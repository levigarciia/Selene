/**
 * InvestigationProgress Component
 * 
 * Exibe o progresso da investigação em tempo real
 * com fases, sub-perguntas e evidências coletadas.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Search, CheckCircle2, Circle, Loader2, AlertCircle,
    ChevronDown, ChevronUp, ExternalLink, FileText,
    Brain, Sparkles, Timer, XCircle
} from 'lucide-react'
import type { InvestigationTrace, InvestigationPhase, Evidence, SubQuestion } from '../../../../services/investigate'

interface InvestigationProgressProps {
    trace: InvestigationTrace
    isExpanded?: boolean
    onToggleExpand?: () => void
}

const phaseNames: Record<string, string> = {
    routing: 'Analisando pergunta',
    decomposition: 'Identificando aspectos',
    clarification: 'Alinhamento',
    collection: 'Coletando informações',
    validation: 'Validando dados',
    synthesis: 'Sintetizando resposta'
}

// Phase icons - used for future expansion
const _phaseIcons: Record<string, React.ReactNode> = {
    routing: <Brain size={14} />,
    decomposition: <FileText size={14} />,
    clarification: <Sparkles size={14} />,
    collection: <Search size={14} />,
    validation: <CheckCircle2 size={14} />,
    synthesis: <Sparkles size={14} />
}
void _phaseIcons // Suppress unused warning

const PhaseStatus: React.FC<{ phase: InvestigationPhase }> = ({ phase }) => {
    const getStatusIcon = () => {
        switch (phase.status) {
            case 'completed':
                return <CheckCircle2 size={14} className="text-green-400" />
            case 'running':
                return <Loader2 size={14} className="text-purple-400 animate-spin" />
            case 'failed':
                return <AlertCircle size={14} className="text-red-400" />
            case 'waiting':
                return <Timer size={14} className="text-yellow-400" />
            case 'skipped':
                return <XCircle size={14} className="text-neutral-500" />
            default:
                return <Circle size={14} className="text-neutral-600" />
        }
    }

    const getStatusColor = () => {
        switch (phase.status) {
            case 'completed': return 'text-green-400'
            case 'running': return 'text-purple-300'
            case 'failed': return 'text-red-400'
            case 'waiting': return 'text-yellow-400'
            default: return 'text-neutral-500'
        }
    }

    return (
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-xs">{phaseNames[phase.name] || phase.name}</span>
            {phase.status === 'completed' && phase.completedAt && phase.startedAt && (
                <span className="text-xs text-neutral-500">
                    ({Math.round((phase.completedAt - phase.startedAt) / 1000)}s)
                </span>
            )}
        </div>
    )
}

const EvidenceItem: React.FC<{ evidence: Evidence; index: number }> = ({ evidence, index }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="bg-neutral-800/30 rounded-lg p-2 text-xs">
            <div 
                className="flex items-start gap-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className="text-purple-400 font-mono">[{index + 1}]</span>
                <div className="flex-1 min-w-0">
                    <p className="text-neutral-200 line-clamp-2">{evidence.claim}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {evidence.source.favicon && (
                            <img 
                                src={evidence.source.favicon} 
                                alt="" 
                                className="w-3 h-3 rounded-sm"
                            />
                        )}
                        <span className="text-neutral-500">{evidence.source.name}</span>
                        <span className={`px-1 py-0.5 rounded text-[10px] ${
                            evidence.source.credibility === 'high' 
                                ? 'bg-green-500/20 text-green-400'
                                : evidence.source.credibility === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-neutral-500/20 text-neutral-400'
                        }`}>
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={12} />
                    </a>
                )}
            </div>
            
            {isExpanded && evidence.excerpt && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 pt-2 border-t border-neutral-700/50"
                >
                    <p className="text-neutral-400 italic">"{evidence.excerpt}"</p>
                </motion.div>
            )}
        </div>
    )
}

export const InvestigationProgress: React.FC<InvestigationProgressProps> = ({
    trace,
    isExpanded = false,
    onToggleExpand
}) => {
    const currentPhase = trace.phases.find((p: InvestigationPhase) => p.status === 'running')
    const completedPhases = trace.phases.filter((p: InvestigationPhase) => p.status === 'completed').length
    const totalPhases = trace.phases.length
    const progress = (completedPhases / totalPhases) * 100

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 
                       border border-purple-500/10 rounded-xl overflow-hidden my-2"
        >
            {/* Header compacto */}
            <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={18} className="text-purple-400" />
                        {trace.state === 'collecting' || trace.state === 'validating' ? (
                            <motion.div
                                className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                            />
                        ) : null}
                    </div>
                    <div>
                        <div className="text-sm text-neutral-200">
                            {currentPhase ? phaseNames[currentPhase.name] : 
                             trace.state === 'completed' ? 'Investigação concluída' :
                             trace.state === 'awaiting_clarification' ? 'Aguardando esclarecimento' :
                             'Investigando...'}
                        </div>
                        <div className="text-xs text-neutral-500">
                            {trace.evidence.length} evidências • Iteração {trace.currentIteration}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Progress bar mini */}
                    <div className="w-20 h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    
                    {isExpanded ? (
                        <ChevronUp size={16} className="text-neutral-500" />
                    ) : (
                        <ChevronDown size={16} className="text-neutral-500" />
                    )}
                </div>
            </div>

            {/* Conteúdo expandido */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-purple-500/10"
                    >
                        {/* Fases */}
                        <div className="p-3 space-y-2">
                            <div className="text-xs text-neutral-500 font-medium mb-2">PROGRESSO</div>
                            <div className="space-y-1">
                                {trace.phases.map((phase: InvestigationPhase, idx: number) => (
                                    <PhaseStatus key={idx} phase={phase} />
                                ))}
                            </div>
                        </div>

                        {/* Sub-perguntas */}
                        {trace.subQuestions.length > 0 && (
                            <div className="p-3 border-t border-neutral-800">
                                <div className="text-xs text-neutral-500 font-medium mb-2">
                                    SUB-PERGUNTAS ({trace.subQuestions.length})
                                </div>
                                <div className="space-y-1">
                                    {trace.subQuestions.map((sq: SubQuestion) => (
                                        <div key={sq.id} className="flex items-center gap-2 text-xs">
                                            {sq.status === 'collected' ? (
                                                <CheckCircle2 size={12} className="text-green-400" />
                                            ) : sq.status === 'collecting' ? (
                                                <Loader2 size={12} className="text-purple-400 animate-spin" />
                                            ) : sq.status === 'failed' ? (
                                                <AlertCircle size={12} className="text-red-400" />
                                            ) : (
                                                <Circle size={12} className="text-neutral-600" />
                                            )}
                                            <span className={sq.status === 'collected' ? 'text-neutral-300' : 'text-neutral-500'}>
                                                {sq.question.slice(0, 60)}{sq.question.length > 60 ? '...' : ''}
                                            </span>
                                            {sq.evidence.length > 0 && (
                                                <span className="text-neutral-600">({sq.evidence.length})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Evidências */}
                        {trace.evidence.length > 0 && (
                            <div className="p-3 border-t border-neutral-800">
                                <div className="text-xs text-neutral-500 font-medium mb-2">
                                    EVIDÊNCIAS COLETADAS ({trace.evidence.length})
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {trace.evidence.slice(0, 5).map((ev: Evidence, idx: number) => (
                                        <EvidenceItem key={ev.id} evidence={ev} index={idx} />
                                    ))}
                                    {trace.evidence.length > 5 && (
                                        <div className="text-xs text-neutral-500 text-center py-1">
                                            +{trace.evidence.length - 5} mais evidências
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Erros */}
                        {trace.errors.length > 0 && (
                            <div className="p-3 border-t border-red-500/20 bg-red-500/5">
                                <div className="text-xs text-red-400 font-medium mb-1">AVISOS</div>
                                {trace.errors.map((err: { phase: string; message: string; timestamp: number }, idx: number) => (
                                    <div key={idx} className="text-xs text-red-300">
                                        • {err.message}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Confiança */}
                        {trace.confidence && (
                            <div className="p-3 border-t border-neutral-800">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-neutral-500">Confiança</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${
                                            trace.confidence.level === 'high' ? 'text-green-400' :
                                            trace.confidence.level === 'medium' ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>
                                            {trace.confidence.level === 'high' ? 'Alta' :
                                             trace.confidence.level === 'medium' ? 'Média' : 'Baixa'}
                                        </span>
                                        <span className="text-xs text-neutral-600">
                                            ({trace.confidence.score}%)
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-400 mt-1">
                                    {trace.confidence.justification}
                                </p>
                                {trace.confidence.warnings.length > 0 && (
                                    <div className="mt-2 text-xs text-yellow-400/80">
                                        ⚠️ {trace.confidence.warnings[0]}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default InvestigationProgress
