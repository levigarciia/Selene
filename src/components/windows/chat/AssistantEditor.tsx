/**
 * AssistantEditor Component
 *
 * Editor completo para criar e modificar assistentes.
 * Agora funciona como painel embutido na shell nova do chat.
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    X, Save, Sparkles, Wand2, Check,
    Brain, Image, Mic, MessageSquare,
    Zap
} from 'lucide-react'
import type {
    AssistenteConfig as AssistantConfig,
    AssistantPermission,
    AssistantBehavior,
    AssistantTone,
    AssistantInteractionFlow
} from '../../../utils/assistentesPadrao'
import {
    DEFAULT_PERMISSIONS,
    DEFAULT_BEHAVIORS,
    DEFAULT_TONE,
    DEFAULT_INTERACTION_FLOW,
    normalizarAssistente
} from '../../../utils/assistentesPadrao'

interface AssistantEditorProps {
    isOpen: boolean
    onClose: () => void
    assistant: AssistantConfig | null
    onSave: (assistant: AssistantConfig) => void
}

const PERMISSION_INFO: Record<AssistantPermission, { label: string; icon: React.ElementType; desc: string }> = {
    memory_read: { label: 'Ler Memórias', icon: Brain, desc: 'Acessa memórias do usuário' },
    memory_write: { label: 'Criar Memórias', icon: Brain, desc: 'Pode salvar novas memórias' },
    cross_chat: { label: 'Contexto Cruzado', icon: MessageSquare, desc: 'Busca em conversas anteriores' },
    image_analysis: { label: 'Analisar Imagens', icon: Image, desc: 'Processa screenshots e imagens' },
    voice_input: { label: 'Entrada de Voz', icon: Mic, desc: 'Recebe comandos por áudio' }
}

const BEHAVIOR_INFO: Record<AssistantBehavior, { label: string; desc: string }> = {
    concise: { label: 'Conciso', desc: 'Respostas curtas e diretas' },
    detailed: { label: 'Detalhado', desc: 'Explicações completas' },
    conversational: { label: 'Conversacional', desc: 'Tom natural e amigável' },
    professional: { label: 'Profissional', desc: 'Linguagem formal' },
    educational: { label: 'Educativo', desc: 'Modo professor com exemplos' },
    creative: { label: 'Criativo', desc: 'Imaginativo e ousado' }
}

const TONE_INFO: Record<AssistantTone, string> = {
    neutral: 'Neutro',
    friendly: 'Amigável',
    formal: 'Formal',
    casual: 'Casual',
    empathetic: 'Empático',
    assertive: 'Assertivo',
    professional: 'Profissional'
}

const COLOR_PRESETS = [
    '#8b5cf6',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#ef4444',
    '#06b6d4',
    '#84cc16'
]

const ICON_PRESETS = ['✨', '🌙', '💻', '📚', '✍️', '🎨', '🔬', '💡', '🎯', '🚀', '⚡', '🧠']

interface EstadoInicialEditorAssistente {
    nome: string
    descricao: string
    prompt: string
    permissions: AssistantPermission[]
    behaviors: AssistantBehavior[]
    tone: AssistantTone
    interactionFlow: AssistantInteractionFlow
    icon: string
    color: string
}

const criarEstadoInicial = (assistant: AssistantConfig | null): EstadoInicialEditorAssistente => {
    if (assistant) {
        return {
            nome: assistant.nome,
            descricao: assistant.descricao,
            prompt: assistant.prompt,
            permissions: assistant.permissions || [...DEFAULT_PERMISSIONS],
            behaviors: assistant.behaviors || [...DEFAULT_BEHAVIORS],
            tone: assistant.tone || DEFAULT_TONE,
            interactionFlow: assistant.interactionFlow || { ...DEFAULT_INTERACTION_FLOW },
            icon: assistant.icon || '✨',
            color: assistant.color || '#8b5cf6'
        }
    }

    return {
        nome: '',
        descricao: '',
        prompt: '',
        permissions: [...DEFAULT_PERMISSIONS],
        behaviors: [...DEFAULT_BEHAVIORS],
        tone: DEFAULT_TONE,
        interactionFlow: { ...DEFAULT_INTERACTION_FLOW },
        icon: '✨',
        color: '#8b5cf6'
    }
}

export const AssistantEditor: React.FC<AssistantEditorProps> = ({
    isOpen,
    onClose,
    assistant,
    onSave
}) => {
    const isEditing = assistant !== null
    const estadoInicial = criarEstadoInicial(assistant)
    const [nome, setNome] = useState(estadoInicial.nome)
    const [descricao, setDescricao] = useState(estadoInicial.descricao)
    const [prompt, setPrompt] = useState(estadoInicial.prompt)
    const [permissions, setPermissions] = useState<AssistantPermission[]>(estadoInicial.permissions)
    const [behaviors, setBehaviors] = useState<AssistantBehavior[]>(estadoInicial.behaviors)
    const [tone, setTone] = useState<AssistantTone>(estadoInicial.tone)
    const [interactionFlow, setInteractionFlow] = useState<AssistantInteractionFlow>(estadoInicial.interactionFlow)
    const [icon, setIcon] = useState(estadoInicial.icon)
    const [color, setColor] = useState(estadoInicial.color)
    const [activeTab, setActiveTab] = useState<'basic' | 'behavior' | 'advanced'>('basic')

    const togglePermission = (perm: AssistantPermission) => {
        setPermissions((prev) =>
            prev.includes(perm)
                ? prev.filter((item) => item !== perm)
                : [...prev, perm]
        )
    }

    const toggleBehavior = (behavior: AssistantBehavior) => {
        setBehaviors((prev) =>
            prev.includes(behavior)
                ? prev.filter((item) => item !== behavior)
                : [...prev, behavior]
        )
    }

    const handleSave = () => {
        if (!nome.trim() || !prompt.trim()) return

        const config: AssistantConfig = normalizarAssistente({
            id: assistant?.id || `custom-${Date.now()}`,
            nome: nome.trim(),
            descricao: descricao.trim(),
            prompt: prompt.trim(),
            origem: assistant?.origem || 'personalizado',
            permissions,
            behaviors,
            tone,
            interactionFlow,
            icon,
            color,
            createdAt: assistant?.createdAt,
            usageCount: assistant?.usageCount
        })

        onSave(config)
        onClose()
    }

    if (!isOpen) return null

    const tabs = [
        { id: 'basic', label: 'Básico', icon: Wand2 },
        { id: 'behavior', label: 'Comportamento', icon: Sparkles },
        { id: 'advanced', label: 'Avançado', icon: Zap }
    ] as const

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 z-20 flex flex-col bg-[#0a0a0c] pointer-events-auto"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            {isEditing ? 'Editar Assistente' : 'Novo Assistente'}
                        </h2>
                        <p className="text-xs text-neutral-500">
                            {isEditing ? 'Ajuste comportamento, permissões e estilo.' : 'Crie um assistente personalizado para a shell nova.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex gap-1 border-b border-white/5 px-6 py-3">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'border border-purple-500/30 bg-purple-500/20 text-purple-200'
                                : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                {activeTab === 'basic' && (
                    <>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-neutral-500">Nome</label>
                                <input
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50"
                                    placeholder="Ex: Assistente de Código"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-neutral-500">Descrição</label>
                                <input
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50"
                                    placeholder="Breve descrição do assistente"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-neutral-500">Ícone</label>
                                <div className="flex flex-wrap gap-2">
                                    {ICON_PRESETS.map((item) => (
                                        <button
                                            key={item}
                                            onClick={() => setIcon(item)}
                                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all ${
                                                icon === item
                                                    ? 'border-2 border-purple-500/50 bg-purple-500/20'
                                                    : 'border border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-neutral-500">Cor</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLOR_PRESETS.map((item) => (
                                        <button
                                            key={item}
                                            onClick={() => setColor(item)}
                                            className={`h-10 w-10 rounded-xl transition-all ${
                                                color === item ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''
                                            }`}
                                            style={{ backgroundColor: item }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase text-neutral-500">System Prompt</label>
                                <span className="text-xs text-neutral-600">{prompt.length} caracteres</span>
                            </div>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={10}
                                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50"
                                placeholder="Descreva como o assistente deve se comportar..."
                            />
                        </div>
                    </>
                )}

                {activeTab === 'behavior' && (
                    <>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase text-neutral-500">Comportamentos</label>
                            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                {(Object.entries(BEHAVIOR_INFO) as [AssistantBehavior, typeof BEHAVIOR_INFO[AssistantBehavior]][]).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleBehavior(key)}
                                        className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                            behaviors.includes(key)
                                                ? 'border-purple-500/30 bg-purple-500/15'
                                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                            behaviors.includes(key) ? 'border-purple-500 bg-purple-500' : 'border-white/30'
                                        }`}>
                                            {behaviors.includes(key) && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-neutral-200">{info.label}</p>
                                            <p className="text-xs text-neutral-500">{info.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase text-neutral-500">Tom</label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.entries(TONE_INFO) as [AssistantTone, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setTone(key)}
                                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                                            tone === key
                                                ? 'border border-purple-500/30 bg-purple-500/20 text-purple-200'
                                                : 'border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase text-neutral-500">Fluxo de Interação</label>
                            <div className="space-y-2">
                                {[
                                    { key: 'clarifyFirst', label: 'Esclarecer antes de responder', desc: 'Faz perguntas quando necessário' },
                                    { key: 'stepByStep', label: 'Respostas passo a passo', desc: 'Organiza em etapas numeradas' },
                                    { key: 'includeExamples', label: 'Incluir exemplos', desc: 'Adiciona exemplos práticos' },
                                    { key: 'summarize', label: 'Resumir no final', desc: 'Termina com síntese' }
                                ].map((item) => {
                                    const ativo = interactionFlow[item.key as keyof AssistantInteractionFlow]

                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => setInteractionFlow((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof AssistantInteractionFlow] }))}
                                            className={`flex w-full items-center gap-3 rounded-xl border p-3 transition-all ${
                                                ativo
                                                    ? 'border-purple-500/30 bg-purple-500/15'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                                ativo ? 'border-purple-500 bg-purple-500' : 'border-white/30'
                                            }`}>
                                                {ativo && <Check size={12} className="text-white" />}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-neutral-200">{item.label}</p>
                                                <p className="text-xs text-neutral-500">{item.desc}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'advanced' && (
                    <>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase text-neutral-500">Permissões</label>
                            <div className="space-y-2">
                                {(Object.entries(PERMISSION_INFO) as [AssistantPermission, typeof PERMISSION_INFO[AssistantPermission]][]).map(([key, info]) => {
                                    const ativo = permissions.includes(key)

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => togglePermission(key)}
                                            className={`flex w-full items-center gap-3 rounded-xl border p-3 transition-all ${
                                                ativo
                                                    ? 'border-purple-500/30 bg-purple-500/15'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                                ativo ? 'bg-purple-500/20' : 'bg-white/10'
                                            }`}>
                                                <info.icon size={16} className={ativo ? 'text-purple-400' : 'text-neutral-400'} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="text-sm font-medium text-neutral-200">{info.label}</p>
                                                <p className="text-xs text-neutral-500">{info.desc}</p>
                                            </div>
                                            <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                                ativo ? 'border-purple-500 bg-purple-500' : 'border-white/30'
                                            }`}>
                                                {ativo && <Check size={12} className="text-white" />}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-neutral-500">
                                Limite de Palavras (0 = ilimitado)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="5000"
                                step="50"
                                value={interactionFlow.maxResponseLength}
                                onChange={(e) => setInteractionFlow((prev) => ({ ...prev, maxResponseLength: parseInt(e.target.value, 10) || 0 }))}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50"
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
                <p className="text-xs text-neutral-500">
                    {assistant?.origem === 'padrao' ? 'Assistente padrão editável' : 'Assistente personalizado'}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!nome.trim() || !prompt.trim()}
                        className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500"
                    >
                        <Save size={16} />
                        {isEditing ? 'Salvar' : 'Criar'}
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

export default AssistantEditor
