// Message Actions Component
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, RefreshCw, Check, ChevronDown, ExternalLink, Brain } from 'lucide-react'
import type { WebSource } from '../types'

interface MessageActionsProps {
    onCopy: () => void
    onRegenerate: () => void
    copied: boolean
    canRegenerate: boolean
    sources?: WebSource[]
    sourcesExpanded?: boolean
    onToggleSources?: () => void
    hasInvestigationTrace?: boolean
    onShowReasoning?: () => void
}

export const MessageActions: React.FC<MessageActionsProps> = ({ 
    onCopy, 
    onRegenerate, 
    copied, 
    canRegenerate, 
    sources, 
    sourcesExpanded, 
    onToggleSources,
    hasInvestigationTrace,
    onShowReasoning
}) => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
            onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
            title="Copiar"
        >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
        {canRegenerate && (
            <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                title="Regenerar"
            >
                <RefreshCw size={14} />
            </button>
        )}
        
        {/* Botão de Raciocínio */}
        {hasInvestigationTrace && onShowReasoning && (
            <button
                onClick={onShowReasoning}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                title="Ver linha de raciocínio"
            >
                <Brain size={12} className="text-purple-400" />
                <span className="text-xs text-purple-300">Raciocínio</span>
            </button>
        )}
        
        {/* Botão de Fontes */}
        {sources && sources.length > 0 && (
            <div className="relative">
                <button
                    onClick={onToggleSources}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                    title="Ver fontes"
                >
                    <div className="flex -space-x-1">
                        {sources.slice(0, 3).map((source, idx) => (
                            <img
                                key={idx}
                                src={source.favicon || `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=16`}
                                alt=""
                                className="w-4 h-4 rounded-full bg-neutral-700 border border-neutral-600"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-neutral-300">Fontes</span>
                    <ChevronDown size={12} className={`text-neutral-400 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                    {sourcesExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute bottom-full left-0 mb-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                        >
                            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                {sources.map((source, idx) => (
                                    <a
                                        key={idx}
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group/source"
                                    >
                                        <img
                                            src={source.favicon || `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=16`}
                                            alt=""
                                            className="w-4 h-4 rounded"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                                            }}
                                        />
                                        <span className="text-xs text-neutral-300 truncate flex-1">{source.title || new URL(source.url).hostname}</span>
                                        <ExternalLink size={12} className="text-neutral-500 opacity-0 group-hover/source:opacity-100 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )}
    </div>
)
