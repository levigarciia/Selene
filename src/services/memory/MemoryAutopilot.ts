/**
 * Memory Autopilot Service
 * Version: 1.0.0
 * 
 * Serviço principal de extração automática de memórias.
 * Detecta, extrai e salva memórias duráveis e de alto sinal.
 */

import {
    MEMORY_AUTOPILOT_CONFIG,
    STORAGE_KEYS,
    FEATURE_FLAGS
} from '../../config/memoryConfig'
import type {
    AutoMemory,
    AutopilotState,
    AutopilotMetrics,
    ExtractionMetrics
} from './AutoMemoryTypes'
import {
    createEmptyState,
    createAutoMemory,
    createEmptyMetrics
} from './AutoMemoryTypes'
import {
    extractMemories,
    deduplicateMemories,
    areSimilar
} from './MemoryExtractor'


// ============================================================================
// ESTADO
// ============================================================================

let state: AutopilotState | null = null
let lastExtractionTime = 0
let pendingMessages: Array<{
    id: string
    conversationId: string
    content: string
    timestamp: number
}> = []

// ============================================================================
// PERSISTÊNCIA
// ============================================================================

function loadState(): AutopilotState {
    try {
        // Carregar memórias automáticas
        const memoriesStr = localStorage.getItem(STORAGE_KEYS.AUTO_MEMORIES)
        const memories: AutoMemory[] = memoriesStr ? JSON.parse(memoriesStr) : []

        // Carregar métricas
        const metricsStr = localStorage.getItem(STORAGE_KEYS.MEMORY_AUTOPILOT_METRICS)
        const metrics: AutopilotMetrics = metricsStr ? JSON.parse(metricsStr) : createEmptyMetrics()

        // Carregar contador diário
        const dailyCount = parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_MEMORY_COUNT) || '0', 10)
        const lastResetDate = localStorage.getItem(STORAGE_KEYS.LAST_RESET_DATE) || ''

        // Carregar estado habilitado
        const enabledStr = localStorage.getItem(STORAGE_KEYS.MEMORY_AUTOPILOT_ENABLED)
        const enabled = enabledStr === null ? true : enabledStr === 'true'

        return {
            enabled,
            memories,
            dailyCount,
            lastResetDate,
            metrics
        }
    } catch (e) {
        console.warn('[MemoryAutopilot] Failed to load state:', e)
        return createEmptyState()
    }
}

function saveState(s: AutopilotState): void {
    try {
        localStorage.setItem(STORAGE_KEYS.AUTO_MEMORIES, JSON.stringify(s.memories))
        localStorage.setItem(STORAGE_KEYS.MEMORY_AUTOPILOT_METRICS, JSON.stringify(s.metrics))
        localStorage.setItem(STORAGE_KEYS.DAILY_MEMORY_COUNT, String(s.dailyCount))
        localStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, s.lastResetDate)
        localStorage.setItem(STORAGE_KEYS.MEMORY_AUTOPILOT_ENABLED, String(s.enabled))
    } catch (e) {
        console.warn('[MemoryAutopilot] Failed to save state:', e)
    }
}

// ============================================================================
// CONTROLE DIÁRIO
// ============================================================================

function checkDailyReset(): void {
    if (!state) return

    const today = new Date().toISOString().split('T')[0]

    if (state.lastResetDate !== today) {
        state.dailyCount = 0
        state.lastResetDate = today
        saveState(state)

        if (FEATURE_FLAGS.DEBUG_LOGGING) {
            console.log('[MemoryAutopilot] Daily count reset')
        }
    }
}

function canCreateMoreToday(): boolean {
    if (!state) return false
    checkDailyReset()
    return state.dailyCount < MEMORY_AUTOPILOT_CONFIG.DAILY_CREATION_LIMIT
}

