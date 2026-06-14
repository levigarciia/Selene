import { afterEach, describe, expect, test, vi } from 'vitest'
import { investigateService } from '../InvestigateService'
import { toolCallingService } from '../../tools/ToolCallingService'
import type { AIToolCallDecision, ToolCall } from '../../../types/tools'
import type { InvestigationTrace } from '../types'

function criarChamada(id: string, results: unknown[]): ToolCall {
    return {
        id,
        input: {
            toolId: 'builtin:web_search',
            arguments: { query: id },
        },
        status: 'completed',
        startedAt: 1,
        completedAt: 2,
        result: {
            success: true,
            data: { results },
            metadata: { durationMs: 1 },
        },
    }
}

function criarTrace(): InvestigationTrace {
    return {
        id: 'trace-1',
        runId: 'run-1',
        originalQuestion: 'Pesquisar Banco Master',
        state: 'idle',
        phases: [
            { name: 'collection', status: 'pending' },
        ],
        currentPhase: null,
        subQuestions: [
            {
                id: 'sub-1',
                question: 'Banco Master crise',
                reasoning: 'Precisa de dados atuais',
                priority: 1,
                status: 'pending',
                evidence: [],
                toolCalls: [],
                iteration: 0,
            },
        ],
        researchPlan: {
            category: 'general',
            objective: 'Coletar evidências',
            searchAngles: [],
            requiredEvidence: [],
            successCriteria: [],
            preferredSourceTypes: [],
        },
        evidence: [],
        validationResults: [],
        currentIteration: 1,
        finalAnswer: '',
        confidence: null,
        citations: [],
        totalToolCalls: 0,
        totalDurationMs: 0,
        startedAt: Date.now(),
        errors: [],
    }
}

describe('InvestigateService - autonomia de ferramentas', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        ;(investigateService as unknown as { currentTrace: null; activeRunId: null }).currentTrace = null
        ;(investigateService as unknown as { currentTrace: null; activeRunId: null }).activeRunId = null
    })

    test('deve tentar recuperação automática quando a primeira coleta não trouxer evidência', async () => {
        const trace = criarTrace()
        ;(investigateService as unknown as { currentTrace: InvestigationTrace; activeRunId: string }).currentTrace = trace
        ;(investigateService as unknown as { currentTrace: InvestigationTrace; activeRunId: string }).activeRunId = trace.runId

        const primeiraDecisao: AIToolCallDecision = {
            shouldUseTool: true,
            toolCalls: [{ tool: 'builtin:web_search', arguments: { query: 'banco master crise' } }],
        }

        vi.spyOn(toolCallingService, 'decideToolUsage').mockResolvedValue(primeiraDecisao)
        vi.spyOn(toolCallingService, 'executeToolCalls')
            .mockResolvedValueOnce([criarChamada('busca-vazia', [])])
            .mockResolvedValueOnce([
                criarChamada('busca-recuperada', [
                    {
                        title: 'Banco Master comunicado',
                        url: 'https://example.com/banco-master',
                        content: 'Comunicado oficial sobre o Banco Master.',
                    },
                ]),
            ])
        vi.spyOn(toolCallingService, 'avaliarAutonomia')
            .mockReturnValueOnce({
                action: 'continuar',
                reason: 'Busca vazia recuperável.',
                toolCalls: [{ tool: 'builtin:web_search', arguments: { query: 'Banco Master comunicado' } }],
            })
            .mockReturnValueOnce({
                action: 'responder',
                reason: 'Há evidência suficiente.',
            })

        await (investigateService as unknown as { runCollection: (iteration: number) => Promise<void> }).runCollection(1)

        expect(toolCallingService.executeToolCalls).toHaveBeenCalledTimes(2)
        expect(trace.subQuestions[0].status).toBe('collected')
        expect(trace.subQuestions[0].evidence.length).toBeGreaterThan(0)
    })
})
