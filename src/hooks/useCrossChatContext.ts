/**
 * useCrossChatContext Hook
 * Version: 1.0.0
 * 
 * Hook React para gerenciar o sistema de referência entre chats.
 * Fornece acesso ao toggle, métricas e configuração.
 */

import { useState, useEffect, useCallback } from 'react'
import { getCrossChatService } from '../services/crosschat/CrossChatContext'
import { getIndexStats, clearIndex, rebuildIndex } from '../services/crosschat/EmbeddingIndex'
import type { CrossChatMetrics } from '../services/crosschat/CrossChatTypes'

// ============================================================================
// TIPOS
// ============================================================================

export interface CrossChatState {
    /** Se o sistema está habilitado */
    enabled: boolean

    /** Estatísticas do índice */
    indexStats: {
        totalMessages: number
        totalProcessed: number
        oldestMessage: number | null
        newestMessage: number | null
        lastUpdated: number
    }

    /** Métricas de uso */
    metrics: CrossChatMetrics
}

export interface CrossChatActions {
    /** Habilita ou desabilita o sistema */
    setEnabled: (enabled: boolean) => void

    /** Limpa o índice de embeddings */
    clearIndex: () => void

    /** Reconstrói o índice a partir das conversas */
    rebuildIndex: (conversations: Array<{
        id: string
        messages: Array<{
            id: string
            role: string
            content: string
            timestamp: number
        }>
    }>) => Promise<number>

    /** Reseta as métricas */
    resetMetrics: () => void

    /** Atualiza o estado manualmente */
    refresh: () => void
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useCrossChatContext(): CrossChatState & CrossChatActions {
    const service = getCrossChatService()

    // Estado local
    const [enabled, setEnabledState] = useState(service.isEnabled())
    const [indexStats, setIndexStats] = useState(getIndexStats())
    const [metrics, setMetrics] = useState(service.getMetrics())

    // Refresh do estado
    const refresh = useCallback(() => {
        setEnabledState(service.isEnabled())
        setIndexStats(getIndexStats())
        setMetrics(service.getMetrics())
    }, [service, setEnabledState, setIndexStats, setMetrics])

    // Toggle enabled
    const setEnabled = useCallback((value: boolean) => {
        service.setEnabled(value)
        setEnabledState(value)
    }, [service, setEnabledState])

    // Limpar índice
    const handleClearIndex = useCallback(() => {
        clearIndex()
        refresh()
    }, [refresh])

    // Reconstruir índice
    const handleRebuildIndex = useCallback(async (conversations: Array<{
        id: string
        messages: Array<{
            id: string
            role: string
            content: string
            timestamp: number
        }>
    }>): Promise<number> => {
        const count = await rebuildIndex(conversations)
        refresh()
        return count
    }, [refresh])

    // Reset métricas
    const resetMetrics = useCallback(() => {
        service.resetMetrics()
        refresh()
    }, [service, refresh])

    // Atualizar estado periodicamente
    useEffect(() => {
        const interval = setInterval(refresh, 30000) // A cada 30s
        return () => clearInterval(interval)
    }, [refresh])

    // Sincronizar com storage
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key?.includes('selene_cross_chat') || e.key?.includes('selene_embedding')) {
                refresh()
            }
        }

        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [refresh])

    return {
        enabled,
        indexStats,
        metrics,
        setEnabled,
        clearIndex: handleClearIndex,
        rebuildIndex: handleRebuildIndex,
        resetMetrics,
        refresh
    }
}

export default useCrossChatContext
