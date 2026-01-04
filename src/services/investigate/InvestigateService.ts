/**
 * Investigate Service
 * 
 * Implements a 4-phase deliberative research pipeline:
 * 1. Decomposition - Break complex question into sub-questions
 * 2. Collection - Gather information for each sub-question using tools
 * 3. Validation - Cross-check and validate findings
 * 4. Synthesis - Generate comprehensive answer with confidence
 */

import { v4 as uuidv4 } from 'uuid'
import type { ToolCall, AIToolCallDecision, AIToolCallRequest } from '../../types/tools'
import { toolCallingService } from '../tools/ToolCallingService'
import { toolExecutor } from '../tools/ToolExecutor'
import { toolRegistry } from '../tools/ToolRegistry'

// ============================================================================
// TYPES
// ============================================================================

export type InvestigationPhaseType = 'decomposition' | 'collection' | 'validation' | 'synthesis'
export type InvestigationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface InvestigationPhase {
    name: InvestigationPhaseType
    status: 'pending' | 'running' | 'completed' | 'failed'
    startedAt?: number
    completedAt?: number
    result?: unknown
    error?: string
}

export interface SubQuestion {
    id: string
    question: string
    reasoning: string
    priority: number
    status: 'pending' | 'collecting' | 'collected' | 'failed'
    findings: string[]
    toolCalls: ToolCall[]
}

export interface InvestigationTrace {
    id: string
    originalQuestion: string
    status: InvestigationStatus
    phases: InvestigationPhase[]
    subQuestions: SubQuestion[]
    toolCalls: ToolCall[]
    findings: string[]
    validationNotes: string[]
    finalAnswer: string
    confidence: number
    totalDurationMs: number
    startedAt: number
    completedAt?: number
}

export interface InvestigationUpdate {
    type: 'phase_started' | 'phase_completed' | 'subquestion_started' | 'tool_called' | 'finding_added' | 'status_changed'
    trace: InvestigationTrace
    data?: unknown
}

type InvestigationListener = (update: InvestigationUpdate) => void

// ============================================================================
// INVESTIGATE SERVICE
// ============================================================================

class InvestigateService {
    private currentTrace: InvestigationTrace | null = null
    private chatFn: ((prompt: string) => Promise<string>) | null = null
    private listeners: Set<InvestigationListener> = new Set()
    private abortController: AbortController | null = null

    /**
     * Set the chat function for AI calls
     */
    setChatFunction(fn: (prompt: string) => Promise<string>): void {
        this.chatFn = fn
        toolCallingService.setChatFunction(fn)
    }

    /**
     * Check if an investigation is running
     */
    get isRunning(): boolean {
        return this.currentTrace?.status === 'running'
    }

    /**
     * Get current trace
     */
    getCurrentTrace(): InvestigationTrace | null {
        return this.currentTrace
    }

    /**
     * Subscribe to investigation updates
     */
    subscribe(callback: InvestigationListener): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private notify(type: InvestigationUpdate['type'], data?: unknown): void {
        if (!this.currentTrace) return
        const update: InvestigationUpdate = { type, trace: this.currentTrace, data }
        this.listeners.forEach(cb => {
            try {
                cb(update)
            } catch (err) {
                console.error('[InvestigateService] Listener error:', err)
            }
        })
    }

    // ========================================================================
    // MAIN PIPELINE
    // ========================================================================

    /**
     * Start an investigation
     */
    async investigate(question: string): Promise<InvestigationTrace> {
        if (!this.chatFn) {
            throw new Error('Chat function not set. Call setChatFunction first.')
        }

        if (this.isRunning) {
            throw new Error('An investigation is already running')
        }

        // Initialize trace
        this.currentTrace = {
            id: uuidv4(),
            originalQuestion: question,
            status: 'running',
            phases: [
                { name: 'decomposition', status: 'pending' },
                { name: 'collection', status: 'pending' },
                { name: 'validation', status: 'pending' },
                { name: 'synthesis', status: 'pending' }
            ],
            subQuestions: [],
            toolCalls: [],
            findings: [],
            validationNotes: [],
            finalAnswer: '',
            confidence: 0,
            totalDurationMs: 0,
            startedAt: Date.now()
        }

        this.abortController = new AbortController()
        this.notify('status_changed')

        console.log('[Investigate] Starting investigation:', question)

        try {
            // Phase 1: Decomposition
            await this.runDecomposition(question)
            if (this.abortController?.signal.aborted) throw new Error('Cancelled')

            // Phase 2: Collection
            await this.runCollection()
            if (this.abortController?.signal.aborted) throw new Error('Cancelled')

            // Phase 3: Validation
            await this.runValidation()
            if (this.abortController?.signal.aborted) throw new Error('Cancelled')

            // Phase 4: Synthesis
            await this.runSynthesis(question)

            // Complete
            this.currentTrace.status = 'completed'
            this.currentTrace.completedAt = Date.now()
            this.currentTrace.totalDurationMs = Date.now() - this.currentTrace.startedAt

            console.log('[Investigate] Completed in', this.currentTrace.totalDurationMs, 'ms')

        } catch (error: any) {
            console.error('[Investigate] Error:', error)
            this.currentTrace.status = error.message === 'Cancelled' ? 'cancelled' : 'failed'
            this.currentTrace.completedAt = Date.now()
            this.currentTrace.totalDurationMs = Date.now() - this.currentTrace.startedAt
        }

        this.notify('status_changed')
        this.abortController = null

        return this.currentTrace
    }

