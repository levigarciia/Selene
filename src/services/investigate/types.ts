/**
 * Investigate Types v2
 *
 * Tipos estruturados para o modo investigar com:
 * - Evidências rastreáveis
 * - Confiança justificável
 * - Checkpoints de alinhamento
 * - Loop adaptativo
 */

// ============================================================================
// EVIDENCE (Evidência Estruturada)
// ============================================================================

export type SourceType = 'primary' | 'secondary' | 'official' | 'community' | 'news'
export type SourceCredibility = 'high' | 'medium' | 'low' | 'unknown'

export interface EvidenceSource {
    name: string              // Nome da fonte (ex: "TechCrunch", "MDN")
    url: string
    type: SourceType
    credibility: SourceCredibility
    date?: string             // Data da informação (ISO string)
    domain: string            // Domínio extraído
    favicon?: string
}

export interface Evidence {
    id: string
    claim: string             // A afirmação/fato extraído
    source: EvidenceSource
    excerpt: string           // Trecho original que suporta a claim
    subQuestionId: string     // Qual sub-pergunta gerou isso
    topic: string             // Categoria/tópico
    extractedAt: number       // Timestamp
}

// ============================================================================
// CONFIDENCE (Confiança Justificável)
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConfidenceFactors {
    independentSources: number        // Quantidade de fontes independentes
    sourceQuality: ConfidenceLevel    // Qualidade média das fontes
    recency: 'current' | 'recent' | 'dated' | 'unknown'
    consistency: 'strong' | 'partial' | 'conflicting'
    inferenceLevel: 'minimal' | 'moderate' | 'high'
    hasGaps: boolean
    hasPrimarySource: boolean
}

export interface ConfidenceAssessment {
    level: ConfidenceLevel
    score: number                     // 0-100
    factors: ConfidenceFactors
    justification: string             // 1-2 frases explicando
    warnings: string[]                // Alertas (ex: "fontes datadas", "conflito entre fontes")
}

// ============================================================================
// ALIGNMENT CHECKPOINT (Checkpoint de Alinhamento)
// ============================================================================

export type ClarificationReason =
    | 'multiple_interpretations'
    | 'needs_context'
    | 'user_preferences'
    | 'scope_too_broad'
    | 'ambiguous_terms'

export interface AlignmentCheckpoint {
    needsClarification: boolean
    reasons: ClarificationReason[]
    clarifyingQuestions: string[]     // 1-3 perguntas
    proposedPlan: string              // Resumo do plano de investigação
    estimatedSteps: number            // Estimativa de passos
    waitingForUser: boolean
}

export interface UserClarification {
    answers: Record<string, string>   // question -> answer
    adjustedScope?: string            // Escopo ajustado pelo usuário
    skipClarification?: boolean       // Usuário pediu para pular
}

// ============================================================================
// VALIDATION WITH FOLLOW-UPS
// ============================================================================

export interface Contradiction {
    topic: string
    claim1: {
        evidenceId: string
        summary: string
        source: string
    }
    claim2: {
        evidenceId: string
        summary: string
        source: string
    }
}

export interface ValidationResult {
    consistencies: string[]
    contradictions: Contradiction[]
    gaps: string[]
    nextQueries: string[]             // O que ainda precisa buscar
    missingEvidence: string[]         // Que tipo de evidência falta
    shouldContinue: boolean           // Precisa de mais iterações?
    iteration: number
    maxIterationsReached: boolean
}

// ============================================================================
// ROUTING (Roteador)
// ============================================================================

export type RouteDecision = 'direct' | 'clarify' | 'investigate'
export type ResearchCategory = 'general' | 'product' | 'comparison' | 'howto' | 'factcheck'

export interface ResearchPlan {
    category: ResearchCategory
    objective: string
    searchAngles: string[]
    requiredEvidence: string[]
    successCriteria: string[]
    preferredSourceTypes: SourceType[]
}

