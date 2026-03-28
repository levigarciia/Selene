import React from 'react'
import { motion } from 'framer-motion'
import { Brain, ChevronDown, Sparkles, Terminal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import seleneLogo from '/tray-icon.png'
import type { ChatMessage } from '../../../../types/chat'
import type { WebSource } from '../types'
import type { ToolCardData } from '../../../../types/tools'
import { ToolCard } from '../../../chat/ToolCard'
import { MessageActions } from './MessageActions'
import { renderizarNosComFontes } from '../utils'

interface MessageListProps {
    messages: ChatMessage[]
    messagesContainerRef: React.RefObject<HTMLDivElement | null>
    messagesEndRef: React.RefObject<HTMLDivElement | null>
    isGenerating: boolean
    isAnalyzingImage: boolean
    messageSources: Record<string, WebSource[]>
    messageSearchCards: Record<string, ToolCardData[]>
    expandedSources: string | null
    onToggleSources: (msgId: string) => void
    copiedMessageId: string | null
    onCopyMessage: (msgId: string, content: string) => void
    onRegenerateResponse: () => void
    profileName?: string
    hasInvestigationTrace?: boolean
    onShowReasoning?: () => void
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    messagesContainerRef,
    messagesEndRef,
    isGenerating,
    isAnalyzingImage,
    messageSources,
    messageSearchCards,
    expandedSources,
    onToggleSources,
    copiedMessageId,
    onCopyMessage,
    onRegenerateResponse,
    profileName,
    hasInvestigationTrace,
    onShowReasoning,
}) => {
    const [raciocinioExpandidoPorMensagem, setRaciocinioExpandidoPorMensagem] = React.useState<Record<string, boolean>>({})

    const renderMarkdown = (
        content: string,
        fontesDaMensagem: WebSource[],
        showCursor: boolean,
        isLastMessage: boolean,
        role: string
    ) => (
        <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${role === 'user'
                ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/30'
                : 'bg-neutral-800/60 border border-white/5 text-neutral-200 rounded-tl-sm'
                } ${showCursor && isGenerating && isLastMessage && role === 'assistant'
                    ? "[&>*:last-child]:after:content-[''] [&>*:last-child]:after:inline-block [&>*:last-child]:after:w-2.5 [&>*:last-child]:after:h-2.5 [&>*:last-child]:after:bg-purple-400 [&>*:last-child]:after:rounded-full [&>*:last-child]:after:ml-1.5 [&>*:last-child]:after:align-baseline [&>*:last-child]:after:animate-pulse"
                    : ''
                }`}
        >
            {showCursor && isGenerating && isLastMessage && role === 'assistant' && !content && (
                <div className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse" />
            )}
            <ReactMarkdown
                components={{
                    p: ({ children }) => (
                        <p className="mb-2 last:mb-0">
                            {renderizarNosComFontes(children, fontesDaMensagem)}
                        </p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-white">
                            {renderizarNosComFontes(children, fontesDaMensagem)}
                        </strong>
                    ),
                    ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ol>,
                    li: ({ children }) => (
                        <li className="pl-1">
                            {renderizarNosComFontes(children, fontesDaMensagem)}
                        </li>
                    ),
                    code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !String(children).includes('\n')
                        return isInline ? (
                            <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-purple-200 border border-white/5 break-all" {...props}>
                                {children}
                            </code>
                        ) : (
                            <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117] max-w-full">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                    <div className="flex items-center gap-1.5">
                                        <Terminal size={12} className="text-white/40" />
                                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{match?.[1] || 'code'}</span>
                                    </div>
                                </div>
                                <div className="p-3 overflow-x-auto max-w-full">
                                    <code className="text-xs font-mono block text-neutral-300 whitespace-pre" {...props}>
                                        {children}
                                    </code>
                                </div>
                            </div>
                        )
                    },
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-purple-500/50 pl-3 py-1 my-2 bg-purple-500/5 italic text-white/70 text-sm rounded-r">
                            {renderizarNosComFontes(children, fontesDaMensagem)}
                        </blockquote>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )

    const renderBlocoRaciocinio = (msgId: string, raciocinio: string) => {
        const expandido = Boolean(raciocinioExpandidoPorMensagem[msgId])
        return (
            <div className="w-full rounded-xl border border-white/10 bg-neutral-900/50 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setRaciocinioExpandidoPorMensagem((prev) => ({ ...prev, [msgId]: !expandido }))}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                    <span className="flex items-center gap-2 text-xs text-neutral-300">
                        <Brain size={14} className="text-purple-300" />
                        Raciocínio do modelo
                    </span>
                    <ChevronDown size={14} className={`text-neutral-500 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                </button>
                {expandido && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5">
                        <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">{raciocinio}</p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <main
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-5 bg-linear-to-b from-[#0a0a0c] to-[#0d0d10] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
        >
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500/20 to-indigo-600/20 flex items-center justify-center">
                        <img src={seleneLogo} alt="Selene Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <p className="text-[30px] text-neutral-400 font-sans font-light tracking-wide">
                            {profileName ? `Olá, ${profileName}! Como posso ajudar?` : 'Comece uma conversa com a Selene'}
                        </p>
                    </div>
                </div>
            ) : (
                messages.map((msg, index) => {
                    const fontesDaMensagem = messageSources[msg.id] || []
                    const isLastMessage = index === messages.length - 1
                    const raciocinioDaMensagem = (msg.raciocinio || '').trim()

                    // Hide the AI bubble when analyzing image
                    const shouldHideForImageAnalysis = isAnalyzingImage && isLastMessage && msg.role === 'assistant' && !msg.content
                    if (shouldHideForImageAnalysis) return null

                    const hasCards = msg.role === 'assistant' && messageSearchCards[msg.id]?.length > 0

                    return (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mr-3 mt-1">
                                    <Sparkles size={14} className="text-purple-400" />
                                </div>
                            )}

                            <div className={`max-w-[70%] min-w-0 flex flex-col gap-2 overflow-hidden ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {msg.role === 'assistant' && raciocinioDaMensagem && renderBlocoRaciocinio(msg.id, raciocinioDaMensagem)}
                                {(() => {
                                    // If we have cards, render card list first and text answer below
                                    if (hasCards) {
                                        const cards = messageSearchCards[msg.id] || []
                                        return (
                                            <>
                                                {cards.map((card, cardIdx) => (
                                                    <React.Fragment key={`tool-group-${msg.id}-${cardIdx}`}>
                                                        <ToolCard
                                                            key={`tool-${msg.id}-${cardIdx}`}
                                                            data={card}
                                                        />
                                                    </React.Fragment>
                                                ))}
                                                {msg.content && renderMarkdown(msg.content, fontesDaMensagem, true, isLastMessage, msg.role)}
                                            </>
                                        )
                                    }

                                    // For user messages with images
                                    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
                                        return (
                                            <>
                                                <div className={`flex flex-wrap gap-2 ${msg.images.length > 1 ? 'max-w-75' : ''}`}>
                                                    {msg.images.map((img, imgIdx) => (
                                                        <div key={imgIdx} className="relative group/img">
                                                            <img
                                                                src={img}
                                                                alt={`Anexo ${imgIdx + 1}`}
                                                                className="max-w-50 max-h-50 rounded-xl border border-white/10 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                                onClick={() => window.open(img, '_blank')}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                {msg.content && renderMarkdown(msg.content, fontesDaMensagem, false, isLastMessage, msg.role)}
                                            </>
                                        )
                                    }

                                    // Default: just render content
                                    return renderMarkdown(msg.content, fontesDaMensagem, true, isLastMessage, msg.role)
                                })()}

                                {/* Message Actions & Timestamp */}
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-neutral-600">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {msg.role === 'assistant' && (
                                        <MessageActions
                                            onCopy={() => onCopyMessage(msg.id, msg.content)}
                                            onRegenerate={onRegenerateResponse}
                                            copied={copiedMessageId === msg.id}
                                            canRegenerate={isLastMessage && !isGenerating}
                                            sources={messageSources[msg.id]}
                                            sourcesExpanded={expandedSources === msg.id}
                                            onToggleSources={() => onToggleSources(msg.id)}
                                            hasInvestigationTrace={hasInvestigationTrace && isLastMessage}
                                            onShowReasoning={onShowReasoning}
                                        />
                                    )}
                                </div>
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0 ml-3 mt-1">
                                    <div className="w-3 h-3 rounded-full bg-neutral-500" />
                                </div>
                            )}
                        </motion.div>
                    )
                })
            )}

            {/* Analyzing Image Indicator */}
            {isAnalyzingImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 py-4"
                >
                    <div className="flex items-center gap-2 text-neutral-400">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm">Analisando imagem selecionada</span>
                    </div>
                </motion.div>
            )}

            <div ref={messagesEndRef} />
        </main>
    )
}