    /**
     * Cancel running investigation
     */
    cancel(): void {
        if (this.abortController) {
            this.abortController.abort()
            console.log('[Investigate] Cancellation requested')
        }
    }

    // ========================================================================
    // PHASE 1: DECOMPOSITION
    // ========================================================================

    private async runDecomposition(question: string): Promise<void> {
        const phase = this.currentTrace!.phases[0]
        phase.status = 'running'
        phase.startedAt = Date.now()
        this.notify('phase_started', { phase: 'decomposition' })

        const prompt = `Você é um assistente de pesquisa. Sua tarefa é decompor uma pergunta complexa em sub-perguntas menores e mais específicas.

**Pergunta Original:**
"${question}"

**Instruções:**
1. Analise a pergunta e identifique os aspectos que precisam ser pesquisados
2. Crie de 2 a 5 sub-perguntas focadas
3. Cada sub-pergunta deve ser respondível com uma busca ou consulta específica
4. Ordene por prioridade (mais importante primeiro)

**Responda APENAS em JSON:**
{
  "analysis": "Breve análise da pergunta",
  "subQuestions": [
    { "question": "Sub-pergunta específica", "reasoning": "Por que isso é relevante", "priority": 1 }
  ]
}
`

        try {
            const response = await this.chatFn!(prompt)
            const parsed = this.parseJSON(response)

            if (parsed?.subQuestions && Array.isArray(parsed.subQuestions)) {
                this.currentTrace!.subQuestions = parsed.subQuestions.map((sq: any, idx: number) => ({
                    id: uuidv4(),
                    question: sq.question || '',
                    reasoning: sq.reasoning || '',
                    priority: sq.priority || idx + 1,
                    status: 'pending',
                    findings: [],
                    toolCalls: []
                }))
            }

            phase.status = 'completed'
            phase.result = parsed
            console.log('[Investigate] Decomposed into', this.currentTrace!.subQuestions.length, 'sub-questions')

        } catch (error: any) {
            phase.status = 'failed'
            phase.error = error.message
            throw error
        } finally {
            phase.completedAt = Date.now()
            this.notify('phase_completed', { phase: 'decomposition' })
        }
    }

    // ========================================================================
    // PHASE 2: COLLECTION
    // ========================================================================

    private async runCollection(): Promise<void> {
        const phase = this.currentTrace!.phases[1]
        phase.status = 'running'
        phase.startedAt = Date.now()
        this.notify('phase_started', { phase: 'collection' })

        const enabledTools = toolRegistry.getEnabled()

        for (const subQ of this.currentTrace!.subQuestions) {
            if (this.abortController?.signal.aborted) break

            subQ.status = 'collecting'
            this.notify('subquestion_started', { subQuestion: subQ })

            try {
                // Ask AI what tools to use for this sub-question
                const decision = await toolCallingService.decideToolUsage(
                    subQ.question,
                    [], // No history for sub-questions
                    enabledTools
                )

                if (decision.shouldUseTool && decision.toolCalls.length > 0) {
                    // Execute tools
                    const calls = await toolCallingService.executeToolCalls(
                        decision,
                        (toolId, query) => {
                            console.log('[Investigate] Calling tool:', toolId, query)
                        },
                        (call) => {
                            subQ.toolCalls.push(call)
                            this.currentTrace!.toolCalls.push(call)
                            this.notify('tool_called', { call })
                        }
                    )

                    // Extract findings from tool results
                    const formatted = toolCallingService.formatResultsForAI(calls)
                    if (formatted) {
                        subQ.findings.push(formatted)
                        this.currentTrace!.findings.push(`**${subQ.question}:**\n${formatted}`)
                        this.notify('finding_added', { finding: formatted })
                    }
                } else if (decision.directResponse) {
                    // AI had a direct answer
                    subQ.findings.push(decision.directResponse)
                    this.currentTrace!.findings.push(`**${subQ.question}:**\n${decision.directResponse}`)
                }

                subQ.status = 'collected'

            } catch (error: any) {
                console.error('[Investigate] Collection error for:', subQ.question, error)
                subQ.status = 'failed'
            }
        }

        phase.status = 'completed'
        phase.completedAt = Date.now()
        this.notify('phase_completed', { phase: 'collection' })
    }

    // ========================================================================
    // PHASE 3: VALIDATION
    // ========================================================================

