/**
 * Reasoning Trail Modal
 * 
 * Displays the audit trail of an investigation showing:
 * - Timeline of phases
 * - Sub-questions generated
 * - Tool calls with inputs/outputs
 * - Validation findings
 * - Confidence score
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
    Globe,
    Plug
} from 'lucide-react'
import type { InvestigationTrace, InvestigationPhase, SubQuestion } from '../../services/investigate/InvestigateService'
import type { ToolCall } from '../../types/tools'

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
            case 'decomposition': return Brain
            case 'collection': return FileSearch
            case 'validation': return ShieldCheck
            case 'synthesis': return Sparkles
            default: return MessageSquare
        }
    }

    const getPhaseName = (name: string) => {
        switch (name) {
            case 'decomposition': return 'Decomposição'
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
            default: return <Clock size={14} className="text-neutral-500" />
        }
    }

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.7) return 'text-green-400'
        if (confidence >= 0.4) return 'text-yellow-400'
        return 'text-red-400'
    }

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

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
                                {(trace.confidence * 100).toFixed(0)}% confiança
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
                    {trace.phases.map((phase, idx) => (
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
                                    {trace.subQuestions.map((sq, i) => (
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
                                    {trace.toolCalls.length > 0 ? (
                                        trace.toolCalls.map((call, i) => (
                                            <ToolCallCard key={call.id} call={call} index={i + 1} />
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">Nenhuma ferramenta utilizada</p>
                                    )}
                                </div>
                            )}

                            {phase.name === 'validation' && (
                                <div className="space-y-2">
                                    {trace.validationNotes.length > 0 ? (
                                        trace.validationNotes.map((note, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs">
                                                <span className="text-neutral-400">{note}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">Sem notas de validação</p>
                                    )}
                                </div>
                            )}

                            {phase.name === 'synthesis' && phase.status === 'completed' && (
                                <div className="text-sm text-neutral-300 bg-neutral-800/50 p-3 rounded-lg">
                                    {trace.finalAnswer.substring(0, 300)}
                                    {trace.finalAnswer.length > 300 && '...'}
                                </div>
                            )}
                        </PhaseCard>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/10 bg-neutral-800/30 shrink-0">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                            {trace.toolCalls.length} ferramentas · {trace.subQuestions.length} sub-perguntas · {trace.findings.length} descobertas
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
                        'bg-neutral-700/50'
                    }`}>
                        <Icon size={16} className={
                            phase.status === 'completed' ? 'text-green-400' :
                            phase.status === 'running' ? 'text-yellow-400' :
                            phase.status === 'failed' ? 'text-red-400' :
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
                            
                            {subQuestion.findings.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs text-neutral-400 mb-1">Descobertas:</p>
                                    {subQuestion.findings.map((f, i) => (
                                        <div key={i} className="text-xs text-neutral-300 bg-neutral-700/30 p-2 rounded mt-1">
                                            {f.substring(0, 150)}{f.length > 150 && '...'}
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

interface ToolCallCardProps {
    call: ToolCall
    index: number
}

const ToolCallCard: React.FC<ToolCallCardProps> = ({ call, index }) => {
    const isSuccess = call.status === 'completed' && call.result?.success
    const isFailed = call.status === 'failed' || (call.result && !call.result.success)

    const getToolIcon = () => {
        if (call.input.toolId.includes('web_search')) return <Globe size={12} className="text-purple-400" />
        if (call.input.toolId.includes('memory')) return <Brain size={12} className="text-indigo-400" />
        return <Plug size={12} className="text-neutral-400" />
    }

    const duration = call.result?.metadata?.durationMs

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isSuccess ? 'bg-green-500/10 border border-green-500/20' :
            isFailed ? 'bg-red-500/10 border border-red-500/20' :
            'bg-neutral-800/40'
        }`}>
            {getToolIcon()}
            <span className="text-xs text-neutral-400 shrink-0">#{index}</span>
            <span className="text-xs text-white flex-1 truncate">
                {call.input.arguments.query as string || call.input.toolId}
            </span>
            {isSuccess && <CheckCircle2 size={12} className="text-green-400" />}
            {isFailed && <AlertCircle size={12} className="text-red-400" />}
            {duration && (
                <span className="text-xs text-neutral-600">{(duration / 1000).toFixed(1)}s</span>
            )}
        </div>
    )
}

export default ReasoningTrailModal
