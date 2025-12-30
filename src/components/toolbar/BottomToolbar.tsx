import { forwardRef, useMemo, useState, type RefObject } from 'react'
import { Settings, Mic, Sparkles, Send, ChevronUp, ChevronDown, Power, PenSquare, Camera, MessageSquare, X } from 'lucide-react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'

interface BottomToolbarProps {
    isRecording: boolean
    toggleRecording: () => void
    transcription: string
    setTranscription: (text: string) => void
    handleChat: () => void
    handleAnalyze: () => void
    aoPerguntarScreenshot: () => void
    nivelAudio?: number
    barrasAudio?: number[]
    pendingScreenshots?: string[]
    onDeleteScreenshot?: (index: number) => void
    aoAbrirAssistentes: () => void
    aoAbrirAssistenteGramatical: () => void
    aoAbrirConfiguracoes: () => void
    aoAbrirChatWindow: () => void
    aoFecharAplicacao: () => void
    menuDropdownRef?: RefObject<HTMLDivElement | null>
    initialCollapsed?: boolean
    forceCollapse?: boolean
}

const BottomToolbar = forwardRef<HTMLDivElement, BottomToolbarProps>(({
    isRecording,
    toggleRecording,
    transcription,
    setTranscription,
    handleChat,
    handleAnalyze,
    aoPerguntarScreenshot,
    nivelAudio,
    barrasAudio,
    pendingScreenshots,
    onDeleteScreenshot,
    aoAbrirAssistentes,
    aoAbrirAssistenteGramatical,
    aoAbrirChatWindow,
    aoAbrirConfiguracoes,
    aoFecharAplicacao,
    menuDropdownRef,
    initialCollapsed = false,
    forceCollapse
}, ref) => {
    const [isExpanded, setIsExpanded] = useState(!initialCollapsed)

    // Sync with forceCollapse
    useMemo(() => {
        if (forceCollapse !== undefined) {
             setIsExpanded(!forceCollapse)
        }
    }, [forceCollapse])

    const [menuAberto, setMenuAberto] = useState(false)
    const dragControls = useDragControls()
    const nivelAudioNormalizado = Math.min(1, Math.max(0, nivelAudio || 0))
    const barrasWave = useMemo(() => Array.from({ length: 24 }, (_, index) => ({
        id: index,
        altura: 6 + (index % 5) * 2,
        seed: Math.random(),
        fase: Math.random() * Math.PI * 2,
        vel1: 0.6 + Math.random() * 0.9,
        vel2: 1.2 + Math.random() * 1.3,
        peso: 0.6 + Math.random() * 0.9,
        delay: (index % 8) * 0.05,
        duracao: 0.9 + (index % 6) * 0.12
    })), [])
    const barrasAtuais = barrasAudio && barrasAudio.length === barrasWave.length
        ? barrasAudio
        : barrasWave.map(() => 0)
    const mediaAudio = barrasAtuais.reduce((acc, valor) => acc + valor, 0) / barrasAtuais.length
    const nivelAudioAmplificado = Math.min(1, Math.pow(Math.max(mediaAudio, nivelAudioNormalizado) * 4, 0.65))
    const opacidadeWave = 0.25 + nivelAudioAmplificado * 0.7
    const tempoOscilacao = performance.now() / 1000

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
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isRecording && (
                                        <button
                                            onClick={toggleRecording}
                                            className="p-3 rounded-xl transition-all bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                                        >
                                            <Mic size={20} />
                                        </button>
                                    )}

                                    <button
                                        onClick={aoPerguntarScreenshot}
                                        className="p-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/15 hover:text-white border border-white/10 transition-all"
                                        title="Perguntar com screenshot (Ctrl+Alt+S)"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 min-w-0 relative bg-white/5 rounded-xl border border-white/5 focus-within:border-white/20 transition-colors">
                                    {isRecording ? (
                                        <div className="h-14 flex items-center justify-center px-4 relative">
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div
                                                    className="w-full max-w-[320px] flex items-end justify-center gap-1.5"
                                                    style={{ opacity: opacidadeWave }}
                                                >
                                                    {barrasWave.map((barra) => {
                                                        const variacao =
                                                            0.6 +
                                                            0.22 * Math.sin(tempoOscilacao * barra.vel1 + barra.fase) +
                                                            0.18 * Math.sin(tempoOscilacao * barra.vel2 + barra.fase * 1.7)
                                                        const altura = barra.altura + (8 + nivelAudioAmplificado * 90) * barra.peso * variacao
                                                        return (
                                                            <div
                                                                key={`wave-${barra.id}`}
                                                                className="onda-audio-barra w-1 rounded-full bg-white/70"
                                                                style={{
                                                                    height: `${altura}px`,
                                                                    animationDelay: `${barra.delay}s`,
                                                                    animationDuration: `${barra.duracao}s`
                                                                }}
                                                            />
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <div className="relative w-14 h-14 flex items-center justify-center">
                                                <button
                                                    onClick={toggleRecording}
                                                    className="relative z-10 w-11 h-11 rounded-full bg-red-500/80 text-white shadow-lg shadow-red-500/30 flex items-center justify-center"
                                                >
                                                    <Mic size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-col w-full">
                                                {pendingScreenshots && pendingScreenshots.length > 0 && (
                                                    <div className="px-4 pt-3 pb-1 flex items-start gap-2 flex-wrap">
                                                        {pendingScreenshots.map((shot, idx) => (
                                                            <div key={`shot-${idx}`} className="relative group">
                                                                <img 
                                                                    src={shot} 
                                                                    alt={`Screenshot Preview ${idx + 1}`} 
                                                                    className="h-16 w-auto rounded-lg border border-white/20 shadow-sm"
                                                                />
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        onDeleteScreenshot?.(idx)
                                                                    }}
                                                                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <input
                                                    type="text"
                                                    value={transcription}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onChange={(e) => setTranscription(e.target.value)}
                                                    placeholder={pendingScreenshots && pendingScreenshots.length > 0 ? "Perguntar sobre as imagens..." : "Digite ou use o microfone para transcrever..."}
                                                    className="w-full bg-transparent border-none outline-none text-sm text-white px-4 py-3 placeholder:text-white/30"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault()
                                                            handleChat()
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                {(transcription.trim() || (pendingScreenshots && pendingScreenshots.length > 0)) && (
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

                                <div className="relative shrink-0">
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
