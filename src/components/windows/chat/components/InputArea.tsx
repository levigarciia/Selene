import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Send, X, Globe, Brain, Loader2, Plug,
    StopCircle, Settings, ImageIcon, ChevronRight
} from 'lucide-react'
import type { MCPServerInfo } from '../hooks/useChatUI'

interface InputAreaProps {
    input: string
    onInputChange: (value: string) => void
    onSend: () => void
    onKeyDown: (e: React.KeyboardEvent) => void
    onPaste: (e: React.ClipboardEvent) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>

    // Generation state
    isGenerating: boolean
    onStopGeneration: () => void
    pendingMessage: { text: string; screenshots: string[] } | null

    // Screenshots
    pendingScreenshots: string[]
    onRemoveScreenshot: (index: number) => void
    onAddScreenshot: (base64: string) => void

    // Input menu
    inputMenuOpen: boolean
    onToggleInputMenu: () => void

    // Web search
    webSearchEnabled: boolean
    onToggleWebSearch: () => void

    // Investigate mode
    investigateMode: boolean
    onToggleInvestigateMode: () => void
    isInvestigating: boolean

    // Tool calling
    toolCallingAtivo: boolean
    onToggleToolCalling: () => void

    // MCP servers
    mcpServers: MCPServerInfo[]
    onOpenMCPPanel: () => void
    onConnectMCPServer: (serverId: string) => void
}

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
}) => {
    const placeholder = isGenerating
        ? (pendingMessage ? 'Aguardando processamento da mensagem anterior...' : 'Digite e Enter para enfileirar próxima mensagem...')
        : (pendingScreenshots.length > 0 ? 'Descreva as imagens ou deixe em branco para resumo...' : (webSearchEnabled ? 'Pergunte algo - pesquisa ativada...' : 'Pergunte alguma coisa...'))

    return (
        <footer className="flex-none p-4 bg-neutral-900/50 border-t border-white/5">
            {/* Pending Screenshots Preview */}
            {pendingScreenshots.length > 0 && (
                <div className="mb-3 flex flex-wrap items-start gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    {pendingScreenshots.map((shot, idx) => (
                        <div key={`shot-chat-${idx}`} className="relative">
                            <img src={shot} alt={`Screenshot ${idx + 1}`} className="h-16 w-auto rounded-lg border border-white/10" />
                            <button
                                onClick={() => onRemoveScreenshot(idx)}
                                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white text-[10px] shadow-lg"
                                title="Remover imagem"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-3 bg-neutral-800/50 rounded-2xl border border-white/10 px-4 py-2 focus-within:border-purple-500/50 transition-colors">
                {/* Plus Button with Dropdown */}
                <div className="relative">
                    <button
                        onClick={onToggleInputMenu}
                        className={`p-1.5 rounded-lg transition-colors ${inputMenuOpen ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/10'}`}
                        title="Opções"
                    >
                        <Plus size={18} className={`transition-transform ${inputMenuOpen ? 'rotate-45' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {inputMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute bottom-full left-0 mb-2 w-64 bg-neutral-900/98 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                            >
                                {/* Connected MCP Servers Header */}
                                {mcpServers.filter(s => s.status === 'connected').length > 0 && (
                                    <div className="flex items-center gap-1 px-3 py-2.5 border-b border-white/5">
                                        {mcpServers.filter(s => s.status === 'connected').map(server => (
                                            <div
                                                key={server.id}
                                                className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-400"
                                                title={`${server.name} (${server.toolCount} tools)`}
                                            >
                                                {server.icon ? (
                                                    <img src={server.icon} alt="" className="w-4 h-4 rounded-sm" />
                                                ) : (
                                                    <Plug size={16} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="py-1">
                                    {/* Web Search Toggle */}
                                    <button
                                        onClick={onToggleWebSearch}
                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Globe size={16} className={webSearchEnabled ? 'text-blue-400' : 'text-neutral-400'} />
                                            <span className="text-sm text-neutral-200">Busca na Web</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${webSearchEnabled ? 'bg-blue-500 justify-end' : 'bg-neutral-700 justify-start'}`}>
                                            <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                                        </div>
                                    </button>

                                    {/* Connected MCP Servers */}
                                    {mcpServers.filter(s => s.status === 'connected').map(server => (
                                        <button
                                            key={server.id}
                                            onClick={() => {
                                                onOpenMCPPanel()
                                                onToggleInputMenu()
                                            }}
                                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {server.icon ? (
                                                    <img src={server.icon} alt="" className="w-4 h-4 rounded-sm" />
                                                ) : (
                                                    <Plug size={16} className="text-emerald-400" />
                                                )}
                                                <span className="text-sm text-neutral-200">{server.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-neutral-500">{server.toolCount}</span>
                                                <ChevronRight size={14} className="text-neutral-500" />
                                            </div>
                                        </button>
                                    ))}

                                    {/* Disconnected MCP Servers */}
                                    {mcpServers.filter(s => s.status !== 'connected').map(server => (
                                        <button
                                            key={server.id}
                                            onClick={() => onConnectMCPServer(server.id)}
                                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {server.icon ? (
                                                    <img src={server.icon} alt="" className="w-4 h-4 rounded-sm opacity-50" />
                                                ) : (
                                                    <Plug size={16} className="text-neutral-500" />
                                                )}
                                                <span className="text-sm text-neutral-400">{server.name}</span>
                                            </div>
                                            <span className="text-xs text-neutral-500 hover:text-neutral-300">
                                                {server.status === 'connecting' ? 'Conectando...' : 'Conectar'}
                                            </span>
                                        </button>
                                    ))}

                                    {/* Tool Calling Toggle */}
                                    <button
                                        onClick={onToggleToolCalling}
                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Plug size={16} className={toolCallingAtivo ? 'text-amber-400' : 'text-neutral-400'} />
                                            <span className="text-sm text-neutral-200">Tool Calling</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${toolCallingAtivo ? 'bg-amber-500 justify-end' : 'bg-neutral-700 justify-start'}`}>
                                            <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                                        </div>
                                    </button>

                                    <div className="h-px bg-white/5 mx-2 my-1" />

                                    {/* Investigate Mode Toggle */}
                                    <button
                                        onClick={onToggleInvestigateMode}
                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Brain size={16} className={investigateMode ? 'text-purple-400' : 'text-neutral-400'} />
                                            <span className="text-sm text-neutral-200">Modo Investigar</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${investigateMode ? 'bg-purple-500 justify-end' : 'bg-neutral-700 justify-start'}`}>
                                            <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                                        </div>
                                    </button>

                                    {/* Attach Image */}
                                    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors">
                                        <ImageIcon size={16} className="text-neutral-400" />
                                        <span className="text-sm text-neutral-200">Anexar imagem</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                files.forEach(file => {
                                                    const reader = new FileReader()
                                                    reader.onload = (ev) => {
                                                        const base64 = ev.target?.result as string
                                                        onAddScreenshot(base64)
                                                    }
                                                    reader.readAsDataURL(file)
                                                })
                                                onToggleInputMenu()
                                            }}
                                        />
                                    </label>

                                    <div className="h-px bg-white/5 mx-2 my-1" />

                                    {/* Connect More */}
                                    <button
                                        onClick={() => {
                                            onOpenMCPPanel()
                                            onToggleInputMenu()
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                                    >
                                        <Settings size={16} className="text-neutral-400" />
                                        <span className="text-sm text-neutral-200">Conectar mais</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                        onInputChange(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={onKeyDown}
                    onPaste={onPaste}
                    placeholder={placeholder}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-neutral-200 placeholder-neutral-500 text-sm resize-none overflow-y-auto leading-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                    style={{ minHeight: '20px', maxHeight: '120px' }}
                />

                {/* Web Search Indicator */}
                {webSearchEnabled && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                        <Globe size={12} className="text-green-400" />
                        <span className="text-[10px] text-green-400 font-medium">Web</span>
                    </div>
                )}

                {/* Investigate Mode Indicator */}
                {investigateMode && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                        <Brain size={12} className="text-purple-400" />
                        <span className="text-[10px] text-purple-400 font-medium">Investigar</span>
                    </div>
                )}

                {/* Investigating Status */}
                {isInvestigating && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                        <Loader2 size={12} className="text-yellow-400 animate-spin" />
                        <span className="text-[10px] text-yellow-400 font-medium">Investigando...</span>
                    </div>
                )}


                {/* Send/Stop Button */}
                {isGenerating ? (
                    <button
                        onClick={onStopGeneration}
                        className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Parar geração"
                    >
                        <StopCircle size={18} />
                    </button>
                ) : (
                    <button
                        data-send-button
                        onClick={onSend}
                        disabled={!input.trim() && pendingScreenshots.length === 0}
                        className={`p-2.5 rounded-xl transition-all duration-200 ${(input.trim() || pendingScreenshots.length > 0)
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:scale-105'
                            : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                            }`}
                    >
                        <Send size={18} />
                    </button>
                )}
            </div>

            <p className="text-center text-[10px] text-neutral-600 mt-2">
                Selene pode cometer erros. Verifique informações importantes.
            </p>
        </footer>
    )
}
