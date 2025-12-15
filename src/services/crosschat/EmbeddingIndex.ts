/**
 * Embedding Index
 * Version: 1.0.0
 * 
 * Índice incremental de embeddings para busca semântica rápida.
 * Armazena mensagens indexadas e permite busca por similaridade.
 */

import {
    CROSS_CHAT_CONFIG,
    STORAGE_KEYS,
    FEATURE_FLAGS
} from '../../config/memoryConfig'
import type {
    EmbeddingIndex,
    SearchResult
} from './CrossChatTypes'
import {
    createEmptyIndex,
    createIndexedMessage,
    validateEmbeddingIndex
} from './CrossChatTypes'
import { getEmbeddingService } from './EmbeddingService'

// ============================================================================
// ESTADO
// ============================================================================

let currentIndex: EmbeddingIndex | null = null
let isDirty = false
let lastSaveTime = 0

// ============================================================================
// PERSISTÊNCIA
// ============================================================================

function loadIndex(): EmbeddingIndex {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.EMBEDDING_INDEX)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (validateEmbeddingIndex(parsed)) {
                if (FEATURE_FLAGS.DEBUG_LOGGING) {
                    console.log('[EmbeddingIndex] Loaded index with', parsed.messages.length, 'messages')
                }
                return parsed
            }
        }
    } catch (e) {
        console.warn('[EmbeddingIndex] Failed to load index:', e)
    }
    return createEmptyIndex()
}

function saveIndex(index: EmbeddingIndex): void {
    try {
        localStorage.setItem(STORAGE_KEYS.EMBEDDING_INDEX, JSON.stringify(index))
        lastSaveTime = Date.now()
        isDirty = false

        if (FEATURE_FLAGS.DEBUG_LOGGING) {
            console.log('[EmbeddingIndex] Saved index with', index.messages.length, 'messages')
        }
    } catch (e) {
        console.warn('[EmbeddingIndex] Failed to save index:', e)
    }
}

// ============================================================================
// LIMPEZA E MANUTENÇÃO
// ============================================================================

/**
 * Remove mensagens antigas e mantém o índice dentro do limite
 */
function pruneIndex(index: EmbeddingIndex): EmbeddingIndex {
    const now = Date.now()
    const maxAge = CROSS_CHAT_CONFIG.MAX_MESSAGE_AGE_DAYS * 24 * 60 * 60 * 1000

    // 1. Remover mensagens antigas
    let messages = index.messages.filter(msg => {
        return now - msg.timestamp < maxAge
    })

    // 2. Manter apenas as mais recentes se exceder limite
    if (messages.length > CROSS_CHAT_CONFIG.MAX_INDEX_SIZE) {
        messages.sort((a, b) => b.timestamp - a.timestamp)
        messages = messages.slice(0, CROSS_CHAT_CONFIG.MAX_INDEX_SIZE)
    }

    return {
        ...index,
        messages,
        lastUpdated: now
    }
}

// ============================================================================
// API PRINCIPAL
// ============================================================================

/**
 * Obtém o índice atual (carrega se necessário)
 */
export function getIndex(): EmbeddingIndex {
    if (!currentIndex) {
        currentIndex = loadIndex()
    }
    return currentIndex
}

/**
 * Adiciona uma mensagem ao índice
 */
export async function indexMessage(
    messageId: string,
    conversationId: string,
    content: string,
    timestamp: number
): Promise<boolean> {
    // Validar tamanho mínimo
    if (content.length < CROSS_CHAT_CONFIG.MIN_MESSAGE_LENGTH) {
        if (FEATURE_FLAGS.DEBUG_LOGGING) {
            console.log('[EmbeddingIndex] Message too short, skipping:', content.length)
        }
        return false
    }

    const index = getIndex()

    // Verificar se já existe
    if (index.messages.some(m => m.id === messageId)) {
        return false
    }

    // Gerar embedding
    const embeddingService = getEmbeddingService()
    const embedding = await embeddingService.generateEmbedding(content)

    // Criar mensagem indexada
    const indexed = createIndexedMessage(
        messageId,
        conversationId,
        content,
        embedding,
        timestamp
    )

    // Adicionar ao índice
    index.messages.push(indexed)
    index.totalProcessed++
    index.lastUpdated = Date.now()

    // Marcar como sujo
    isDirty = true
    currentIndex = index

    // Salvar periodicamente
    if (Date.now() - lastSaveTime > 30000) { // A cada 30 segundos
        saveIndex(pruneIndex(index))
    }

    return true
}

