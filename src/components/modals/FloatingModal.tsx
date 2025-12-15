
import { Sparkles, Eye, EyeOff, X, Terminal, Maximize2 } from 'lucide-react'
import { forwardRef } from 'react'
import { motion, useDragControls, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../../types/chat'

interface FloatingModalProps {
    transcription: string
    messages: ChatMessage[]
    showPreview: boolean
    setShowPreview: (show: boolean) => void
    onClose: () => void
    isGenerating?: boolean
}

const FloatingModal = forwardRef<HTMLDivElement, FloatingModalProps>(({
    transcription,
    messages,
    showPreview,
    setShowPreview,
    onClose,
    isGenerating = false
}, ref) => {
    const dragControls = useDragControls()

    return (
        <motion.div
            ref={ref}
            data-area-interativa="true"
            className="fixed top-20 right-20 w-[420px] max-h-[500px] flex flex-col pointer-events-auto z-50 font-sans"
            onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
            onPointerLeave={() => window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.2 }}
        >
            <motion.div
                drag
                dragListener={false}
                dragControls={dragControls}
                dragMomentum={false}
                className="flex flex-col w-full h-full overflow-hidden text-neutral-100 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl bg-neutral-900/80 rounded-[28px]"
            >
                {/* Header - Glassy & Minimal */}
                <div
                    className="relative flex-none flex items-center justify-between px-5 py-4 cursor-grab active:cursor-grabbing group select-none z-10"
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    {/* Background sheen for header */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />

                    <div className="relative flex items-center gap-2">
                        <Sparkles size={18} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        <span className="font-medium text-sm text-neutral-200 tracking-wide font-['Inter']">Selene</span>
                    </div>

                    <div className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                            onClick={() => {
                                console.log('[FloatingModal] Expand clicked')
                                if (!window.electronAPI) {
                                    console.error('[FloatingModal] electronAPI not found')
                                    return
                                }
                                if (!window.electronAPI.openExpandedChat) {
                                    console.error('[FloatingModal] openExpandedChat not defined in electronAPI', Object.keys(window.electronAPI))
                                    return
                                }
                                console.log('[FloatingModal] sending open-expanded-chat')
                                window.electronAPI.openExpandedChat(messages)
                            }}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title="Expandir"
                        >
                            <Maximize2 size={14} />
                        </button>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title={showPreview ? "Ocultar preview" : "Mostrar preview"}
                        >
                            {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-colors"
                            title="Dispensar"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>


                {/* Content Area - Chat Style */}
                <AnimatePresence>
                    {showPreview && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex-1 overflow-x-hidden overflow-y-auto relative flex flex-col p-5 gap-4 min-h-[0] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                        >

                            {messages.map((msg, index) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="flex flex-col items-end max-w-[85%]">
                                            <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/10 border border-white/5 text-sm text-white/90 shadow-sm backdrop-blur-md">
                                                {msg.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-start max-w-[95%]">
                                            <div className="text-[10px] text-purple-300/80 ml-1 mb-1 font-bold tracking-wider uppercase flex items-center gap-1.5">
                                                <Sparkles size={10} />
                                                Selene
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl opacity-20 blur group-hover:opacity-30 transition duration-1000"></div>
                                                <div className={`relative px-5 py-4 rounded-2xl rounded-tl-sm bg-neutral-900/90 border border-white/10 text-sm text-neutral-100 leading-relaxed shadow-xl ${
                                                    isGenerating && index === messages.length - 1 && msg.role === 'assistant'
                                                        ? "[&>*:last-child]:after:content-[''] [&>*:last-child]:after:inline-block [&>*:last-child]:after:w-2.5 [&>*:last-child]:after:h-2.5 [&>*:last-child]:after:bg-purple-400 [&>*:last-child]:after:rounded-full [&>*:last-child]:after:ml-1.5 [&>*:last-child]:after:align-baseline [&>*:last-child]:after:animate-pulse"
                                                        : ''
                                                }`}>
                                                    {(isGenerating && index === messages.length - 1 && msg.role === 'assistant' && !msg.content) && (
                                                        <div className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse" />
                                                    )}
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                            strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
                                                            ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ul>,
                                                            ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ol>,
                                                            li: ({ children }) => <li className="pl-1">{children}</li>,
                                                            code: ({ className, children, ...props }) => {
                                                                const match = /language-(\w+)/.exec(className || '')
                                                                const isInline = !match && !String(children).includes('\n')
                                                                return isInline ? (
                                                                    <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-purple-200 border border-white/5" {...props}>
                                                                        {children}
                                                                    </code>
                                                                ) : (
                                                                    <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117]">
                                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Terminal size={12} className="text-white/40" />
                                                                                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{match?.[1] || 'code'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="p-3 overflow-x-auto">
                                                                            <code className="text-xs font-mono block text-neutral-300" {...props}>
                                                                                {children}
                                                                            </code>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            },
                                                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors">{children}</a>,
                                                            blockquote: ({ children }) => <blockquote className="border-l-2 border-purple-500/50 pl-3 py-1 my-2 bg-purple-500/5 italic text-white/70 text-sm rounded-r">{children}</blockquote>,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Live Transcription Preview (if recording or analyzing) */}
                            {(transcription || (!transcription && showPreview && messages.length === 0)) && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="self-end max-w-[85%] opacity-70"
                                >
                                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/5 border border-white/5 text-sm text-white/60 italic border-dashed text-left">
                                        {transcription || "Ouvindo..."}
                                    </div>
                                </motion.div>
                            )}

                            {/* Dummy div to scroll into view */}
                            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div >
    )
})

FloatingModal.displayName = 'FloatingModal'

export default FloatingModal
