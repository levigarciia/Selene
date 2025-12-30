/**
 * SettingsPanel Component
 * 
 * Unified settings panel used by both the floating modal (App.tsx)
 * and the ChatWindow inline settings.
 * 
 * This is the SINGLE SOURCE OF TRUTH for settings UI.
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    X, User, Briefcase, Heart, Brain, Trash2, KeyRound, Settings2,
    Zap, Link2, Download, RefreshCw, PenSquare, Camera, MousePointerClick, Mic
} from 'lucide-react'
import type { UserProfile, Memory } from '../../hooks/useUserProfile'
import type { UseVoiceInputReturn } from '../../hooks/useVoiceInput'
import { VoiceSettings } from './VoiceSettings'

// ============================================
// Types
// ============================================

export type SettingsTab = 'perfil' | 'memorias' | 'api' | 'modelos' | 'atalhos' | 'transcricao' | 'avancado'

export interface AutoMemory {
    id: string
    text: string
    category: string
    confidence: number
    createdAt: number
}

export interface SettingsPanelProps {
    // Profile
    profile: UserProfile
    setProfile: (profile: UserProfile) => void
    
    // Memories
    memories: Memory[]
    addMemory: (content: string) => void
    removeMemory: (id: string) => void
    
    // Auto-Memories (optional - ChatWindow has these)
    autoMemories?: AutoMemory[]
    removeAutoMemory?: (id: string) => void
    clearAutoMemories?: () => void
    
    // API Keys
    apiKey: string
    setApiKey: (v: string) => void
    geminiKey: string
    setGeminiKey: (v: string) => void
    openRouterKey: string
    setOpenRouterKey: (v: string) => void
    
    // Models
    modeloOpenRouter: string
    setModeloOpenRouter: (v: string) => void
    modeloLmStudio: string
    setModeloLmStudio: (v: string) => void
    baseUrlLmStudio: string
    setBaseUrlLmStudio: (v: string) => void
    
    // Provider
    provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
    setProvedorAtivo: (v: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
    
    // Shortcuts (optional - only in toolbar modal)
    atalhoGramatical?: string
    setAtalhoGramatical?: (v: string) => void
    atalhoScreenshot?: string
    setAtalhoScreenshot?: (v: string) => void
    
    // Advanced settings (optional)
    crossChatEnabled?: boolean
    setCrossChatEnabled?: (v: boolean) => void
    memoryAutopilotEnabled?: boolean
    setMemoryAutopilotEnabled?: (v: boolean) => void
    
    // Voice input
    voiceInput?: UseVoiceInputReturn
    
    // UI
    onClose: () => void
    
    // Variant: 'modal' shows as overlay, 'inline' shows as panel
    variant?: 'modal' | 'inline'
    
    // Which tabs to show (defaults to all applicable)
    visibleTabs?: SettingsTab[]
}

// ============================================
// Component
// ============================================

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    profile, setProfile,
    memories, addMemory, removeMemory,
    autoMemories, removeAutoMemory, clearAutoMemories,
    apiKey, setApiKey,
    geminiKey, setGeminiKey,
    openRouterKey, setOpenRouterKey,
    modeloOpenRouter, setModeloOpenRouter,
    modeloLmStudio, setModeloLmStudio,
    baseUrlLmStudio, setBaseUrlLmStudio,
    provedorAtivo, setProvedorAtivo,
    atalhoGramatical, setAtalhoGramatical,
    atalhoScreenshot, setAtalhoScreenshot,
    crossChatEnabled, setCrossChatEnabled,
    memoryAutopilotEnabled, setMemoryAutopilotEnabled,
    voiceInput,
    onClose,
    variant = 'inline',
    visibleTabs
}) => {
    // State
    const [newMemory, setNewMemory] = useState('')
    const [activeTab, setActiveTab] = useState<SettingsTab>('perfil')
    
    // Shortcut capture state
    const [capturingGrammar, setCapturingGrammar] = useState(false)
    const [capturingScreenshot, setCapturingScreenshot] = useState(false)
    const [previewGrammar, setPreviewGrammar] = useState(atalhoGramatical || '')
    const [previewScreenshot, setPreviewScreenshot] = useState(atalhoScreenshot || '')
    
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
    
    // Sync shortcut previews
    useEffect(() => {
        if (atalhoGramatical) setPreviewGrammar(atalhoGramatical)
    }, [atalhoGramatical])
    
    useEffect(() => {
        if (atalhoScreenshot) setPreviewScreenshot(atalhoScreenshot)
    }, [atalhoScreenshot])
    
    // Load auto-update status
    useEffect(() => {
        window.electronAPI?.getAutoUpdateStatus?.().then((status: { enabled: boolean; currentVersion: string }) => {
            setAutoUpdateEnabled(status.enabled)
        })
        window.electronAPI?.getAppVersion?.().then((version: string) => {
            setAppVersion(version)
        })
        
        const removeListener = window.electronAPI?.onUpdateStatus?.((status: any) => {
            setUpdateStatus(status)
            setIsCheckingUpdate(status.status === 'checking')
        })
        
        return () => removeListener?.()
    }, [])
    
    // Determine which tabs to show
    const allTabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
        { id: 'perfil', label: 'Perfil', icon: User },
        { id: 'memorias', label: 'Memórias', icon: Brain },
        { id: 'api', label: 'Chaves API', icon: KeyRound },
        { id: 'modelos', label: 'Modelos', icon: Settings2 },
        ...(atalhoGramatical !== undefined || atalhoScreenshot !== undefined 
            ? [{ id: 'atalhos' as SettingsTab, label: 'Atalhos', icon: PenSquare }] 
            : []),
        ...(voiceInput 
            ? [{ id: 'transcricao' as SettingsTab, label: 'Transcrição', icon: Mic }] 
            : []),
        ...(crossChatEnabled !== undefined || memoryAutopilotEnabled !== undefined 
            ? [{ id: 'avancado' as SettingsTab, label: 'Avançado', icon: Zap }] 
            : []),
    ]
    
    const tabs = visibleTabs 
        ? allTabs.filter(t => visibleTabs.includes(t.id))
        : allTabs
    
    // Shortcut handling
    const formatShortcut = (keys: string[]) => keys.filter(Boolean).join('+')
    
    const buildShortcut = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (e.key === 'Escape') return ''
        
        const keys: string[] = []
        if (e.ctrlKey) keys.push('Ctrl')
        if (e.metaKey) keys.push('Meta')
        if (e.altKey) keys.push('Alt')
        if (e.shiftKey) keys.push('Shift')
        
        const special = ['Control', 'Meta', 'Alt', 'Shift']
        const isBase = !special.includes(e.key)
        if (isBase) {
            keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
        }
        
        if (!isBase) return ''
        return formatShortcut(keys.slice(0, 4))
    }
    
    const handleShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'grammar' | 'screenshot') => {
        const shortcut = buildShortcut(e)
        if (type === 'grammar') {
            setPreviewGrammar(shortcut)
            setAtalhoGramatical?.(shortcut)
        } else {
            setPreviewScreenshot(shortcut)
            setAtalhoScreenshot?.(shortcut)
        }
    }
    
    // Auto-update handlers
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
    
    // Container classes based on variant
    const containerClass = variant === 'modal'
        ? 'bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden'
        : 'absolute inset-0 bg-[#0a0a0c] z-20 flex flex-col'
    
    return (
        <motion.div
            initial={{ opacity: 0, x: variant === 'inline' ? 20 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: variant === 'inline' ? 20 : 0 }}
            className={`${containerClass} pointer-events-auto`}
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
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.id
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
                
                {/* Profile Tab */}
                {activeTab === 'perfil' && (
                    <>
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
                                placeholder="Ex: Gosto de respostas diretas e objetivas. Prefiro exemplos práticos..."
                                rows={4}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-rose-500/50 transition-colors resize-none"
                            />
                        </section>
                    </>
                )}
                
                {/* Memories Tab */}
                {activeTab === 'memorias' && (
                    <div className="space-y-4">
                        {/* Manual Memories */}
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
                        
                        {/* Auto Memories (if available) */}
                        {autoMemories !== undefined && (
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
                                    {autoMemories.length > 0 && clearAutoMemories && (
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
                                                {removeAutoMemory && (
                                                    <button
                                                        onClick={() => removeAutoMemory(memory.id)}
                                                        className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                )}
                
                {/* API Keys Tab */}
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
                                    className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                                        provedorAtivo === prov.id
                                            ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                            : 'bg-neutral-900/50 border-white/10 text-neutral-400 hover:bg-white/5'
                                    }`}
                                >
                                    {prov.label}
                                </button>
                            ))}
                        </div>
                        
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
                
                {/* Models Tab */}
                {activeTab === 'modelos' && (
                    <div className="space-y-4">
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
                
                {/* Shortcuts Tab */}
                {activeTab === 'atalhos' && atalhoGramatical !== undefined && (
                    <div className="space-y-4">
                        {[{
                            title: 'Atalho do assistente gramatical',
                            description: 'Clique no campo e pressione até 4 teclas; aplicado imediatamente.',
                            icon: <PenSquare size={16} className="text-emerald-300" />,
                            value: previewGrammar,
                            capturing: capturingGrammar,
                            onFocus: () => setCapturingGrammar(true),
                            onBlur: () => setCapturingGrammar(false),
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleShortcutKeyDown(e, 'grammar'),
                            placeholder: 'Ctrl+Alt+X'
                        }, {
                            title: 'Atalho de screenshot (pergunta com imagem)',
                            description: 'Clique no campo e pressione até 4 teclas.',
                            icon: <Camera size={16} className="text-emerald-300" />,
                            value: previewScreenshot,
                            capturing: capturingScreenshot,
                            onFocus: () => setCapturingScreenshot(true),
                            onBlur: () => setCapturingScreenshot(false),
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleShortcutKeyDown(e, 'screenshot'),
                            placeholder: 'Ctrl+Alt+S'
                        }].map((shortcut, idx) => (
                            <section key={idx} className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {shortcut.icon}
                                            <p className="text-sm font-semibold text-white">{shortcut.title}</p>
                                        </div>
                                        <p className="text-xs text-neutral-500">{shortcut.description}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                                        <MousePointerClick size={14} /> Clique e pressione
                                    </div>
                                </div>
                                <div className="text-xs text-neutral-600">
                                    Atalho atual:{' '}
                                    <span className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-neutral-300">
                                        {shortcut.value || 'não configurado'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        value={shortcut.value}
                                        onFocus={shortcut.onFocus}
                                        onBlur={shortcut.onBlur}
                                        onKeyDown={shortcut.onKeyDown}
                                        readOnly
                                        className={`w-full bg-neutral-900/50 border rounded-xl px-3 py-2 text-sm text-white outline-none ${
                                            shortcut.capturing ? 'border-emerald-400' : 'border-white/10 focus:border-purple-400'
                                        }`}
                                        placeholder={shortcut.placeholder}
                                    />
                                    <div className={`px-3 py-2 rounded-xl text-xs ${
                                        shortcut.capturing 
                                            ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-100' 
                                            : 'bg-white/5 border border-white/10 text-neutral-600'
                                    }`}>
                                        {shortcut.capturing ? 'Capturando…' : 'Pronto'}
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-600">Escape limpa, máximo de 4 teclas combinadas.</p>
                            </section>
                        ))}
                    </div>
                )}
                
                {/* Transcription Tab */}
                {activeTab === 'transcricao' && voiceInput && (
                    <VoiceSettings
                        provider={voiceInput.provider}
                        onProviderChange={voiceInput.setProvider}
                        whisperModel={voiceInput.whisperConfig.modelSize}
                        onModelChange={voiceInput.setWhisperModel}
                        whisperBinaryPath={voiceInput.whisperBinaryPath}
                        onBinaryPathChange={voiceInput.setWhisperBinaryPath}
                        isWhisperReady={voiceInput.isWhisperReady}
                        onInitialize={voiceInput.initializeWhisper}
                        isRecording={voiceInput.isRecording}
                        error={voiceInput.error}
                        microfoneId={voiceInput.microfoneId}
                        onMicrofoneChange={voiceInput.setMicrofoneId}
                    />
                )}
                
                {/* Advanced Tab */}
                {activeTab === 'avancado' && (crossChatEnabled !== undefined || memoryAutopilotEnabled !== undefined) && (
                    <div className="space-y-4">
                        {/* Cross-Chat Context */}
                        {setCrossChatEnabled && (
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-blue-500/20">
                                            <Link2 size={18} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Contexto entre Conversas</h3>
                                            <p className="text-xs text-neutral-500">Recupera trechos relevantes de conversas anteriores.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCrossChatEnabled(!crossChatEnabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${crossChatEnabled ? 'bg-blue-500' : 'bg-neutral-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${crossChatEnabled ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-600">
                                    Quando ativado, a Selene busca automaticamente contexto de conversas passadas para enriquecer suas respostas.
                                </p>
                                <button
                                    onClick={() => {
                                        if (window.confirm('Isso apagará todo o histórico de contexto entre conversas. Continuar?')) {
                                            import('../../services/crosschat/EmbeddingIndex').then(({ clearIndex }) => {
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
                        )}
                        
                        {/* Memory Autopilot */}
                        {setMemoryAutopilotEnabled && (
                            <section className="bg-neutral-800/30 border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-amber-500/20">
                                            <Zap size={18} className="text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-200">Memória Automática</h3>
                                            <p className="text-xs text-neutral-500">Extrai e salva automaticamente memórias importantes.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setMemoryAutopilotEnabled(!memoryAutopilotEnabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${memoryAutopilotEnabled ? 'bg-amber-500' : 'bg-neutral-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${memoryAutopilotEnabled ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-600">
                                    Quando ativado, a Selene detecta e salva automaticamente preferências, contexto de projetos
                                    e informações relevantes.
                                </p>
                                <p className="text-xs text-amber-400/70">
                                    ⚠️ Requer mensagens longas (+80 caracteres) e confiança alta para extrair memórias.
                                </p>
                            </section>
                        )}
                        
                        {/* Auto-Update */}
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
                                    className={`relative w-12 h-6 rounded-full transition-colors ${autoUpdateEnabled ? 'bg-green-500' : 'bg-neutral-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoUpdateEnabled ? 'translate-x-6' : ''}`} />
                                </button>
                            </div>
                            <p className="text-xs text-neutral-600">
                                Quando ativado, a Selene verifica por atualizações no boot e periodicamente.
                            </p>
                            
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
                        
                        {/* Info Note */}
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <p className="text-xs text-purple-200/80">
                                <strong>Nota:</strong> Esses recursos são processados localmente e não enviam dados adicionais para APIs.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

export default SettingsPanel