/**
 * Indexa múltiplas mensagens de uma vez
 */
export async function indexMessages(
    messages: Array<{
        id: string
        conversationId: string
        content: string
        timestamp: number
    }>
): Promise<number> {
    let indexed = 0

    for (const msg of messages) {
        const success = await indexMessage(
            msg.id,
            msg.conversationId,
            msg.content,
            msg.timestamp
        )
        if (success) indexed++
    }

    // Forçar salvamento após batch
    if (indexed > 0 && currentIndex) {
        saveIndex(pruneIndex(currentIndex))
    }

    return indexed
}

/**
 * Busca mensagens similares a uma query
 */
export async function searchSimilar(
    query: string,
    excludeConversationId?: string,
    limit: number = CROSS_CHAT_CONFIG.MAX_SEARCH_RESULTS
): Promise<SearchResult[]> {
    const index = getIndex()

    if (index.messages.length === 0) {
        return []
    }

    const embeddingService = getEmbeddingService()
    const queryEmbedding = await embeddingService.generateEmbedding(query)

    // Calcular similaridade para todas as mensagens
    const results: SearchResult[] = []

    for (const msg of index.messages) {
        // Excluir conversa atual
        if (excludeConversationId && msg.conversationId === excludeConversationId) {
            continue
        }

        const similarity = embeddingService.cosineSimilarity(queryEmbedding, msg.embedding)

        if (similarity >= CROSS_CHAT_CONFIG.SIMILARITY_THRESHOLD) {
            // Criar snippet truncado
            let snippet = msg.content
            if (snippet.length > CROSS_CHAT_CONFIG.MAX_SNIPPET_LENGTH) {
                snippet = snippet.slice(0, CROSS_CHAT_CONFIG.MAX_SNIPPET_LENGTH) + '...'
            }

            results.push({
                message: msg,
                similarity,
                snippet
            })
        }
    }

    // Ordenar por similaridade decrescente
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, limit)
}

/**
 * Remove mensagens de uma conversa específica
 */
export function removeConversation(conversationId: string): number {
    const index = getIndex()
    const before = index.messages.length

    index.messages = index.messages.filter(m => m.conversationId !== conversationId)
    index.lastUpdated = Date.now()

    currentIndex = index
    saveIndex(index)

    return before - index.messages.length
}

/**
 * Força salvamento do índice
 */
export function flushIndex(): void {
    if (currentIndex && isDirty) {
        saveIndex(pruneIndex(currentIndex))
    }
}

/**
 * Reconstrói o índice a partir das conversas
 */
export async function rebuildIndex(
    conversations: Array<{
        id: string
        messages: Array<{
            id: string
            role: string
            content: string
            timestamp: number
        }>
    }>
): Promise<number> {
    // Criar novo índice vazio
    currentIndex = createEmptyIndex()

    // Indexar apenas mensagens do usuário
    const messagesToIndex: Array<{
        id: string
        conversationId: string
        content: string
        timestamp: number
    }> = []

    for (const conv of conversations) {
        for (const msg of conv.messages) {
            if (msg.role === 'user' && msg.content.length >= CROSS_CHAT_CONFIG.MIN_MESSAGE_LENGTH) {
                messagesToIndex.push({
                    id: msg.id,
                    conversationId: conv.id,
                    content: msg.content,
                    timestamp: msg.timestamp
                })
            }
        }
    }

    return indexMessages(messagesToIndex)
}

/**
 * Obtém estatísticas do índice
 */
export function getIndexStats(): {
    totalMessages: number
    totalProcessed: number
    oldestMessage: number | null
    newestMessage: number | null
    lastUpdated: number
} {
    const index = getIndex()

    let oldest: number | null = null
    let newest: number | null = null

    for (const msg of index.messages) {
        if (oldest === null || msg.timestamp < oldest) oldest = msg.timestamp
        if (newest === null || msg.timestamp > newest) newest = msg.timestamp
    }

    return {
        totalMessages: index.messages.length,
        totalProcessed: index.totalProcessed,
        oldestMessage: oldest,
        newestMessage: newest,
        lastUpdated: index.lastUpdated
    }
}

/**
 * Limpa todo o índice
 */
export function clearIndex(): void {
    currentIndex = createEmptyIndex()
    saveIndex(currentIndex)
}
