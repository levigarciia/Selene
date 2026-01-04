import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Settings, ChevronLeft, ChevronRight,
    Bot, Plug, FolderClosed, Trash2, MessageSquare
} from 'lucide-react'
import seleneLogo from '/tray-icon.png'
import type { Conversation } from '../types'
import type { Project } from '../../../../types/project'
import type { AssistantConfig } from '../../../../utils/assistentesPadrao'
import { SidebarItem } from './SidebarItem'

interface SidebarProps {
    collapsed: boolean
    onToggleCollapsed: () => void

    // Projects
    projects: Project[]
    activeProjectId: string | null
    onSelectProject: (id: string) => void
    onDeleteProject: (id: string) => void
    isCreatingProject: boolean
    newProjectName: string
    onSetNewProjectName: (name: string) => void
    onSetIsCreatingProject: (creating: boolean) => void
    onAddProject: (name: string) => void
    newProjectInputRef: React.RefObject<HTMLInputElement | null>

    // Conversations
    conversations: Conversation[]
    activeConversationId: string | null
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
    onRenameConversation: (id: string, newTitle: string) => void
    onMoveConversationToProject: (convId: string, projectId: string) => void
    onCreateNewConversation: () => void

    // Panels
    showAssistantsPanel: boolean
    onOpenAssistantsPanel: () => void
    onOpenMCPPanel: () => void
    onOpenSettings: () => void
    showMCPPanel: boolean