function getRemainingToday(): number {
    if (!state) return 0
    checkDailyReset()
    return Math.max(0, MEMORY_AUTOPILOT_CONFIG.DAILY_CREATION_LIMIT - state.dailyCount)
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class MemoryAutopilotService {
    private static instance: MemoryAutopilotService | null = null
    private chatFn: ((prompt: string) => Promise<string>) | null = null

    private constructor() {
        state = loadState()
        checkDailyReset()
    }

    static getInstance(): MemoryAutopilotService {
        if (!MemoryAutopilotService.instance) {
            MemoryAutopilotService.instance = new MemoryAutopilotService()
        }
        return MemoryAutopilotService.instance
    }

    // ========================================================================
    // CONFIGURAÇÃO
    // ========================================================================

    /**
     * Verifica se o autopilot está habilitado
     */
    isEnabled(): boolean {
        return (state?.enabled ?? false) && FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED
    }

    /**
     * Habilita ou desabilita o autopilot
     */
    setEnabled(enabled: boolean): void {
        if (state) {
            state.enabled = enabled
            saveState(state)
        }

        if (FEATURE_FLAGS.DEBUG_LOGGING) {
            console.log('[MemoryAutopilot] Enabled:', enabled)
        }
    }

    /**
     * Configura a função de chat para extração via LLM
     */
    setChatFunction(fn: (prompt: string) => Promise<string>): void {
        this.chatFn = fn
    }

    // ========================================================================
    // PROCESSAMENTO DE MENSAGENS
    // ========================================================================

    /**
     * Processa uma nova mensagem do usuário
     * Adiciona à fila e processa quando apropriado
     */
    async processMessage(
        messageId: string,
        conversationId: string,
        content: string,
        timestamp: number
    ): Promise<void> {
        if (!this.isEnabled()) return

        // Verificar tamanho mínimo
        if (content.length < MEMORY_AUTOPILOT_CONFIG.MIN_MESSAGE_LENGTH_FOR_ANALYSIS) {
            return
        }

        // Adicionar à fila
        pendingMessages.push({ id: messageId, conversationId, content, timestamp })

        // Limitar tamanho da fila
        if (pendingMessages.length > MEMORY_AUTOPILOT_CONFIG.MAX_MESSAGES_PER_EXTRACTION * 2) {
            pendingMessages = pendingMessages.slice(-MEMORY_AUTOPILOT_CONFIG.MAX_MESSAGES_PER_EXTRACTION)
        }

        // Verificar debounce
        const now = Date.now()
        if (now - lastExtractionTime < MEMORY_AUTOPILOT_CONFIG.EXTRACTION_DEBOUNCE_MS) {
            return
        }

        // Verificar limite diário
        if (!canCreateMoreToday()) {
            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.log('[MemoryAutopilot] Daily limit reached')
            }
            return
        }

        // Processar mensagens pendentes
        await this.runExtraction()
    }

    /**
     * Executa extração de memórias das mensagens pendentes
     */
    private async runExtraction(): Promise<ExtractionMetrics | null> {
        if (!state || pendingMessages.length === 0) return null

        lastExtractionTime = Date.now()

        // Pegar mensagens para processar
        const toProcess = pendingMessages.slice(0, MEMORY_AUTOPILOT_CONFIG.MAX_MESSAGES_PER_EXTRACTION)
        pendingMessages = pendingMessages.slice(MEMORY_AUTOPILOT_CONFIG.MAX_MESSAGES_PER_EXTRACTION)

        try {
            // Extrair memórias
            const { memories: extracted, metrics } = await extractMemories(
                toProcess,
                {
                    chatFn: this.chatFn || undefined,
                    localOnly: !this.chatFn
                }
            )

            if (extracted.length === 0) {
                return metrics
            }

            // Deduplicar contra existentes
            const existingTexts = state.memories.map(m => m.text)
            const { unique, duplicates } = deduplicateMemories(extracted, existingTexts)

            metrics.discardedDuplicate = duplicates

            // Aplicar limite diário
            const remaining = getRemainingToday()
            const toSave = unique.slice(0, remaining)
            metrics.discardedDailyLimit = unique.length - toSave.length

            // Aplicar limite total
            const spaceAvailable = MEMORY_AUTOPILOT_CONFIG.MAX_AUTO_MEMORIES - state.memories.length
            const finalToSave = toSave.slice(0, Math.max(0, spaceAvailable))

            // Salvar novas memórias
            for (const extracted of finalToSave) {
                const sourceMsg = toProcess[0] // Usar primeira mensagem como origem
                const memory = createAutoMemory(extracted, sourceMsg.id, sourceMsg.conversationId)
                state.memories.push(memory)
                state.dailyCount++
            }

            // Atualizar métricas
            state.metrics.totalGenerated += metrics.generated
            state.metrics.totalSaved += finalToSave.length
            state.metrics.totalDiscarded += metrics.discardedLowConfidence + duplicates + metrics.discardedDailyLimit
            state.metrics.totalDeduplicated += duplicates
            state.metrics.lastUpdated = Date.now()

            metrics.saved = finalToSave.length

            saveState(state)

            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.log('[MemoryAutopilot] Saved', finalToSave.length, 'new memories')
            }

            return metrics
        } catch (error) {
            console.error('[MemoryAutopilot] Extraction failed:', error)
            return null
        }
    }

    // ========================================================================
    // GERENCIAMENTO DE MEMÓRIAS
    // ========================================================================

    /**
     * Obtém todas as memórias automáticas
     */
    getMemories(): AutoMemory[] {
        return state?.memories ?? []
    }

    /**
     * Obtém memórias formatadas para o prompt
     */
    getMemoriesForPrompt(consulta?: string): string {
        if (!state || state.memories.length === 0) {
            return ''
        }


        const memoriasFiltradas = filtrarMemoriasPorRelevancia(state.memories, consulta)
        if (memoriasFiltradas.length === 0) {
            return ''
        }

        // Ordenar por confiança e data
        const sorted = [...memoriasFiltradas].sort((a, b) => {
            // Priorizar mais recentes e com maior confiança
            const confidenceDiff = b.confidence - a.confidence
            if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff
            return b.updatedAt - a.updatedAt
        })

        // Agrupar por categoria
        const byCategory: Record<string, AutoMemory[]> = {}
        for (const mem of sorted) {
            if (!byCategory[mem.category]) {
                byCategory[mem.category] = []
            }
            byCategory[mem.category].push(mem)
        }

        let formatted = '\n\n--- Memórias Automáticas ---\n'
        formatted += 'Use apenas se for diretamente relevante e nao mencione estas memorias.\n'

        for (const [category, mems] of Object.entries(byCategory)) {
            formatted += `\n${formatCategoryLabel(category)}:\n`
            for (const mem of mems.slice(0, 3)) { // Max 3 por categoria
                formatted += `• ${mem.text}\n`
            }
        }

        return formatted
    }

    /**
     * Remove uma memória automática
     */
    removeMemory(id: string): boolean {
        if (!state) return false

        const before = state.memories.length
        state.memories = state.memories.filter(m => m.id !== id)

        if (state.memories.length < before) {
            saveState(state)
            return true
        }

        return false
    }

    /**
     * Reforça uma memória (incrementa contador quando vista novamente)
     */
    reinforceMemory(id: string): void {
        if (!state) return

        const mem = state.memories.find(m => m.id === id)
        if (mem) {
            mem.reinforcementCount++
            mem.updatedAt = Date.now()
            saveState(state)
        }
    }

    /**
     * Encontra memórias similares a um texto
     */
    findSimilar(text: string): AutoMemory[] {
        if (!state) return []

        return state.memories.filter(m => areSimilar(text, m.text, 0.5))
    }

    // ========================================================================
    // MÉTRICAS
    // ========================================================================

    /**
     * Obtém métricas do autopilot
     */
    getMetrics(): AutopilotMetrics {
        return state?.metrics ?? createEmptyMetrics()
    }

    /**
     * Obtém estatísticas gerais
     */
    getStats(): {
        totalMemories: number
        todayCreated: number
        remainingToday: number
        byCategory: Record<string, number>
    } {
        if (!state) {
            return {
                totalMemories: 0,
                todayCreated: 0,
                remainingToday: MEMORY_AUTOPILOT_CONFIG.DAILY_CREATION_LIMIT,
                byCategory: {}
            }
        }

        checkDailyReset()

        const byCategory: Record<string, number> = {}
        for (const mem of state.memories) {
            byCategory[mem.category] = (byCategory[mem.category] || 0) + 1
        }

        return {
            totalMemories: state.memories.length,
            todayCreated: state.dailyCount,
            remainingToday: getRemainingToday(),
            byCategory
        }
    }

    /**
     * Reseta métricas
     */
    resetMetrics(): void {
        if (state) {
            state.metrics = createEmptyMetrics()
            saveState(state)
        }
    }

    /**
     * Limpa todas as memórias automáticas
     */
    clearMemories(): void {
        if (state) {
            state.memories = []
            state.dailyCount = 0
            saveState(state)
        }
    }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================