    private async runValidation(): Promise<void> {
        const phase = this.currentTrace!.phases[2]
        phase.status = 'running'
        phase.startedAt = Date.now()
        this.notify('phase_started', { phase: 'validation' })

        if (this.currentTrace!.findings.length === 0) {
            phase.status = 'completed'
            phase.completedAt = Date.now()
            this.currentTrace!.validationNotes.push('Nenhuma informação coletada para validar.')
            this.notify('phase_completed', { phase: 'validation' })
            return
        }

        const findingsText = this.currentTrace!.findings.join('\n\n---\n\n')

        const prompt = `Você é um validador de informações. Analise as informações coletadas e identifique:
1. Consistências - informações que se confirmam
2. Contradições - informações conflitantes
3. Lacunas - aspectos não cobertos
4. Confiabilidade - avaliação geral

**Informações Coletadas:**
${findingsText}

**Responda em JSON:**
{
  "consistencies": ["..."],
  "contradictions": ["..."],
  "gaps": ["..."],
  "overallReliability": "alta" | "média" | "baixa",
  "confidenceScore": 0.0 - 1.0,
  "notes": "Observações adicionais"
}
`

        try {
            const response = await this.chatFn!(prompt)
            const parsed = this.parseJSON(response)

            if (parsed) {
                phase.result = parsed
                this.currentTrace!.confidence = parsed.confidenceScore || 0.5

                if (parsed.consistencies?.length) {
                    this.currentTrace!.validationNotes.push('✓ Consistências: ' + parsed.consistencies.join('; '))
                }
                if (parsed.contradictions?.length) {
                    this.currentTrace!.validationNotes.push('⚠ Contradições: ' + parsed.contradictions.join('; '))
                }
                if (parsed.gaps?.length) {
                    this.currentTrace!.validationNotes.push('? Lacunas: ' + parsed.gaps.join('; '))
                }
                if (parsed.notes) {
                    this.currentTrace!.validationNotes.push('📝 ' + parsed.notes)
                }
            }

            phase.status = 'completed'

        } catch (error: any) {
            phase.status = 'failed'
            phase.error = error.message
            this.currentTrace!.confidence = 0.3 // Low confidence on validation failure
        } finally {
            phase.completedAt = Date.now()
            this.notify('phase_completed', { phase: 'validation' })
        }
    }

    // ========================================================================
    // PHASE 4: SYNTHESIS
    // ========================================================================

    private async runSynthesis(originalQuestion: string): Promise<void> {
        const phase = this.currentTrace!.phases[3]
        phase.status = 'running'
        phase.startedAt = Date.now()
        this.notify('phase_started', { phase: 'synthesis' })

        const findingsText = this.currentTrace!.findings.join('\n\n')
        const validationText = this.currentTrace!.validationNotes.join('\n')
        const confidence = this.currentTrace!.confidence

        const prompt = `Você é um pesquisador sintetizando resultados de uma investigação.

**Pergunta Original:**
"${originalQuestion}"

**Informações Coletadas:**
${findingsText || '(Nenhuma informação específica coletada)'}

**Notas de Validação:**
${validationText || '(Sem validação adicional)'}

**Nível de Confiança:** ${(confidence * 100).toFixed(0)}%

**Instruções:**
1. Responda à pergunta original de forma completa e bem fundamentada
2. Cite as fontes quando relevante
3. Mencione limitações ou incertezas se existirem
4. Seja claro e objetivo

**Sua Resposta:**`

        try {
            const response = await this.chatFn!(prompt)
            this.currentTrace!.finalAnswer = response.trim()
            phase.status = 'completed'
            phase.result = { answer: response }

        } catch (error: any) {
            phase.status = 'failed'
            phase.error = error.message
            this.currentTrace!.finalAnswer = `Não foi possível sintetizar uma resposta: ${error.message}`
        } finally {
            phase.completedAt = Date.now()
            this.notify('phase_completed', { phase: 'synthesis' })
        }
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private parseJSON(text: string): any | null {
        try {
            // Try direct parse
            return JSON.parse(text)
        } catch {
            // Try to extract JSON from markdown code block
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) {
                try {
                    return JSON.parse(match[1].trim())
                } catch {
                    // Try to find JSON object in text
                }
            }
            // Try to find JSON object anywhere
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0])
                } catch {
                    return null
                }
            }
            return null
        }
    }

    /**
     * Get a short status message for UI
     */
    getStatusMessage(): string {
        if (!this.currentTrace) return ''

        const runningPhase = this.currentTrace.phases.find(p => p.status === 'running')
        if (!runningPhase) {
            if (this.currentTrace.status === 'completed') return 'Investigação concluída'
            if (this.currentTrace.status === 'failed') return 'Investigação falhou'
            if (this.currentTrace.status === 'cancelled') return 'Investigação cancelada'
            return ''
        }

        switch (runningPhase.name) {
            case 'decomposition':
                return 'Analisando a pergunta...'
            case 'collection':
                const collecting = this.currentTrace.subQuestions.find(sq => sq.status === 'collecting')
                if (collecting) {
                    return `Pesquisando: "${collecting.question.substring(0, 40)}..."`
                }
                return 'Coletando informações...'
            case 'validation':
                return 'Validando informações...'
            case 'synthesis':
                return 'Sintetizando resposta...'
            default:
                return 'Investigando...'
        }
    }
}

// Singleton
export const investigateService = new InvestigateService()
export default investigateService