    // Assistants
    activeAssistant: AssistantConfig | null
    hasActiveAssistant: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
    collapsed,
    onToggleCollapsed,
    projects,
    activeProjectId,
    onSelectProject,
    onDeleteProject,
    isCreatingProject,
    newProjectName,
    onSetNewProjectName,
    onSetIsCreatingProject,
    onAddProject,
    newProjectInputRef,
    conversations,
    activeConversationId,
    onSelectConversation,
    onDeleteConversation,
    onRenameConversation,
    onMoveConversationToProject,
    onCreateNewConversation,
    showAssistantsPanel,
    onOpenAssistantsPanel,
    onOpenMCPPanel,
    onOpenSettings,
    showMCPPanel,
    activeAssistant,
    hasActiveAssistant,
}) => {
    const standaloneConversations = conversations.filter(c => !c.projectId)

    return (
        <AnimatePresence initial={false}>
            <motion.aside
                initial={false}
                animate={{ width: collapsed ? 64 : 280 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="flex-none flex flex-col border-r border-white/5 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
            >
                {/* Sidebar Header */}
                <div
                    className={`h-14 flex items-center px-4 border-b border-white/5 ${collapsed ? 'justify-center' : 'justify-between'}`}
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center">
                                <img src={seleneLogo} alt="Selene Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="font-semibold text-sm">Selene</span>
                        </div>
                    )}
                    <button
                        onClick={onToggleCollapsed}
                        className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Assistants Button */}
                <div className="p-3 pb-0">
                    <button
                        onClick={onOpenAssistantsPanel}
                        className={`w-full flex items-center gap-2 p-3 rounded-xl transition-colors ${collapsed ? 'justify-center' : ''} ${
                            hasActiveAssistant || showAssistantsPanel
                                ? 'text-purple-300 hover:bg-purple-500/20'
                                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={activeAssistant?.nome || 'Assistentes'}
                    >
                        <Bot size={18} />
                        {!collapsed && (
                            <span className="text-sm font-medium">
                                {activeAssistant?.nome || 'Assistentes'}
                            </span>
                        )}
                    </button>
                </div>

                {/* MCP Tools Button */}
                <div className="px-3">
                    <button
                        onClick={onOpenMCPPanel}
                        className={`w-full flex items-center gap-2 p-3 rounded-xl transition-colors ${collapsed ? 'justify-center' : ''} ${
                            showMCPPanel
                                ? 'text-blue-300 hover:bg-blue-500/20'
                                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                        title="MCP Tools"
                    >
                        <Plug size={18} />
                        {!collapsed && (
                            <span className="text-sm font-medium">MCP Tools</span>
                        )}
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-3">
                    <button
                        onClick={onCreateNewConversation}
                        className={`w-full flex items-center gap-2 p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
                    >
                        <Plus size={18} />
                        {!collapsed && <span className="text-sm font-medium">Nova conversa</span>}
                    </button>
                </div>

                {/* Projects & Conversations List */}
                <div className="flex-1 overflow-y-auto px-3 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">

                    {/* Projects Section */}
                    {!collapsed && (
                        <>
                            <p className="px-3 text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-2 mt-2">
                                Projetos
                            </p>

                            {/* New Project Input/Button */}
                            {isCreatingProject ? (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 mb-1">
                                    <FolderClosed size={16} className="text-yellow-500 shrink-0" />
                                    <input
                                        ref={newProjectInputRef}
                                        type="text"
                                        value={newProjectName}
                                        onChange={(e) => onSetNewProjectName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newProjectName.trim()) {
                                                onAddProject(newProjectName.trim())
                                                onSetNewProjectName('')
                                                onSetIsCreatingProject(false)
                                            } else if (e.key === 'Escape') {
                                                onSetNewProjectName('')
                                                onSetIsCreatingProject(false)
                                            }
                                        }}
                                        onBlur={() => {
                                            if (newProjectName.trim()) {
                                                onAddProject(newProjectName.trim())
                                            }
                                            onSetNewProjectName('')
                                            onSetIsCreatingProject(false)
                                        }}
                                        placeholder="Nome do projeto..."
                                        className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => onSetIsCreatingProject(true)}
                                    className="w-full flex items-center gap-2 p-2.5 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors mb-1"
                                >
                                    <FolderClosed size={16} />
                                    <Plus size={12} className="-ml-3 -mt-2" />
                                    <span className="text-sm">Novo projeto</span>
                                </button>
                            )}

                            {/* Existing Projects */}
                            {projects.map(project => {
                                const isActive = project.id === activeProjectId
                                const projectConversations = conversations.filter(c => c.projectId === project.id)
                                const projectColor = project.color || '#FFD700'

                                return (
                                    <div key={project.id} className="mb-1">
                                        <div className="relative group">
                                            <button
                                                onClick={() => onSelectProject(project.id)}
                                                className={`w-full p-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 text-left hover:bg-white/5 ${isActive ? 'bg-purple-600/20 text-white' : 'text-neutral-300 hover:text-white'}`}
                                            >
                                                <FolderClosed size={18} style={{ color: projectColor }} />
                                                <span className="flex-1 text-sm font-medium truncate pr-10">{project.name}</span>
                                                {projectConversations.length > 0 && (
                                                    <span className="text-[10px] text-neutral-500">{projectConversations.length}</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (confirm(`Excluir projeto "${project.name}"? As conversas serão movidas para fora.`)) {
                                                        onDeleteProject(project.id)
                                                    }
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
                                                title="Excluir projeto"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}

                    {/* Standalone Conversations */}
                    {!collapsed && (
                        <p className="px-3 text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-2 mt-4">
                            Conversas
                        </p>
                    )}
                    {standaloneConversations.map(conv => (
                        <div
                            key={conv.id}
                            onContextMenu={(e) => {
                                if (projects.length === 0) return
                                e.preventDefault()
                                const projectNames = projects.map(p => p.name).join('\n')
                                const choice = prompt(
                                    `Mover "${conv.title}" para qual projeto?\n\nProjetos disponíveis:\n${projectNames}\n\nDigite o nome do projeto:`
                                )
                                if (choice) {
                                    const targetProject = projects.find(p =>
                                        p.name.toLowerCase() === choice.toLowerCase()
                                    )
                                    if (targetProject) {
                                        onMoveConversationToProject(conv.id, targetProject.id)
                                    } else {
                                        alert('Projeto não encontrado')
                                    }
                                }
                            }}
                        >
                            <SidebarItem
                                icon={MessageSquare}
                                label={conv.title}
                                collapsed={collapsed}
                                active={conv.id === activeConversationId}
                                onClick={() => onSelectConversation(conv.id)}
                                onDelete={() => onDeleteConversation(conv.id)}
                                onRename={(newTitle) => onRenameConversation(conv.id, newTitle)}
                            />
                        </div>
                    ))}
                </div>

                {/* Settings */}
                <div className="p-3 border-t border-white/5">
                    <SidebarItem
                        icon={Settings}
                        label="Configurações"
                        collapsed={collapsed}
                        onClick={onOpenSettings}
                    />
                </div>
            </motion.aside>
        </AnimatePresence>
    )
}
