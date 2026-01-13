/**
 * ClarificationCard Component
 * 
 * Exibe as perguntas de esclarecimento durante o modo Investigar
 * e permite que o usuário responda antes de continuar a investigação.
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { HelpCircle, Send, SkipForward, ChevronRight } from 'lucide-react'
import type { AlignmentCheckpoint, UserClarification } from '../../../../services/investigate'

interface ClarificationCardProps {
    checkpoint: AlignmentCheckpoint
    onSubmit: (clarification: UserClarification) => void
    onSkip: () => void
}

export const ClarificationCard: React.FC<ClarificationCardProps> = ({
    checkpoint,
    onSubmit,
    onSkip
}) => {
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [adjustedScope, setAdjustedScope] = useState('')

    const handleSubmit = () => {
        onSubmit({
            answers,
            adjustedScope: adjustedScope || undefined,
            skipClarification: false
        })
    }

    const handleSkip = () => {
        onSubmit({
            answers: {},
            skipClarification: true
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 
                       border border-purple-500/20 rounded-xl p-4 my-3"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                    <HelpCircle size={16} className="text-purple-400" />
                </div>
                <span className="text-sm font-medium text-purple-300">
                    Antes de investigar...
                </span>
            </div>

            {/* Plano proposto */}
            <div className="text-xs text-neutral-400 mb-3">
                <span className="text-neutral-500">Plano de investigação:</span>
                <div className="mt-1 pl-2 border-l-2 border-neutral-700 text-neutral-300">
                    {checkpoint.proposedPlan.split('\n').slice(0, 3).map((line, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <ChevronRight size={12} className="text-purple-400/50" />
                            <span>{line}</span>
                        </div>
                    ))}
                    {checkpoint.proposedPlan.split('\n').length > 3 && (
                        <div className="text-neutral-500 text-xs mt-1">
                            +{checkpoint.proposedPlan.split('\n').length - 3} mais...
                        </div>
                    )}
                </div>
            </div>

            {/* Perguntas de esclarecimento */}
            <div className="space-y-3">
                {checkpoint.clarifyingQuestions.map((question, idx) => (
                    <div key={idx}>
                        <label className="block text-sm text-neutral-200 mb-1.5">
                            {question}
                        </label>
                        <input
                            type="text"
                            value={answers[question] || ''}
                            onChange={(e) => setAnswers(prev => ({ 
                                ...prev, 
                                [question]: e.target.value 
                            }))}
                            placeholder="Sua resposta (opcional)..."
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg 
                                     px-3 py-2 text-sm text-white placeholder-neutral-500
                                     focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20
                                     transition-colors"
                        />
                    </div>
                ))}

                {/* Campo para ajustar escopo */}
                <div>
                    <label className="block text-sm text-neutral-400 mb-1.5">
                        Quer focar em algo específico? (opcional)
                    </label>
                    <input
                        type="text"
                        value={adjustedScope}
                        onChange={(e) => setAdjustedScope(e.target.value)}
                        placeholder="Ex: foco em custo-benefício, apenas opções gratuitas..."
                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg 
                                 px-3 py-2 text-sm text-white placeholder-neutral-500
                                 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20
                                 transition-colors"
                    />
                </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-700/50">
                <button
                    onClick={handleSkip}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 
                             hover:text-neutral-200 transition-colors"
                >
                    <SkipForward size={14} />
                    Pular e investigar
                </button>

                <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 
                             hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm
                             transition-colors"
                >
                    <Send size={14} />
                    Continuar investigação
                </button>
            </div>
        </motion.div>
    )
}

export default ClarificationCard
