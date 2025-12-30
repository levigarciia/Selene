/**
 * SearchCard Component
 * 
 * Displays a web search query card with expandable results
 * Similar to how ChatGPT displays searches
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, ChevronDown, ExternalLink } from 'lucide-react'

export interface SearchSource {
    url: string
    title: string
    favicon?: string
    snippet?: string
}

interface SearchCardProps {
    query: string
    resultCount: number
    sources: SearchSource[]
    isSearching?: boolean
}

export const SearchCard: React.FC<SearchCardProps> = ({
    query,
    resultCount,
    sources,
    isSearching = false
}) => {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="my-2">
            <button
                onClick={() => !isSearching && sources.length > 0 && setExpanded(!expanded)}
                disabled={isSearching || sources.length === 0}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    expanded 
                        ? 'bg-neutral-800/80 border-white/15' 
                        : 'bg-neutral-800/50 border-white/10 hover:bg-neutral-800/70'
                } ${isSearching ? 'animate-pulse' : ''}`}
            >
                <Globe size={18} className="text-neutral-400 shrink-0" />
                
                <span className="flex-1 text-left text-sm text-neutral-300 truncate">
                    {query}
                </span>
                
                {isSearching ? (
                    <span className="text-xs text-neutral-500">buscando...</span>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                        <span>{resultCount} resultado{resultCount !== 1 ? 's' : ''}</span>
                        {sources.length > 0 && (
                            <ChevronDown 
                                size={14} 
                                className={`transition-transform ${expanded ? 'rotate-180' : ''}`} 
                            />
                        )}
                    </div>
                )}
            </button>
            
            <AnimatePresence>
                {expanded && sources.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 ml-4 pl-4 border-l-2 border-neutral-700 space-y-2">
                            {sources.map((source, idx) => (
                                <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                                >
                                    <img
                                        src={source.favicon || `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=16`}
                                        alt=""
                                        className="w-4 h-4 rounded mt-0.5 shrink-0"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-neutral-200 truncate flex-1">
                                                {source.title}
                                            </span>
                                            <ExternalLink 
                                                size={12} 
                                                className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                                            />
                                        </div>
                                        {source.snippet && (
                                            <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                                                {source.snippet}
                                            </p>
                                        )}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default SearchCard
