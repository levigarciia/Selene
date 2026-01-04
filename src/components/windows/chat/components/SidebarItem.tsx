// Sidebar Item Component with inline rename support
import React, { useState, useRef, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    active?: boolean
    collapsed?: boolean
    onClick?: () => void
    onDelete?: () => void
    onRename?: (newName: string) => void
    trailing?: React.ReactNode
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
    icon: Icon, 
    label, 
    active, 
    collapsed, 
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
    
    return (
        <div className="relative group">
            <button
                onClick={isEditing ? undefined : onClick}
                className={`w-full p-3 rounded-xl flex items-center transition-all duration-200 text-left ${active
                    ? 'bg-purple-500/15 text-purple-200'
                    : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'} ${collapsed ? 'justify-center' : 'gap-3'}`}
                title={collapsed ? label : undefined}
            >
                <Icon size={18} className={active ? 'text-purple-400' : 'group-hover:text-purple-300 transition-colors'} />
                {!collapsed && (
                    isEditing ? (
                        <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-sm font-medium bg-neutral-800 border border-purple-500/50 rounded px-2 py-0.5 outline-none text-white"
                        />
                    ) : (
                        <span className="flex-1 text-sm font-medium truncate pr-12">{label}</span>
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
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-500 hover:text-white transition-all cursor-pointer"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
                    title="Excluir conversa"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    )
}
