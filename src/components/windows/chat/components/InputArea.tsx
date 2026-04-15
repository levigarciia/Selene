import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowUp,
    ChevronDown,
    Globe,
    Loader2,
    Mic,
    Paperclip,
    Plug,
    Settings,
    Sparkles,
    StopCircle,
    X,
} from 'lucide-react'
import type { UseVoiceInputReturn } from '../../../../hooks/useVoiceInput'
import type { ResumoContextoAtivo } from '../tiposShellChat'
import type { MCPServerInfo } from '../hooks/useChatUI'
import { PopoverContextoChat } from './PopoverContextoChat'

interface InputAreaProps {
    input: string
    onInputChange: (value: string) => void
    onSend: () => void
    onKeyDown: (e: React.KeyboardEvent) => void
    onPaste: (e: React.ClipboardEvent) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>

    isGenerating: boolean
    onStopGeneration: () => void
    pendingMessage: { text: string; screenshots: string[] } | null

    pendingScreenshots: string[]
    onRemoveScreenshot: (index: number) => void
    onAddScreenshot: (base64: string) => void

    inputMenuOpen: boolean
    onToggleInputMenu: () => void

    webSearchEnabled: boolean
    onToggleWebSearch: () => void

    investigateMode: boolean
    onToggleInvestigateMode: () => void
    isInvestigating: boolean

    toolCallingAtivo: boolean
    onToggleToolCalling: () => void

    mcpServers: MCPServerInfo[]
    onOpenMCPPanel: () => void
    onConnectMCPServer: (serverId: string) => void

    voiceInput: UseVoiceInputReturn
    resumoContextoAtivo: ResumoContextoAtivo
    resumoContextoAberto: boolean
    onToggleResumoContexto: () => void
    onFecharResumoContexto: () => void
}

interface GrupoFerramentasProps {
    children: React.ReactNode
}

const GrupoFerramentas: React.FC<GrupoFerramentasProps> = ({ children }) => (
    <div className="flex items-center gap-3 text-[#8a909d]">{children}</div>
)

const BotaoFerramenta: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
    <button
        type="button"
        {...props}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/[0.05] hover:text-[#d7dce6] ${className}`}
    />
)

