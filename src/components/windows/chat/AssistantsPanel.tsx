/**
 * AssistantsPanel Component
 * 
 * Full-screen panel for managing AI assistants
 * Replaces the dropdown selector with a more comprehensive interface
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    X,
    Plus,
    Settings,
    Trash2,
    Copy,
    RotateCcw,
    Check,
    Search,
    Sparkles
} from 'lucide-react'
import type { AssistenteConfig as AssistantConfig } from '../../../utils/assistentesPadrao'
import type { UseAssistantsReturn } from '../../../hooks/useAssistants'

interface AssistantsPanelProps {
    assistants: UseAssistantsReturn
    onOpenEditor: (assistant: AssistantConfig | null) => void
    onClose: () => void
}

export const AssistantsPanel: React.FC<AssistantsPanelProps> = ({
    assistants,
    onOpenEditor,
    onClose
}) => {
    const [searchQuery, setSearchQuery] = useState('')
    
    const {
        assistants: assistantList,
        activeAssistant,
        useDefaultPrompt,
        selectAssistant,
        toggleDefaultPrompt,
        removeAssistant,
        duplicateAssistant,
        restoreDefaults
    } = assistants
    
    // Filter assistants by search
    const filteredAssistants = assistantList.filter(a =>
        a.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.descricao.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    // Group assistants by origin
    const defaultAssistants = filteredAssistants.filter(a => a.origem === 'padrao')
    const customAssistants = filteredAssistants.filter(a => a.origem === 'personalizado')
    
    const handleSelect = (id: string | null) => {
        if (id === null) {
            selectAssistant(null)
            toggleDefaultPrompt()
        } else {
            selectAssistant(id)
        }
    }
    
    const handleDuplicate = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        duplicateAssistant(id)
    }
    
    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (window.confirm('Remover este assistente?')) {
            removeAssistant(id)
        }
    }
    
    const handleEdit = (e: React.MouseEvent, assistant: AssistantConfig) => {
        e.stopPropagation()
        onOpenEditor(assistant)
        onClose()
    }
    
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
                    <div className="p-2 rounded-xl bg-purple-500/20">
                        <Sparkles size={18} className="text-purple-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-neutral-100">Assistentes</h2>
                        <p className="text-[10px] text-neutral-500">Gerencie seus assistentes de IA</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Search & Actions */}
            <div className="flex-none px-5 py-3 border-b border-white/5 flex gap-3">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar assistente..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-purple-500/50 transition-colors"
                    />
                </div>
                <button
                    onClick={() => onOpenEditor(null)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium text-white transition-colors"
                >
                    <Plus size={16} />
                    Criar Novo
                </button>
                <button
                    onClick={restoreDefaults}
                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors"
                    title="Restaurar padrões"
                >
                    <RotateCcw size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                {/* Default Selene Option */}
                <section>
                    <p className="text-[10px] font-semibold uppercase text-neutral-500 tracking-wider mb-3 px-1">
                        Sistema Padrão
                    </p>
                    <button
                        onClick={() => handleSelect(null)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                            useDefaultPrompt 
                                ? 'bg-purple-500/15 border-2 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
                                : 'bg-white/5 border-2 border-transparent hover:bg-white/10 hover:border-white/10'
                        }`}
                    >
                        <span className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-600/30 text-2xl">
                            🌙
                        </span>
                        <div className="flex-1 text-left">
                            <p className="text-base font-semibold text-neutral-100">Selene (Padrão)</p>
                            <p className="text-sm text-neutral-500 mt-0.5">
                                Assistente inteligente sem modificações de comportamento
                            </p>
                        </div>
                        {useDefaultPrompt && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded-lg">Ativo</span>
                                <Check size={20} className="text-purple-400" />
                            </div>
                        )}
                    </button>
                </section>
                
                {/* Default Assistants */}
                {defaultAssistants.length > 0 && (
                    <section>
                        <p className="text-[10px] font-semibold uppercase text-neutral-500 tracking-wider mb-3 px-1">
                            Assistentes Padrão ({defaultAssistants.length})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {defaultAssistants.map((assistant) => (
                                <AssistantCard
                                    key={assistant.id}
                                    assistant={assistant}
                                    isActive={!useDefaultPrompt && activeAssistant?.id === assistant.id}
                                    onSelect={() => handleSelect(assistant.id)}
                                    onEdit={(e) => handleEdit(e, assistant)}
                                    onDuplicate={(e) => handleDuplicate(e, assistant.id)}
                                    canDelete={false}
                                />
                            ))}
                        </div>
                    </section>
                )}
                
                {/* Custom Assistants */}
                {customAssistants.length > 0 && (
                    <section>
                        <p className="text-[10px] font-semibold uppercase text-neutral-500 tracking-wider mb-3 px-1">
                            Seus Assistentes ({customAssistants.length})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {customAssistants.map((assistant) => (
                                <AssistantCard
                                    key={assistant.id}
                                    assistant={assistant}
                                    isActive={!useDefaultPrompt && activeAssistant?.id === assistant.id}
                                    onSelect={() => handleSelect(assistant.id)}
                                    onEdit={(e) => handleEdit(e, assistant)}
                                    onDuplicate={(e) => handleDuplicate(e, assistant.id)}
                                    onDelete={(e) => handleDelete(e, assistant.id)}
                                    canDelete={true}
                                />
                            ))}
                        </div>
                    </section>
                )}
                
                {filteredAssistants.length === 0 && searchQuery && (
                    <div className="text-center py-12">
                        <p className="text-neutral-500">Nenhum assistente encontrado para "{searchQuery}"</p>
                    </div>
                )}
                
                {/* Empty state for custom assistants */}
                {customAssistants.length === 0 && !searchQuery && (
                    <section className="bg-neutral-800/20 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                            <Plus size={24} className="text-purple-400" />
                        </div>
                        <h3 className="text-lg font-medium text-neutral-200 mb-2">Crie seu primeiro assistente</h3>
                        <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
                            Personalize o comportamento da Selene criando assistentes com instruções específicas para diferentes tarefas.
                        </p>
                        <button
                            onClick={() => onOpenEditor(null)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium text-white transition-colors"
                        >
                            <Plus size={16} />
                            Criar Assistente
                        </button>
                    </section>
                )}
            </div>
        </motion.div>
    )
}

// Assistant Card Component
interface AssistantCardProps {
    assistant: AssistantConfig
    isActive: boolean
    onSelect: () => void
    onEdit?: (e: React.MouseEvent) => void
    onDuplicate?: (e: React.MouseEvent) => void
    onDelete?: (e: React.MouseEvent) => void
    canDelete: boolean
}

const AssistantCard: React.FC<AssistantCardProps> = ({
    assistant,
    isActive,
    onSelect,
    onEdit,
    onDuplicate,
    onDelete,
    canDelete
}) => {
    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-start gap-3 p-4 rounded-xl transition-all group text-left relative ${
                isActive 
                    ? 'bg-purple-500/15 border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10 hover:border-white/10'
            }`}
        >
            <span 
                className="w-10 h-10 flex items-center justify-center rounded-xl text-lg flex-shrink-0"
                style={{ backgroundColor: `${assistant.color || '#8b5cf6'}20` }}
            >
                {assistant.icon || '✨'}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-200 truncate">
                        {assistant.nome}
                    </p>
                    {isActive && (
                        <Check size={14} className="text-purple-400 flex-shrink-0" />
                    )}
                </div>
                <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                    {assistant.descricao}
                </p>
                {assistant.usageCount !== undefined && assistant.usageCount > 0 && (
                    <p className="text-[10px] text-neutral-600 mt-1">
                        {assistant.usageCount} {assistant.usageCount === 1 ? 'uso' : 'usos'}
                    </p>
                )}
            </div>
            
            {/* Action buttons (visible on hover) */}
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="p-1.5 bg-neutral-900/80 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Editar"
                    >
                        <Settings size={12} />
                    </button>
                )}
                {onDuplicate && (
                    <button
                        onClick={onDuplicate}
                        className="p-1.5 bg-neutral-900/80 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Duplicar"
                    >
                        <Copy size={12} />
                    </button>
                )}
                {canDelete && onDelete && (
                    <button
                        onClick={onDelete}
                        className="p-1.5 bg-neutral-900/80 hover:bg-red-500/20 rounded-lg text-neutral-400 hover:text-red-400 transition-colors"
                        title="Remover"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
        </button>
    )
}

export default AssistantsPanel
