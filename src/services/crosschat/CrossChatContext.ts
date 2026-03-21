/**
 * Cross-Chat Context Service
 * Version: 1.0.0
 * 
 * Serviço principal para referência entre chats.
 * Recupera contexto relevante de conversas anteriores de forma discreta.
 */

import {
    CROSS_CHAT_CONFIG,
    STORAGE_KEYS,
    FEATURE_FLAGS
} from '../../config/memoryConfig'
import type {
    CrossChatContextData,
    ContextSnippet,
    CrossChatMetrics
} from './CrossChatTypes'
import { createEmptyMetrics as createEmptyCCMetrics } from './CrossChatTypes'
import { getEmbeddingService, estimateTokens } from './EmbeddingService'
import {
    searchSimilar,
    indexMessage,
    getIndexStats,
    flushIndex
} from './EmbeddingIndex'

// ============================================================================
// ESTADO
// ============================================================================

let metrics: CrossChatMetrics | null = null
let isEnabled = true

// ============================================================================
// PERSISTÊNCIA DE CONFIGURAÇÃO
// ============================================================================

function loadEnabled(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CROSS_CHAT_ENABLED)
        if (stored !== null) {
            return stored === 'true'
        }
    } catch (e) {
        console.warn('[CrossChatContext] Failed to load enabled state:', e)
    }
    return true // Habilitado por padrão
}

function saveEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEYS.CROSS_CHAT_ENABLED, String(enabled))
    } catch (e) {
        console.warn('[CrossChatContext] Failed to save enabled state:', e)
    }
}

function loadMetrics(): CrossChatMetrics {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CROSS_CHAT_METRICS)
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (e) {
        console.warn('[CrossChatContext] Failed to load metrics:', e)
    }
    return createEmptyCCMetrics()
}

