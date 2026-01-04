import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Minus, Square, X, ChevronRight,
    FolderOpen, FilePlus, FileText, MessageSquare, Trash2, Send, Plus,
    Palette, FileCode, ChevronDown
} from 'lucide-react'
import type { Project } from '../../../../types/project'
import type { Conversation } from '../types'
import { formatFileSize } from '../../../../services/DocumentService'

// Cores disponíveis para projetos
const CORES_PROJETO = [
    '#FFD700', // Gold
    '#7C3AED', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#8B5CF6', // Violet
]

interface ProjectViewProps {
    project: Project
    conversations: Conversation[]
    onClose: () => void
    onRenameProject: (newName: string) => void
    onUpdateProject: (updates: Partial<Project>) => void
    onDeleteFile: (fileId: string) => void
    onDeleteConversation: (convId: string) => void
    onUploadFiles: () => void
    onSelectConversation: (convId: string) => void
    chatInput: string
    onChatInputChange: (value: string) => void
    onCreateChat: (initialMessage?: string) => void
    chatInputRef: React.RefObject<HTMLInputElement | null>
}

export const ProjectView: React.FC<ProjectViewProps> = ({
    project,
    conversations,
    onClose,
    onRenameProject,
    onUpdateProject,
    onDeleteFile,
    onDeleteConversation,
    onUploadFiles,
    onSelectConversation,
    chatInput,
    onChatInputChange,
    onCreateChat,
    chatInputRef,
}) => {
    const projectConvs = conversations.filter(c => c.projectId === project.id)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showInstructions, setShowInstructions] = useState(!!project.instructions)

    const corAtual = project.color || '#FFD700'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-neutral-900"
        >
            {/* Project Header */}
            <header
                className="flex-none h-14 flex items-center justify-between px-5 bg-neutral-900/80 border-b border-white/5 backdrop-blur-xl"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <FolderOpen size={20} style={{ color: corAtual }} />
                    <span className="text-sm font-medium text-neutral-200">{project.name}</span>
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
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </header>

            {/* Project Content */}
            <div className="flex-1 overflow-y-auto p-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="max-w-2xl mx-auto">
                    {/* Project Title with Color Picker */}
                    <div className="flex items-center gap-4 mb-6">
                        {/* Color Picker Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="p-2 rounded-xl hover:bg-white/10 transition-colors group"
                                title="Mudar cor da pasta"
                            >
                                <FolderOpen size={32} style={{ color: corAtual }} />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Palette size={8} className="text-neutral-400" />
                                </div>
                            </button>

                            {/* Color Picker Dropdown */}
                            <AnimatePresence>
                                {showColorPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-neutral-800 border border-white/10 shadow-xl z-50"
                                    >
                                        <p className="text-xs text-neutral-500 mb-2">Cor da pasta</p>
                                        <div className="flex flex-wrap gap-2 w-40">
                                            {CORES_PROJETO.map(cor => (
                                                <button
                                                    key={cor}
                                                    onClick={() => {
                                                        onUpdateProject({ color: cor })
                                                        setShowColorPicker(false)
                                                    }}
                                                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${cor === corAtual ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-800' : ''}`}
                                                    style={{ backgroundColor: cor }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <input
                            type="text"
                            value={project.name}
                            onChange={(e) => onRenameProject(e.target.value)}
                            className="text-2xl font-semibold bg-transparent text-white border-none outline-none flex-1 focus:ring-2 focus:ring-purple-500/50 rounded px-2 -mx-2"
                        />

                        {/* Files Count Badge */}
                        <button
                            onClick={onUploadFiles}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors text-sm"
                        >
                            <FilePlus size={14} />
                            <span>{project.files.length} arquivos</span>
                        </button>
                    </div>

                    {/* Project Instructions */}
                    <div className="mb-6">
                        <button
                            onClick={() => setShowInstructions(!showInstructions)}
                            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors mb-2"
                        >
                            <FileCode size={14} />
                            <span>Instruções do Projeto</span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform ${showInstructions ? 'rotate-180' : ''}`}
                            />
                        </button>

                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <textarea
                                        value={project.instructions || ''}
                                        onChange={(e) => onUpdateProject({ instructions: e.target.value })}
                                        placeholder="Adicione instruções específicas para este projeto. Por exemplo: 'Responda sempre em inglês', 'Use formato técnico', 'Foque em Python'..."
                                        className="w-full h-32 p-4 rounded-xl bg-white/5 border border-white/10 text-neutral-200 placeholder-neutral-500 text-sm resize-none outline-none focus:border-purple-500/50 transition-colors [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
                                    />
                                    <p className="text-xs text-neutral-600 mt-1.5">
                                        Estas instruções serão aplicadas automaticamente em todas as conversas deste projeto.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* New Chat Input */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 focus-within:border-purple-500/50 transition-colors">
                            <Plus size={20} className="text-neutral-500" />
                            <input
                                ref={chatInputRef}
                                type="text"
                                value={chatInput}
                                onChange={(e) => onChatInputChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && chatInput.trim()) {
                                        onCreateChat(chatInput.trim())
                                        onChatInputChange('')
                                    }
                                }}
                                placeholder={`Novo chat em ${project.name}`}
                                className="flex-1 bg-transparent text-white placeholder-neutral-500 outline-none"
                            />
                            <button
                                onClick={() => {
                                    if (chatInput.trim()) {
                                        onCreateChat(chatInput.trim())
                                        onChatInputChange('')
                                    }
                                }}
                                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Files Section */}
                    {project.files.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                                <FileText size={14} />
                                Arquivos do Projeto
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {project.files.map(file => (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                                    >
                                        <FileText size={18} className="text-neutral-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{file.name}</p>
                                            <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (confirm(`Remover "${file.name}"?`)) {
                                                    onDeleteFile(file.id)
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-neutral-500 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversations in Project */}
                    <div>
                        <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                            <MessageSquare size={14} />
                            Conversas do Projeto ({projectConvs.length})
                        </h3>
                        {projectConvs.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500">
                                <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Nenhuma conversa ainda</p>
                                <p className="text-sm mt-1">Use o campo acima para iniciar um novo chat</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {projectConvs.map(conv => (
                                    <div
                                        key={conv.id}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                                    >
                                        <button
                                            onClick={() => onSelectConversation(conv.id)}
                                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                                        >
                                            <MessageSquare size={18} className="text-neutral-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{conv.title}</p>
                                                <p className="text-xs text-neutral-500">
                                                    {new Date(conv.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                                    {conv.messages.length > 0 && ` · ${conv.messages.length} mensagens`}
                                                </p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm(`Excluir "${conv.title}"?`)) {
                                                    onDeleteConversation(conv.id)
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-neutral-500 hover:text-red-400 transition-all shrink-0"
                                            title="Excluir conversa"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
