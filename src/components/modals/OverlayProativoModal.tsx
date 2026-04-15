import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { BellRing, ExternalLink, PauseCircle, Sparkles, X } from 'lucide-react'
import type { IntervencaoOverlay } from '../../types/overlayProativo'

interface OverlayProativoModalProps {
    intervencao: IntervencaoOverlay | null
    onExpandir: () => void
    onDispensar: () => void
    onSonecar: () => void
}

const OverlayProativoModal = forwardRef<HTMLDivElement, OverlayProativoModalProps>(({
    intervencao,
    onExpandir,
    onDispensar,
    onSonecar,
}, ref) => {
    const aberto = Boolean(intervencao && (intervencao.status === 'respondendo' || intervencao.status === 'pronto'))

    return (
        <AnimatePresence>
            {aberto && intervencao && (
                <motion.div
                    ref={ref}
                    data-area-interativa="true"
                    initial={{ opacity: 0, y: -20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className="fixed top-5 left-1/2 z-[53] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 pointer-events-auto"
                    onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
                    onPointerLeave={() => window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })}
                >
                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1117]/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#98a6bd]">
                                    <BellRing size={14} className="text-amber-300" />
                                    Overlay inteligente
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-sm text-white">
                                    <Sparkles size={15} className="text-violet-300" />
                                    <span className="truncate">{intervencao.resumo || 'Pitaco proativo'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onExpandir}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 transition-colors hover:bg-white/10"
                                >
                                    <ExternalLink size={14} />
                                    Expandir
                                </button>
                                <button
                                    type="button"
                                    onClick={onSonecar}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10"
                                >
                                    <PauseCircle size={14} />
                                    Soneca 15 min
                                </button>
                                <button
                                    type="button"
                                    onClick={onDispensar}
                                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/75 transition-colors hover:bg-red-500/15 hover:text-red-200"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[42vh] overflow-y-auto px-5 py-4 text-sm leading-7 text-[#edf1f7] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                            {!intervencao.resposta.trim() && (
                                <div className="flex items-center gap-2 text-sm text-[#a9b6ca]">
                                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-violet-400 animate-pulse" />
                                    Preparando pitaco proativo...
                                </div>
                            )}

                            {intervencao.resposta.trim() && (
                                <ReactMarkdown
                                    components={{
                                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                                        ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
                                        ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
                                        li: ({ children }) => <li>{children}</li>,
                                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                        code: ({ children }) => <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-violet-200">{children}</code>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-violet-300 underline underline-offset-2">{children}</a>,
                                    }}
                                >
                                    {intervencao.resposta}
                                </ReactMarkdown>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

OverlayProativoModal.displayName = 'OverlayProativoModal'

export default OverlayProativoModal
