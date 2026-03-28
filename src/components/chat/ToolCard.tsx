/**
 * ToolCard Component
 * 
 * Generic card for displaying any tool call with expandable results.
 * Supports different tool types with dynamic icons.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Globe, 
    Brain, 
    File, 
    Plug, 
    Terminal, 
    Camera, 
    Database,
    Search,
    ChevronDown, 
    ExternalLink,
    AlertCircle,
    Loader2
} from 'lucide-react'
import type { ToolCardData, ToolResultItem, ToolCallStatus } from '../../types/tools'

// Icon mapping for tool types
const TOOL_ICONS: Record<string, React.ElementType> = {
    Globe,
    Brain,
    File,
    Plug,
    Terminal,
    Camera,
    Database,
    Search,
    AlertCircle
}

const getIcon = (iconName: string): React.ElementType => {
    return TOOL_ICONS[iconName] || Plug
}

const getStatusColor = (status: ToolCallStatus): string => {
    switch (status) {
        case 'executing':
            return 'text-yellow-400'
        case 'completed':
            return 'text-green-400'
        case 'failed':
            return 'text-red-400'
        case 'cancelled':
            return 'text-neutral-500'
        default:
            return 'text-neutral-400'
    }
}

interface ToolCardProps {
    data: ToolCardData
    onExpand?: () => void
    compact?: boolean
}

export const ToolCard: React.FC<ToolCardProps> = ({
    data,
    onExpand,
    compact = false
}) => {
    const [expanded, setExpanded] = useState(false)
    const IconComponent = getIcon(data.toolIcon)
    const isLoading = data.status === 'pending' || data.status === 'executing'
    const hasResults = data.results.length > 0
    const canExpand = hasResults && !isLoading

    const handleClick = () => {
        if (canExpand) {
            setExpanded(!expanded)
            onExpand?.()
        }
    }

    return (
        <div className={`${compact ? 'my-1' : 'my-2'}`}>
            <button
                onClick={handleClick}
                disabled={!canExpand}
                className={`w-full flex items-center gap-3 px-4 ${compact ? 'py-2' : 'py-3'} rounded-xl border transition-all ${
                    expanded 
                        ? 'bg-neutral-800/80 border-white/15' 
                        : 'bg-neutral-800/50 border-white/10 hover:bg-neutral-800/70'
                } ${isLoading ? 'animate-pulse' : ''} ${!canExpand ? 'cursor-default' : 'cursor-pointer'}`}
            >
                {isLoading ? (
                    <Loader2 size={18} className="text-purple-400 animate-spin shrink-0" />
                ) : (
                    <IconComponent size={18} className={`shrink-0 ${getStatusColor(data.status)}`} />
                )}
                
                <div className="flex-1 min-w-0 text-left">
                    {data.statusText && (
                        <span className="text-xs text-neutral-400 block mb-1 truncate">
                            {data.statusText}
                        </span>
                    )}
                    <span className={`${compact ? 'text-xs' : 'text-sm'} text-neutral-300 truncate block`}>
                        {data.query}
                    </span>
                    {!compact && data.toolName && (
                        <span className="text-[10px] text-neutral-500">
                            {data.toolName}
                        </span>
                    )}
                </div>
                
                {data.status === 'executing' ? (
                    <span className="text-xs text-neutral-500">executando...</span>
                ) : data.status === 'failed' ? (
                    <div className="flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        <span>erro</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                        {data.resultCount > 0 && (
                            <span>{data.resultCount} resultado{data.resultCount !== 1 ? 's' : ''}</span>
                        )}
                        {data.durationMs && (
                            <span className="text-neutral-600">• {(data.durationMs / 1000).toFixed(1)}s</span>
                        )}
                        {canExpand && (
                            <ChevronDown 
                                size={14} 
                                className={`transition-transform ${expanded ? 'rotate-180' : ''}`} 
                            />
                        )}
                    </div>
                )}
            </button>
            
            <AnimatePresence>
                {expanded && hasResults && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 ml-4 pl-4 border-l-2 border-neutral-700 space-y-2">
                            {data.results.map((result, idx) => (
                                <ToolResultItemView key={idx} result={result} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Error message */}
            {data.status === 'failed' && data.error && (
                <div className="mt-1 ml-4 pl-4 border-l-2 border-red-500/30 py-2">
                    <p className="text-xs text-red-400">{data.error}</p>
                </div>
            )}
        </div>
    )
}

// Individual result item
const ToolResultItemView: React.FC<{ result: ToolResultItem }> = ({ result }) => {
    if (result.type === 'link') {
        return (
            <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
                {result.favicon ? (
                    <img
                        src={result.favicon}
                        alt=""
                        className="w-4 h-4 rounded mt-0.5 shrink-0"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E'
                        }}
                    />
                ) : (
                    <Globe size={14} className="text-neutral-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-200 truncate flex-1">
                            {result.title}
                        </span>
                        <ExternalLink 
                            size={12} 
                            className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                        />
                    </div>
                    {result.content && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                            {result.content}
                        </p>
                    )}
                </div>
            </a>
        )
    }

    if (result.type === 'code') {
        return (
            <div className="p-2 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                    <Terminal size={12} className="text-neutral-500" />
                    <span className="text-xs text-neutral-400">{result.title}</span>
                </div>
                <pre className="text-xs text-neutral-300 overflow-x-auto">
                    <code>{result.content}</code>
                </pre>
            </div>
        )
    }

    if (result.type === 'json') {
        return (
            <div className="p-2 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                    <Database size={12} className="text-neutral-500" />
                    <span className="text-xs text-neutral-400">{result.title}</span>
                </div>
                <pre className="text-xs text-neutral-300 overflow-x-auto">
                    <code>{result.content}</code>
                </pre>
            </div>
        )
    }

    if (result.type === 'error') {
        return (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-xs text-red-400">{result.title}</span>
                </div>
                {result.content && (
                    <p className="text-xs text-red-300/70 mt-1">{result.content}</p>
                )}
            </div>
        )
    }

    // Default: text
    return (
        <div className="p-2">
            <span className="text-sm text-neutral-200">{result.title}</span>
            {result.content && (
                <p className="text-xs text-neutral-500 mt-0.5">{result.content}</p>
            )}
        </div>
    )
}

export default ToolCard
