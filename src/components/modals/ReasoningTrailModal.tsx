/**
 * Reasoning Trail Modal v2
 * 
 * Displays the audit trail of an investigation showing:
 * - Timeline of phases
 * - Sub-questions generated
 * - Evidence collected
 * - Validation results
 * - Confidence assessment
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    ChevronDown,
    ChevronRight,
    Brain,
    Search,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
    MessageSquare,
    FileSearch,
    ShieldCheck,
    Sparkles,
    ExternalLink,
    Timer,
    XCircle
} from 'lucide-react'
import type { 
    InvestigationTrace, 
    InvestigationPhase, 
    SubQuestion,
    Evidence,
    ConfidenceAssessment,
    ValidationResult
} from '../../services/investigate'

interface ReasoningTrailModalProps {
    isOpen: boolean
    onClose: () => void
    trace: InvestigationTrace | null
}

export const ReasoningTrailModal: React.FC<ReasoningTrailModalProps> = ({
    isOpen,
    onClose,
    trace
}) => {
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['decomposition', 'collection']))
    const [expandedSubQuestions, setExpandedSubQuestions] = useState<Set<string>>(new Set())

    if (!isOpen || !trace) return null

    const togglePhase = (phase: string) => {
        setExpandedPhases(prev => {
            const next = new Set(prev)
            if (next.has(phase)) {
                next.delete(phase)
            } else {
                next.add(phase)
            }
            return next
        })
    }

    const toggleSubQuestion = (id: string) => {
        setExpandedSubQuestions(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const getPhaseIcon = (name: string) => {
        switch (name) {
            case 'routing': return Brain
            case 'decomposition': return Brain
            case 'clarification': return MessageSquare
            case 'collection': return FileSearch
            case 'validation': return ShieldCheck
            case 'synthesis': return Sparkles
            default: return MessageSquare
        }
    }

    const getPhaseName = (name: string) => {
        switch (name) {
            case 'routing': return 'Análise'
            case 'decomposition': return 'Decomposição'
            case 'clarification': return 'Alinhamento'
            case 'collection': return 'Coleta'
            case 'validation': return 'Validação'
            case 'synthesis': return 'Síntese'
            default: return name
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 size={14} className="text-green-400" />
            case 'running': return <Loader2 size={14} className="text-yellow-400 animate-spin" />
            case 'failed': return <AlertCircle size={14} className="text-red-400" />
            case 'waiting': return <Timer size={14} className="text-yellow-400" />
            case 'skipped': return <XCircle size={14} className="text-neutral-500" />
            default: return <Clock size={14} className="text-neutral-500" />
        }
    }

    const getConfidenceColor = (confidence: ConfidenceAssessment | null) => {
        if (!confidence) return 'text-neutral-400'
        if (confidence.level === 'high') return 'text-green-400'
        if (confidence.level === 'medium') return 'text-yellow-400'
        return 'text-red-400'
    }

    const getConfidenceScore = (confidence: ConfidenceAssessment | null) => {
        if (!confidence) return 0
        return confidence.score
    }

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

    // Get total evidence count
    const totalEvidence = trace.evidence.length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-[700px] max-h-[85vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                            <Brain size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Linha de Raciocínio</h2>
                            <p className="text-xs text-neutral-500">Auditoria do processo de investigação</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Confidence Badge */}
                        <div className={`px-3 py-1 rounded-full bg-neutral-800 ${getConfidenceColor(trace.confidence)}`}>
                            <span className="text-xs font-medium">
                                {getConfidenceScore(trace.confidence)}% confiança
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={18} className="text-neutral-400" />
                        </button>
                    </div>
                </div>

                {/* Original Question */}
                <div className="px-6 py-3 bg-neutral-800/30 border-b border-white/5 shrink-0">
                    <p className="text-xs text-neutral-500 mb-1">Pergunta Original</p>
                    <p className="text-sm text-white">{trace.originalQuestion}</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Phases Timeline */}
                    {trace.phases.map((phase: InvestigationPhase, idx: number) => (
                        <PhaseCard
                            key={phase.name}
                            phase={phase}
                            isExpanded={expandedPhases.has(phase.name)}
                            onToggle={() => togglePhase(phase.name)}
                            icon={getPhaseIcon(phase.name)}
                            phaseName={getPhaseName(phase.name)}
                            statusIcon={getStatusIcon(phase.status)}
                            isLast={idx === trace.phases.length - 1}
                        >
                            {/* Phase-specific content */}
                            {phase.name === 'decomposition' && (
                                <div className="space-y-2">
                                    {trace.subQuestions.map((sq: SubQuestion, i: number) => (
                                        <SubQuestionCard
                                            key={sq.id}
                                            subQuestion={sq}
                                            index={i + 1}
                                            isExpanded={expandedSubQuestions.has(sq.id)}
                                            onToggle={() => toggleSubQuestion(sq.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {phase.name === 'collection' && (
                                <div className="space-y-2">
                                    {trace.evidence.length > 0 ? (
                                        trace.evidence.slice(0, 5).map((ev: Evidence, i: number) => (
                                            <EvidenceCard key={ev.id} evidence={ev} index={i + 1} />
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">Nenhuma evidência coletada</p>
                                    )}
                                    {trace.evidence.length > 5 && (
                                        <p className="text-xs text-neutral-500">
                                            +{trace.evidence.length - 5} mais evidências
                                        </p>
                                    )}
                                </div>
                            )}

                            {phase.name === 'validation' && (
                                <div className="space-y-2">
                                    {trace.validationResults.length > 0 ? (
                                        <ValidationResultCard result={trace.validationResults[trace.validationResults.length - 1]} />
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">Sem resultados de validação</p>
                                    )}
                                </div>
                            )}

                            {phase.name === 'synthesis' && phase.status === 'completed' && (
                                <div className="space-y-2">
                                    <div className="text-sm text-neutral-300 bg-neutral-800/50 p-3 rounded-lg">
                                        {trace.finalAnswer.substring(0, 300)}
                                        {trace.finalAnswer.length > 300 && '...'}
                                    </div>
                                    {trace.confidence && (
                                        <ConfidenceCard confidence={trace.confidence} />
                                    )}
                                </div>
                            )}
                        </PhaseCard>
                    ))}

                    {/* Errors */}
                    {trace.errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <p className="text-xs text-red-400 font-medium mb-2">Erros/Avisos</p>
                            {trace.errors.map((err, idx) => (
                                <div key={idx} className="text-xs text-red-300">
                                    • [{err.phase}] {err.message}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/10 bg-neutral-800/30 shrink-0">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                            {totalEvidence} evidências · {trace.subQuestions.length} sub-perguntas · Iteração {trace.currentIteration}
                        </span>
                        <span>
                            Duração total: {formatDuration(trace.totalDurationMs)}
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface PhaseCardProps {
    phase: InvestigationPhase
    isExpanded: boolean
    onToggle: () => void
    icon: React.ElementType
    phaseName: string
    statusIcon: React.ReactNode
    isLast: boolean
    children: React.ReactNode
}

const PhaseCard: React.FC<PhaseCardProps> = ({
    phase,
    isExpanded,
    onToggle,
    icon: Icon,
    phaseName,
    statusIcon,
    isLast,
    children
}) => {
    const duration = phase.completedAt && phase.startedAt
        ? phase.completedAt - phase.startedAt
        : null

    return (
        <div className="relative">
            {/* Timeline line */}
            {!isLast && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-neutral-700/50" />
            )}

            <div className="relative">
                <button
                    onClick={onToggle}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isExpanded ? 'bg-neutral-800/70' : 'hover:bg-neutral-800/40'
                    }`}
                >
                    {/* Timeline dot */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        phase.status === 'completed' ? 'bg-green-500/20' :
                        phase.status === 'running' ? 'bg-yellow-500/20' :
                        phase.status === 'failed' ? 'bg-red-500/20' :
                        phase.status === 'waiting' ? 'bg-yellow-500/20' :
                        'bg-neutral-700/50'
                    }`}>
                        <Icon size={16} className={
                            phase.status === 'completed' ? 'text-green-400' :
                            phase.status === 'running' ? 'text-yellow-400' :
                            phase.status === 'failed' ? 'text-red-400' :
                            phase.status === 'waiting' ? 'text-yellow-400' :
                            'text-neutral-500'
                        } />
                    </div>

                    <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{phaseName}</span>
                            {statusIcon}
                            {duration && (
                                <span className="text-xs text-neutral-600">{(duration / 1000).toFixed(1)}s</span>
                            )}
                        </div>
                    </div>

                    {isExpanded ? (
                        <ChevronDown size={16} className="text-neutral-500" />
                    ) : (
                        <ChevronRight size={16} className="text-neutral-500" />
                    )}
                </button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pl-14 pr-3 pb-3">
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

interface SubQuestionCardProps {
    subQuestion: SubQuestion
    index: number
    isExpanded: boolean
    onToggle: () => void
}

const SubQuestionCard: React.FC<SubQuestionCardProps> = ({
    subQuestion,
    index,
    isExpanded,
    onToggle
}) => {
    const statusIcon = subQuestion.status === 'collected'
        ? <CheckCircle2 size={12} className="text-green-400" />
        : subQuestion.status === 'collecting'
        ? <Loader2 size={12} className="text-yellow-400 animate-spin" />
        : subQuestion.status === 'failed'
        ? <AlertCircle size={12} className="text-red-400" />
        : <Clock size={12} className="text-neutral-500" />

    return (
        <div className="bg-neutral-800/40 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-800/60 transition-colors"
            >
                <span className="text-xs text-neutral-500 shrink-0">#{index}</span>
                <span className="text-xs text-white flex-1 text-left truncate">{subQuestion.question}</span>
                {statusIcon}
                {subQuestion.evidence.length > 0 && (
                    <span className="text-xs text-neutral-500">({subQuestion.evidence.length})</span>
                )}
                {isExpanded ? (
                    <ChevronDown size={14} className="text-neutral-600" />
                ) : (
                    <ChevronRight size={14} className="text-neutral-600" />
                )}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2">
                            <p className="text-xs text-neutral-500 italic">{subQuestion.reasoning}</p>
                            
                            {subQuestion.evidence.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs text-neutral-400 mb-1">Evidências:</p>
                                    {subQuestion.evidence.slice(0, 3).map((ev: Evidence, i: number) => (
                                        <div key={ev.id} className="text-xs text-neutral-300 bg-neutral-700/30 p-2 rounded mt-1">
                                            <span className="text-purple-400">[{i + 1}]</span> {ev.claim.substring(0, 100)}
                                            {ev.claim.length > 100 && '...'}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {subQuestion.toolCalls.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-neutral-500">
                                    <Search size={10} />
                                    <span>{subQuestion.toolCalls.length} ferramenta(s) usada(s)</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

interface EvidenceCardProps {
    evidence: Evidence
    index: number
}

const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, index }) => {
    const credibilityColor = evidence.source.credibility === 'high' 
        ? 'bg-green-500/20 text-green-400'
        : evidence.source.credibility === 'medium'
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-neutral-500/20 text-neutral-400'

    return (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-neutral-800/40">
            <span className="text-xs text-purple-400 font-mono shrink-0">[{index}]</span>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-white line-clamp-2">{evidence.claim}</p>
                <div className="flex items-center gap-2 mt-1">
                    {evidence.source.favicon && (
                        <img src={evidence.source.favicon} alt="" className="w-3 h-3 rounded-sm" />
                    )}
                    <span className="text-xs text-neutral-500">{evidence.source.name}</span>
                    <span className={`text-[10px] px-1 py-0.5 rounded ${credibilityColor}`}>
                        {evidence.source.credibility}
                    </span>
                </div>
            </div>
            {evidence.source.url && (
                <a
                    href={evidence.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-500 hover:text-purple-400 transition-colors"
                >
                    <ExternalLink size={12} />
                </a>
            )}
        </div>
    )
}

interface ValidationResultCardProps {
    result: Pick<ValidationResult, 'consistencies' | 'contradictions' | 'gaps' | 'shouldContinue'>
}

const ValidationResultCard: React.FC<ValidationResultCardProps> = ({ result }) => {
    return (
        <div className="space-y-2">
            {result.consistencies.length > 0 && (
                <div>
                    <p className="text-xs text-green-400 mb-1">✓ Consistências</p>
                    {result.consistencies.map((c, i) => (
                        <p key={i} className="text-xs text-neutral-300 pl-3">• {c}</p>
                    ))}
                </div>
            )}
            {result.contradictions.length > 0 && (
                <div>
                    <p className="text-xs text-yellow-400 mb-1">⚠ Contradições</p>
                    {result.contradictions.map((c, i) => (
                        <p key={i} className="text-xs text-neutral-300 pl-3">• {c.topic}</p>
                    ))}
                </div>
            )}
            {result.gaps.length > 0 && (
                <div>
                    <p className="text-xs text-neutral-400 mb-1">? Lacunas</p>
                    {result.gaps.map((g, i) => (
                        <p key={i} className="text-xs text-neutral-300 pl-3">• {g}</p>
                    ))}
                </div>
            )}
        </div>
    )
}

interface ConfidenceCardProps {
    confidence: ConfidenceAssessment
}

const ConfidenceCard: React.FC<ConfidenceCardProps> = ({ confidence }) => {
    const levelColor = confidence.level === 'high' 
        ? 'text-green-400' 
        : confidence.level === 'medium' 
        ? 'text-yellow-400' 
        : 'text-red-400'

    return (
        <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-500">Confiança</span>
                <span className={`text-sm font-medium ${levelColor}`}>
                    {confidence.level === 'high' ? 'Alta' : 
                     confidence.level === 'medium' ? 'Média' : 'Baixa'} ({confidence.score}%)
                </span>
            </div>
            <p className="text-xs text-neutral-400">{confidence.justification}</p>
            {confidence.warnings.length > 0 && (
                <div className="mt-2 text-xs text-yellow-400">
                    ⚠️ {confidence.warnings[0]}
                </div>
            )}
        </div>
    )
}

export default ReasoningTrailModal