function saveMetrics(m: CrossChatMetrics): void {
    try {
        localStorage.setItem(STORAGE_KEYS.CROSS_CHAT_METRICS, JSON.stringify(m))
    } catch (e) {
        console.warn('[CrossChatContext] Failed to save metrics:', e)
    }
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class CrossChatContextService {
    private static instance: CrossChatContextService | null = null

    private constructor() {
        isEnabled = loadEnabled()
        metrics = loadMetrics()
    }

    static getInstance(): CrossChatContextService {
        if (!CrossChatContextService.instance) {
            CrossChatContextService.instance = new CrossChatContextService()
        }
        return CrossChatContextService.instance
    }

    // ========================================================================
    // CONFIGURAÇÃO
    // ========================================================================

    /**
     * Verifica se o serviço está habilitado
     */
    isEnabled(): boolean {
        return isEnabled && FEATURE_FLAGS.CROSS_CHAT_CONTEXT_ENABLED
    }

    /**
     * Habilita ou desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        isEnabled = enabled
        saveEnabled(enabled)

        if (FEATURE_FLAGS.DEBUG_LOGGING) {
            console.log('[CrossChatContext] Enabled:', enabled)
        }
    }

    /**
     * Configura a API key para embeddings
     */
    setApiKey(key: string): void {
        getEmbeddingService().setApiKey(key)
    }

    // ========================================================================
    // INDEXAÇÃO
    // ========================================================================

    /**
     * Indexa uma nova mensagem do usuário
     */
    async indexUserMessage(
        messageId: string,
        conversationId: string,
        content: string,
        timestamp: number,
        projectId?: string
    ): Promise<boolean> {
        if (!this.isEnabled()) return false

        // Apenas mensagens do usuário, acima do tamanho mínimo
        if (content.length < CROSS_CHAT_CONFIG.MIN_MESSAGE_LENGTH) {
            return false
        }

        const success = await indexMessage(messageId, conversationId, content, timestamp, projectId)

        if (success && metrics) {
            metrics.totalMessagesIndexed++
            metrics.lastUpdated = Date.now()
            saveMetrics(metrics)
        }

        return success
    }

    // ========================================================================
    // RECUPERAÇÃO DE CONTEXTO
    // ========================================================================

    /**
     * Recupera contexto relevante para uma query
     * Este é o método principal usado no pipeline de prompt
     */
    async getRelevantContext(
        query: string,
        currentConversationId?: string,
        currentProjectId?: string
    ): Promise<CrossChatContextData | null> {
        if (!this.isEnabled()) return null

        try {
            // Buscar mensagens similares
            const results = await searchSimilar(
                query,
                currentConversationId,
                currentProjectId,
                CROSS_CHAT_CONFIG.MAX_SEARCH_RESULTS
            )

            if (results.length === 0) {
                return null
            }

            // Converter para snippets
            const snippets: ContextSnippet[] = []
            let totalTokens = 0
            const sourceConvIds = new Set<string>()

            for (const result of results) {
                // Verificar limite de tokens
                const snippetTokens = estimateTokens(result.snippet)
                if (totalTokens + snippetTokens > CROSS_CHAT_CONFIG.MAX_CONTEXT_TOKENS) {
                    break
                }

                // Verificar limite de snippets
                if (snippets.length >= CROSS_CHAT_CONFIG.MAX_CONTEXT_SNIPPETS) {
                    break
                }

                snippets.push({
                    text: result.snippet,
                    relevance: result.similarity,
                    conversationId: result.message.conversationId,
                    originalTimestamp: result.message.timestamp
                })

                totalTokens += snippetTokens
                sourceConvIds.add(result.message.conversationId)
            }

            if (snippets.length === 0) {
                return null
            }

            // Atualizar métricas
            if (metrics) {
                metrics.totalSearches++
                metrics.totalContextsInjected++
                metrics.tokensOptimized += totalTokens * 10 // Aproximação de economia
                metrics.lastUpdated = Date.now()
                saveMetrics(metrics)
            }

            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.log('[CrossChatContext] Retrieved', snippets.length, 'snippets,', totalTokens, 'tokens')
            }

            return {
                snippets,
                estimatedTokens: totalTokens,
                retrievedAt: Date.now(),
                sourceConversationIds: Array.from(sourceConvIds)
            }
        } catch (error) {
            console.error('[CrossChatContext] Error retrieving context:', error)
            return null
        }
    }

    /**
     * Formata o contexto para injeção no prompt
     * Formato discreto, sem expor detalhes desnecessários
     */
    formatContextForPrompt(context: CrossChatContextData): string {
        if (context.snippets.length === 0) {
            return ''
        }

        let formatted = '\n\n--- Contexto de conversas anteriores ---\n'
        formatted += 'Use apenas se for diretamente relevante e nao mencione que veio de outras conversas.\n'
        formatted += 'O usuário já mencionou os seguintes tópicos relevantes:\n'

        for (const snippet of context.snippets) {
            // Formato limpo, sem expor IDs ou datas
            formatted += `• ${snippet.text}\n`
        }

        return formatted
    }

    // ========================================================================
    // MÉTRICAS E ESTATÍSTICAS
    // ========================================================================

    /**
     * Obtém métricas do serviço
     */
    getMetrics(): CrossChatMetrics {
        if (!metrics) {
            metrics = loadMetrics()
        }
        return { ...metrics }
    }

    /**
     * Obtém estatísticas do índice
     */
    getIndexStats() {
        return getIndexStats()
    }

    /**
     * Reseta métricas
     */
    resetMetrics(): void {
        metrics = createEmptyCCMetrics()
        saveMetrics(metrics)
    }

    // ========================================================================
    // LIMPEZA
    // ========================================================================

    /**
     * Força salvamento de dados pendentes
     */
    flush(): void {
        flushIndex()
    }
}

// ============================================================================
// EXPORTAÇÕES CONVENIENTES
// ============================================================================

export function getCrossChatService(): CrossChatContextService {
    return CrossChatContextService.getInstance()
}

/**
 * Função helper para uso direto no pipeline de prompt
 */
export async function getContextForPrompt(
    query: string,
    currentConversationId?: string,
    currentProjectId?: string
): Promise<string> {
    const service = getCrossChatService()

    if (!service.isEnabled()) {
        return ''
    }

    const context = await service.getRelevantContext(query, currentConversationId, currentProjectId)

    if (!context) {
        return ''
    }

    return service.formatContextForPrompt(context)
}
