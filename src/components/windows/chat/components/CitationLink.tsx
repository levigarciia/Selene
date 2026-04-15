/**
 * CitationLink Component
 * 
 * Renderiza citações clicáveis [1], [2], etc. que abrem tooltips
 * com informações da fonte e link para o original.
 */

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Copy, Check } from 'lucide-react'

export interface Citation {
    marker: string      // [1], [2], etc.
    evidenceId: string
    url: string
    title: string
    excerpt?: string
    favicon?: string
}

interface CitationLinkProps {
    marker: string
    citation?: Citation
    onClick?: () => void
}

export const CitationLink: React.FC<CitationLinkProps> = ({ 
    marker, 
    citation,
    onClick 
}) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const [copied, setCopied] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const linkRef = useRef<HTMLSpanElement>(null)

    const handleCopyUrl = async () => {
        if (citation?.url) {
            await navigator.clipboard.writeText(citation.url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    // Fecha tooltip ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
                linkRef.current && !linkRef.current.contains(e.target as Node)) {
                setShowTooltip(false)
            }
        }

        if (showTooltip) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showTooltip])

    return (
        <span className="relative inline-block">
            <span
                ref={linkRef}
                onClick={() => {
                    if (citation) {
                        setShowTooltip(!showTooltip)
                    }
                    onClick?.()
                }}
                className={`
                    inline-flex items-center justify-center
                    px-1.5 py-0.5 mx-0.5 
                    text-[11px] font-medium
                    rounded-md cursor-pointer
                    transition-all duration-200
                    ${citation 
                        ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200' 
                        : 'bg-neutral-700/50 text-neutral-400'
                    }
                `}
            >
                {marker}
            </span>

            <AnimatePresence>
                {showTooltip && citation && (
                    <motion.div
                        ref={tooltipRef}
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                    >
                        <div className="bg-neutral-900 border border-neutral-700 rounded-lg 
                                      shadow-xl shadow-black/50 w-64 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-start gap-2 p-3 border-b border-neutral-800">
                                {citation.favicon && (
                                    <img 
                                        src={citation.favicon} 
                                        alt="" 
                                        className="w-4 h-4 rounded-sm mt-0.5"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium truncate">
                                        {citation.title}
                                    </p>
                                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                                        {citation.url ? new URL(citation.url).hostname : 'Fonte'}
                                    </p>
                                </div>
                            </div>

                            {/* Excerpt */}
                            {citation.excerpt && (
                                <div className="p-3 border-b border-neutral-800">
                                    <p className="text-xs text-neutral-400 italic line-clamp-3">
                                        "{citation.excerpt}"
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 p-2 bg-neutral-800/50">
                                {citation.url && (
                                    <a
                                        href={citation.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2 py-1.5 
                                                 bg-purple-500/20 hover:bg-purple-500/30
                                                 text-purple-300 text-xs rounded-md
                                                 transition-colors"
                                    >
                                        <ExternalLink size={12} />
                                        Abrir fonte
                                    </a>
                                )}
                                
                                <button
                                    onClick={handleCopyUrl}
                                    className="flex items-center gap-1.5 px-2 py-1.5 
                                             bg-neutral-700/50 hover:bg-neutral-700
                                             text-neutral-300 text-xs rounded-md
                                             transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={12} className="text-green-400" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={12} />
                                            Copiar URL
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                            <div className="w-2 h-2 bg-neutral-900 border-r border-b 
                                          border-neutral-700 rotate-45" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    )
}

export default CitationLink
