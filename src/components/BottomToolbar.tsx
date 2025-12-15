import { forwardRef, useMemo, useState, type RefObject } from 'react'
import { Settings, Mic, MicOff, Sparkles, Send, ChevronUp, ChevronDown, Power, PenSquare, Camera, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'

interface BottomToolbarProps {
    isRecording: boolean
    toggleRecording: () => void
    transcription: string
    setTranscription: (text: string) => void
    handleChat: () => void
    handleAnalyze: () => void
    aoPerguntarScreenshot: () => void
    aoAbrirAssistentes: () => void
    aoAbrirAssistenteGramatical: () => void
    aoAbrirConfiguracoes: () => void
    aoAbrirChatWindow: () => void
    aoFecharAplicacao: () => void
    menuDropdownRef?: RefObject<HTMLDivElement | null>
    initialCollapsed?: boolean
}

const BottomToolbar = forwardRef<HTMLDivElement, BottomToolbarProps>(({
    isRecording,
    toggleRecording,
    transcription,
    setTranscription,
    handleChat,
    handleAnalyze,
    aoPerguntarScreenshot,
    aoAbrirAssistentes,
    aoAbrirAssistenteGramatical,
    aoAbrirChatWindow,
    aoAbrirConfiguracoes,
    aoFecharAplicacao,
    menuDropdownRef,
    initialCollapsed = false
}, ref) => {
    const [isExpanded, setIsExpanded] = useState(!initialCollapsed)
    const [menuAberto, setMenuAberto] = useState(false)
    const dragControls = useDragControls()
    const barrasWave = useMemo(() => Array.from({ length: 20 }, (_, index) => ({
        delay: (index % 6) * 0.08,
        escala: 0.5 + (index % 5) * 0.08
    })), [])

    const acionarEAbrir = (acao: () => void) => {
        setMenuAberto(false)
        acao()
    }

    return (
        <div
            ref={ref}
            data-area-interativa="true"
            className={`fixed ${isExpanded ? 'bottom-10' : 'bottom-3'} left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-auto`}
            onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
            onPointerLeave={() => {
                if (!menuAberto) {
                    window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
                }
            }}
        >
            <motion.div
                drag
                dragListener={false}
                dragControls={dragControls}
                dragMomentum={false}
                layout
                className={`overflow-visible transition-all duration-200 ${isExpanded
                    ? 'w-full bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl'
                    : 'w-[180px] mx-auto bg-black/30 backdrop-blur-sm border border-white/5 rounded-full px-2 shadow-md'
                    }`}
            >
                {isExpanded && (
                    <div
                        className="h-7 w-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors border-b border-white/5"
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <div
                            className="w-12 h-1.5 bg-white/20 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsExpanded(!isExpanded)
                            }}
                            style={{ cursor: 'pointer' }}
                        />
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            key="toolbar-conteudo"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex flex-col"
                        >
                            <div className="p-3 flex items-center gap-3 relative">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleRecording}
                                        className={`p-3 rounded-xl transition-all ${isRecording
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse'
                                            : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'}`}
                                    >
                                        {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                                    </button>

                                    <button
                                        onClick={aoPerguntarScreenshot}
                                        className="p-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/15 hover:text-white border border-white/10 transition-all"
                                        title="Perguntar com screenshot (Ctrl+Alt+S)"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 relative bg-white/5 rounded-xl border border-white/5 focus-within:border-white/20 transition-colors">
                                    {isRecording ? (
                                        <div className="h-14 flex items-center px-4 gap-3">
                                            <div className="flex-1 flex items-center gap-1 h-10">
                                                {barrasWave.map((barra, index) => (
                                                    <motion.div
                                                        key={`wave-${index}`}
                                                        className="w-1 rounded-full bg-white/60"
                                                        initial={{ scaleY: 0.4 }}
                                                        animate={{ scaleY: [barra.escala, 1.4, 0.6] }}
                                                        transition={{
                                                            repeat: Infinity,
                                                            repeatType: 'mirror',
                                                            duration: 1.2,
                                                            ease: 'easeInOut',
                                                            delay: barra.delay
                                                        }}
                                                        style={{ transformOrigin: 'center bottom' }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-inner shadow-white/20">
                                                    <Mic size={18} className="text-white" />
                                                </div>
                                                <span className="text-xs text-white/60 whitespace-nowrap">Gravando... transcricao no preview.</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={transcription}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => setTranscription(e.target.value)}
                                                placeholder="Digite ou use o microfone para transcrever..."
                                                className="w-full bg-transparent border-none outline-none text-sm text-white px-4 py-3 placeholder:text-white/30"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault()
                                                        handleChat()
                                                    }
                                                }}
                                            />

                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                {transcription.trim() && (
                                                    <>
                                                        <button onClick={handleChat} className="p-1.5 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg transition-colors">
                                                            <Send size={14} />
                                                        </button>
                                                        <button onClick={handleAnalyze} className="p-1.5 bg-purple-500/80 hover:bg-purple-500 text-white rounded-lg transition-colors">
                                                            <Sparkles size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setMenuAberto((estado) => !estado)}
                                        className={`flex items-center gap-2 p-3 rounded-xl transition-colors border ${menuAberto
                                            ? 'bg-white/15 border-white/30 text-white'
                                            : 'hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                                            }`}
                                    >
                                        <Settings size={18} />
                                        <ChevronDown size={14} className={`transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {menuAberto && (
                                            <motion.div
                                                ref={menuDropdownRef}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                className="absolute right-0 bottom-full mb-2 w-64 bg-neutral-900/95 border border-white/10 rounded-2xl shadow-xl overflow-hidden z-20"
                                                onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
                                                onPointerLeave={() => {
                                                    window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
                                                }}
                                            >
                                                <div className="divide-y divide-white/10">
                                                    <button
                                                        onClick={() => acionarEAbrir(aoAbrirChatWindow)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/90 flex items-start gap-2"
                                                    >
                                                        <MessageSquare size={16} className="text-blue-400 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-semibold">Chat Expandido</p>
                                                            <p className="text-xs text-white/60">Abrir janela de chat completa.</p>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => acionarEAbrir(aoAbrirAssistentes)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/90 flex items-start gap-2"
                                                    >
                                                        <Sparkles size={16} className="text-purple-300 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-semibold">Assistentes</p>
                                                            <p className="text-xs text-white/60">Configure e salve varios system prompts.</p>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => acionarEAbrir(aoAbrirAssistenteGramatical)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/90 flex items-start gap-2"
                                                    >
                                                        <PenSquare size={16} className="text-emerald-300 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-semibold">Assistente gramatical</p>
                                                            <p className="text-xs text-white/60">Corrija ou reescreva o texto selecionado.</p>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => acionarEAbrir(aoAbrirConfiguracoes)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/90 flex items-start gap-2"
                                                    >
                                                        <Settings size={16} className="text-blue-300 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-semibold">Configuracoes</p>
                                                            <p className="text-xs text-white/60">Chaves de API e preferencias.</p>
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => acionarEAbrir(aoFecharAplicacao)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/90 flex items-start gap-2"
                                                    >
                                                        <Power size={16} className="text-red-300 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-semibold">Fechar app</p>
                                                            <p className="text-xs text-white/60">Encerra a Selene rapidamente.</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!isExpanded && (
                    <div className="px-1 py-1">
                        <button
                            onClick={() => setIsExpanded(true)}
                            onPointerDown={(e) => dragControls.start(e)}
                            className="w-full max-w-[180px] mx-auto flex items-center justify-center gap-2 rounded-full border border-white/5 bg-black/50 px-3 py-1.5 backdrop-blur-sm hover:bg-black transition-all active:scale-[0.99]"
                        >
                            <div className="w-10 h-1.5 rounded-full bg-white/25" />
                            {isRecording ? (
                                <span className="flex items-center gap-1 text-[10px] text-red-300 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    Rec
                                </span>
                            ) : (
                                <ChevronUp size={14} className="text-white/40" />
                            )}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    )
})

BottomToolbar.displayName = 'BottomToolbar'

export default BottomToolbar