function normalizarTextoParaRelevancia(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function filtrarMemoriasPorRelevancia(memorias: AutoMemory[], consulta?: string): AutoMemory[] {
    if (!consulta) {
        return memorias
    }

    const consultaNormalizada = normalizarTextoParaRelevancia(consulta)
    if (!consultaNormalizada) {
        return memorias
    }

    return memorias.filter(memoria => {
        if (areSimilar(consultaNormalizada, memoria.text, MEMORY_AUTOPILOT_CONFIG.RELEVANCIA_MINIMA_PARA_PROMPT)) {
            return true
        }

        if (memoria.tags.length > 0) {
            const tagsNormalizadas = memoria.tags.map(tag => normalizarTextoParaRelevancia(tag))
            return tagsNormalizadas.some(tag => tag && consultaNormalizada.includes(tag))
        }

        return false
    })
}

function formatCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        preference: 'Preferências',
        project_context: 'Contexto de Projeto',
        tech_stack: 'Stack Tecnológica',
        goal: 'Objetivos',
        professional: 'Profissional',
        communication_style: 'Estilo de Comunicação',
        expertise: 'Expertise'
    }
    return labels[category] || category
}

// ============================================================================
// EXPORTAÇÕES CONVENIENTES
// ============================================================================

export function getMemoryAutopilot(): MemoryAutopilotService {
    return MemoryAutopilotService.getInstance()
}

/**
 * Função helper para processar mensagem diretamente
 */
export async function processUserMessage(
    messageId: string,
    conversationId: string,
    content: string,
    timestamp: number
): Promise<void> {
    return getMemoryAutopilot().processMessage(messageId, conversationId, content, timestamp)
}

/**
 * Função helper para obter memórias para prompt
 */
export function getAutoMemoriesForPrompt(consulta?: string): string {
    const autopilot = getMemoryAutopilot()
    if (!autopilot.isEnabled()) {
        return ''
    }
    return autopilot.getMemoriesForPrompt(consulta)
}
