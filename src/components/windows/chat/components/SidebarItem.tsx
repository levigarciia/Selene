// Sidebar Item Component with inline rename support
import React, { useState, useRef, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    descricao?: string
    active?: boolean
    collapsed?: boolean
    variante?: 'padrao' | 'chat-expandida'
    onClick?: () => void
    onDelete?: () => void
    onRename?: (newName: string) => void
    trailing?: React.ReactNode
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
    icon: Icon,
    label,
    descricao,
    active,
    collapsed,
    variante = 'padrao',
    onClick,
    onDelete,
    onRename,
    trailing
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(label)
    const inputRef = useRef<HTMLInputElement>(null)
    
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])
    
    const handleRename = () => {
        const trimmed = editValue.trim()
        if (trimmed && trimmed !== label && onRename) {
            onRename(trimmed)
        }
        setIsEditing(false)
        setEditValue(label)
    }
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRename()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
            setEditValue(label)
        }
    }

    const classesBotao = variante === 'chat-expandida'
        ? active
            ? 'border-white/[0.05] bg-white/[0.04] text-white'
            : 'border-transparent bg-transparent text-[#8b92a0] hover:bg-white/[0.025] hover:text-[#eef1f7]'
        : active
            ? 'bg-purple-500/15 text-purple-200'
            : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'

    const classesIcone = variante === 'chat-expandida'
        ? active
            ? 'text-[#d5dae3]'
            : 'text-[#6e7684] transition-colors group-hover:text-[#c7ccd6]'
        : active
            ? 'text-purple-400'
            : 'group-hover:text-purple-300 transition-colors'

    const classesAcao = variante === 'chat-expandida'
        ? 'hover:bg-white/[0.05] text-[#666e7d] hover:text-white'
        : 'hover:bg-white/10 text-neutral-500 hover:text-white'
    
    return (
        <div className="relative min-w-0 max-w-full group">
            <button
                onClick={isEditing ? undefined : onClick}
                className={`w-full rounded-xl border text-left transition-all duration-200 ${
                    variante === 'chat-expandida' ? 'px-2.5 py-2' : 'p-3'
                } ${classesBotao} ${collapsed ? 'justify-center' : 'gap-3'} flex min-w-0 max-w-full items-center overflow-hidden`}
                title={collapsed ? label : undefined}
            >
                <Icon size={variante === 'chat-expandida' ? 16 : 18} className={`shrink-0 ${classesIcone}`} />
                {!collapsed && (
                    isEditing ? (
                        <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex-1 rounded border px-2 py-0.5 outline-none ${
                                variante === 'chat-expandida'
                                    ? 'border-white/[0.08] bg-[#0f1013] text-[13px] font-medium text-white'
                                    : 'border-purple-500/50 bg-neutral-800 text-sm font-medium text-white'
                            }`}
                        />
                    ) : (
                        <div className={`min-w-0 max-w-full flex-1 overflow-hidden ${variante === 'chat-expandida' ? 'pr-11' : 'pr-12'}`}>
                            <div className={`block max-w-full truncate whitespace-nowrap ${variante === 'chat-expandida' ? 'text-[12.5px] font-medium' : 'text-sm font-medium'}`}>
                                {label}
                            </div>
                            {descricao && (
                                <div className={`block max-w-full truncate whitespace-nowrap ${variante === 'chat-expandida' ? 'mt-0.5 text-[10.5px] text-[#68707d]' : 'mt-0.5 text-xs text-neutral-500'}`}>
                                    {descricao}
                                </div>
                            )}
                        </div>
                    )
                )}
                {!collapsed && trailing}
            </button>
            {!collapsed && onRename && !isEditing && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsEditing(true)
                        setEditValue(label)
                    }}
                    className={`absolute right-8 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100 ${classesAcao}`}
                    title="Renomear"
                >
                    <Pencil size={14} />
                </button>
            )}
            {!collapsed && onDelete && !isEditing && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100 ${
                        variante === 'chat-expandida'
                            ? 'text-[#666e7d] hover:bg-[#2f161b] hover:text-[#f2b8c2]'
                            : 'text-neutral-500 hover:bg-red-500/20 hover:text-red-400'
                    }`}
                    title="Excluir conversa"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    )
}