export const InputArea: React.FC<InputAreaProps> = ({
    input,
    onInputChange,
    onSend,
    onKeyDown,
    onPaste,
    textareaRef,
    isGenerating,
    onStopGeneration,
    pendingMessage,
    pendingScreenshots,
    onRemoveScreenshot,
    onAddScreenshot,
    inputMenuOpen,
    onToggleInputMenu,
    webSearchEnabled,
    onToggleWebSearch,
    investigateMode,
    onToggleInvestigateMode,
    isInvestigating,
    toolCallingAtivo,
    onToggleToolCalling,
    mcpServers,
    onOpenMCPPanel,
    onConnectMCPServer,
    voiceInput,
    resumoContextoAtivo,
    resumoContextoAberto,
    onToggleResumoContexto,
    onFecharResumoContexto,
}) => {
    const entradaArquivoRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        const elemento = textareaRef.current
        if (!elemento) return

        elemento.style.height = 'auto'
        elemento.style.height = `${Math.min(elemento.scrollHeight, 150)}px`
    }, [input, textareaRef])

    const placeholder = isGenerating
        ? (pendingMessage ? 'Aguardando a mensagem anterior...' : 'Digite para enfileirar a próxima mensagem...')
        : pendingScreenshots.length > 0
        ? 'Descreva as imagens ou envie sem texto para resumir...'
        : 'Envie uma mensagem...'

    const servidoresConectados = mcpServers.filter((server) => server.status === 'connected')
    const contadorContexto = resumoContextoAtivo.contadorTotal
    const statusVoz = voiceInput.statusCaptura === 'gravando_local'
        ? 'Ouvindo ao vivo'
        : voiceInput.statusCaptura === 'gravando_cloud'
        ? 'Gravando por blocos'
        : voiceInput.statusCaptura === 'transcrevendo_cloud'
        ? 'Transcrevendo blocos'
        : null
    const classeBotaoMicrofone = voiceInput.statusCaptura === 'gravando_local'
        ? 'bg-[#173526] text-[#8be0b0]'
        : voiceInput.statusCaptura === 'gravando_cloud'
        ? 'bg-[#3a1d27] text-[#f4adb9]'
        : voiceInput.statusCaptura === 'transcrevendo_cloud'
        ? 'bg-[#2f2a18] text-[#f2d07d]'
        : ''
    const statusVozUsaLoader = voiceInput.statusCaptura === 'transcrevendo_cloud'

    const abrirSeletorImagem = () => {
        if (inputMenuOpen) {
            onToggleInputMenu()
        }

        entradaArquivoRef.current?.click()
    }

    const lidarComSelecaoImagens = (event: React.ChangeEvent<HTMLInputElement>) => {
        const arquivos = Array.from(event.target.files || [])

        arquivos.forEach((arquivo) => {
            const leitor = new FileReader()
            leitor.onload = (evento) => {
                const base64 = evento.target?.result as string
                onAddScreenshot(base64)
            }
            leitor.readAsDataURL(arquivo)
        })

        event.target.value = ''
    }

    return (
        <footer className="px-6 pb-4 pt-2">
            <div className="mx-auto w-full max-w-[54rem] lg:w-[46vw]">
                {pendingScreenshots.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-start gap-2">
                        {pendingScreenshots.map((shot, idx) => (
                            <div
                                key={`shot-chat-${idx}`}
                                className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#121419]"
                            >
                                <img
                                    src={shot}
                                    alt={`Screenshot ${idx + 1}`}
                                    className="h-16 w-auto object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemoveScreenshot(idx)}
                                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                                    title="Remover imagem"
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative rounded-2xl border border-white/[0.05] bg-[#191b1f] px-4 py-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition-colors focus-within:border-white/[0.08]">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => {
                                onInputChange(e.target.value)
                                e.target.style.height = 'auto'
                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
                            }}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                            placeholder={placeholder}
                            rows={1}
                            className="min-h-[72px] w-full resize-none overflow-y-auto border-none bg-transparent pr-16 text-[15px] leading-7 text-[#d7dce5] outline-none placeholder:text-[#8497ba] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent"
                            style={{ maxHeight: '150px' }}
                        />

                        <div className="mt-2.5 flex items-end justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#8a909d]">
                                <div className="relative">
                                    <GrupoFerramentas>
                                        <BotaoFerramenta
                                            onClick={abrirSeletorImagem}
                                            aria-label="Anexar imagens"
                                            title="Anexar imagens"
                                        >
                                            <Paperclip size={16} />
                                        </BotaoFerramenta>

                                        <input
                                            ref={entradaArquivoRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={lidarComSelecaoImagens}
                                        />

                                        <BotaoFerramenta
                                            onClick={() => {
                                                void voiceInput.toggleRecording().catch((erro) => {
                                                    console.error('[InputArea] Erro ao alternar gravação:', erro)
                                                })
                                            }}
                                            className={classeBotaoMicrofone}
                                            aria-label="Microfone"
                                            title={voiceInput.modoTranscricao === 'local_realtime'
                                                ? 'Microfone local em tempo real'
                                                : 'Microfone em nuvem por blocos'}
                                        >
                                            {voiceInput.statusCaptura === 'transcrevendo_cloud'
                                                ? <Loader2 size={16} className="animate-spin" />
                                                : <Mic size={16} />}
                                        </BotaoFerramenta>
                                    </GrupoFerramentas>

                                    <AnimatePresence>
                                        {inputMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute bottom-full left-0 z-50 mb-3 w-72 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111216] shadow-2xl"
                                            >
                                                {servidoresConectados.length > 0 && (
                                                    <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-3">
                                                        {servidoresConectados.map((server) => (
                                                            <div
                                                                key={server.id}
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-300"
                                                                title={`${server.name} (${server.toolCount} tools)`}
                                                            >
                                                                {server.icon ? (
                                                                    <img src={server.icon} alt="" className="h-4 w-4 rounded-sm" />
                                                                ) : (
                                                                    <Plug size={14} />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="py-1 text-[13px] text-[#cfd4de]">
                                                    <button
                                                        type="button"
                                                        onClick={onToggleInvestigateMode}
                                                        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.04]"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Sparkles size={15} className={investigateMode ? 'text-[#b1a7ff]' : 'text-[#838a98]'} />
                                                            Modo investigar
                                                        </span>
                                                        <span className={`h-4 w-8 rounded-full ${investigateMode ? 'bg-[#4b479f]' : 'bg-white/[0.08]'}`}>
                                                            <span className={`block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${investigateMode ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={onToggleToolCalling}
                                                        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.04]"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Plug size={15} className={toolCallingAtivo ? 'text-[#d4b46a]' : 'text-[#838a98]'} />
                                                            Tool calling
                                                        </span>
                                                        <span className={`h-4 w-8 rounded-full ${toolCallingAtivo ? 'bg-[#4b479f]' : 'bg-white/[0.08]'}`}>
                                                            <span className={`block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${toolCallingAtivo ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                                        </span>
                                                    </button>

                                                    {mcpServers.map((server) => (
                                                        <button
                                                            key={server.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (server.status === 'connected') {
                                                                    onOpenMCPPanel()
                                                                    onToggleInputMenu()
                                                                    return
                                                                }

                                                                onConnectMCPServer(server.id)
                                                            }}
                                                            className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.04]"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                {server.icon ? (
                                                                    <img src={server.icon} alt="" className="h-4 w-4 rounded-sm opacity-80" />
                                                                ) : (
                                                                    <Plug size={15} className="text-[#838a98]" />
                                                                )}
                                                                {server.name}
                                                            </span>
                                                            <span className="text-[12px] text-[#808796]">
                                                                {server.status === 'connected'
                                                                    ? `${server.toolCount} tools`
                                                                    : server.status === 'connecting'
                                                                    ? 'Conectando'
                                                                    : 'Conectar'}
                                                            </span>
                                                        </button>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onOpenMCPPanel()
                                                            onToggleInputMenu()
                                                        }}
                                                        className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-white/[0.04]"
                                                    >
                                                        <Settings size={15} className="text-[#838a98]" />
                                                        Conectar mais
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <span className="h-5 w-px bg-white/[0.08]" />

                                <button
                                    type="button"
                                    onClick={onToggleInputMenu}
                                    className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04] hover:text-[#d7dce6] ${inputMenuOpen ? 'bg-white/[0.04] text-[#d7dce6]' : ''}`}
                                    aria-label="Abrir ações rápidas"
                                    title="Abrir ações rápidas"
                                >
                                    <Sparkles size={15} className={investigateMode ? 'text-[#c6b6ff]' : toolCallingAtivo ? 'text-[#d4b46a]' : ''} />
                                    <ChevronDown size={13} />
                                </button>

                                <span className="h-5 w-px bg-white/[0.08]" />

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={onToggleResumoContexto}
                                        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04] hover:text-[#d7dce6]"
                                    >
                                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] text-[#d7dce6]">
                                            {contadorContexto}
                                        </span>
                                        <span>Contexto</span>
                                    </button>

                                    <PopoverContextoChat
                                        aberto={resumoContextoAberto}
                                        resumo={resumoContextoAtivo}
                                        onClose={onFecharResumoContexto}
                                    />
                                </div>

                                <span className="h-5 w-px bg-white/[0.08]" />

                                <button
                                    type="button"
                                    onClick={onToggleWebSearch}
                                    className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04] hover:text-[#d7dce6] ${webSearchEnabled ? 'text-[#b5c3eb]' : ''}`}
                                >
                                    <Globe size={15} />
                                    <span>Web</span>
                                </button>

                                {(statusVoz || isInvestigating) && (
                                    <>
                                        <span className="h-5 w-px bg-white/[0.08]" />
                                        <span className={`flex items-center gap-1.5 ${statusVoz ? 'text-[#f0b4c1]' : 'text-[#d8bd7a]'}`}>
                                            {statusVoz
                                                ? statusVozUsaLoader
                                                    ? <Loader2 size={14} className="animate-spin" />
                                                    : <Mic size={14} />
                                                : <Loader2 size={14} className="animate-spin" />}
                                            {statusVoz || 'Investigando'}
                                        </span>
                                    </>
                                )}
                            </div>

                            {isGenerating ? (
                                <button
                                    type="button"
                                    onClick={onStopGeneration}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3a1d27] text-[#f19ab0] transition-colors hover:bg-[#512736]"
                                    title="Parar geração"
                                >
                                    <StopCircle size={17} />
                                </button>
                            ) : (
                                <button
                                    data-send-button
                                    type="button"
                                    onClick={onSend}
                                    disabled={!input.trim() && pendingScreenshots.length === 0}
                                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                        input.trim() || pendingScreenshots.length > 0
                                            ? 'bg-[#4f6bcb] text-white hover:bg-[#5d78da]'
                                            : 'bg-white/[0.06] text-[#69707d]'
                                    }`}
                                >
                                    <ArrowUp size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
