import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronDown,
    FolderClosed,
    MessageSquare,
    Plus,
    Search,
    Sparkles,
} from 'lucide-react'
import type { Conversation } from '../types'
import type { Project } from '../../../../types/project'
import { SidebarItem } from './SidebarItem'
import { PopoverPerfilChat } from './PopoverPerfilChat'

interface SidebarProps {
    collapsed: boolean
    projects: Project[]
    activeProjectId: string | null
    onSelectProject: (id: string) => void
    isCreatingProject: boolean
    newProjectName: string
    onSetNewProjectName: (name: string) => void
    onSetIsCreatingProject: (creating: boolean) => void
    onAddProject: (name: string) => void
    newProjectInputRef: React.RefObject<HTMLInputElement | null>
    conversations: Conversation[]
    activeConversationId: string | null
    onSelectConversation: (id: string) => void
    onDeleteConversation: (id: string) => void
    onRenameConversation: (id: string, newTitle: string) => void
    onMoveConversationToProject: (convId: string, projectId: string) => void
    onCreateNewConversation: () => void
    className?: string
    busca?: string
    onBuscaChange?: (valor: string) => void
    onAbrirContexto?: () => void
    nomePerfil?: string
    fotoPerfil?: string
    perfilAberto?: boolean
    onAlternarPerfil: () => void
    onFecharPerfil: () => void
    onAbrirPerfil: () => void
    onAbrirPersonalizacao: () => void
    onAbrirConfiguracao: () => void
}

interface GrupoProjetoSidebarProps {
    project: Project
    conversations: Conversation[]
    ativo: boolean
    expandido: boolean
    activeConversationId: string | null
    onAlternarExpandido: () => void
    onAbrirProjeto: () => void
    onSelecionarConversa: (id: string) => void
    onExcluirConversa: (id: string) => void
    onRenomearConversa: (id: string, newTitle: string) => void
}

function normalizarBusca(valor: string) {
    return valor.trim().toLocaleLowerCase('pt-BR')
}

