import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    ArrowUp,
    Check,
    ChevronDown,
    ChevronRight,
    FolderOpen,
    MessageSquare,
    Paperclip,
    Palette,
    Pencil,
    Plus,
    Trash2,
    X,
    FileCode,
    FilePlus,
    Files,
} from 'lucide-react'
import type { Project, ProjectFile } from '../../../../types/project'
import type { Conversation } from '../types'

const CORES_PROJETO = [
    '#FFD700',
    '#7C3AED',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#EC4899',
    '#6366F1',
    '#14B8A6',
    '#8B5CF6',
]

interface ProjectViewProps {
    project: Project
    conversations: Conversation[]
    onClose: () => void
    onDeleteProject: () => void
    onRenameProject: (newName: string) => void
    onUpdateProject: (updates: Partial<Project>) => void
    onRenameFile: (fileId: string, newName: string) => void
    onRemoveFile: (fileId: string) => void
    onDeleteConversation: (convId: string) => void
    onRenameConversation: (convId: string, newTitle: string) => void
    onUploadFiles: () => void
    onSelectConversation: (convId: string) => void
    chatInput: string
    onChatInputChange: (value: string) => void
    onCreateChat: () => void
    chatInputRef: React.RefObject<HTMLInputElement | null>
    pendingScreenshots: string[]
    onRemoveScreenshot: (index: number) => void
    onAddImages: (files: File[]) => void
    onChatPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void
}

