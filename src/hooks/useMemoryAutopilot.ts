/**
 * useMemoryAutopilot Hook
 * Version: 1.0.0
 * 
 * Hook React para gerenciar o sistema de memória automática.
 * Fornece acesso ao toggle, memórias, métricas e ações.
 */

import { useState, useEffect, useCallback } from 'react'
import { getMemoryAutopilot } from '../services/memory/MemoryAutopilot'
import type { AutoMemory, AutopilotMetrics } from '../services/memory/AutoMemoryTypes'

// ============================================================================
// TIPOS
// ============================================================================

export interface MemoryAutopilotState {
    /** Se o autopilot está habilitado */
    enabled: boolean

    /** Memórias automáticas */
    memories: AutoMemory[]

    /** Estatísticas */
    stats: {
        totalMemories: number
        todayCreated: number
        remainingToday: number
        byCategory: Record<string, number>
    }

    /** Métricas de uso */
    metrics: AutopilotMetrics
}

export interface MemoryAutopilotActions {
    /** Habilita ou desabilita o autopilot */
    setEnabled: (enabled: boolean) => void

    /** Remove uma memória automática */
    removeMemory: (id: string) => void

    /** Limpa todas as memórias automáticas */
    clearMemories: () => void

    /** Reseta as métricas */
    resetMetrics: () => void

    /** Atualiza o estado manualmente */
    refresh: () => void
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useMemoryAutopilot(): MemoryAutopilotState & MemoryAutopilotActions {
    const autopilot = getMemoryAutopilot()

    // Estado local
    const [enabled, setEnabledState] = useState(autopilot.isEnabled())
    const [memories, setMemories] = useState(autopilot.getMemories())
    const [stats, setStats] = useState(autopilot.getStats())
    const [metrics, setMetrics] = useState(autopilot.getMetrics())

    // Refresh do estado
    const refresh = useCallback(() => {
        setEnabledState(autopilot.isEnabled())
        setMemories(autopilot.getMemories())
        setStats(autopilot.getStats())
        setMetrics(autopilot.getMetrics())
    }, [autopilot])

    // Toggle enabled
    const setEnabled = useCallback((value: boolean) => {
        autopilot.setEnabled(value)
        setEnabledState(value)
    }, [autopilot])

    // Remover memória
    const removeMemory = useCallback((id: string) => {
        autopilot.removeMemory(id)
        refresh()
    }, [autopilot, refresh])

    // Limpar memórias
    const clearMemories = useCallback(() => {
        autopilot.clearMemories()
        refresh()
    }, [autopilot, refresh])

    // Reset métricas
    const resetMetrics = useCallback(() => {
        autopilot.resetMetrics()
        refresh()
    }, [autopilot, refresh])

    // Atualizar estado periodicamente
    useEffect(() => {
        const interval = setInterval(refresh, 30000) // A cada 30s
        return () => clearInterval(interval)
    }, [refresh])

    // Sincronizar com storage
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key?.includes('selene_auto_memories') || e.key?.includes('selene_memory_autopilot')) {
                refresh()
            }
        }

        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [refresh])

    return {
        enabled,
        memories,
        stats,
        metrics,
        setEnabled,
        removeMemory,
        clearMemories,
        resetMetrics,
        refresh
    }
}

export default useMemoryAutopilot
