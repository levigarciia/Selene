/**
 * Investigate Service v2
 *
 * Pipeline de pesquisa deliberativo com:
 * - Roteador inicial (direct | clarify | investigate)
 * - Checkpoint de alinhamento com usuário
 * - Loop adaptativo Collection ↔ Validation
 * - Evidências estruturadas com citações
 * - Confiança justificável
 * - Cancelamento robusto
 */

import { v4 as uuidv4 } from 'uuid'
import { toolCallingService } from '../tools/ToolCallingService'
import { toolRegistry } from '../tools/ToolRegistry'
import type { ToolCall } from '../../types/tools'
import {
    INVESTIGATION_LIMITS,
} from './types'
import type {
    InvestigationTrace,
    InvestigationPhase,
    InvestigationUpdate,
    InvestigationListener,
    InvestigationUpdateType,
    SubQuestion,
    Evidence,
    EvidenceSource,
    SourceCredibility,
    SourceType,
    RouteAnalysis,
    RouteDecision,
    AlignmentCheckpoint,
    ClarificationReason,
    UserClarification,
    ValidationResult,
    ConfidenceAssessment,
    ConfidenceLevel,
    ResearchPlan,
    ResearchCategory,
} from './types'

// Re-export types
export * from './types'

type ChatFunction = (prompt: string, systemPrompt?: string) => Promise<string>
type StreamCallback = (chunk: string) => void
type ContextoExecucaoInvestigacao = {
    conversationId?: string
    projectId?: string
}
type EscopoDecomposicao = 'amplo' | 'focado' | 'específico'

interface FaseDecomposicao extends InvestigationPhase {
    decompositionData?: {
        ambiguities: string[]
        contextNeeded: string[]
        scope: EscopoDecomposicao
    }
}

interface RespostaSubPergunta {
    question?: string
    reasoning?: string
    priority?: number
}

interface RespostaDecomposicao {
    objective?: string
    subQuestions?: RespostaSubPergunta[]
    ambiguities?: string[]
    contextNeeded?: string[]
    scope?: EscopoDecomposicao
    searchAngles?: string[]
    requiredEvidence?: string[]
    successCriteria?: string[]
    preferredSourceTypes?: SourceType[]
}

interface ResultadoFerramentaInvestigacao {
    results?: Array<{
        title?: string
        content?: string
        snippet?: string
        url?: string
    }>
    formattedForAI?: string
}

interface RespostaContradicao {
    topic?: string
    summary?: string
}

interface RespostaValidacao {
    consistencies?: string[]
    contradictions?: RespostaContradicao[]
    gaps?: string[]
    nextQueries?: string[]
    missingEvidence?: string[]
    overallAssessment?: 'suficiente' | 'parcial' | 'insuficiente'
}

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    if (typeof erro === 'object' && erro !== null && 'message' in erro) {
        const mensagem = (erro as { message?: unknown }).message
        if (typeof mensagem === 'string' && mensagem.trim()) {
            return mensagem
        }
    }
    return fallback
}

// ============================================================================
// INVESTIGATE SERVICE v2
// ============================================================================

class InvestigateServiceV2 {
    private currentTrace: InvestigationTrace | null = null
    private chatFn: ChatFunction | null = null
    private listeners: Set<InvestigationListener> = new Set()
    private abortController: AbortController | null = null
    private activeRunId: string | null = null
    private historicoChat: Array<{ role: 'user' | 'assistant'; content: string }> = []
    private contextoExecucao: ContextoExecucaoInvestigacao = {}

    // ========================================================================
    // SETUP
    // ========================================================================

    setChatFunction(fn: ChatFunction): void {
        this.chatFn = fn
        toolCallingService.setChatFunction(fn)
    }

    setStreamCallback(_fn: StreamCallback | null): void {
        void _fn
    }