const GrupoProjetoSidebar: React.FC<GrupoProjetoSidebarProps> = ({
    project,
    conversations,
    ativo,
    expandido,
    activeConversationId,
    onAlternarExpandido,
    onAbrirProjeto,
    onSelecionarConversa,
    onExcluirConversa,
    onRenomearConversa,
}) => {
    const corProjeto = project.color || '#dabb71'
    const conversaAtivaNoProjeto = conversations.some((conversation) => conversation.id === activeConversationId)

    return (
        <div className="min-w-0 max-w-full space-y-1">
            <div className={`group flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-colors ${
                ativo || conversaAtivaNoProjeto
                    ? 'border-white/[0.07] bg-white/[0.045]'
                    : 'border-transparent bg-transparent hover:bg-white/[0.025]'
            }`}>
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
                    style={{
                        color: corProjeto,
                        borderColor: `${corProjeto}44`,
                        backgroundColor: `${corProjeto}18`,
                    }}
                >
                    <FolderClosed size={15} />
                </div>

                <div className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={onAbrirProjeto}
                        className="w-full text-left"
                    >
                        <div className="truncate text-[12.5px] font-medium text-[#eef1f7]">
                            {project.name}
                        </div>
                        <div className="truncate text-[10.5px] text-[#68707d]">
                            {project.files.length} arquivo(s) · {conversations.length} conversa(s)
                        </div>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onAlternarExpandido}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#727a89] transition-colors hover:bg-white/[0.05] hover:text-white"
                    aria-label={expandido ? 'Recolher conversas do projeto' : 'Expandir conversas do projeto'}
                >
                    <ChevronDown size={14} className={`transition-transform ${expandido ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence initial={false}>
                {expandido && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="min-w-0 max-w-full overflow-hidden"
                    >
                        <div className="ml-4 min-w-0 max-w-full border-l border-white/[0.06] pl-3 pt-1">
                            {conversations.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/[0.05] px-3 py-2 text-[11.5px] text-[#6e7685]">
                                    Nenhuma conversa neste projeto.
                                </div>
                            ) : (
                                <div className="min-w-0 max-w-full space-y-1">
                                    {conversations.map((conversation) => (
                                        <SidebarItem
                                            key={conversation.id}
                                            icon={MessageSquare}
                                            label={conversation.title}
                                            active={conversation.id === activeConversationId}
                                            variante="chat-expandida"
                                            onClick={() => onSelecionarConversa(conversation.id)}
                                            onDelete={() => onExcluirConversa(conversation.id)}
                                            onRename={(novoTitulo) => onRenomearConversa(conversation.id, novoTitulo)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export const Sidebar: React.FC<SidebarProps> = ({
    collapsed,
    projects,
    activeProjectId,
    onSelectProject,
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
    className = '',
    busca = '',
    onBuscaChange,
    onAbrirContexto,
    nomePerfil,
    fotoPerfil,
    perfilAberto = false,
    onAlternarPerfil,
    onFecharPerfil,
    onAbrirPerfil,
    onAbrirPersonalizacao,
    onAbrirConfiguracao,
}) => {
    const larguraSidebarExpandida = 322
    const transicaoLarguraSidebar = {
        type: 'spring' as const,
        stiffness: 320,
        damping: 34,
        mass: 0.9,
    }
    const [projetosExpandidos, setProjetosExpandidos] = React.useState<Record<string, boolean>>({})
    const areaPerfilRef = React.useRef<HTMLDivElement | null>(null)
    const termoBusca = normalizarBusca(busca)
    const projetoDaConversaAtiva = conversations.find((conversation) => conversation.id === activeConversationId)?.projectId || null
    const iniciaisPerfil = (nomePerfil || 'Selene')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte[0]?.toUpperCase())
        .join('')

    const standaloneConversations = React.useMemo(() => (
        [...conversations]
            .filter((conversation) => {
                if (conversation.projectId) return false
                if (!termoBusca) return true
                return normalizarBusca(conversation.title).includes(termoBusca)
            })
            .sort((a, b) => b.updatedAt - a.updatedAt)
    ), [conversations, termoBusca])

    const projetosFiltrados = React.useMemo(() => (
        [...projects]
            .filter((project) => {
                if (!termoBusca) return true

                const nomeProjeto = normalizarBusca(project.name)
                const instrucoesProjeto = normalizarBusca(project.instructions || '')
                const encontrouConversa = conversations.some((conversation) => (
                    conversation.projectId === project.id &&
                    normalizarBusca(conversation.title).includes(termoBusca)
                ))

                return nomeProjeto.includes(termoBusca) || instrucoesProjeto.includes(termoBusca) || encontrouConversa
            })
            .sort((a, b) => b.updatedAt - a.updatedAt)
    ), [conversations, projects, termoBusca])

    const obterConversasProjeto = React.useCallback((projectId: string) => (
        [...conversations]
            .filter((conversation) => {
                if (conversation.projectId !== projectId) return false
                if (!termoBusca) return true
                return normalizarBusca(conversation.title).includes(termoBusca)
            })
            .sort((a, b) => b.updatedAt - a.updatedAt)
    ), [conversations, termoBusca])

    const projetosExpandidosAutomaticamente = React.useMemo(() => {
        const ids = new Set<string>()

        if (activeProjectId) {
            ids.add(activeProjectId)
        }

        if (projetoDaConversaAtiva) {
            ids.add(projetoDaConversaAtiva)
        }

        if (termoBusca) {
            projetosFiltrados.forEach((project) => {
                if (obterConversasProjeto(project.id).length > 0) {
                    ids.add(project.id)
                }
            })
        }

        return ids
    }, [activeProjectId, obterConversasProjeto, projetoDaConversaAtiva, projetosFiltrados, termoBusca])

    const projetoEstaExpandido = React.useCallback((projectId: string) => (
        projetosExpandidos[projectId] ?? projetosExpandidosAutomaticamente.has(projectId)
    ), [projetosExpandidos, projetosExpandidosAutomaticamente])

    const alternarProjetoExpandido = React.useCallback((projectId: string) => {
        setProjetosExpandidos((prev) => {
            const expandidoAtual = prev[projectId] ?? projetosExpandidosAutomaticamente.has(projectId)

            return {
                ...prev,
                [projectId]: !expandidoAtual,
            }
        })
    }, [projetosExpandidosAutomaticamente])

    const projetosVazios = projetosFiltrados.length === 0
    const conversasVazias = standaloneConversations.length === 0

    return (
        <motion.aside
            initial={false}
            animate={{
                width: collapsed ? 0 : larguraSidebarExpandida,
                minWidth: collapsed ? 0 : larguraSidebarExpandida,
                maxWidth: collapsed ? 0 : larguraSidebarExpandida,
                opacity: collapsed ? 0 : 1,
            }}
            transition={{
                width: transicaoLarguraSidebar,
                minWidth: transicaoLarguraSidebar,
                maxWidth: transicaoLarguraSidebar,
                opacity: { duration: collapsed ? 0.14 : 0.18, ease: 'easeOut' },
            }}
            style={{ pointerEvents: collapsed ? 'none' : 'auto' }}
            className={`${className} flex-none shrink-0 overflow-hidden bg-[#090a0c]`}
        >
            <motion.div
                initial={false}
                animate={{
                    opacity: collapsed ? 0 : 1,
                    x: collapsed ? -18 : 0,
                    scale: collapsed ? 0.985 : 1,
                }}
                transition={{
                    opacity: { duration: collapsed ? 0.1 : 0.18, ease: 'easeOut' },
                    x: { duration: collapsed ? 0.14 : 0.22, ease: [0.22, 1, 0.36, 1] },
                    scale: { duration: 0.2, ease: 'easeOut' },
                }}
                style={{ width: larguraSidebarExpandida }}
                className="flex h-full min-h-0 flex-col px-3 pb-3 pt-3"
            >
                <div className="space-y-2.5 border-b border-white/[0.04] pb-3">
                    <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.035] p-1">
                        <button
                            type="button"
                            onClick={onCreateNewConversation}
                            className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] font-medium text-white transition-colors hover:bg-white/[0.03]"
                        >
                            <Plus size={15} className="shrink-0" />
                            <span className="whitespace-nowrap">Nova conversa</span>
                        </button>

                        {onAbrirContexto && (
                            <button
                                type="button"
                                onClick={onAbrirContexto}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.02] text-[#cdd3de] transition-colors hover:bg-white/[0.06]"
                                aria-label="Abrir contexto"
                            >
                                <Sparkles size={14} />
                            </button>
                        )}
                    </div>

                    <label className="flex h-9 items-center gap-2.5 rounded-xl border border-white/[0.05] bg-[#121318] px-3 text-[#737b8a] focus-within:border-white/[0.08] focus-within:text-[#cad0db]">
                        <Search size={14} />
                        <input
                            value={busca}
                            onChange={(event) => onBuscaChange?.(event.target.value)}
                            placeholder="Buscar projetos e conversas..."
                            className="w-full bg-transparent text-[12.5px] text-[#dbe0e8] outline-none placeholder:text-[#5f6674]"
                        />
                    </label>
                </div>

                    <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/8 hover:[&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent">
                        <section className="mb-4">
                            <div className="mb-1.5 flex items-center justify-between px-1">
                                <div className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-[#606877]">
                                    Projetos
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSetIsCreatingProject(true)}
                                    className="flex h-5 w-5 items-center justify-center rounded-md text-[#757d8d] transition-colors hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Novo projeto"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>

                            {isCreatingProject && (
                                <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-[#111318] px-2.5 py-2">
                                    <FolderClosed size={14} className="shrink-0 text-[#dabb71]" />
                                    <input
                                        ref={newProjectInputRef}
                                        type="text"
                                        value={newProjectName}
                                        onChange={(event) => onSetNewProjectName(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && newProjectName.trim()) {
                                                onAddProject(newProjectName.trim())
                                                onSetNewProjectName('')
                                                onSetIsCreatingProject(false)
                                            } else if (event.key === 'Escape') {
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
                                        className="w-full bg-transparent text-[12.5px] text-white outline-none placeholder:text-[#5e6674]"
                                    />
                                </div>
                            )}

                            <div className="space-y-1">
                                {projetosVazios && (
                                    <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-3 text-[12.5px] text-[#707887]">
                                        Nenhum projeto encontrado.
                                    </div>
                                )}

                                {projetosFiltrados.map((project) => (
                                    <GrupoProjetoSidebar
                                        key={project.id}
                                        project={project}
                                        conversations={obterConversasProjeto(project.id)}
                                        ativo={project.id === activeProjectId}
                                        expandido={projetoEstaExpandido(project.id)}
                                        activeConversationId={activeConversationId}
                                        onAlternarExpandido={() => alternarProjetoExpandido(project.id)}
                                        onAbrirProjeto={() => onSelectProject(project.id)}
                                        onSelecionarConversa={onSelectConversation}
                                        onExcluirConversa={onDeleteConversation}
                                        onRenomearConversa={onRenameConversation}
                                    />
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="mb-1.5 px-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-[#606877]">
                                Conversas
                            </div>

                            <div className="space-y-1">
                                {conversasVazias && (
                                    <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-3 text-[12.5px] text-[#707887]">
                                        Nenhuma conversa encontrada.
                                    </div>
                                )}

                                {standaloneConversations.map((conversation) => (
                                    <div
                                        key={conversation.id}
                                        onContextMenu={(event) => {
                                            if (projects.length === 0) return
                                            event.preventDefault()
                                            const nomesProjetos = projects.map((project) => project.name).join('\n')
                                            const escolha = prompt(
                                                `Mover "${conversation.title}" para qual projeto?\n\nProjetos disponíveis:\n${nomesProjetos}\n\nDigite o nome do projeto:`
                                            )

                                            if (escolha) {
                                                const projetoDestino = projects.find((project) => (
                                                    project.name.toLowerCase() === escolha.toLowerCase()
                                                ))

                                                if (projetoDestino) {
                                                    onMoveConversationToProject(conversation.id, projetoDestino.id)
                                                } else {
                                                    alert('Projeto não encontrado')
                                                }
                                            }
                                        }}
                                    >
                                        <SidebarItem
                                            icon={MessageSquare}
                                            label={conversation.title}
                                            active={conversation.id === activeConversationId}
                                            variante="chat-expandida"
                                            onClick={() => onSelectConversation(conversation.id)}
                                            onDelete={() => onDeleteConversation(conversation.id)}
                                            onRename={(novoTitulo) => onRenameConversation(conversation.id, novoTitulo)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="border-t border-white/[0.04] pt-3">
                        <div ref={areaPerfilRef} className="relative">
                            <button
                                type="button"
                                onClick={onAlternarPerfil}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                                    perfilAberto
                                        ? 'border-white/[0.08] bg-white/[0.05] text-white'
                                        : 'border-white/[0.05] bg-white/[0.02] text-[#c8ced8] hover:bg-white/[0.04] hover:text-white'
                                }`}
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.06] bg-[#14161b] text-[12px] font-semibold text-white">
                                    {fotoPerfil ? (
                                        <img
                                            src={fotoPerfil}
                                            alt={nomePerfil || 'Perfil'}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        iniciaisPerfil || 'S'
                                    )}
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium">{nomePerfil || 'Pessoal'}</span>
                                </span>

                                <ChevronDown size={15} className={`text-[#7c8492] transition-transform ${perfilAberto ? 'rotate-180' : ''}`} />
                            </button>

                            <PopoverPerfilChat
                                aberto={perfilAberto}
                                onClose={onFecharPerfil}
                                onAbrirPerfil={onAbrirPerfil}
                                onAbrirPersonalizacao={onAbrirPersonalizacao}
                                onAbrirConfiguracao={onAbrirConfiguracao}
                                className="bottom-full left-0 mb-3 w-[280px]"
                                areaAncoraRef={areaPerfilRef}
                            />
                        </div>
                    </div>
            </motion.div>
        </motion.aside>
    )
}