export interface InvestigationStats {
    uniqueDomains: number
    highCredibilitySources: number
    officialOrPrimarySources: number
    totalEvidence: number
}

export interface RouteAnalysis {
    decision: RouteDecision
    reasoning: string
    signals: {
        isShortAndSimple: boolean
        needsCurrentInfo: boolean
        needsMultipleSources: boolean
        isAmbiguous: boolean
        hasEnoughContext: boolean
        isComplex: boolean
    }
}

// ============================================================================
// SUB-QUESTIONS
// ============================================================================

export interface SubQuestion {
    id: string
    question: string
    reasoning: string
    priority: number
    status: 'pending' | 'collecting' | 'collected' | 'failed'
    evidence: Evidence[]              // Mudou de findings: string[]
    toolCalls: string[]               // IDs dos tool calls
    iteration: number                 // Em qual iteração foi coletado
}

// ============================================================================
// INVESTIGATION STATE
// ============================================================================

export type InvestigationState =
    | 'idle'
    | 'routing'
    | 'decomposing'
    | 'awaiting_clarification'
    | 'collecting'
    | 'validating'
    | 'synthesizing'
    | 'completed'
    | 'failed'
    | 'cancelled'

export interface InvestigationPhase {
    name: 'routing' | 'decomposition' | 'clarification' | 'collection' | 'validation' | 'synthesis'
    status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'skipped'
    startedAt?: number
    completedAt?: number
    result?: unknown
    error?: string
    iteration?: number                // Para fases que podem repetir
}

// ============================================================================
// INVESTIGATION TRACE (Rastreio Completo)
// ============================================================================

export interface InvestigationTrace {
    id: string
    runId: string                     // Único por execução (para cancelamento)
    originalQuestion: string
    state: InvestigationState

    // Routing
    routeAnalysis?: RouteAnalysis

    // Phases
    phases: InvestigationPhase[]
    currentPhase: InvestigationPhase['name'] | null

    // Decomposition
    subQuestions: SubQuestion[]
    researchPlan?: ResearchPlan
    researchCategory?: ResearchCategory

    // Alignment
    alignmentCheckpoint?: AlignmentCheckpoint
    userClarification?: UserClarification

    // Evidence (não mais strings soltas)
    evidence: Evidence[]

    // Validation
    validationResults: ValidationResult[]
    currentIteration: number

    // Synthesis
    finalAnswer: string
    confidence: ConfidenceAssessment | null
    citations: {
        marker: string               // [1], [2], etc.
        evidenceId: string
        url: string
        title: string
    }[]

    // Meta
    totalToolCalls: number
    totalDurationMs: number
    stats?: InvestigationStats
    startedAt: number
    completedAt?: number

    // Errors
    errors: {
        phase: string
        message: string
        timestamp: number
    }[]
}

// ============================================================================
// UPDATES (Para UI reativa)
// ============================================================================

export type InvestigationUpdateType =
    | 'state_changed'
    | 'phase_started'
    | 'phase_completed'
    | 'subquestion_started'
    | 'evidence_found'
    | 'validation_complete'
    | 'clarification_needed'
    | 'clarification_received'
    | 'iteration_started'
    | 'synthesis_started'
    | 'completed'
    | 'error'
    | 'cancelled'

export interface InvestigationUpdate {
    type: InvestigationUpdateType
    trace: InvestigationTrace
    message?: string                  // Mensagem para UI
    data?: unknown
}

export type InvestigationListener = (update: InvestigationUpdate) => void

// ============================================================================
// LIMITS
// ============================================================================

export const INVESTIGATION_LIMITS = {
    MAX_COLLECTION_ITERATIONS: 3,
    MAX_TOTAL_TOOL_CALLS: 10,
    MAX_INVESTIGATION_TIME_MS: 120000,  // 2 minutos
    MAX_SUB_QUESTIONS: 5,
    MAX_EVIDENCE_PER_QUESTION: 5,
    MAX_CLARIFYING_QUESTIONS: 3,
} as const