export const ProjectView: React.FC<ProjectViewProps> = ({
    project,
    conversations,
    onClose,
    onDeleteProject,
    onRenameProject,
    onUpdateProject,
    onRenameFile,
    onRemoveFile,
    onDeleteConversation,
    onRenameConversation,
    onUploadFiles,
    onSelectConversation,
    chatInput,
    onChatInputChange,
    onCreateChat,
    chatInputRef,
    pendingScreenshots,
    onRemoveScreenshot,
    onAddImages,
    onChatPaste,
}) => {
    const projectConvs = conversations.filter((conversation) => conversation.projectId === project.id)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showInstructions, setShowInstructions] = useState(false)
    const [conversaEditandoId, setConversaEditandoId] = useState<string | null>(null)
    const [tituloConversaEditado, setTituloConversaEditado] = useState('')
    const [arquivoEditandoId, setArquivoEditandoId] = useState<string | null>(null)
    const [nomeArquivoEditado, setNomeArquivoEditado] = useState('')
    const [mostrarTodasConversas, setMostrarTodasConversas] = useState(false)
    const [mostrarTodosArquivos, setMostrarTodosArquivos] = useState(false)
    const [arquivoSelecionadoId, setArquivoSelecionadoId] = useState<string | null>(null)
    const inputImagensRef = useRef<HTMLInputElement>(null)
    const corAtual = project.color || '#FFD700'

    const LIMITE_ITENS_LISTA = 4
    const conversasExibidas = mostrarTodasConversas ? projectConvs : projectConvs.slice(0, LIMITE_ITENS_LISTA)
    const arquivosExibidos = mostrarTodosArquivos ? project.files : project.files.slice(0, LIMITE_ITENS_LISTA)
    const arquivoSelecionado = arquivoSelecionadoId ? project.files.find((f) => f.id === arquivoSelecionadoId) : undefined

    const placeholderComposer = pendingScreenshots.length > 0
        ? `Descreva as imagens do novo chat em ${project.name}`
        : `Novo chat em ${project.name}`

    const iniciarEdicaoConversa = (conversa: Conversation) => {
        setConversaEditandoId(conversa.id)
        setTituloConversaEditado(conversa.title)
    }

    const cancelarEdicaoConversa = () => {
        setConversaEditandoId(null)
        setTituloConversaEditado('')
    }

    const salvarEdicaoConversa = (convId: string) => {
        const tituloNormalizado = tituloConversaEditado.trim()

        if (!tituloNormalizado) {
            cancelarEdicaoConversa()
            return
        }

        onRenameConversation(convId, tituloNormalizado)
        cancelarEdicaoConversa()
    }

    const iniciarEdicaoArquivo = (arquivo: ProjectFile) => {
        setArquivoEditandoId(arquivo.id)
        setNomeArquivoEditado(arquivo.name)
    }

    const cancelarEdicaoArquivo = () => {
        setArquivoEditandoId(null)
        setNomeArquivoEditado('')
    }

    const salvarEdicaoArquivo = (fileId: string) => {
        const nomeNormalizado = nomeArquivoEditado.trim()

        if (!nomeNormalizado) {
            cancelarEdicaoArquivo()
            return
        }

        onRenameFile(fileId, nomeNormalizado)
        cancelarEdicaoArquivo()
    }

    const formatarTamanhoArquivo = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const formatarTipoArquivo = (tipo: ProjectFile['type']) => tipo.toUpperCase()

    const podeCriarChat = chatInput.trim().length > 0 || pendingScreenshots.length > 0

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 z-20 flex flex-col bg-[#0a0a0c] pointer-events-auto"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
                        aria-label="Voltar para o chat"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="relative shrink-0">
                        <button
                            onClick={() => setShowColorPicker((value) => !value)}
                            className="group rounded-2xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
                            title="Mudar cor da pasta"
                        >
                            <FolderOpen size={24} style={{ color: corAtual }} />
                            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-800 bg-neutral-700 opacity-0 transition-opacity group-hover:opacity-100">
                                <Palette size={8} className="text-neutral-300" />
                            </div>
                        </button>

                        <AnimatePresence>
                            {showColorPicker && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="absolute left-0 top-full z-50 mt-2 w-44 rounded-xl border border-white/10 bg-[#16181d] p-3 shadow-xl"
                                >
                                    <p className="mb-2 text-xs text-neutral-500">Cor da pasta</p>
                                    <div className="flex flex-wrap gap-2">
                                        {CORES_PROJETO.map((cor) => (
                                            <button
                                                key={cor}
                                                onClick={() => {
                                                    onUpdateProject({ color: cor })
                                                    setShowColorPicker(false)
                                                }}
                                                className={`h-7 w-7 rounded-lg transition-transform hover:scale-110 ${
                                                    cor === corAtual ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16181d]' : ''
                                                }`}
                                                style={{ backgroundColor: cor }}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="min-w-0">
                        <input
                            type="text"
                            value={project.name}
                            onChange={(event) => onRenameProject(event.target.value)}
                            className="w-full min-w-0 rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-white outline-none transition-colors focus:border-white/10 focus:bg-white/[0.03]"
                        />
                        <p className="px-2 text-xs text-neutral-500">
                            {project.files.length} arquivo(s) e {projectConvs.length} conversa(s) vinculada(s)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onUploadFiles}
                        className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                    >
                        <FilePlus size={15} />
                        Adicionar arquivos
                    </button>
                    <button
                        onClick={() => {
                            if (confirm(`Excluir projeto "${project.name}"? As conversas serão movidas para fora.`)) {
                                onDeleteProject()
                            }
                        }}
                        className="flex items-center gap-2 rounded-xl border border-[#4d232b] bg-[#2a161b] px-3 py-2 text-sm text-[#f1bcc5] transition-colors hover:bg-[#341b22]"
                    >
                        <Trash2 size={15} />
                        Excluir projeto
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="mx-auto max-w-4xl space-y-8">
                    <div>
                        <button
                            onClick={() => setShowInstructions((value) => !value)}
                            className="mb-3 flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-neutral-300"
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
                                        onChange={(event) => onUpdateProject({ instructions: event.target.value })}
                                        placeholder="Defina o prompt-base deste projeto. Exemplo: regras, tom, formato técnico e como os arquivos devem ser usados."
                                        className="h-32 w-full resize-none bg-transparent p-0 text-sm leading-7 text-neutral-200 placeholder-neutral-500 outline-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div>
                        {pendingScreenshots.length > 0 && (
                            <div className="mb-3 flex flex-wrap items-start gap-2">
                                {pendingScreenshots.map((shot, idx) => (
                                    <div
                                        key={`shot-project-${idx}`}
                                        className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#121419]"
                                    >
                                        <img
                                            src={shot}
                                            alt={`Imagem anexada ${idx + 1}`}
                                            className="h-16 w-auto object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => onRemoveScreenshot(idx)}
                                            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                                            title="Remover imagem"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rounded-[24px] border border-white/[0.06] bg-[#1b1d22] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.14)] transition-colors focus-within:border-white/[0.1]">
                            <div className="flex items-center gap-3">
                                <Plus size={20} className="shrink-0 text-neutral-500" />
                                <input
                                    ref={chatInputRef}
                                    type="text"
                                    value={chatInput}
                                    onChange={(event) => onChatInputChange(event.target.value)}
                                    onPaste={onChatPaste}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && podeCriarChat) {
                                            onCreateChat()
                                        }
                                    }}
                                    placeholder={placeholderComposer}
                                    className="flex-1 bg-transparent text-white placeholder-neutral-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => inputImagensRef.current?.click()}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-neutral-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                                    title="Anexar imagens"
                                >
                                    <Paperclip size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={onCreateChat}
                                    disabled={!podeCriarChat}
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                                        podeCriarChat
                                            ? 'bg-[#4f6bcb] text-white hover:bg-[#5d78da]'
                                            : 'bg-white/[0.06] text-[#69707d]'
                                    }`}
                                    title="Criar conversa"
                                >
                                    <ArrowUp size={16} />
                                </button>
                            </div>

                            <input
                                ref={inputImagensRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                    const files = Array.from(event.target.files || [])
                                    if (files.length > 0) {
                                        onAddImages(files)
                                    }
                                    event.target.value = ''
                                }}
                            />
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/[0.06] bg-[#111216] p-6 shadow-[0_20px_48px_rgba(0,0,0,0.18)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                                <MessageSquare size={14} />
                                Conversas do projeto ({projectConvs.length})
                            </h3>

                            {projectConvs.length > LIMITE_ITENS_LISTA && (
                                <button
                                    onClick={() => setMostrarTodasConversas((v) => !v)}
                                    className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                                >
                                    <span>{mostrarTodasConversas ? 'Ver menos' : 'Ver todas'}</span>
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform ${mostrarTodasConversas ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            )}
                        </div>

                        {projectConvs.length === 0 ? (
                            <div className="py-12 text-center text-neutral-500">
                                <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Nenhuma conversa ainda</p>
                                <p className="mt-1 text-sm">Use o campo acima para iniciar um novo chat</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {conversasExibidas.map((conv) => {
                                    const estaEditando = conversaEditandoId === conv.id

                                    return (
                                        <div
                                            key={conv.id}
                                            className="group flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]"
                                        >
                                            <MessageSquare size={18} className="shrink-0 text-neutral-500" />

                                            <div className="min-w-0 flex-1">
                                                {estaEditando ? (
                                                    <input
                                                        type="text"
                                                        value={tituloConversaEditado}
                                                        onChange={(event) => setTituloConversaEditado(event.target.value)}
                                                        onBlur={() => salvarEdicaoConversa(conv.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                salvarEdicaoConversa(conv.id)
                                                            } else if (event.key === 'Escape') {
                                                                cancelarEdicaoConversa()
                                                            }
                                                        }}
                                                        className="w-full rounded-xl border border-white/10 bg-[#0f1116] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#6f86d6]/60"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => onSelectConversation(conv.id)}
                                                        className="w-full text-left"
                                                    >
                                                        <p className="truncate text-sm text-white">{conv.title}</p>
                                                        <p className="text-xs text-neutral-500">
                                                            {new Date(conv.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                                            {conv.messages.length > 0 && ` · ${conv.messages.length} mensagens`}
                                                        </p>
                                                    </button>
                                                )}
                                            </div>

                                            {estaEditando ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => salvarEdicaoConversa(conv.id)}
                                                        className="shrink-0 rounded-lg p-1.5 text-[#cad6ff] transition-colors hover:bg-[#2c3b68] hover:text-white"
                                                        title="Salvar nome da conversa"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={cancelarEdicaoConversa}
                                                        className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
                                                        title="Cancelar edição"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => iniciarEdicaoConversa(conv)}
                                                        className="shrink-0 rounded-lg p-1.5 text-neutral-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                                                        title="Renomear conversa"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Excluir "${conv.title}"?`)) {
                                                                onDeleteConversation(conv.id)
                                                            }
                                                        }}
                                                        className="shrink-0 rounded-lg p-1.5 text-neutral-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
                                                        title="Excluir conversa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <ChevronRight size={16} className="shrink-0 text-neutral-600 transition-colors group-hover:text-neutral-400" />
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    <section className="rounded-[28px] border border-white/[0.06] bg-[#111216] p-6 shadow-[0_20px_48px_rgba(0,0,0,0.18)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                                <Files size={14} />
                                Arquivos de projeto ({project.files.length})
                            </h3>

                            <div className="flex items-center gap-2">
                                {project.files.length > LIMITE_ITENS_LISTA && (
                                    <button
                                        onClick={() => setMostrarTodosArquivos((v) => !v)}
                                        className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                                    >
                                        <span>{mostrarTodosArquivos ? 'Ver menos' : 'Ver todos'}</span>
                                        <ChevronDown
                                            size={14}
                                            className={`transition-transform ${mostrarTodosArquivos ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                )}

                                <button
                                    onClick={onUploadFiles}
                                    className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                                >
                                    <FilePlus size={15} />
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {project.files.length === 0 ? (
                            <div className="py-10 text-center text-neutral-500">
                                <Files size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Nenhum arquivo anexado</p>
                                <p className="mt-1 text-sm">Adicione documentos para usar como contexto do projeto</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {arquivosExibidos.map((arquivo) => {
                                        const estaEditando = arquivoEditandoId === arquivo.id
                                        const estaSelecionado = arquivoSelecionadoId === arquivo.id

                                        return (
                                            <button
                                                type="button"
                                                key={arquivo.id}
                                                onClick={() => {
                                                    if (estaEditando) return
                                                    setArquivoSelecionadoId((prev) => (prev === arquivo.id ? null : arquivo.id))
                                                }}
                                                className={`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                                                    estaSelecionado
                                                        ? 'border-[#6f86d6]/40 bg-[#6f86d6]/10'
                                                        : 'border-white/[0.05] bg-white/[0.03] hover:bg-white/[0.05]'
                                                }`}
                                            >
                                                <FileCode size={18} className="shrink-0 text-neutral-500" />

                                                <div className="min-w-0 flex-1">
                                                    {estaEditando ? (
                                                        <input
                                                            type="text"
                                                            value={nomeArquivoEditado}
                                                            onChange={(event) => setNomeArquivoEditado(event.target.value)}
                                                            onBlur={() => salvarEdicaoArquivo(arquivo.id)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter') {
                                                                    salvarEdicaoArquivo(arquivo.id)
                                                                } else if (event.key === 'Escape') {
                                                                    cancelarEdicaoArquivo()
                                                                }
                                                            }}
                                                            onClick={(event) => event.stopPropagation()}
                                                            className="w-full rounded-xl border border-white/10 bg-[#0f1116] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#6f86d6]/60"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <>
                                                            <p className="truncate text-sm text-white">{arquivo.name}</p>
                                                            <p className="text-xs text-neutral-500">
                                                                {formatarTipoArquivo(arquivo.type)} · {formatarTamanhoArquivo(arquivo.size)}
                                                                {' · '}
                                                                {new Date(arquivo.addedAt).toLocaleDateString('pt-BR', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                })}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>

                                                {estaEditando ? (
                                                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => salvarEdicaoArquivo(arquivo.id)}
                                                            className="shrink-0 rounded-lg p-1.5 text-[#cad6ff] transition-colors hover:bg-[#2c3b68] hover:text-white"
                                                            title="Salvar nome do arquivo"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={cancelarEdicaoArquivo}
                                                            className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
                                                            title="Cancelar edição"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => iniciarEdicaoArquivo(arquivo)}
                                                            className="shrink-0 rounded-lg p-1.5 text-neutral-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                                                            title="Renomear arquivo"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (confirm(`Remover "${arquivo.name}" do projeto?`)) {
                                                                    if (arquivoSelecionadoId === arquivo.id) setArquivoSelecionadoId(null)
                                                                    onRemoveFile(arquivo.id)
                                                                }
                                                            }}
                                                            className="shrink-0 rounded-lg p-1.5 text-neutral-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
                                                            title="Remover arquivo"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <ChevronRight
                                                            size={16}
                                                            className={`shrink-0 transition-colors ${
                                                                estaSelecionado ? 'text-neutral-300' : 'text-neutral-600 group-hover:text-neutral-400'
                                                            }`}
                                                        />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>

                                <AnimatePresence>
                                    {arquivoSelecionado && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 overflow-hidden"
                                        >
                                            <div className="rounded-2xl border border-white/[0.07] bg-[#0f1014] p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-white">{arquivoSelecionado.name}</p>
                                                        <p className="mt-0.5 text-xs text-neutral-500">
                                                            {formatarTipoArquivo(arquivoSelecionado.type)} · {formatarTamanhoArquivo(arquivoSelecionado.size)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setArquivoSelecionadoId(null)}
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                                                        title="Fechar visualização"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/[0.06] bg-black/20 p-3 text-sm leading-6 text-neutral-200 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                                                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-neutral-200">
                                                        {arquivoSelecionado.content?.trim() ? arquivoSelecionado.content : 'Arquivo sem texto extraível.'}
                                                    </pre>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </motion.div>
    )
}
