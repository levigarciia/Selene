/**
 * AssistantSelector Component
 * 
 * A dropdown/panel for selecting and managing AI assistants
 * directly within the ChatWindow interface.
 */

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronDown,
    Check,
    Plus,
    Settings,
    Trash2,
    Copy,
    RotateCcw
} from 'lucide-react'
import type { AssistenteConfig as AssistantConfig } from '../../../utils/assistentesPadrao'
import type { UseAssistantsReturn } from '../../../hooks/useAssistants'

interface AssistantSelectorProps {
    assistants: UseAssistantsReturn
    onOpenEditor?: (assistant: AssistantConfig | null) => void
}

export const AssistantSelector: React.FC<AssistantSelectorProps> = ({
    assistants,
    onOpenEditor
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)
    
    const {
        assistants: assistantList,
        activeAssistant,
        useDefaultPrompt,
        selectAssistant,
        toggleDefaultPrompt,
        removeAssistant,
        duplicateAssistant
    } = assistants
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])
    
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
        setIsOpen(false)
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
        onOpenEditor?.(assistant)
        setIsOpen(false)
    }
    
    const displayName = useDefaultPrompt 
        ? 'Selene (Padrão)' 
        : activeAssistant?.nome || 'Selecionar Assistente'
    
    const displayIcon = useDefaultPrompt
        ? '🌙'
        : activeAssistant?.icon || '✨'
    
    const displayColor = useDefaultPrompt
        ? '#8b5cf6'
        : activeAssistant?.color || '#8b5cf6'
    
    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
            >
                <span 
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-sm"
                    style={{ backgroundColor: `${displayColor}20` }}
                >
                    {displayIcon}
                </span>
                <span className="text-sm font-medium text-neutral-200 max-w-[140px] truncate">
                    {displayName}
                </span>
                <ChevronDown 
                    size={14} 
                    className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>
            
            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-80 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                    >
                        {/* Search */}
                        <div className="p-3 border-b border-white/5">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar assistente..."
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-purple-500/50"
                            />
                        </div>
                        
                        <div className="max-h-[400px] overflow-y-auto">
                            {/* Default Selene Option */}
                            <div className="p-2">
                                <button
                                    onClick={() => handleSelect(null)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                        useDefaultPrompt 
                                            ? 'bg-purple-500/15 border border-purple-500/30' 
                                            : 'hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-purple-500/20 text-lg">
                                        🌙
                                    </span>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-neutral-200">Selene (Padrão)</p>
                                        <p className="text-xs text-neutral-500 line-clamp-1">
                                            Sistema padrão sem modificações
                                        </p>
                                    </div>
                                    {useDefaultPrompt && (
                                        <Check size={16} className="text-purple-400" />
                                    )}
                                </button>
                            </div>
                            
                            {/* Divider */}
                            <div className="px-4 py-2">
                                <div className="h-px bg-white/10" />
                            </div>
                            
                            {/* Default Assistants */}
                            {defaultAssistants.length > 0 && (
                                <div className="px-2">
                                    <p className="px-3 py-1 text-[10px] font-semibold uppercase text-neutral-500 tracking-wider">
                                        Assistentes Padrão
                                    </p>
                                    {defaultAssistants.map((assistant) => (
                                        <AssistantItem
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
                            )}
                            
                            {/* Custom Assistants */}
                            {customAssistants.length > 0 && (
                                <div className="px-2 mt-2">
                                    <p className="px-3 py-1 text-[10px] font-semibold uppercase text-neutral-500 tracking-wider">
                                        Seus Assistentes
                                    </p>
                                    {customAssistants.map((assistant) => (
                                        <AssistantItem
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
                            )}
                            
                            {filteredAssistants.length === 0 && searchQuery && (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-sm text-neutral-500">
                                        Nenhum assistente encontrado
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-3 border-t border-white/5 flex gap-2">
                            <button
                                onClick={() => {
                                    onOpenEditor?.(null)
                                    setIsOpen(false)
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Plus size={14} />
                                Criar Novo
                            </button>
                            <button
                                onClick={() => {
                                    assistants.restoreDefaults()
                                    setIsOpen(false)
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-colors"
                                title="Restaurar padrões"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Assistant Item Component
interface AssistantItemProps {
    assistant: AssistantConfig
    isActive: boolean
    onSelect: () => void
    onEdit?: (e: React.MouseEvent) => void
    onDuplicate?: (e: React.MouseEvent) => void
    onDelete?: (e: React.MouseEvent) => void
    canDelete: boolean
}

const AssistantItem: React.FC<AssistantItemProps> = ({
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
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative ${
                isActive 
                    ? 'bg-purple-500/15 border border-purple-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
            }`}
        >
            <span 
                className="w-8 h-8 flex items-center justify-center rounded-xl text-lg"
                style={{ backgroundColor: `${assistant.color || '#8b5cf6'}20` }}
            >
                {assistant.icon || '✨'}
            </span>
            <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate">
                    {assistant.nome}
                </p>
                <p className="text-xs text-neutral-500 line-clamp-1">
                    {assistant.descricao}
                </p>
            </div>
            
            {/* Action buttons (visible on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Editar"
                    >
                        <Settings size={12} />
                    </button>
                )}
                {onDuplicate && (
                    <button
                        onClick={onDuplicate}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Duplicar"
                    >
                        <Copy size={12} />
                    </button>
                )}
                {canDelete && onDelete && (
                    <button
                        onClick={onDelete}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-neutral-400 hover:text-red-400 transition-colors"
                        title="Remover"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
            
            {isActive && (
                <Check size={16} className="text-purple-400 flex-shrink-0" />
            )}
        </button>
    )
}

export default AssistantSelector
