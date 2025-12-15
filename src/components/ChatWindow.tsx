import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Send, Minus, Square, X, Terminal,
    MessageSquare, Plus, Settings, ChevronLeft, ChevronRight,
    Copy, RefreshCw, StopCircle, Check, Loader2, User, Briefcase, Heart, Brain, Trash2, KeyRound, Settings2,
    Zap, Link2, Download
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { v4 as uuidv4 } from 'uuid'

import type { ChatMessage } from '../types/chat'
import { useAI } from '../hooks/useAI'
import { useUserProfile } from '../hooks/useUserProfile'
import type { UserProfile, Memory } from '../hooks/useUserProfile'
import { useCrossChatContext } from '../hooks/useCrossChatContext'
import { useMemoryAutopilot } from '../hooks/useMemoryAutopilot'
import { composePrompt, processUserMessageForMemory } from '../services/PromptPipeline'

// Types
interface Conversation {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
}

// Sidebar Item Component
const SidebarItem: React.FC<{
    icon: React.ElementType
    label: string
    active?: boolean
    onClick?: () => void
    onDelete?: () => void
    trailing?: React.ReactNode
}> = ({ icon: Icon, label, active, onClick, onDelete, trailing }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200 text-left ${active
                ? 'bg-purple-500/15 text-purple-200'
                : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'
                }`}
        >
            <Icon size={18} className={active ? 'text-purple-400' : 'group-hover:text-purple-300 transition-colors'} />
            <span className="flex-1 text-sm font-medium truncate pr-6">{label}</span>
            {trailing}
        </button>
        {onDelete && (
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
                title="Excluir conversa"
            >
                <Trash2 size={14} />
            </button>
        )}
    </div>
)

// Message Actions Component
const MessageActions: React.FC<{
    onCopy: () => void
    onRegenerate: () => void
    copied: boolean
    canRegenerate: boolean
}> = ({ onCopy, onRegenerate, copied, canRegenerate }) => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
            onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
            title="Copiar"
        >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
        {canRegenerate && (
            <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                title="Regenerar"
            >
                <RefreshCw size={14} />
            </button>
        )}
    </div>
)

// Streaming Indicator Component
const StreamingIndicator: React.FC = () => (
    <div className="flex items-center gap-2 text-purple-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Gerando resposta...</span>
    </div>
)

// Settings Panel Component
const SettingsPanel: React.FC<{
    profile: UserProfile
    setProfile: (profile: UserProfile) => void
    memories: Memory[]
    addMemory: (content: string) => void
    removeMemory: (id: string) => void
    // Auto memories
    autoMemories: Array<{ id: string; text: string; category: string; confidence: number; createdAt: number }>
    removeAutoMemory: (id: string) => void
    clearAutoMemories: () => void
    // API settings
    apiKey: string
    setApiKey: (v: string) => void
    geminiKey: string
    setGeminiKey: (v: string) => void
    openRouterKey: string
    setOpenRouterKey: (v: string) => void
    modeloOpenRouter: string
    setModeloOpenRouter: (v: string) => void
    modeloLmStudio: string
    setModeloLmStudio: (v: string) => void
    baseUrlLmStudio: string
    setBaseUrlLmStudio: (v: string) => void
    provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
    setProvedorAtivo: (v: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
    // Advanced settings
    crossChatEnabled: boolean
    setCrossChatEnabled: (v: boolean) => void
    memoryAutopilotEnabled: boolean
    setMemoryAutopilotEnabled: (v: boolean) => void
    onClose: () => void
}> = ({
    profile, setProfile, memories, addMemory, removeMemory,
    autoMemories, removeAutoMemory, clearAutoMemories,
    apiKey, setApiKey, geminiKey, setGeminiKey, openRouterKey, setOpenRouterKey,
    modeloOpenRouter, setModeloOpenRouter, modeloLmStudio, setModeloLmStudio,
    baseUrlLmStudio, setBaseUrlLmStudio, provedorAtivo, setProvedorAtivo,
    crossChatEnabled, setCrossChatEnabled, memoryAutopilotEnabled, setMemoryAutopilotEnabled,
    onClose
}) => {
        const [newMemory, setNewMemory] = useState('')
        const [activeTab, setActiveTab] = useState<'perfil' | 'memorias' | 'api' | 'modelos' | 'avancado'>('perfil')

        // Auto-update state
        const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false)
        const [updateStatus, setUpdateStatus] = useState<{
            status: string
            version?: string
            progress?: { percent: number }
            error?: string
        } | null>(null)
        const [appVersion, setAppVersion] = useState('')
        const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

        // Load auto-update status on mount
        useEffect(() => {
            window.electronAPI?.getAutoUpdateStatus?.().then((status: { enabled: boolean; currentVersion: string }) => {
                setAutoUpdateEnabled(status.enabled)
            })
            window.electronAPI?.getAppVersion?.().then((version: string) => {
                setAppVersion(version)
            })

            // Listen for update status events
            const removeListener = window.electronAPI?.onUpdateStatus?.((status: any) => {
                setUpdateStatus(status)
                if (status.status === 'checking') {
                    setIsCheckingUpdate(true)
                } else {
                    setIsCheckingUpdate(false)
                }
            })

            return () => removeListener?.()
        }, [])

        const handleToggleAutoUpdate = () => {
            const newValue = !autoUpdateEnabled
            setAutoUpdateEnabled(newValue)
            window.electronAPI?.setAutoUpdate?.(newValue)
        }

        const handleCheckForUpdates = async () => {
            setIsCheckingUpdate(true)
            try {
                await window.electronAPI?.checkForUpdates?.()
            } finally {
                setTimeout(() => setIsCheckingUpdate(false), 3000)
            }
        }

        const handleInstallUpdate = () => {
            window.electronAPI?.installUpdate?.()
        }

        const tabs = [
            { id: 'perfil', label: 'Perfil', icon: User },
            { id: 'memorias', label: 'Memórias', icon: Brain },
            { id: 'api', label: 'Chaves API', icon: KeyRound },
            { id: 'modelos', label: 'Modelos', icon: Settings2 },
            { id: 'avancado', label: 'Avançado', icon: Zap },
        ] as const

        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-0 bg-[#0a0a0c] z-20 flex flex-col pointer-events-auto"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Header */}
                <div className="flex-none h-14 flex items-center justify-between px-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-neutral-100">Configurações</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex-none px-5 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                    {activeTab === 'perfil' && (
                        <>
                            {/* Name */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/20">
                                        <User size={18} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">Como você quer ser chamado?</h3>
                                        <p className="text-xs text-neutral-500">A Selene usará esse nome para se referir a você.</p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    placeholder="Seu nome ou apelido"
                                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </section>

                            {/* Occupation */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/20">
                                        <Briefcase size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">Ocupação</h3>
                                        <p className="text-xs text-neutral-500">Com o que você trabalha ou estuda?</p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={profile.occupation}
                                    onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                                    placeholder="Ex: Desenvolvedor de software, Designer, Estudante..."
                                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500/50 transition-colors"
                                />
                            </section>

                            {/* About Me */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-rose-500/20">
                                        <Heart size={18} className="text-rose-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">Mais sobre você</h3>
                                        <p className="text-xs text-neutral-500">Interesses, valores ou preferências a serem lembrados.</p>
                                    </div>
                                </div>
                                <textarea
                                    value={profile.aboutMe}
                                    onChange={(e) => setProfile({ ...profile, aboutMe: e.target.value })}
                                    placeholder="Ex: Gosto de respostas diretas e objetivas. Prefiro exemplos práticos. Tenho interesse em tecnologia e música..."
                                    rows={4}
                                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-rose-500/50 transition-colors resize-none"
                                />
                            </section>
                        </>
                    )}

                    {activeTab === 'memorias' && (
                        <div className="space-y-4">
                            {/* Manual Memories Section */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/20">
                                        <Brain size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">Memórias Manuais</h3>
                                        <p className="text-xs text-neutral-500">Informações que você adicionou manualmente.</p>
                                    </div>
                                </div>

                                {/* Add Memory */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMemory}
                                        onChange={(e) => setNewMemory(e.target.value)}
                                        placeholder="Adicionar nova memória..."
                                        className="flex-1 bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-emerald-500/50 transition-colors"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newMemory.trim()) {
                                                addMemory(newMemory.trim())
                                                setNewMemory('')
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (newMemory.trim()) {
                                                addMemory(newMemory.trim())
                                                setNewMemory('')
                                            }
                                        }}
                                        disabled={!newMemory.trim()}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Adicionar
                                    </button>
                                </div>

                                {/* Manual Memories List */}
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {memories.length === 0 ? (
                                        <p className="text-xs text-neutral-600 text-center py-4">Nenhuma memória manual ainda</p>
                                    ) : (
                                        memories.map((memory) => (
                                            <div
                                                key={memory.id}
                                                className="flex items-start gap-3 p-3 bg-neutral-900/50 border border-emerald-500/10 rounded-xl group"
                                            >
                                                <p className="flex-1 text-sm text-neutral-300">{memory.content}</p>
                                                <button
                                                    onClick={() => removeMemory(memory.id)}
                                                    className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            {/* Automatic Memories Section */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-amber-500/20">
                                            <Zap size={18} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Memórias Automáticas</h3>
                                            <p className="text-xs text-neutral-500">Extraídas automaticamente das conversas.</p>
                                        </div>
                                    </div>
                                    {autoMemories.length > 0 && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Apagar todas as ${autoMemories.length} memórias automáticas?`)) {
                                                    clearAutoMemories()
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                                        >
                                            Limpar todas
                                        </button>
                                    )}
                                </div>

                                {/* Auto Memories List */}
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {autoMemories.length === 0 ? (
                                        <p className="text-xs text-neutral-600 text-center py-4">
                                            Nenhuma memória automática ainda. {memoryAutopilotEnabled ? 'Continue conversando!' : 'Ative nas configurações avançadas.'}
                                        </p>
                                    ) : (
                                        autoMemories.map((memory) => (
                                            <div
                                                key={memory.id}
                                                className="flex items-start gap-3 p-3 bg-neutral-900/50 border border-amber-500/10 rounded-xl group"
                                            >
                                                <div className="flex-1">
                                                    <p className="text-sm text-neutral-300">{memory.text}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded">
                                                            {memory.category}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-600">
                                                            {Math.round(memory.confidence * 100)}% confiança
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeAutoMemory(memory.id)}
                                                    className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                                <div className="p-2 rounded-xl bg-amber-500/20">
                                    <KeyRound size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-neutral-200">Provedor Ativo & Chaves</h3>
                                    <p className="text-xs text-neutral-500">Selecione qual IA a Selene deve usar.</p>
                                </div>
                            </div>

                            {/* Provider Selection */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {([
                                    { id: 'openai', label: 'OpenAI' },
                                    { id: 'gemini', label: 'Gemini' },
                                    { id: 'openrouter', label: 'OpenRouter' },
                                    { id: 'lmstudio', label: 'LM Studio' }
                                ] as const).map((prov) => (
                                    <button
                                        key={prov.id}
                                        onClick={() => setProvedorAtivo(prov.id)}
                                        className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${provedorAtivo === prov.id
                                            ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                            : 'bg-neutral-900/50 border-white/10 text-neutral-400 hover:bg-white/5'
                                            }`}
                                    >
                                        {prov.label}
                                    </button>
                                ))}
                            </div>

                            {/* API Keys */}
                            <div className="space-y-3 pt-2">
                                <label className="flex flex-col gap-1.5 text-sm">
                                    <span className="text-neutral-400">OpenAI API Key</span>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400 placeholder-neutral-600"
                                        placeholder="sk-..."
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5 text-sm">
                                    <span className="text-neutral-400">Gemini API Key</span>
                                    <input
                                        type="password"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 placeholder-neutral-600"
                                        placeholder="AIza..."
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5 text-sm">
                                    <span className="text-neutral-400">OpenRouter API Key</span>
                                    <input
                                        type="password"
                                        value={openRouterKey}
                                        onChange={(e) => setOpenRouterKey(e.target.value)}
                                        className="bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400 placeholder-neutral-600"
                                        placeholder="sk-or-..."
                                    />
                                </label>
                            </div>
                        </section>
                    )}

                    {activeTab === 'modelos' && (
                        <div className="space-y-4">
                            {/* OpenRouter Model */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500/20">
                                        <Settings2 size={18} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">OpenRouter</h3>
                                        <p className="text-xs text-neutral-500">Modelo preferido para OpenRouter.</p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={modeloOpenRouter}
                                    onChange={(e) => setModeloOpenRouter(e.target.value)}
                                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-indigo-500/50 transition-colors"
                                    placeholder="ex: openai/gpt-4o ou google/gemini-2.0-flash-exp:free"
                                />
                                <p className="text-xs text-neutral-600">Se o modelo não suportar imagem, redirecionamos automaticamente para gemini-2.0-flash.</p>
                            </section>

                            {/* LM Studio */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/20">
                                        <Settings2 size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-neutral-200">LM Studio</h3>
                                        <p className="text-xs text-neutral-500">Servidor local via LM Studio.</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="flex flex-col gap-1.5 text-sm">
                                        <span className="text-neutral-400">Modelo</span>
                                        <input
                                            type="text"
                                            value={modeloLmStudio}
                                            onChange={(e) => setModeloLmStudio(e.target.value)}
                                            className="bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 placeholder-neutral-600"
                                            placeholder="ex: local-model-id"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5 text-sm">
                                        <span className="text-neutral-400">Endpoint</span>
                                        <input
                                            type="text"
                                            value={baseUrlLmStudio}
                                            onChange={(e) => setBaseUrlLmStudio(e.target.value)}
                                            className="bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 placeholder-neutral-600"
                                            placeholder="ex: http://localhost:1234/v1"
                                        />
                                    </label>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'avancado' && (
                        <div className="space-y-4">
                            {/* Cross-Chat Context Toggle */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-blue-500/20">
                                            <Link2 size={18} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Contexto entre Conversas</h3>
                                            <p className="text-xs text-neutral-500">Recupera trechos relevantes de conversas anteriores automaticamente.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCrossChatEnabled(!crossChatEnabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${crossChatEnabled ? 'bg-blue-500' : 'bg-neutral-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${crossChatEnabled ? 'translate-x-6' : ''
                                                }`}
                                        />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-600">
                                    Quando ativado, a Selene busca automaticamente contexto de conversas passadas para enriquecer suas respostas.
                                    Isso não grava memórias permanentes, apenas recupera trechos relevantes.
                                </p>
                                {/* Clear Embeddings Button */}
                                <button
                                    onClick={() => {
                                        if (window.confirm('Isso apagará todo o histórico de contexto entre conversas. Continuar?')) {
                                            import('../services/crosschat/EmbeddingIndex').then(({ clearIndex }) => {
                                                clearIndex()
                                                alert('Índice de embeddings limpo com sucesso!')
                                            })
                                        }
                                    }}
                                    className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium transition-colors"
                                >
                                    🗑️ Limpar todos os embeddings
                                </button>
                            </section>

                            {/* Memory Autopilot Toggle */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-amber-500/20">
                                            <Zap size={18} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Memória Automática</h3>
                                            <p className="text-xs text-neutral-500">Extrai e salva automaticamente memórias importantes das conversas.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setMemoryAutopilotEnabled(!memoryAutopilotEnabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${memoryAutopilotEnabled ? 'bg-amber-500' : 'bg-neutral-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${memoryAutopilotEnabled ? 'translate-x-6' : ''
                                                }`}
                                        />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-600">
                                    Quando ativado, a Selene detecta e salva automaticamente preferências, contexto de projetos
                                    e informações relevantes. Memórias extraídas aparecem na seção "Memórias".
                                </p>
                                <p className="text-xs text-amber-400/70">
                                    ⚠️ Requer mensagens longas (+80 caracteres) e confiança alta para extrair memórias.
                                </p>
                            </section>

                            {/* Auto-Update Section */}
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-green-500/20">
                                            <Download size={18} className="text-green-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Atualizações Automáticas</h3>
                                            <p className="text-xs text-neutral-500">Baixa e instala atualizações automaticamente.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleToggleAutoUpdate}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${autoUpdateEnabled ? 'bg-green-500' : 'bg-neutral-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoUpdateEnabled ? 'translate-x-6' : ''
                                                }`}
                                        />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-600">
                                    Quando ativado, a Selene verifica por atualizações no boot e periodicamente (a cada 4 horas).
                                    Downloads são feitos em segundo plano e você será notificado quando estiver pronto.
                                </p>

                                {/* Version and Status */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-neutral-500">Versão atual: <span className="text-neutral-300">{appVersion || 'Carregando...'}</span></span>
                                    <button
                                        onClick={handleCheckForUpdates}
                                        disabled={isCheckingUpdate}
                                        className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw size={12} className={isCheckingUpdate ? 'animate-spin' : ''} />
                                        {isCheckingUpdate ? 'Verificando...' : 'Verificar agora'}
                                    </button>
                                </div>

                                {/* Update Status Feedback */}
                                {updateStatus && (
                                    <div className={`p-3 rounded-xl text-xs ${
                                        updateStatus.status === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                                        updateStatus.status === 'downloaded' ? 'bg-green-500/10 border border-green-500/20 text-green-300' :
                                        updateStatus.status === 'available' || updateStatus.status === 'downloading' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' :
                                        'bg-neutral-800 text-neutral-400'
                                    }`}>
                                        {updateStatus.status === 'checking' && 'Verificando atualizações...'}
                                        {updateStatus.status === 'not-available' && '✓ Você está na versão mais recente!'}
                                        {updateStatus.status === 'available' && `Nova versão disponível: ${updateStatus.version}`}
                                        {updateStatus.status === 'downloading' && `Baixando... ${updateStatus.progress?.percent.toFixed(0)}%`}
                                        {updateStatus.status === 'downloaded' && (
                                            <div className="flex items-center justify-between">
                                                <span>Atualização pronta! Versão {updateStatus.version}</span>
                                                <button
                                                    onClick={handleInstallUpdate}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium"
                                                >
                                                    Reiniciar e atualizar
                                                </button>
                                            </div>
                                        )}
                                        {updateStatus.status === 'error' && `Erro: ${updateStatus.error}`}
                                    </div>
                                )}
                            </section>

                            {/* Info Section */}
                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <p className="text-xs text-purple-200/80">
                                    <strong>Nota:</strong> Esses recursos são processados localmente e não enviam dados adicionais para APIs.
                                    Os sistemas são completamente isolados e podem ser desativados a qualquer momento.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        )
    }

const ChatWindow: React.FC = () => {
    // Use shared hooks
    const {
        profile,
        setProfile,
        memories,
        addMemory,
        removeMemory,
        getProfileContext
    } = useUserProfile()

    const {
        apiKey, setApiKey,
        geminiKey, setGeminiKey,
        openRouterKey, setOpenRouterKey,
        modeloOpenRouter, setModeloOpenRouter,
        modeloLmStudio, setModeloLmStudio,
        baseUrlLmStudio, setBaseUrlLmStudio,
        provedorAtivo, setProvedorAtivo,
        systemPrompt,
        criarOuObterServico
    } = useAI()

    // Memory and cross-chat hooks
    const crossChat = useCrossChatContext()
    const memoryAutopilot = useMemoryAutopilot()

    // Conversations state
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        const saved = localStorage.getItem('selene_conversations')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return []
            }
        }
        return []
    })
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

    // UI state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [input, setInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Get current conversation's messages
    const activeConversation = conversations.find(c => c.id === activeConversationId)
    const messages = activeConversation?.messages ?? []

    // Persist conversations
    useEffect(() => {
        localStorage.setItem('selene_conversations', JSON.stringify(conversations))
    }, [conversations])

    // Hydration from main window
    useEffect(() => {
        const removeListener = window.electronAPI?.onHydrateChat?.((msgs: ChatMessage[]) => {
            console.log('[ChatWindow] Hydrating with', msgs.length, 'messages')
            if (msgs.length > 0) {
                const newConv: Conversation = {
                    id: uuidv4(),
                    title: msgs[0].content.slice(0, 30) + (msgs[0].content.length > 30 ? '...' : ''),
                    messages: msgs,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
                setConversations(prev => [newConv, ...prev])
                setActiveConversationId(newConv.id)
            }
        })
        return () => removeListener?.()
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Create new conversation
    const createNewConversation = useCallback(() => {
        const newConv: Conversation = {
            id: uuidv4(),
            title: 'Nova conversa',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        setConversations(prev => [newConv, ...prev])
        setActiveConversationId(newConv.id)
    }, [])

    // Update conversation messages
    const updateConversationMessages = useCallback((convId: string, newMessages: ChatMessage[]) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convId) {
                const title = newMessages[0]?.content.slice(0, 30) + (newMessages[0]?.content.length > 30 ? '...' : '') || 'Nova conversa'
                return { ...c, messages: newMessages, title, updatedAt: Date.now() }
            }
            return c
        }))
    }, [])

    // Delete conversation
    const deleteConversation = useCallback((convId: string) => {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (activeConversationId === convId) {
            setActiveConversationId(null)
        }
        // Also remove from embedding index (cross-chat memory)
        import('../services/crosschat/EmbeddingIndex').then(({ removeConversation }) => {
            const removed = removeConversation(convId)
            console.log(`[ChatWindow] Removed ${removed} messages from embedding index`)
        }).catch(err => console.warn('[ChatWindow] Failed to clean embedding index:', err))
    }, [activeConversationId])

    // Send message with streaming
    const handleSend = async () => {
        if (!input.trim() || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) {
            console.error('[ChatWindow] No AI service available')
            return
        }

        // Create conversation if none active
        let convId = activeConversationId
        if (!convId) {
            const newConv: Conversation = {
                id: uuidv4(),
                title: input.trim().slice(0, 30) + (input.trim().length > 30 ? '...' : ''),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            setConversations(prev => [newConv, ...prev])
            setActiveConversationId(newConv.id)
            convId = newConv.id
        }

        const userMsg: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        }

        // Create placeholder AI message for streaming
        const aiMsgId = uuidv4()
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }

        const currentMessages = [...messages, userMsg, aiMsg]
        updateConversationMessages(convId, currentMessages)
        setInput('')
        setIsGenerating(true)

        abortControllerRef.current = new AbortController()
        let streamedContent = ''

        try {
            // Compose prompt with all contexts using the pipeline
            const { systemPrompt: composedPrompt } = await composePrompt({
                systemPrompt,
                userProfileContext: getProfileContext(),
                currentConversationId: convId,
                currentUserMessage: userMsg.content
            })

            // Stream the response
            await servico.streamChat(
                userMsg.content,
                (chunk: string) => {
                    streamedContent += chunk
                    // Update the AI message in real-time
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === aiMsgId ? { ...m, content: streamedContent } : m
                                )
                            }
                        }
                        return c
                    }))
                },
                composedPrompt,
                messages
            )

            // Process message for memory systems (async, non-blocking)
            processUserMessageForMemory(
                userMsg.id,
                convId,
                userMsg.content,
                userMsg.timestamp
            ).catch(err => console.warn('[ChatWindow] Memory processing failed:', err))

        } catch (error: any) {
            if (error?.name === 'AbortError') {
                console.log('[ChatWindow] Generation stopped by user')
            } else {
                console.error('[ChatWindow] Chat error:', error)
                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: '⚠️ Erro ao processar mensagem. Verifique sua conexão ou chaves de API.',
                    timestamp: Date.now()
                }
                updateConversationMessages(convId, [...messages, userMsg, errorMsg])
            }
        } finally {
            setIsGenerating(false)
            abortControllerRef.current = null
        }
    }

    // Stop generation
    const stopGeneration = () => {
        abortControllerRef.current?.abort()
        setIsGenerating(false)
    }

    // Regenerate last response
    const regenerateLastResponse = async () => {
        if (!activeConversationId || messages.length < 2 || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) return

        // Remove last assistant message
        const lastUserMsgIndex = messages.map(m => m.role).lastIndexOf('user')
        if (lastUserMsgIndex === -1) return

        const messagesUpToUser = messages.slice(0, lastUserMsgIndex + 1)
        const userContent = messages[lastUserMsgIndex].content

        updateConversationMessages(activeConversationId, messagesUpToUser)
        setIsGenerating(true)

        try {
            // Compose prompt with all contexts using the pipeline
            const { systemPrompt: composedPrompt } = await composePrompt({
                systemPrompt,
                userProfileContext: getProfileContext(),
                currentConversationId: activeConversationId,
                currentUserMessage: userContent
            })

            const response = await servico.chat(userContent, composedPrompt, messagesUpToUser.slice(0, -1))
            const aiMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }
            updateConversationMessages(activeConversationId, [...messagesUpToUser, aiMsg])
        } catch (error) {
            console.error('[ChatWindow] Regenerate error:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    // Copy message
    const copyMessage = (msgId: string, content: string) => {
        navigator.clipboard.writeText(content)
        setCopiedMessageId(msgId)
        setTimeout(() => setCopiedMessageId(null), 2000)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex h-screen w-full bg-[#0a0a0c] text-neutral-100 font-sans overflow-hidden selection:bg-purple-500/30">
            {/* Sidebar */}
            <AnimatePresence initial={false}>
                <motion.aside
                    initial={false}
                    animate={{ width: sidebarCollapsed ? 64 : 280 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="flex-none flex flex-col border-r border-white/5 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
                >
                    {/* Sidebar Header */}
                    <div
                        className="h-14 flex items-center justify-between px-4 border-b border-white/5"
                        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                    >
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <img src="/tray-icon.png" alt="Selene Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="font-semibold text-sm">Selene</span>
                            </div>
                        )}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-3">
                        <button
                            onClick={createNewConversation}
                            className={`w-full flex items-center gap-2 p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                        >
                            <Plus size={18} />
                            {!sidebarCollapsed && <span className="text-sm font-medium">Nova conversa</span>}
                        </button>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                        {!sidebarCollapsed && (
                            <p className="px-3 text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
                                Conversas recentes
                            </p>
                        )}
                        {conversations.map(conv => (
                            <SidebarItem
                                key={conv.id}
                                icon={MessageSquare}
                                label={sidebarCollapsed ? '' : conv.title}
                                active={conv.id === activeConversationId}
                                onClick={() => setActiveConversationId(conv.id)}
                                onDelete={!sidebarCollapsed ? () => deleteConversation(conv.id) : undefined}
                            />
                        ))}
                    </div>

                    {/* Settings */}
                    <div className="p-3 border-t border-white/5">
                        <SidebarItem
                            icon={Settings}
                            label={sidebarCollapsed ? '' : 'Configurações'}
                            onClick={() => setShowSettings(true)}
                        />
                    </div>
                </motion.aside>
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative">
                {/* Settings Panel */}
                <AnimatePresence>
                    {showSettings && (
                        <SettingsPanel
                            profile={profile}
                            setProfile={setProfile}
                            memories={memories}
                            addMemory={addMemory}
                            removeMemory={removeMemory}
                            autoMemories={memoryAutopilot.memories.map(m => ({
                                id: m.id,
                                text: m.text,
                                category: m.category,
                                confidence: m.confidence,
                                createdAt: m.createdAt
                            }))}
                            removeAutoMemory={memoryAutopilot.removeMemory}
                            clearAutoMemories={memoryAutopilot.clearMemories}
                            apiKey={apiKey}
                            setApiKey={setApiKey}
                            geminiKey={geminiKey}
                            setGeminiKey={setGeminiKey}
                            openRouterKey={openRouterKey}
                            setOpenRouterKey={setOpenRouterKey}
                            modeloOpenRouter={modeloOpenRouter}
                            setModeloOpenRouter={setModeloOpenRouter}
                            modeloLmStudio={modeloLmStudio}
                            setModeloLmStudio={setModeloLmStudio}
                            baseUrlLmStudio={baseUrlLmStudio}
                            setBaseUrlLmStudio={setBaseUrlLmStudio}
                            provedorAtivo={provedorAtivo}
                            setProvedorAtivo={setProvedorAtivo}
                            crossChatEnabled={crossChat.enabled}
                            setCrossChatEnabled={crossChat.setEnabled}
                            memoryAutopilotEnabled={memoryAutopilot.enabled}
                            setMemoryAutopilotEnabled={memoryAutopilot.setEnabled}
                            onClose={() => setShowSettings(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Header */}
                <header
                    className="flex-none h-14 flex items-center justify-between px-5 bg-neutral-900/80 border-b border-white/5 backdrop-blur-xl"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    <div>
                        <h1 className="font-medium text-sm text-neutral-200">
                            {activeConversation?.title || 'Selene Chat'}
                        </h1>
                        <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            {profile.name ? `Olá, ${profile.name}` : 'Online'}
                        </p>
                    </div>

                    <div
                        className="flex items-center gap-1"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        <button
                            onClick={() => window.electronAPI?.minimizeWindow?.()}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            onClick={() => window.electronAPI?.toggleMaximizeWindow?.()}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Square size={14} />
                        </button>
                        <button
                            onClick={() => window.electronAPI?.closeWindow?.()}
                            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {/* Messages Area */}
                <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-[#0a0a0c] to-[#0d0d10] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 flex items-center justify-center">
                                <img src="/tray-icon.png" alt="Selene Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <p className="text-[30px] text-neutral-400 font-sans font-light tracking-wide">
                                    {profile.name ? `Olá, ${profile.name}! Como posso ajudar?` : 'Comece uma conversa com a Selene'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
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

                                <div className={`max-w-[70%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/30'
                                            : 'bg-neutral-800/60 border border-white/5 text-neutral-200 rounded-tl-sm'
                                            }`}
                                    >
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
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
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                                                        {children}
                                                    </a>
                                                ),
                                                blockquote: ({ children }) => (
                                                    <blockquote className="border-l-2 border-purple-500/50 pl-3 py-1 my-2 bg-purple-500/5 italic text-white/70 text-sm rounded-r">
                                                        {children}
                                                    </blockquote>
                                                ),
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Message Actions & Timestamp */}
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        <span className="text-[10px] text-neutral-600">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.role === 'assistant' && (
                                            <MessageActions
                                                onCopy={() => copyMessage(msg.id, msg.content)}
                                                onRegenerate={regenerateLastResponse}
                                                copied={copiedMessageId === msg.id}
                                                canRegenerate={index === messages.length - 1 && !isGenerating}
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
                        ))
                    )}

                    {/* Streaming Indicator */}
                    {isGenerating && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-start"
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mr-3">
                                <Sparkles size={14} className="text-purple-400" />
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-neutral-800/60 border border-white/5">
                                <StreamingIndicator />
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </main>

                {/* Input Area */}
                <footer className="flex-none p-4 bg-neutral-900/50 border-t border-white/5">
                    <div className="flex items-center gap-3 bg-neutral-800/50 rounded-2xl border border-white/10 px-4 py-2 focus-within:border-purple-500/50 transition-colors">
                        <textarea
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value)
                                // Auto-resize
                                e.target.style.height = 'auto'
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Envie uma mensagem..."
                            disabled={isGenerating}
                            rows={1}
                            className="flex-1 bg-transparent border-none outline-none text-neutral-200 placeholder-neutral-500 text-sm resize-none overflow-y-auto leading-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                            style={{ minHeight: '20px', maxHeight: '120px' }}
                        />
                        {isGenerating ? (
                            <button
                                onClick={stopGeneration}
                                className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                title="Parar geração"
                            >
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className={`p-2.5 rounded-xl transition-all duration-200 ${input.trim()
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
            </div>
        </div>
    )
}

export default ChatWindow
