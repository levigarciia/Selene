/**
 * AssistantEditor Component
 * 
 * Full-featured editor for creating and modifying AI assistants
 * with permissions, behaviors, and interaction flows.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    assistant: AssistantConfig | null // null = creating new
    onSave: (assistant: AssistantConfig) => void
}

// Permission metadata
const PERMISSION_INFO: Record<AssistantPermission, { label: string; icon: React.ElementType; desc: string }> = {
    memory_read: { label: 'Ler Memórias', icon: Brain, desc: 'Acessa memórias do usuário' },
    memory_write: { label: 'Criar Memórias', icon: Brain, desc: 'Pode salvar novas memórias' },
    cross_chat: { label: 'Contexto Cruzado', icon: MessageSquare, desc: 'Busca em conversas anteriores' },
    image_analysis: { label: 'Analisar Imagens', icon: Image, desc: 'Processa screenshots e imagens' },
    voice_input: { label: 'Entrada de Voz', icon: Mic, desc: 'Recebe comandos por áudio' }
}

// Behavior metadata
const BEHAVIOR_INFO: Record<AssistantBehavior, { label: string; desc: string }> = {
    concise: { label: 'Conciso', desc: 'Respostas curtas e diretas' },
    detailed: { label: 'Detalhado', desc: 'Explicações completas' },
    conversational: { label: 'Conversacional', desc: 'Tom natural e amigável' },
    professional: { label: 'Profissional', desc: 'Linguagem formal' },
    educational: { label: 'Educativo', desc: 'Modo professor com exemplos' },
    creative: { label: 'Criativo', desc: 'Imaginativo e ousado' }
}

// Tone metadata
const TONE_INFO: Record<AssistantTone, string> = {
    neutral: 'Neutro',
    friendly: 'Amigável',
    formal: 'Formal',
    casual: 'Casual',
    empathetic: 'Empático',
    assertive: 'Assertivo',
    professional: 'Profissional'
}

// Color presets
const COLOR_PRESETS = [
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#84cc16'  // Lime
]

// Icon presets
const ICON_PRESETS = ['✨', '🌙', '💻', '📚', '✍️', '🎨', '🔬', '💡', '🎯', '🚀', '⚡', '🧠']

export const AssistantEditor: React.FC<AssistantEditorProps> = ({
    isOpen,
    onClose,
    assistant,
    onSave
}) => {
    const isEditing = assistant !== null
    
    // Form state
    const [nome, setNome] = useState('')
    const [descricao, setDescricao] = useState('')
    const [prompt, setPrompt] = useState('')
    const [permissions, setPermissions] = useState<AssistantPermission[]>([])
    const [behaviors, setBehaviors] = useState<AssistantBehavior[]>([])
    const [tone, setTone] = useState<AssistantTone>('friendly')
    const [interactionFlow, setInteractionFlow] = useState<AssistantInteractionFlow>({ ...DEFAULT_INTERACTION_FLOW })
    const [icon, setIcon] = useState('✨')
    const [color, setColor] = useState('#8b5cf6')
    
    const [activeTab, setActiveTab] = useState<'basic' | 'behavior' | 'advanced'>('basic')
    
    // Initialize form when assistant changes
    useEffect(() => {
        if (assistant) {
            setNome(assistant.nome)
            setDescricao(assistant.descricao)
            setPrompt(assistant.prompt)
            setPermissions(assistant.permissions || [...DEFAULT_PERMISSIONS])
            setBehaviors(assistant.behaviors || [...DEFAULT_BEHAVIORS])
            setTone(assistant.tone || DEFAULT_TONE)
            setInteractionFlow(assistant.interactionFlow || { ...DEFAULT_INTERACTION_FLOW })
            setIcon(assistant.icon || '✨')
            setColor(assistant.color || '#8b5cf6')
        } else {
            // Reset for new assistant
            setNome('')
            setDescricao('')
            setPrompt('')
            setPermissions([...DEFAULT_PERMISSIONS])
            setBehaviors([...DEFAULT_BEHAVIORS])
            setTone(DEFAULT_TONE)
            setInteractionFlow({ ...DEFAULT_INTERACTION_FLOW })
            setIcon('✨')
            setColor('#8b5cf6')
        }
        setActiveTab('basic')
    }, [assistant, isOpen])
    
    const togglePermission = (perm: AssistantPermission) => {
        setPermissions(prev => 
            prev.includes(perm) 
                ? prev.filter(p => p !== perm)
                : [...prev, perm]
        )
    }
    
    const toggleBehavior = (behavior: AssistantBehavior) => {
        setBehaviors(prev => 
            prev.includes(behavior) 
                ? prev.filter(b => b !== behavior)
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
    
    const tabs = [
        { id: 'basic', label: 'Básico', icon: Wand2 },
        { id: 'behavior', label: 'Comportamento', icon: Sparkles },
        { id: 'advanced', label: 'Avançado', icon: Zap }
    ] as const
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="w-full max-w-3xl bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-10 h-10 flex items-center justify-center rounded-xl text-xl"
                                    style={{ backgroundColor: `${color}20` }}
                                >
                                    {icon}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        {isEditing ? 'Editar Assistente' : 'Novo Assistente'}
                                    </h2>
                                    <p className="text-xs text-neutral-500">
                                        {isEditing ? 'Modifique as configurações' : 'Configure seu assistente personalizado'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-400 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex gap-1 px-6 py-3 border-b border-white/5">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
                            {activeTab === 'basic' && (
                                <>
                                    {/* Name & Description */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-neutral-500">Nome</label>
                                            <input
                                                value={nome}
                                                onChange={(e) => setNome(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50"
                                                placeholder="Ex: Assistente de Código"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-neutral-500">Descrição</label>
                                            <input
                                                value={descricao}
                                                onChange={(e) => setDescricao(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50"
                                                placeholder="Breve descrição do assistente"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Icon & Color */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-neutral-500">Ícone</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {ICON_PRESETS.map(i => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setIcon(i)}
                                                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-lg transition-all ${
                                                            icon === i 
                                                                ? 'bg-purple-500/20 border-2 border-purple-500/50' 
                                                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {i}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-neutral-500">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {COLOR_PRESETS.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setColor(c)}
                                                        className={`w-10 h-10 rounded-xl transition-all ${
                                                            color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''
                                                        }`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* System Prompt */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold uppercase text-neutral-500">System Prompt</label>
                                            <span className="text-xs text-neutral-600">{prompt.length} caracteres</span>
                                        </div>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            rows={8}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50 resize-none"
                                            placeholder="Descreva como o assistente deve se comportar..."
                                        />
                                    </div>
                                </>
                            )}
                            
                            {activeTab === 'behavior' && (
                                <>
                                    {/* Behaviors */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold uppercase text-neutral-500">Comportamentos</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(Object.entries(BEHAVIOR_INFO) as [AssistantBehavior, typeof BEHAVIOR_INFO[AssistantBehavior]][]).map(([key, info]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => toggleBehavior(key)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                                        behaviors.includes(key)
                                                            ? 'bg-purple-500/15 border-purple-500/30'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                                        behaviors.includes(key) 
                                                            ? 'bg-purple-500 border-purple-500' 
                                                            : 'border-white/30'
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
                                    
                                    {/* Tone */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold uppercase text-neutral-500">Tom</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {(Object.entries(TONE_INFO) as [AssistantTone, string][]).map(([key, label]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setTone(key)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                                        tone === key
                                                            ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                                            : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Interaction Flow */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold uppercase text-neutral-500">Fluxo de Interação</label>
                                        <div className="space-y-2">
                                            {[
                                                { key: 'clarifyFirst', label: 'Esclarecer antes de responder', desc: 'Faz perguntas quando necessário' },
                                                { key: 'stepByStep', label: 'Respostas passo a passo', desc: 'Organiza em etapas numeradas' },
                                                { key: 'includeExamples', label: 'Incluir exemplos', desc: 'Adiciona exemplos práticos' },
                                                { key: 'summarize', label: 'Resumir no final', desc: 'Termina com síntese' }
                                            ].map(item => (
                                                <button
                                                    key={item.key}
                                                    onClick={() => setInteractionFlow(prev => ({ ...prev, [item.key]: !prev[item.key as keyof AssistantInteractionFlow] }))}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                                        interactionFlow[item.key as keyof AssistantInteractionFlow]
                                                            ? 'bg-purple-500/15 border-purple-500/30'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                                        interactionFlow[item.key as keyof AssistantInteractionFlow]
                                                            ? 'bg-purple-500 border-purple-500' 
                                                            : 'border-white/30'
                                                    }`}>
                                                        {interactionFlow[item.key as keyof AssistantInteractionFlow] && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-medium text-neutral-200">{item.label}</p>
                                                        <p className="text-xs text-neutral-500">{item.desc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {activeTab === 'advanced' && (
                                <>
                                    {/* Permissions */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold uppercase text-neutral-500">Permissões</label>
                                        <div className="space-y-2">
                                            {(Object.entries(PERMISSION_INFO) as [AssistantPermission, typeof PERMISSION_INFO[AssistantPermission]][]).map(([key, info]) => {
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => togglePermission(key)}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                                            permissions.includes(key)
                                                                ? 'bg-purple-500/15 border-purple-500/30'
                                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                            permissions.includes(key) 
                                                                ? 'bg-purple-500/20' 
                                                                : 'bg-white/10'
                                                        }`}>
                                                            <info.icon size={16} className={permissions.includes(key) ? 'text-purple-400' : 'text-neutral-400'} />
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-sm font-medium text-neutral-200">{info.label}</p>
                                                            <p className="text-xs text-neutral-500">{info.desc}</p>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                                            permissions.includes(key) 
                                                                ? 'bg-purple-500 border-purple-500' 
                                                                : 'border-white/30'
                                                        }`}>
                                                            {permissions.includes(key) && <Check size={12} className="text-white" />}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    
                                    {/* Max Response Length */}
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
                                            onChange={(e) => setInteractionFlow(prev => ({ ...prev, maxResponseLength: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                            <p className="text-xs text-neutral-500">
                                {assistant?.origem === 'padrao' ? 'Assistente padrão (editável)' : 'Assistente personalizado'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-neutral-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!nome.trim() || !prompt.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Save size={16} />
                                    {isEditing ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default AssistantEditor
