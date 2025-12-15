/**
 * Cross-Chat Context Types
 * Version: 1.0.0
 * 
 * Tipos e schemas para o sistema de referência entre chats
 */

// ============================================================================
// TIPOS BÁSICOS
// ============================================================================

/**
 * Representa uma mensagem indexada para busca semântica
 */
export interface IndexedMessage {
    /** ID único da mensagem */
    id: string

    /** ID da conversa de origem */
    conversationId: string

    /** Conteúdo textual da mensagem */
    content: string

    /** Embedding vetorial da mensagem */
    embedding: number[]

    /** Timestamp de quando a mensagem foi criada */
    timestamp: number

    /** Timestamp de quando foi indexada */
    indexedAt: number
}

/**
 * Resultado de uma busca semântica
 */
export interface SearchResult {
    /** Mensagem encontrada */
    message: IndexedMessage

    /** Score de similaridade (0-1) */
    similarity: number

    /** Trecho relevante truncado */
    snippet: string
}

/**
 * Contexto recuperado para injeção no prompt
 */
export interface CrossChatContextData {
    /** Trechos relevantes encontrados */
    snippets: ContextSnippet[]

    /** Total de tokens estimado */
    estimatedTokens: number

    /** Timestamp da busca */
    retrievedAt: number

    /** IDs das conversas de origem */
    sourceConversationIds: string[]
}

/**
 * Trecho individual de contexto
 */
export interface ContextSnippet {
    /** Texto do trecho */
    text: string

    /** Score de relevância */
    relevance: number

    /** ID da conversa de origem */
    conversationId: string

    /** Timestamp da mensagem original */
    originalTimestamp: number
}

// ============================================================================
// ÍNDICE DE EMBEDDINGS
// ============================================================================

/**
 * Estrutura do índice de embeddings persistido
 */
export interface EmbeddingIndex {
    /** Versão do schema do índice */
    version: string

    /** Mensagens indexadas */
    messages: IndexedMessage[]

    /** Timestamp da última atualização */
    lastUpdated: number

    /** Número total de mensagens processadas (incluindo descartadas) */
    totalProcessed: number
}

/**
 * Cache de embeddings para evitar recomputação
 */
export interface EmbeddingCache {
    /** Mapa de hash do conteúdo para embedding */
    entries: Map<string, CacheEntry>

    /** Timestamp da última limpeza */
    lastCleanup: number
}

export interface CacheEntry {
    embedding: number[]
    createdAt: number
    accessCount: number
}

// ============================================================================
// MÉTRICAS
// ============================================================================

export interface CrossChatMetrics {
    /** Total de buscas realizadas */
    totalSearches: number

    /** Total de contextos injetados */
    totalContextsInjected: number

    /** Total de mensagens indexadas */
    totalMessagesIndexed: number

    /** Total de tokens economizados (vs reenviar chats inteiros) */
    tokensOptimized: number

    /** Timestamp da última atualização */
    lastUpdated: number
}

// ============================================================================
// SCHEMAS DE VALIDAÇÃO (usando estrutura manual sem zod por enquanto)
// ============================================================================

/**
 * Valida um IndexedMessage
 */
export function validateIndexedMessage(data: unknown): data is IndexedMessage {
    if (!data || typeof data !== 'object') return false
    const msg = data as Record<string, unknown>

    return (
        typeof msg.id === 'string' &&
        typeof msg.conversationId === 'string' &&
        typeof msg.content === 'string' &&
        Array.isArray(msg.embedding) &&
        typeof msg.timestamp === 'number' &&
        typeof msg.indexedAt === 'number'
    )
}

/**
 * Valida um EmbeddingIndex
 */
export function validateEmbeddingIndex(data: unknown): data is EmbeddingIndex {
    if (!data || typeof data !== 'object') return false
    const idx = data as Record<string, unknown>

    return (
        typeof idx.version === 'string' &&
        Array.isArray(idx.messages) &&
        typeof idx.lastUpdated === 'number' &&
        typeof idx.totalProcessed === 'number'
    )
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createEmptyIndex(): EmbeddingIndex {
    return {
        version: '1.0.0',
        messages: [],
        lastUpdated: Date.now(),
        totalProcessed: 0
    }
}

export function createEmptyMetrics(): CrossChatMetrics {
    return {
        totalSearches: 0,
        totalContextsInjected: 0,
        totalMessagesIndexed: 0,
        tokensOptimized: 0,
        lastUpdated: Date.now()
    }
}

export function createIndexedMessage(
    id: string,
    conversationId: string,
    content: string,
    embedding: number[],
    timestamp: number
): IndexedMessage {
    return {
        id,
        conversationId,
        content,
        embedding,
        timestamp,
        indexedAt: Date.now()
    }
}
