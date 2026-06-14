import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Loader2, ChevronDown, Check } from 'lucide-react'
import type { ToolCardData } from '../../types/tools'

interface WebSearchGroupCardProps {
    cards: ToolCardData[]
}

/**
 * Extrai o domínio de uma URL para exibição simplificada
 */
function extrairDominio(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
        return ''
    }
}

/**
 * Componente que agrupa múltiplas buscas web em uma única timeline colapsável.
 */
export const WebSearchGroupCard: React.FC<WebSearchGroupCardProps> = ({ cards }) => {
    const [expandido, setExpandido] = useState(true)

    if (cards.length === 0) return null

    // Verifica se há alguma busca em andamento
    const isExecutando = cards.some(c => c.status === 'pending' || c.status === 'executing')
    // Verifica se todas as buscas terminaram (completed, failed ou cancelled)
    const isConcluido = cards.every(c => c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled')
    // Verifica se todas as buscas ainda estão na fase de planejamento
    const isPlanejando = cards.some(c => c.status === 'pending') && !cards.some(c => c.status === 'executing' || c.status === 'completed');

    return (
        <div className="min-w-0 max-w-full my-1">
            {/* Cabeçalho colapsável */}
            <button
                onClick={() => setExpandido(!expandido)}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-300 transition-colors py-1.5 px-1 focus:outline-none cursor-pointer"
            >
                <span>{isPlanejando ? 'Planejando' : isExecutando ? 'Pesquisando na web' : 'Pesquisou na web'}</span>
                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
                />
                {isExecutando && (
                    <Loader2 size={11} className="text-purple-400 animate-spin ml-1 shrink-0" />
                )}
            </button>

            {/* Timeline de buscas agrupadas */}
            <AnimatePresence>
                {expandido && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="relative pl-6 flex flex-col gap-4 mt-2 mb-3">
                            {/* Linha vertical da timeline */}
                            <div className="absolute left-[9px] top-2 bottom-6 w-[1px] bg-neutral-800" />

                            {/* Passos de busca individual */}
                            {cards.map((card, index) => {
                                const carregandoCard = card.status === 'pending' || card.status === 'executing'
                                return (
                                    <div key={card.callId || index} className="relative flex flex-col min-w-0">
                                        {/* Ícone posicionado no eixo da linha da timeline */}
                                        <div className="absolute -left-[20px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1a1c21] border border-neutral-800 text-neutral-400 z-10 shrink-0">
                                            {carregandoCard ? (
                                                <Loader2 size={10} className="text-purple-400 animate-spin shrink-0" />
                                            ) : (
                                                <Globe size={10} className="shrink-0" />
                                            )}
                                        </div>

                                        {/* Detalhes da busca */}
                                        <div className="flex flex-col min-w-0 pl-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-semibold text-neutral-300 truncate pr-2 select-text">
                                                    {(!card.query || card.query === 'builtin:web_search') ? 'Planejando' : card.query}
                                                </span>
                                                <span className="shrink-0 text-[10px] text-neutral-500 font-medium font-sans">
                                                    {card.status === 'executing' ? (
                                                        <span className="text-purple-400 animate-pulse">executando...</span>
                                                    ) : card.status === 'pending' ? (
                                                        null
                                                    ) : card.status === 'failed' ? (
                                                        <span className="text-red-400">erro</span>
                                                    ) : (
                                                        `${card.resultCount} resultado${card.resultCount !== 1 ? 's' : ''}`
                                                    )}
                                                </span>
                                            </div>

                                            {/* Resultados e Links encontrados */}
                                            {card.results && card.results.length > 0 && (
                                                <div className="mt-2 rounded-xl bg-neutral-900/60 border border-white/5 max-h-36 overflow-y-auto p-1.5 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                                    {card.results.map((result, rIdx) => (
                                                        <a
                                                            key={rIdx}
                                                            href={result.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-between gap-3 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-all text-xs group cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                {result.favicon ? (
                                                                    <img
                                                                        src={result.favicon}
                                                                        alt=""
                                                                        className="w-3.5 h-3.5 rounded mt-0.5 shrink-0"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <Globe size={11} className="text-neutral-500 mt-0.5 shrink-0" />
                                                                )}
                                                                <span className="text-neutral-300 truncate flex-1 font-normal group-hover:text-purple-300 transition-colors">
                                                                    {result.title}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                                                                {extrairDominio(result.url || '')}
                                                            </span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Nó de Conclusão da timeline */}
                            {!isPlanejando && (
                                <div className="relative flex items-center min-w-0">
                                    <div className="absolute -left-[20px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1a1c21] border border-neutral-800 z-10 shrink-0">
                                        {isConcluido ? (
                                            <Check size={10} className="text-green-400 shrink-0" />
                                        ) : (
                                            <Loader2 size={10} className="text-purple-400 animate-spin shrink-0" />
                                        )}
                                    </div>
                                    <span className="text-xs text-neutral-400 font-semibold pl-1">
                                        {isConcluido ? 'Concluído' : 'Buscando...'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default WebSearchGroupCard
