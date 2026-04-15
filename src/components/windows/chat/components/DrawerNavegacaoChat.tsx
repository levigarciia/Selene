import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, FolderClosed, MessageSquareText, Plus, Settings, Wrench } from 'lucide-react'
import type { Project } from '../../../../types/project'
import type { Conversation } from '../types'

interface DrawerNavegacaoChatProps {
    aberto: boolean
    conversations: Conversation[]
    projects: Project[]
    activeConversationId: string | null
    currentProjectId: string | null
    onClose: () => void
    onNovaConversa: () => void
    onSelecionarConversa: (conversationId: string) => void
    onSelecionarProjeto: (projectId: string) => void
    onAbrirAssistentes: () => void
    onAbrirApps: () => void
    onAbrirConfiguracoes: () => void
}

export const DrawerNavegacaoChat: React.FC<DrawerNavegacaoChatProps> = ({
    aberto,
    conversations,
    projects,
    activeConversationId,
    currentProjectId,
    onClose,
    onNovaConversa,
    onSelecionarConversa,
    onSelecionarProjeto,
    onAbrirAssistentes,
    onAbrirApps,
    onAbrirConfiguracoes,
}) => {
    return (
        <AnimatePresence>
            {aberto && (
                <>
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
                        aria-label="Fechar navegação"
                    />

                    <motion.aside
                        initial={{ x: -18, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -18, opacity: 0 }}
                        className="absolute left-4 top-4 z-30 flex h-[calc(100%-2rem)] w-[320px] flex-col rounded-3xl border border-white/[0.06] bg-[#121417] p-4 shadow-2xl"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-white">Navegação rápida</p>
                                <p className="text-xs text-[#88909d]">Converse, troque de contexto e retome o trabalho.</p>
                            </div>
                            <button
                                type="button"
                                onClick={onNovaConversa}
                                className="flex h-9 items-center gap-2 rounded-xl bg-[#4b479f] px-3 text-sm font-medium text-white transition-colors hover:bg-[#5b57b0]"
                            >
                                <Plus size={15} />
                                Novo chat
                            </button>
                        </div>

                        <div className="mb-4 grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={onAbrirAssistentes}
                                className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-left text-[#d7dce6] transition-colors hover:bg-white/[0.06]"
                            >
                                <Bot size={15} className="mb-2 text-[#b6b4ff]" />
                                <div className="text-[13px] font-medium">Assistentes</div>
                            </button>
                            <button
                                type="button"
                                onClick={onAbrirApps}
                                className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-left text-[#d7dce6] transition-colors hover:bg-white/[0.06]"
                            >
                                <Wrench size={15} className="mb-2 text-[#92d5bf]" />
                                <div className="text-[13px] font-medium">Apps</div>
                            </button>
                            <button
                                type="button"
                                onClick={onAbrirConfiguracoes}
                                className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-left text-[#d7dce6] transition-colors hover:bg-white/[0.06]"
                            >
                                <Settings size={15} className="mb-2 text-[#9fb4de]" />
                                <div className="text-[13px] font-medium">Config</div>
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                            <section>
                                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#68707d]">
                                    Conversas recentes
                                </div>
                                <div className="space-y-2">
                                    {conversations.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-white/[0.05] px-3 py-4 text-sm text-[#808898]">
                                            Nenhuma conversa recente.
                                        </div>
                                    )}
                                    {conversations.map((conversation) => (
                                        <button
                                            key={conversation.id}
                                            type="button"
                                            onClick={() => onSelecionarConversa(conversation.id)}
                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                                                conversation.id === activeConversationId
                                                    ? 'border-[#5b57b0]/60 bg-[#201f38] text-white'
                                                    : 'border-white/[0.05] bg-white/[0.03] text-[#d6dbe5] hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MessageSquareText size={15} className="text-[#9aa2b0]" />
                                                <span className="truncate text-[13px] font-medium">{conversation.title}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-[#838b98]">
                                                {new Date(conversation.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#68707d]">
                                    Projetos recentes
                                </div>
                                <div className="space-y-2">
                                    {projects.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-white/[0.05] px-3 py-4 text-sm text-[#808898]">
                                            Nenhum projeto criado.
                                        </div>
                                    )}
                                    {projects.map((project) => (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => onSelecionarProjeto(project.id)}
                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                                                project.id === currentProjectId
                                                    ? 'border-[#5b57b0]/60 bg-[#201f38] text-white'
                                                    : 'border-white/[0.05] bg-white/[0.03] text-[#d6dbe5] hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FolderClosed size={15} className="text-[#f0c769]" />
                                                <span className="truncate text-[13px] font-medium">{project.name}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-[#838b98]">
                                                {project.files.length} arquivo(s)
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
