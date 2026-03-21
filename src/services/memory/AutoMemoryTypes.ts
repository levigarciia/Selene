/**
 * Memory Autopilot Types
 * Version: 1.0.0
 * 
 * Tipos e schemas para o sistema de memória automática
 */

import type { MemoryCategory } from '../../config/memoryConfig'
import { MEMORY_CATEGORIES } from '../../config/memoryConfig'

// ============================================================================
// TIPOS BÁSICOS
// ============================================================================

/**
 * Memória automática extraída pelo autopilot
 */
export interface AutoMemory {
    /** ID único da memória */
    id: string

    /** Categoria da memória */
    category: MemoryCategory

    /** Texto curto e objetivo */
    text: string

    /** Tags para busca */
    tags: string[]

    /** Score de confiança (0-1) */
    confidence: number

    /** ID da mensagem de origem */
    sourceMessageId: string

    /** ID da conversa de origem */
    sourceConversationId: string

    /** ID do projeto de origem (opcional para conversas globais) */
    sourceProjectId?: string

    /** Data de extração */
    createdAt: number

    /** Data da última atualização */
    updatedAt: number

    /** Número de vezes que foi reforçada/vista novamente */
    reinforcementCount: number

    /** Se é uma memória automática (vs manual) */
    isAutomatic: boolean

    /** Embedding para deduplicação (opcional, calculado sob demanda) */
    embedding?: number[]
}

/**
 * Resultado da extração de memórias
 */
export interface ExtractionResult {
    /** Memórias extraídas */
    memories: ExtractedMemory[]

    /** Métricas da extração */
    metrics: ExtractionMetrics
}

/**
 * Memória antes de ser processada/salva
 */
export interface ExtractedMemory {
    category: MemoryCategory
    text: string
    tags: string[]
    confidence: number
    reasoning: string
}

/**
 * Métricas de uma extração
 */
export interface ExtractionMetrics {
    /** Total de memórias candidatas geradas */
    generated: number

    /** Total salvo após filtros */
    saved: number

    /** Descartadas por baixa confiança */
    discardedLowConfidence: number

    /** Descartadas por deduplicação */
    discardedDuplicate: number

    /** Descartadas por categoria bloqueada */
    discardedBlacklisted: number

    /** Descartadas por limite diário */
    discardedDailyLimit: number

    /** Atualizações de memórias existentes */
    updated: number

    /** Tempo de processamento em ms */
    processingTimeMs: number
}

// ============================================================================
// ESTADO DO AUTOPILOT
// ============================================================================

export interface AutopilotState {
    /** Se o autopilot está habilitado */
    enabled: boolean

    /** Memórias automáticas salvas */
    memories: AutoMemory[]

    /** Contagem de memórias criadas hoje */
    dailyCount: number

    /** Data do último reset do contador diário */
    lastResetDate: string

    /** Métricas acumuladas */
    metrics: AutopilotMetrics
}

export interface AutopilotMetrics {
    /** Total de memórias geradas (histórico) */
    totalGenerated: number

    /** Total de memórias salvas (histórico) */
    totalSaved: number

    /** Total descartadas */
    totalDiscarded: number

    /** Total de deduplicações */
    totalDeduplicated: number

    /** Última atualização */
    lastUpdated: number
}

// ============================================================================
// RESPOSTA DO LLM
// ============================================================================

/**
 * Schema de resposta esperada do LLM para extração
 */
export interface LLMExtractionResponse {
    memories: Array<{
        category: string
        text: string
        tags: string[]
        confidence: number
        reasoning: string
    }>
}

/**
 * Schema de resposta para refinamento de memória
 */
export interface LLMRefinementResponse {
    action: 'update' | 'replace' | 'ignore'
    updatedText?: string
    confidence: number
    reasoning: string
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

const validCategories = Object.values(MEMORY_CATEGORIES)

export function validateExtractedMemory(data: unknown): data is ExtractedMemory {
    if (!data || typeof data !== 'object') return false
    const mem = data as Record<string, unknown>

    return (
        typeof mem.category === 'string' &&
        validCategories.includes(mem.category as MemoryCategory) &&
        typeof mem.text === 'string' &&
        mem.text.length > 0 &&
        mem.text.length <= 200 &&
        Array.isArray(mem.tags) &&
        mem.tags.every(t => typeof t === 'string') &&
        typeof mem.confidence === 'number' &&
        mem.confidence >= 0 &&
        mem.confidence <= 1
    )
}

export function validateLLMExtractionResponse(data: unknown): data is LLMExtractionResponse {
    if (!data || typeof data !== 'object') return false
    const resp = data as Record<string, unknown>

    if (!Array.isArray(resp.memories)) return false

    return resp.memories.every(mem => {
        if (!mem || typeof mem !== 'object') return false
        const m = mem as Record<string, unknown>
        return (
            typeof m.category === 'string' &&
            typeof m.text === 'string' &&
            Array.isArray(m.tags) &&
            typeof m.confidence === 'number'
        )
    })
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createEmptyState(): AutopilotState {
    return {
        enabled: true,
        memories: [],
        dailyCount: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        metrics: createEmptyMetrics()
    }
}

export function createEmptyMetrics(): AutopilotMetrics {
    return {
        totalGenerated: 0,
        totalSaved: 0,
        totalDiscarded: 0,
        totalDeduplicated: 0,
        lastUpdated: Date.now()
    }
}

export function createAutoMemory(
    extracted: ExtractedMemory,
    sourceMessageId: string,
    sourceConversationId: string,
    sourceProjectId?: string
): AutoMemory {
    const id = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
        id,
        category: extracted.category as MemoryCategory,
        text: extracted.text,
        tags: extracted.tags,
        confidence: extracted.confidence,
        sourceMessageId,
        sourceConversationId,
        sourceProjectId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reinforcementCount: 1,
        isAutomatic: true
    }
}

export function createExtractionMetrics(): ExtractionMetrics {
    return {
        generated: 0,
        saved: 0,
        discardedLowConfidence: 0,
        discardedDuplicate: 0,
        discardedBlacklisted: 0,
        discardedDailyLimit: 0,
        updated: 0,
        processingTimeMs: 0
    }
}