    setHistoricoChat(historico: Array<{ role: 'user' | 'assistant'; content: string }>): void {
        this.historicoChat = historico
            .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0)
            .slice(-10)
    }

    setContextoExecucao(contexto: ContextoExecucaoInvestigacao): void {
        this.contextoExecucao = { ...contexto }
    }

    get isRunning(): boolean {
        return this.currentTrace?.state === 'collecting' ||
               this.currentTrace?.state === 'decomposing' ||
               this.currentTrace?.state === 'validating' ||
               this.currentTrace?.state === 'synthesizing' ||
               this.currentTrace?.state === 'routing'
    }

    get isAwaitingClarification(): boolean {
        return this.currentTrace?.state === 'awaiting_clarification'
    }

    getCurrentTrace(): InvestigationTrace | null {
        return this.currentTrace
    }

    subscribe(callback: InvestigationListener): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private notify(type: InvestigationUpdateType, message?: string, data?: unknown): void {
        if (!this.currentTrace) return
        const update: InvestigationUpdate = {
            type,
            trace: { ...this.currentTrace },
            message,
            data
        }
        this.listeners.forEach(cb => {
            try {
                cb(update)
            } catch (err) {
                console.error('[InvestigateV2] Listener error:', err)
            }
        })
    }

    private isAborted(): boolean {
        return this.abortController?.signal.aborted || false
    }

    private checkRunId(): boolean {
        return this.currentTrace?.runId === this.activeRunId
    }

    /**
     * Verifica se o tempo máximo de investigação foi excedido
     */
    private isTimedOut(): boolean {
        if (!this.currentTrace) return false
        const elapsed = Date.now() - this.currentTrace.startedAt
        return elapsed >= INVESTIGATION_LIMITS.MAX_INVESTIGATION_TIME_MS
    }

    /**
     * Verifica todas as condições de parada
     */
    private shouldStop(): boolean {
        if (this.isAborted()) return true
        if (!this.checkRunId()) return true
        if (this.isTimedOut()) {
            console.log('[InvestigateV2] Investigation timed out after',
                INVESTIGATION_LIMITS.MAX_INVESTIGATION_TIME_MS / 1000, 'seconds')
            return true
        }
        return false
    }

    // ========================================================================
    // MAIN ENTRY POINT
    // ========================================================================

    /**
     * Inicia uma investigação
     */
    async investigate(question: string): Promise<InvestigationTrace> {
        if (!this.chatFn) {
            throw new Error('Chat function not set')
        }

        if (this.isRunning) {
            throw new Error('Investigation already running')
        }

        const runId = uuidv4()
        this.activeRunId = runId
        this.abortController = new AbortController()

        // Inicializa trace
        this.currentTrace = this.createInitialTrace(question, runId)
        this.notify('state_changed', 'Iniciando investigação...')

        console.log('[InvestigateV2] Starting investigation:', question)

        try {
            // FASE 0: Routing
            const route = await this.runRouting(question)
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')

            if (route.decision === 'direct') {
                // Resposta direta, sem investigação completa
                await this.runDirectAnswer(question)
                return this.currentTrace!
            }

            // FASE 1: Decomposition
            await this.runDecomposition(question)
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')

            // FASE 2: Alignment Checkpoint
            const needsClarification = await this.runAlignmentCheck()
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')

            if (needsClarification) {
                // Aguarda clarificação do usuário
                this.currentTrace!.state = 'awaiting_clarification'
                this.notify('clarification_needed', 'Aguardando esclarecimento...')
                // O fluxo continua quando provideClarification() é chamado
                return this.currentTrace!
            }

            // FASES 3-5: Collection → Validation → Loop → Synthesis
            await this.runCollectionValidationLoop()

        } catch (error: unknown) {
            const mensagemErro = obterMensagemErro(error, 'Falha desconhecida')
            if (mensagemErro === 'Cancelled') {
                this.currentTrace!.state = 'cancelled'
                this.notify('cancelled', 'Investigação cancelada')
            } else if (mensagemErro === 'Timeout') {
                // Timeout: sintetiza com o que já tem
                console.log('[InvestigateV2] Timeout reached, synthesizing with available data...')
                this.currentTrace!.errors.push({
                    phase: this.currentTrace!.currentPhase || 'unknown',
                    message: `Tempo máximo de ${INVESTIGATION_LIMITS.MAX_INVESTIGATION_TIME_MS / 1000}s atingido`,
                    timestamp: Date.now()
                })
                // Tenta sintetizar com as evidências já coletadas
                if (this.currentTrace!.evidence.length > 0) {
                    try {
                        await this.runSynthesis()
                        this.notify('completed', 'Investigação concluída (tempo limite atingido)')
                    } catch {
                        this.currentTrace!.state = 'failed'
                        this.currentTrace!.finalAnswer = '⏱️ O tempo máximo de investigação foi atingido. ' +
                            'Não foi possível completar a pesquisa, mas aqui está o que encontrei até agora:\n\n' +
                            this.currentTrace!.evidence.slice(0, 3).map(e => `• ${e.claim}`).join('\n')
                    }
                } else {
                    this.currentTrace!.state = 'failed'
                    this.currentTrace!.finalAnswer = '⏱️ O tempo máximo de investigação foi atingido antes de coletar informações suficientes. ' +
                        'Por favor, tente uma pergunta mais específica.'
                }
            } else {
                const mensagemErro = obterMensagemErro(error, 'Erro desconhecido na investigação')
                console.error('[InvestigateV2] Error:', error)
                this.currentTrace!.state = 'failed'
                this.currentTrace!.errors.push({
                    phase: this.currentTrace!.currentPhase || 'unknown',
                    message: mensagemErro,
                    timestamp: Date.now()
                })
                this.notify('error', mensagemErro)
            }
        } finally {
            if (this.currentTrace) {
                this.currentTrace.completedAt = Date.now()
                this.currentTrace.totalDurationMs = Date.now() - this.currentTrace.startedAt
            }
            this.abortController = null
            this.contextoExecucao = {}
        }

        return this.currentTrace!
    }

    /**
     * Fornece clarificação do usuário e continua a investigação
     */
    async provideClarification(clarification: UserClarification): Promise<InvestigationTrace> {
        if (!this.currentTrace || this.currentTrace.state !== 'awaiting_clarification') {
            throw new Error('No investigation awaiting clarification')
        }

        this.currentTrace.userClarification = clarification
        this.notify('clarification_received', 'Esclarecimento recebido')

        // Ajusta sub-perguntas baseado na clarificação
        await this.adjustSubQuestionsFromClarification(clarification)

        // Continua com Collection → Validation → Synthesis
        await this.runCollectionValidationLoop()

        return this.currentTrace!
    }

    /**
     * Cancela investigação em andamento
     */
    cancel(): void {
        if (this.abortController) {
            this.abortController.abort()
            this.activeRunId = null
            console.log('[InvestigateV2] Cancellation requested')
        }
    }

    // ========================================================================
    // FASE 0: ROUTING
    // ========================================================================

    private async runRouting(question: string): Promise<RouteAnalysis> {
        this.updatePhase('routing', 'running')
        this.currentTrace!.state = 'routing'
        this.notify('phase_started', 'Analisando pergunta...')

        // Análise heurística rápida primeiro
        const signals = this.analyzeQuestionSignals(question)

        // Decisão baseada em sinais
        let decision: RouteDecision = 'investigate'
        let reasoning = ''

        if (signals.isShortAndSimple && !signals.needsCurrentInfo) {
            decision = 'direct'
            reasoning = 'Pergunta simples que pode ser respondida diretamente'
        } else if (signals.isAmbiguous && !signals.hasEnoughContext) {
            decision = 'clarify'
            reasoning = 'Pergunta ambígua que precisa de esclarecimento'
        } else if (signals.needsCurrentInfo || signals.needsMultipleSources || signals.isComplex) {
            decision = 'investigate'
            reasoning = 'Pergunta complexa que requer investigação'
        }

        const analysis: RouteAnalysis = {
            decision,
            reasoning,
            signals
        }

        this.currentTrace!.routeAnalysis = analysis
        this.updatePhase('routing', 'completed', analysis)
        this.notify('phase_completed', `Decisão: ${decision}`)

        console.log('[InvestigateV2] Route decision:', decision, reasoning)
        return analysis
    }

    private analyzeQuestionSignals(question: string): RouteAnalysis['signals'] {
        const q = question.toLowerCase()
        const len = question.length

        // Detecta se pede informação abrangente (mesmo sendo pergunta "curta")
        const asksForBroadInfo = this.asksForBroadInfo(q)
        const hasEnoughContext = this.temContextoSuficiente(question)

        return {
            // Só é simples se NÃO pedir info abrangente
            isShortAndSimple: len < 50 && !q.includes('?') && !this.hasComplexTerms(q) && !asksForBroadInfo,
            needsCurrentInfo: this.needsCurrentInfo(q),
            needsMultipleSources: this.needsMultipleSources(q) || asksForBroadInfo,
            isAmbiguous: this.isAmbiguous(q),
            hasEnoughContext,
            isComplex: this.isComplex(q) || asksForBroadInfo
        }
    }

    private temContextoSuficiente(question: string): boolean {
        const historico = this.historicoChat
            .filter(m => m.content && m.content.trim().length > 0)

        if (historico.length === 0) return false

        const perguntaNormalizada = this.normalizarTexto(question)
        const tokensPergunta = this.extrairTokensRelevantes(question)
        const temIndicadores = this.temIndicadoresDeContexto(question)

        const mensagensRecentes = historico
            .filter(m => this.normalizarTexto(m.content) !== perguntaNormalizada)
            .slice(-6)

        if (mensagensRecentes.length === 0) return false

        const tokensPerguntaSet = new Set(tokensPergunta)
        for (const msg of mensagensRecentes) {
            const tokensMsg = this.extrairTokensRelevantes(msg.content)
            if (tokensMsg.length === 0) continue

            let intersecao = 0
            const tokensMsgSet = new Set(tokensMsg)
            tokensPerguntaSet.forEach(t => {
                if (tokensMsgSet.has(t)) intersecao += 1
            })

            if (intersecao >= 2) return true
            if (intersecao >= 1 && tokensPerguntaSet.size <= 2) return true
            if (temIndicadores && tokensMsg.length >= 4) return true
        }

        return false
    }

    private temIndicadoresDeContexto(texto: string): boolean {
        const termos = [
            'isso', 'isto', 'essa', 'esse', 'essas', 'esses',
            'aquilo', 'aquele', 'aquela', 'aqueles', 'aquelas',
            'ele', 'ela', 'eles', 'elas', 'disso', 'dessa', 'desse',
            'daquele', 'daquela', 'daquilo', 'aqui', 'ali', 'la', 'tal'
        ]
        const normalizado = this.normalizarTexto(texto)
        return termos.some(t => normalizado.includes(t))
    }

    private extrairTokensRelevantes(texto: string): string[] {
        const stopwords = new Set([
            'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
            'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
            'ao', 'aos', 'à', 'às', 'por', 'para', 'com', 'sem', 'sobre',
            'e', 'ou', 'que', 'qual', 'quais', 'quem', 'como', 'onde', 'quando',
            'quanto', 'porque', 'por', 'porquê', 'se', 'ser', 'estar', 'é', 'são',
            'foi', 'era', 'sua', 'seu', 'suas', 'seus', 'meu', 'minha', 'meus', 'minhas',
            'this', 'that', 'the', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'with',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'i', 'you', 'he', 'she',
            'they', 'we', 'it', 'what', 'which', 'who', 'how', 'where', 'when', 'why'
        ])

        const normalizado = this.normalizarTexto(texto)
        if (!normalizado) return []

        return normalizado
            .split(' ')
            .map(t => t.trim())
            .filter(t => t.length > 2 && !stopwords.has(t))
    }

    private normalizarTexto(texto: string): string {
        return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    private asksForBroadInfo(q: string): boolean {
        // Detecta perguntas que pedem informação ampla/completa
        const broadTerms = [
            'tudo sobre', 'me conta sobre', 'me fala sobre', 'me diz sobre',
            'o que é', 'quem é', 'quem foi', 'como funciona',
            'explique', 'explica', 'detalhe', 'detalha',
            'história de', 'história da', 'história do',
            'tell me about', 'what is', 'who is', 'how does',
            'explain', 'describe'
        ]
        return broadTerms.some(t => q.includes(t))
    }

    private hasComplexTerms(q: string): boolean {
        const complexTerms = ['compare', 'comparar', 'análise', 'analysis', 'melhor', 'best',
                             'diferença', 'difference', 'prós e contras', 'pros and cons']
        return complexTerms.some(t => q.includes(t))
    }

    private needsCurrentInfo(q: string): boolean {
        const currentTerms = ['atual', 'current', 'hoje', 'today', '2024', '2025', '2026',
                             'recente', 'recent', 'agora', 'now', 'preço', 'price',
                             'cotação', 'notícia', 'news']
        return currentTerms.some(t => q.includes(t))
    }

    private needsMultipleSources(q: string): boolean {
        const multiSourceTerms = ['comparar', 'compare', 'opinião', 'opinion',
                                  'melhor', 'best', 'recomendação', 'recommend']
        return multiSourceTerms.some(t => q.includes(t))
    }

    private isAmbiguous(q: string): boolean {
        const ambiguousTerms = ['melhor', 'best', 'ideal', 'bom', 'good',
                                'vale a pena', 'worth', 'deveria', 'should']
        return ambiguousTerms.some(t => q.includes(t))
    }

    private isComplex(q: string): boolean {
        // Perguntas com múltiplas partes ou que precisam de análise
        const hasMultipleParts = (q.match(/\?/g) || []).length > 1
        const hasComplexStructure = q.includes(' e ') || q.includes(' ou ') || q.includes(' vs ')
        return hasMultipleParts || hasComplexStructure || q.length > 200
    }

    // ========================================================================
    // RESPOSTA DIRETA (sem investigação)
    // ========================================================================

    private async runDirectAnswer(question: string): Promise<void> {
        this.currentTrace!.state = 'synthesizing'
        this.updatePhase('synthesis', 'running')
        this.notify('phase_started', 'Gerando resposta...')

        const response = await this.chatFn!(question)

        this.currentTrace!.finalAnswer = response
        this.currentTrace!.state = 'completed'
        this.currentTrace!.confidence = {
            level: 'medium',
            score: 70,
            factors: {
                independentSources: 0,
                sourceQuality: 'medium',
                recency: 'unknown',
                consistency: 'strong',
                inferenceLevel: 'moderate',
                hasGaps: false,
                hasPrimarySource: false
            },
            justification: 'Resposta direta baseada em conhecimento geral',
            warnings: []
        }

        this.updatePhase('synthesis', 'completed')
        this.notify('completed', 'Resposta gerada')
    }

    // ========================================================================
    // FASE 1: DECOMPOSITION
    // ========================================================================

    private async runDecomposition(question: string): Promise<void> {
        this.currentTrace!.state = 'decomposing'
        this.updatePhase('decomposition', 'running')
        this.notify('phase_started', 'Analisando pergunta...')

        const category = this.classificarCategoriaPesquisa(question)
        this.currentTrace!.researchCategory = category

        const prompt = `Você é um pesquisador sênior. Crie um plano de Deep Research e decomponha a pergunta em sub-perguntas pesquisáveis.

**Pergunta:** "${question}"
**Categoria detectada:** ${category}

**Instruções:**
1. Defina o objetivo da pesquisa em uma frase
2. Liste ângulos de busca distintos para evitar uma única fonte ou uma única interpretação
3. Crie 2-5 sub-perguntas específicas, verificáveis e ordenadas por prioridade
4. Diga quais evidências são necessárias para a resposta ser confiável
5. Identifique ambiguidades ou dependências de contexto
6. Prefira fontes primárias/oficiais quando a categoria exigir dados atuais, produto, comparação ou fact-check

**Responda em JSON:**
{
  "objective": "Objetivo da pesquisa",
  "searchAngles": ["ângulo 1", "ângulo 2"],
  "subQuestions": [
    { "question": "Sub-pergunta específica", "reasoning": "Por que relevante", "priority": 1 }
  ],
  "requiredEvidence": ["tipo de evidência necessária"],
  "successCriteria": ["critério para considerar suficiente"],
  "ambiguities": ["Lista de ambiguidades ou interpretações possíveis"],
  "contextNeeded": ["Informações de contexto que ajudariam"],
  "preferredSourceTypes": ["official", "primary", "secondary"],
  "scope": "amplo" | "focado" | "específico"
}`

        try {
            const response = await this.chatFn!(prompt)
            const parsed = this.parseJSON(response) as RespostaDecomposicao | null

            if (parsed?.subQuestions) {
                this.currentTrace!.subQuestions = parsed.subQuestions
                    .slice(0, INVESTIGATION_LIMITS.MAX_SUB_QUESTIONS)
                    .map((sq, idx: number) => ({
                        id: uuidv4(),
                        question: sq.question || '',
                        reasoning: sq.reasoning || '',
                        priority: sq.priority || idx + 1,
                        status: 'pending' as const,
                        evidence: [],
                        toolCalls: [],
                        iteration: 0
                    }))
            }

            this.currentTrace!.researchPlan = this.criarPlanoPesquisa(category, question, parsed)

            // Guarda info para checkpoint de alinhamento
            if (parsed) {
                (this.currentTrace!.phases[1] as FaseDecomposicao).decompositionData = {
                    ambiguities: parsed.ambiguities || [],
                    contextNeeded: parsed.contextNeeded || [],
                    scope: parsed.scope || 'focado'
                }
            }

            this.updatePhase('decomposition', 'completed', parsed)
            this.notify('phase_completed', `${this.currentTrace!.subQuestions.length} sub-perguntas identificadas`)

        } catch (error: unknown) {
            this.updatePhase('decomposition', 'failed', null, obterMensagemErro(error, 'Falha na decomposição'))
            throw error
        }
    }

    private classificarCategoriaPesquisa(question: string): ResearchCategory {
        const texto = question.toLowerCase()

        if (/\b(vs|versus|comparar|comparativo|diferen[cç]a|qual (é )?melhor)\b/i.test(texto)) {
            return 'comparison'
        }

        if (/\b(como|passo a passo|tutorial|implementar|configurar|resolver|fazer)\b/i.test(texto)) {
            return 'howto'
        }

        if (/\b(pre[cç]o|comprar|produto|plano|assinatura|review|recomenda[cç][aã]o)\b/i.test(texto)) {
            return 'product'
        }

        if (/\b(verdade|falso|confirma|verificar|fact[- ]?check|checar|prova|evid[eê]ncia)\b/i.test(texto)) {
            return 'factcheck'
        }

        return 'general'
    }

    private criarPlanoPesquisa(
        category: ResearchCategory,
        question: string,
        parsed: RespostaDecomposicao | null
    ): ResearchPlan {
        const defaultSourceTypes: Record<ResearchCategory, SourceType[]> = {
            general: ['official', 'primary', 'secondary'],
            product: ['official', 'secondary', 'community'],
            comparison: ['official', 'primary', 'secondary', 'community'],
            howto: ['official', 'primary', 'secondary'],
            factcheck: ['official', 'primary', 'news']
        }

        return {
            category,
            objective: parsed?.objective || `Responder com evidências: ${question}`,
            searchAngles: (parsed?.searchAngles || []).slice(0, 5),
            requiredEvidence: (parsed?.requiredEvidence || []).slice(0, 5),
            successCriteria: (parsed?.successCriteria || []).slice(0, 5),
            preferredSourceTypes: (parsed?.preferredSourceTypes || defaultSourceTypes[category]).slice(0, 4)
        }
    }

    // ========================================================================
    // FASE 2: ALIGNMENT CHECKPOINT
    // ========================================================================

    private async runAlignmentCheck(): Promise<boolean> {
        this.updatePhase('clarification', 'running')

        const decompositionData = (this.currentTrace!.phases.find((p) => p.name === 'decomposition') as FaseDecomposicao | undefined)?.decompositionData
        const ambiguidades = decompositionData?.ambiguities ?? []
        const contextoNecessario = decompositionData?.contextNeeded ?? []
        const reasons: ClarificationReason[] = []
        const clarifyingQuestions: string[] = []

        // Verifica se precisa de clarificação
        if (ambiguidades.length > 0) {
            reasons.push('multiple_interpretations')
            clarifyingQuestions.push(...ambiguidades.slice(0, 2).map(
                (a: string) => `Sobre "${a}", você quer que eu foque em qual aspecto?`
            ))
        }

        if (contextoNecessario.length > 0) {
            reasons.push('needs_context')
            clarifyingQuestions.push(...contextoNecessario.slice(0, 2))
        }

        if (decompositionData?.scope === 'amplo') {
            reasons.push('scope_too_broad')
            if (clarifyingQuestions.length === 0) {
                clarifyingQuestions.push('O escopo é bem amplo. Quer que eu foque em algum aspecto específico?')
            }
        }

        // Limita a 3 perguntas
        const questions = clarifyingQuestions.slice(0, INVESTIGATION_LIMITS.MAX_CLARIFYING_QUESTIONS)

        // Gera plano resumido
        const plan = this.currentTrace!.subQuestions
            .map((sq, i) => `${i + 1}. ${sq.question}`)
            .join('\n')

        const checkpoint: AlignmentCheckpoint = {
            needsClarification: reasons.length > 0 && questions.length > 0,
            reasons,
            clarifyingQuestions: questions,
            proposedPlan: plan,
            estimatedSteps: this.currentTrace!.subQuestions.length,
            waitingForUser: false
        }

        this.currentTrace!.alignmentCheckpoint = checkpoint

        if (checkpoint.needsClarification) {
            checkpoint.waitingForUser = true
            this.updatePhase('clarification', 'waiting')
            console.log('[InvestigateV2] Needs clarification:', questions)
            return true
        }

        this.updatePhase('clarification', 'skipped')
        return false
    }

    private async adjustSubQuestionsFromClarification(clarification: UserClarification): Promise<void> {
        if (clarification.adjustedScope) {
            // Re-decompor com o novo escopo
            console.log('[InvestigateV2] Adjusting scope:', clarification.adjustedScope)

            const prompt = `Ajuste as sub-perguntas considerando a clarificação do usuário:

**Pergunta original:** "${this.currentTrace!.originalQuestion}"
**Clarificação:** ${JSON.stringify(clarification.answers)}
**Escopo ajustado:** ${clarification.adjustedScope || 'não especificado'}

**Sub-perguntas atuais:**
${this.currentTrace!.subQuestions.map(sq => `- ${sq.question}`).join('\n')}

**Retorne as sub-perguntas ajustadas em JSON:**
{
  "subQuestions": [
    { "question": "...", "reasoning": "...", "priority": 1 }
  ]
}`

            try {
                const response = await this.chatFn!(prompt)
                const parsed = this.parseJSON(response) as RespostaDecomposicao | null

                if (parsed?.subQuestions) {
                    this.currentTrace!.subQuestions = parsed.subQuestions
                        .slice(0, INVESTIGATION_LIMITS.MAX_SUB_QUESTIONS)
                        .map((sq, idx: number) => ({
                            id: uuidv4(),
                            question: sq.question || '',
                            reasoning: sq.reasoning || '',
                            priority: sq.priority || idx + 1,
                            status: 'pending' as const,
                            evidence: [],
                            toolCalls: [],
                            iteration: 0
                        }))
                }
            } catch (error) {
                console.warn('[InvestigateV2] Failed to adjust sub-questions:', error)
                // Continua com as sub-perguntas originais
            }
        }
    }

    // ========================================================================
    // FASES 3-4: COLLECTION ↔ VALIDATION LOOP
    // ========================================================================

    private async runCollectionValidationLoop(): Promise<void> {
        let iteration = 0
        let shouldContinue = true

        while (shouldContinue && iteration < INVESTIGATION_LIMITS.MAX_COLLECTION_ITERATIONS) {
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')
            if (this.currentTrace!.totalToolCalls >= INVESTIGATION_LIMITS.MAX_TOTAL_TOOL_CALLS) {
                console.log('[InvestigateV2] Max tool calls reached')
                break
            }

            iteration++
            this.currentTrace!.currentIteration = iteration
            this.notify('iteration_started', `Iteração ${iteration}`)

            // COLLECTION
            await this.runCollection(iteration)
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')

            // VALIDATION
            const validation = await this.runValidation(iteration)
            if (this.shouldStop()) throw new Error(this.isTimedOut() ? 'Timeout' : 'Cancelled')

            shouldContinue = validation.shouldContinue && !validation.maxIterationsReached

            // Se precisa continuar, adiciona novas sub-perguntas das gaps
            if (shouldContinue && validation.nextQueries.length > 0) {
                this.addFollowUpQuestions(validation.nextQueries, iteration)
            }
        }

        // SYNTHESIS
        await this.runSynthesis()
    }

    private async runCollection(iteration: number): Promise<void> {
        this.currentTrace!.state = 'collecting'
        this.updatePhase('collection', 'running')
        this.notify('phase_started', `Coletando informações (iteração ${iteration})...`)

        const enabledTools = toolRegistry.getEnabled()
        const pendingQuestions = this.currentTrace!.subQuestions.filter(
            sq => sq.status === 'pending' && sq.iteration < iteration
        )

        for (const subQ of pendingQuestions) {
            if (this.isAborted() || !this.checkRunId()) break
            if (this.currentTrace!.totalToolCalls >= INVESTIGATION_LIMITS.MAX_TOTAL_TOOL_CALLS) break

            subQ.status = 'collecting'
            subQ.iteration = iteration
            this.notify('subquestion_started', `Pesquisando: ${subQ.question.slice(0, 50)}...`)

            try {
                // ============================================================
                // ETAPA A: Busca ampla para mapear termos e candidatos
                // ============================================================
                const consultaPesquisa = this.montarConsultaPesquisa(subQ.question)
                let decision = await toolCallingService.decideToolUsage(
                    consultaPesquisa,
                    [],
                    enabledTools
                )
                let tentativaAutonomia = 0
                const chamadasSubPergunta: ToolCall[] = []

                if (decision.shouldUseTool && decision.toolCalls.length > 0) {
                    const allEvidence: Evidence[] = []

                    while (
                        decision.shouldUseTool &&
                        decision.toolCalls.length > 0 &&
                        tentativaAutonomia < 3 &&
                        this.currentTrace!.totalToolCalls < INVESTIGATION_LIMITS.MAX_TOTAL_TOOL_CALLS
                    ) {
                        const calls = await toolCallingService.executeToolCalls(
                            decision,
                            undefined,
                            (call) => {
                                subQ.toolCalls.push(call.id)
                                this.currentTrace!.totalToolCalls++
                            },
                            {
                                conversationId: this.contextoExecucao.conversationId,
                                projectId: this.contextoExecucao.projectId,
                                userQuery: consultaPesquisa
                            }
                        )

                        chamadasSubPergunta.push(...calls)

                        for (const call of calls) {
                            if (call.status === 'completed' && call.result?.data) {
                                const evidence = this.extractEvidenceFromToolCall(call, subQ)
                                allEvidence.push(...evidence)
                            }
                        }

                        const autonomia = toolCallingService.avaliarAutonomia(
                            consultaPesquisa,
                            calls,
                            chamadasSubPergunta,
                            enabledTools,
                            {
                                maxTentativasPorTarefa: 4,
                                modoAutonomia: 'equilibrado',
                            }
                        )

                        tentativaAutonomia++
                        if (autonomia.action !== 'continuar' || !autonomia.toolCalls?.length) {
                            break
                        }

                        decision = {
                            shouldUseTool: true,
                            toolCalls: autonomia.toolCalls,
                        }
                    }

                    // ============================================================
                    // ETAPA B: Seleção e priorização de qualidade de fontes
                    // ============================================================
                    const rankedEvidence = this.rankAndFilterEvidence(allEvidence, subQ.question)
                        .filter(e => !this.isDuplicateEvidence(e))

                    subQ.evidence.push(...rankedEvidence)
                    this.currentTrace!.evidence.push(...rankedEvidence)

                    for (const e of rankedEvidence) {
                        this.notify('evidence_found', `Encontrado: ${e.claim.slice(0, 50)}...`)
                    }

                    // Log de qualidade de fontes
                    const highQuality = rankedEvidence.filter(e => e.source.credibility === 'high').length
                    const mediumQuality = rankedEvidence.filter(e => e.source.credibility === 'medium').length
                    console.log(`[InvestigateV2] Source quality: ${highQuality} high, ${mediumQuality} medium, ${rankedEvidence.length - highQuality - mediumQuality} other`)
                }

                subQ.status = 'collected'

            } catch (error: unknown) {
                console.error('[InvestigateV2] Collection error:', error)
                subQ.status = 'failed'
            }
        }

        this.updatePhase('collection', 'completed', { iteration })
        this.notify('phase_completed', `Coleta iteração ${iteration} concluída`)
    }

    /**
     * Ranqueia e filtra evidências por qualidade de fonte
     * Prioriza: fonte primária > oficial > secundária > community
     */
    private rankAndFilterEvidence(evidence: Evidence[], question: string): Evidence[] {
        const preferredTypes = this.currentTrace!.researchPlan?.preferredSourceTypes || []
        // Score de qualidade por tipo de fonte
        const typeScores: Record<string, number> = {
            'primary': 10,
            'official': 9,
            'secondary': 5,
            'news': 4,
            'community': 3
        }

        // Score de credibilidade
        const credibilityScores: Record<string, number> = {
            'high': 10,
            'medium': 5,
            'low': 2,
            'unknown': 1
        }

        // Detecta se é assunto técnico, produto, ou controverso
        const isTechy = /programação|código|api|framework|biblioteca|software|dev/i.test(question)
        const isProduct = /preço|comprar|produto|serviço|plano/i.test(question)
        const isControversial = /melhor|vs|comparar|opinião/i.test(question)

        // Calcula score para cada evidência
        const scored = evidence.map(e => {
            let score = 0

            // Score base por tipo e credibilidade
            score += typeScores[e.source.type] || 3
            score += credibilityScores[e.source.credibility] || 1

            // Bonus por contexto
            if (isTechy && (e.source.type === 'primary' ||
                           e.source.domain.includes('github') ||
                           e.source.domain.includes('stackoverflow'))) {
                score += 5
            }

            if (isProduct && e.source.type === 'official') {
                score += 5
            }

            if (preferredTypes.includes(e.source.type)) {
                score += 4
            }

            // Penaliza duplicatas (mesmo domínio)
            const domainCount = evidence.filter(x => x.source.domain === e.source.domain).length
            if (domainCount > 1) {
                score -= 2
            }

            return { evidence: e, score }
        })

        // Ordena por score e remove duplicatas por domínio (mantém o melhor)
        scored.sort((a, b) => b.score - a.score)

        const seenDomains = new Set<string>()
        const result: Evidence[] = []

        for (const { evidence: e } of scored) {
            // Se é controverso, permite múltiplas fontes do mesmo domínio
            if (!isControversial && seenDomains.has(e.source.domain)) {
                continue
            }

            seenDomains.add(e.source.domain)
            result.push(e)

            if (result.length >= INVESTIGATION_LIMITS.MAX_EVIDENCE_PER_QUESTION) {
                break
            }
        }

        return result
    }

    private montarConsultaPesquisa(question: string): string {
        const plan = this.currentTrace!.researchPlan
        if (!plan || plan.searchAngles.length === 0) {
            return question
        }

        const angles = plan.searchAngles.slice(0, 2).join(' | ')
        const evidence = plan.requiredEvidence.slice(0, 2).join(' | ')
        return [question, angles, evidence].filter(Boolean).join('\n')
    }

    private isDuplicateEvidence(evidence: Evidence): boolean {
        const normalizedUrl = this.normalizarUrlFonte(evidence.source.url)
        const normalizedClaim = evidence.claim.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

        return this.currentTrace!.evidence.some(existing => {
            if (normalizedUrl && this.normalizarUrlFonte(existing.source.url) === normalizedUrl) {
                return true
            }

            const existingClaim = existing.claim.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
            return normalizedClaim.length > 20 && existingClaim === normalizedClaim
        })
    }

    private normalizarUrlFonte(url: string): string {
        if (!url) return ''

        try {
            const parsed = new URL(url)
            parsed.hash = ''
            parsed.search = ''
            return parsed.toString().replace(/\/$/, '')
        } catch {
            return url.trim().toLowerCase()
        }
    }

    private extractEvidenceFromToolCall(call: ToolCall, subQ: SubQuestion): Evidence[] {
        const evidence: Evidence[] = []
        const data = call.result?.data as ResultadoFerramentaInvestigacao | undefined

        if (!data) return evidence

        // Se tem resultados formatados (web search, etc)
        if (data.results && Array.isArray(data.results)) {
            for (const result of data.results.slice(0, INVESTIGATION_LIMITS.MAX_EVIDENCE_PER_QUESTION)) {
                evidence.push({
                    id: uuidv4(),
                    claim: result.title || result.content || '',
                    source: this.parseSource(result.url || '', result.title),
                    excerpt: result.content || result.snippet || '',
                    subQuestionId: subQ.id,
                    topic: subQ.question.split(' ').slice(0, 3).join(' '),
                    extractedAt: Date.now()
                })
            }
        }

        // Se tem formattedForAI (texto livre)
        if (data.formattedForAI && typeof data.formattedForAI === 'string') {
            evidence.push({
                id: uuidv4(),
                claim: data.formattedForAI.slice(0, 200),
                source: {
                    name: 'AI Summary',
                    url: '',
                    type: 'secondary',
                    credibility: 'medium',
                    domain: ''
                },
                excerpt: data.formattedForAI,
                subQuestionId: subQ.id,
                topic: subQ.question.split(' ').slice(0, 3).join(' '),
                extractedAt: Date.now()
            })
        }

        return evidence
    }

    private parseSource(url: string, title?: string): EvidenceSource {
        let domain = ''
        let name = title || 'Fonte desconhecida'

        try {
            const parsed = new URL(url)
            domain = parsed.hostname.replace('www.', '')
            name = this.getSourceName(domain) || domain
        } catch {
            // URL inválida
        }

        return {
            name,
            url,
            type: this.guessSourceType(domain),
            credibility: this.guessCredibility(domain),
            domain,
            favicon: url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : undefined
        }
    }

    private getSourceName(domain: string): string | null {
        const names: Record<string, string> = {
            'github.com': 'GitHub',
            'stackoverflow.com': 'Stack Overflow',
            'wikipedia.org': 'Wikipedia',
            'mdn.mozilla.org': 'MDN Web Docs',
            'docs.google.com': 'Google Docs',
            'medium.com': 'Medium',
            'dev.to': 'Dev.to',
            'reddit.com': 'Reddit',
            'twitter.com': 'Twitter/X',
            'youtube.com': 'YouTube',
        }
        return names[domain] || null
    }

    private guessSourceType(domain: string): SourceType {
        if (domain.includes('gov.') || domain.endsWith('.gov')) return 'official'
        if (domain.includes('edu.') || domain.endsWith('.edu')) return 'primary'
        if (domain.includes('reddit') || domain.includes('forum')) return 'community'
        if (domain.includes('news') || domain.includes('blog')) return 'news'
        return 'secondary'
    }

    private guessCredibility(domain: string): SourceCredibility {
        const highCredibility = ['github.com', 'stackoverflow.com', 'mdn.mozilla.org',
                                 'wikipedia.org', 'docs.python.org', 'docs.microsoft.com']
        const mediumCredibility = ['medium.com', 'dev.to', 'reddit.com', 'hackernews.com']

        if (highCredibility.some(d => domain.includes(d))) return 'high'
        if (mediumCredibility.some(d => domain.includes(d))) return 'medium'
        if (domain.endsWith('.gov') || domain.endsWith('.edu')) return 'high'
        return 'unknown'
    }

    private addFollowUpQuestions(queries: string[], iteration: number): void {
        const remaining = INVESTIGATION_LIMITS.MAX_SUB_QUESTIONS - this.currentTrace!.subQuestions.length
        const toAdd = queries.slice(0, remaining)

        for (const q of toAdd) {
            this.currentTrace!.subQuestions.push({
                id: uuidv4(),
                question: q,
                reasoning: 'Follow-up da validação',
                priority: this.currentTrace!.subQuestions.length + 1,
                status: 'pending',
                evidence: [],
                toolCalls: [],
                iteration: iteration
            })
        }
    }

    // ========================================================================
    // FASE 4: VALIDATION (com follow-ups)
    // ========================================================================

    private async runValidation(iteration: number): Promise<ValidationResult> {
        this.currentTrace!.state = 'validating'
        this.updatePhase('validation', 'running')
        this.notify('phase_started', 'Validando informações...')

        const evidence = this.currentTrace!.evidence

        if (evidence.length === 0) {
            const result: ValidationResult = {
                consistencies: [],
                contradictions: [],
                gaps: ['Nenhuma evidência coletada'],
                nextQueries: [],
                missingEvidence: ['Informações gerais sobre o tópico'],
                shouldContinue: iteration < 2,
                iteration,
                maxIterationsReached: iteration >= INVESTIGATION_LIMITS.MAX_COLLECTION_ITERATIONS
            }
            this.currentTrace!.validationResults.push(result)
            this.updatePhase('validation', 'completed', result)
            return result
        }

        // Formata evidências para o prompt
        const evidenceSummary = evidence.map((e, i) =>
            `[${i + 1}] ${e.claim}\n    Fonte: ${e.source.name} (${e.source.credibility})\n    Trecho: "${e.excerpt.slice(0, 100)}..."`
        ).join('\n\n')

        const prompt = `Você é um validador de pesquisa. Analise as evidências coletadas.

**Pergunta original:** "${this.currentTrace!.originalQuestion}"

**Evidências (${evidence.length}):**
${evidenceSummary}

**Analise e retorne em JSON:**
{
  "consistencies": ["Informações que se confirmam entre fontes"],
  "contradictions": [
    {
      "topic": "Tema da contradição",
      "summary": "Fonte A diz X, Fonte B diz Y"
    }
  ],
  "gaps": ["Aspectos não cobertos pelas evidências"],
  "nextQueries": ["Buscas específicas para preencher lacunas"],
  "missingEvidence": ["Tipos de evidência que faltam (ex: fonte oficial, dados recentes)"],
  "overallAssessment": "suficiente" | "parcial" | "insuficiente"
}`

        try {
            const response = await this.chatFn!(prompt)
            const parsed = this.parseJSON(response) as RespostaValidacao | null

            const result: ValidationResult = {
                consistencies: parsed?.consistencies || [],
                contradictions: (parsed?.contradictions || []).map((c) => {
                    const resumo = c.summary || ''
                    const [parteUm = resumo, parteDois = ''] = resumo.split(' vs ')
                    return {
                        topic: c.topic || 'Conflito',
                        claim1: { evidenceId: '', summary: parteUm, source: '' },
                        claim2: { evidenceId: '', summary: parteDois, source: '' }
                    }
                }),
                gaps: parsed?.gaps || [],
                nextQueries: parsed?.nextQueries || [],
                missingEvidence: parsed?.missingEvidence || [],
                shouldContinue: parsed?.overallAssessment === 'insuficiente' || parsed?.overallAssessment === 'parcial',
                iteration,
                maxIterationsReached: iteration >= INVESTIGATION_LIMITS.MAX_COLLECTION_ITERATIONS
            }

            this.currentTrace!.validationResults.push(result)
            this.updatePhase('validation', 'completed', result)
            this.notify('validation_complete',
                `Validação: ${result.consistencies.length} consistências, ${result.gaps.length} lacunas`)

            return result

        } catch (error: unknown) {
            console.error('[InvestigateV2] Validation error:', error)
            this.updatePhase('validation', 'failed', null, obterMensagemErro(error, 'Falha na validação'))

            return {
                consistencies: [],
                contradictions: [],
                gaps: [],
                nextQueries: [],
                missingEvidence: [],
                shouldContinue: false,
                iteration,
                maxIterationsReached: true
            }
        }
    }

    // ========================================================================
    // FASE 5: SYNTHESIS
    // ========================================================================

    private async runSynthesis(): Promise<void> {
        this.currentTrace!.state = 'synthesizing'
        this.updatePhase('synthesis', 'running')
        this.notify('synthesis_started', 'Sintetizando resposta...')

        const evidence = this.currentTrace!.evidence
        const validations = this.currentTrace!.validationResults

        // Formata evidências com números para citação
        const evidenceWithNumbers = evidence.map((e, i) => ({
            ...e,
            citationNumber: i + 1
        }))

        const evidenceText = evidenceWithNumbers.map(e =>
            `[${e.citationNumber}] ${e.claim}\n    Fonte: ${e.source.name} (${e.source.url})`
        ).join('\n')

        const validationNotes = validations.flatMap(v => [
            ...v.consistencies.map(c => `✓ ${c}`),
            ...v.contradictions.map(c => `⚠ Conflito: ${c.topic}`),
            ...v.gaps.map(g => `? Lacuna: ${g}`)
        ]).join('\n')
        const categoryInstructions = this.obterInstrucoesSintesePorCategoria(this.currentTrace!.researchCategory || 'general')
        const plan = this.currentTrace!.researchPlan

        const prompt = `Você é um pesquisador sintetizando resultados.

**Pergunta:** "${this.currentTrace!.originalQuestion}"
**Categoria:** ${this.currentTrace!.researchCategory || 'general'}
**Objetivo do plano:** ${plan?.objective || 'Responder com evidências suficientes'}
**Critérios de sucesso:** ${(plan?.successCriteria || []).join('; ') || 'resposta clara, citada e honesta sobre lacunas'}

**Evidências numeradas:**
${evidenceText || '(Nenhuma evidência específica)'}

**Notas de validação:**
${validationNotes || '(Sem validação adicional)'}

**Instruções:**
1. Responda completamente à pergunta
2. Use citações no formato [1], [2] etc referenciando as evidências
3. Mencione contradições encontradas
4. Seja claro sobre limitações ou incertezas
5. No final, liste as fontes citadas
${categoryInstructions}

**Sua resposta:**`

        try {
            const response = await this.chatFn!(prompt)

            this.currentTrace!.finalAnswer = response

            // Extrai citações usadas
            const citationMatches = response.match(/\[(\d+)\]/g) || []
            const usedCitations = [...new Set(citationMatches.map((m) => parseInt(m.replaceAll('[', '').replaceAll(']', ''), 10)))]

            this.currentTrace!.citations = usedCitations
                .filter(n => n <= evidence.length)
                .map(n => {
                    const e = evidence[n - 1]
                    return {
                        marker: `[${n}]`,
                        evidenceId: e.id,
                        url: e.source.url,
                        title: e.source.name
                    }
                })

            // Calcula confiança justificável
            this.currentTrace!.confidence = this.calculateConfidence()
            this.currentTrace!.stats = this.calcularEstatisticasPesquisa()

            this.currentTrace!.state = 'completed'
            this.updatePhase('synthesis', 'completed')
            this.notify('completed', 'Investigação concluída')

        } catch (error: unknown) {
            const mensagemErro = obterMensagemErro(error, 'Falha na síntese')
            this.updatePhase('synthesis', 'failed', null, mensagemErro)
            this.currentTrace!.finalAnswer = `Não foi possível sintetizar: ${mensagemErro}`
            this.currentTrace!.state = 'failed'
            throw error
        }
    }

    private obterInstrucoesSintesePorCategoria(category: ResearchCategory): string {
        const instructions: Record<ResearchCategory, string> = {
            general: '6. Organize a resposta por tópicos quando isso melhorar a leitura.',
            product: '6. Inclua critérios de decisão, ressalvas de preço/disponibilidade e evite recomendar sem evidência recente.',
            comparison: '6. Inclua uma tabela comparativa quando houver pelo menos dois itens comparáveis.',
            howto: '6. Responda em passos acionáveis, com pré-requisitos, riscos e validação ao final.',
            factcheck: '6. Separe evidências a favor, evidências contra e dê um veredito proporcional à força das fontes.'
        }

        return instructions[category]
    }

    private calcularEstatisticasPesquisa() {
        const evidence = this.currentTrace!.evidence
        return {
            uniqueDomains: new Set(evidence.map(e => e.source.domain).filter(Boolean)).size,
            highCredibilitySources: evidence.filter(e => e.source.credibility === 'high').length,
            officialOrPrimarySources: evidence.filter(e => e.source.type === 'official' || e.source.type === 'primary').length,
            totalEvidence: evidence.length
        }
    }

    private calculateConfidence(): ConfidenceAssessment {
        const evidence = this.currentTrace!.evidence
        const validations = this.currentTrace!.validationResults

        const factors = {
            independentSources: new Set(evidence.map(e => e.source.domain)).size,
            sourceQuality: this.getAverageSourceQuality(evidence) as ConfidenceLevel,
            recency: this.getRecencyAssessment(evidence) as 'current' | 'recent' | 'dated' | 'unknown',
            consistency: this.getConsistencyLevel(validations) as 'strong' | 'partial' | 'conflicting',
            inferenceLevel: (evidence.length > 3 ? 'minimal' : evidence.length > 0 ? 'moderate' : 'high') as 'minimal' | 'moderate' | 'high',
            hasGaps: validations.some(v => v.gaps.length > 0),
            hasPrimarySource: evidence.some(e => e.source.type === 'primary' || e.source.type === 'official')
        }

        // Calcula score baseado em fatores
        let score = 50 // Base

        // Fontes independentes (+5 por fonte, max +20)
        score += Math.min(factors.independentSources * 5, 20)

        // Qualidade das fontes
        if (factors.sourceQuality === 'high') score += 15
        else if (factors.sourceQuality === 'medium') score += 5
        else score -= 10

        // Fonte primária
        if (factors.hasPrimarySource) score += 10

        // Consistência
        if (factors.consistency === 'strong') score += 10
        else if (factors.consistency === 'conflicting') score -= 15

        // Lacunas
        if (factors.hasGaps) score -= 10

        // Limita entre 0-100
        score = Math.max(0, Math.min(100, score))

        // Determina nível
        let level: ConfidenceLevel = 'medium'
        if (score >= 75) level = 'high'
        else if (score < 50) level = 'low'

        // Gera justificativa
        const justificationParts: string[] = []
        if (factors.independentSources > 2) justificationParts.push(`${factors.independentSources} fontes independentes`)
        if (factors.hasPrimarySource) justificationParts.push('inclui fonte primária')
        if (factors.consistency === 'conflicting') justificationParts.push('há contradições entre fontes')
        if (factors.hasGaps) justificationParts.push('algumas lacunas identificadas')

        const warnings: string[] = []
        if (factors.consistency === 'conflicting') warnings.push('Fontes apresentam informações conflitantes')
        if (factors.hasGaps) warnings.push('Nem todos os aspectos foram cobertos')
        if (factors.sourceQuality === 'low') warnings.push('Qualidade das fontes é limitada')

        return {
            level,
            score,
            factors,
            justification: justificationParts.join(', ') || 'Análise baseada em evidências disponíveis',
            warnings
        }
    }

    private getAverageSourceQuality(evidence: Evidence[]): string {
        if (evidence.length === 0) return 'low'
        const qualities = evidence.map(e => e.source.credibility)
        const highCount = qualities.filter(q => q === 'high').length
        if (highCount >= evidence.length / 2) return 'high'
        if (highCount > 0 || qualities.filter(q => q === 'medium').length > 0) return 'medium'
        return 'low'
    }

    private getRecencyAssessment(evidence: Evidence[]): string {
        if (evidence.length === 0) return 'unknown'
        const timestamps = evidence
            .map(e => this.parseDataFonte(e.source.date))
            .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t))

        if (timestamps.length === 0) return 'unknown'

        const maisRecente = Math.max(...timestamps)
        const agora = Date.now()
        const dias = Math.max(0, Math.floor((agora - maisRecente) / (1000 * 60 * 60 * 24)))

        if (dias <= 7) return 'current'
        if (dias <= 365) return 'recent'
        return 'dated'
    }

    private parseDataFonte(data?: string): number | null {
        if (!data) return null
        const limpa = data.trim()
        if (!limpa) return null

        const ts = Date.parse(limpa)
        if (!Number.isNaN(ts)) return ts

        const matchBr = limpa.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
        if (matchBr) {
            const dia = Number(matchBr[1])
            const mes = Number(matchBr[2]) - 1
            const ano = Number(matchBr[3])
            const parsed = new Date(ano, mes, dia).getTime()
            return Number.isNaN(parsed) ? null : parsed
        }

        const matchIso = limpa.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
        if (matchIso) {
            const ano = Number(matchIso[1])
            const mes = Number(matchIso[2]) - 1
            const dia = Number(matchIso[3])
            const parsed = new Date(ano, mes, dia).getTime()
            return Number.isNaN(parsed) ? null : parsed
        }

        return null
    }

    private getConsistencyLevel(validations: ValidationResult[]): string {
        if (validations.length === 0) return 'partial'
        const lastValidation = validations[validations.length - 1]
        if (lastValidation.contradictions.length > 2) return 'conflicting'
        if (lastValidation.contradictions.length > 0) return 'partial'
        if (lastValidation.consistencies.length > 2) return 'strong'
        return 'partial'
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private createInitialTrace(question: string, runId: string): InvestigationTrace {
        return {
            id: uuidv4(),
            runId,
            originalQuestion: question,
            state: 'routing',
            phases: [
                { name: 'routing', status: 'pending' },
                { name: 'decomposition', status: 'pending' },
                { name: 'clarification', status: 'pending' },
                { name: 'collection', status: 'pending' },
                { name: 'validation', status: 'pending' },
                { name: 'synthesis', status: 'pending' }
            ],
            currentPhase: 'routing',
            subQuestions: [],
            evidence: [],
            validationResults: [],
            currentIteration: 0,
            finalAnswer: '',
            confidence: null,
            citations: [],
            totalToolCalls: 0,
            totalDurationMs: 0,
            startedAt: Date.now(),
            errors: []
        }
    }

    private updatePhase(
        name: InvestigationPhase['name'],
        status: InvestigationPhase['status'],
        result?: unknown,
        error?: string
    ): void {
        if (!this.currentTrace) return

        const phase = this.currentTrace.phases.find(p => p.name === name)
        if (phase) {
            phase.status = status
            if (status === 'running') phase.startedAt = Date.now()
            if (status === 'completed' || status === 'failed') phase.completedAt = Date.now()
            if (result) phase.result = result
            if (error) phase.error = error
        }

        this.currentTrace.currentPhase = name
    }

    private parseJSON(text: string): unknown | null {
        try {
            return JSON.parse(text)
        } catch {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) {
                try {
                    return JSON.parse(match[1].trim())
                } catch {
                    return null
                }
            }
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
     * Mensagem de status para UI
     */
    getStatusMessage(): string {
        if (!this.currentTrace) return ''

        switch (this.currentTrace.state) {
            case 'routing':
                return 'Analisando pergunta...'
            case 'decomposing':
                return 'Identificando sub-perguntas...'
            case 'awaiting_clarification':
                return 'Aguardando seu esclarecimento...'
            case 'collecting': {
                const collecting = this.currentTrace.subQuestions.find(sq => sq.status === 'collecting')
                if (collecting) {
                    return `Pesquisando: "${collecting.question.slice(0, 40)}..."`
                }
                return `Coletando informações (iteração ${this.currentTrace.currentIteration})...`
            }
            case 'validating':
                return 'Validando e cruzando informações...'
            case 'synthesizing':
                return 'Sintetizando resposta final...'
            case 'completed':
                return 'Investigação concluída'
            case 'cancelled':
                return 'Investigação cancelada'
            case 'failed':
                return 'Investigação falhou'
            default:
                return 'Investigando...'
        }
    }
}

// Singleton
export const investigateService = new InvestigateServiceV2()
export default investigateService
