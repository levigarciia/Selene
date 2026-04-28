import React from 'react'
import { motion } from 'framer-motion'
import { Brain, Check, ChevronDown, Pencil, Sparkles, Terminal, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../../../../types/chat'
import type { WebSource } from '../types'
import type { ToolCardData } from '../../../../types/tools'
import { ToolCard } from '../../../chat/ToolCard'
import { MessageActions } from './MessageActions'
import { renderizarNosComFontes } from '../utils'

interface MessageListProps {
    messages: ChatMessage[]
    messagesContainerRef: React.RefObject<HTMLDivElement | null>
    messagesEndRef: React.RefObject<HTMLDivElement | null>
    isGenerating: boolean
    isAnalyzingImage: boolean
    messageSources: Record<string, WebSource[]>
    messageSearchCards: Record<string, ToolCardData[]>
    expandedSources: string | null
    onToggleSources: (msgId: string) => void
    copiedMessageId: string | null
    onCopyMessage: (msgId: string, content: string) => void
    onEditUserMessage: (msgId: string, content: string) => void
    onRegenerateResponse: () => void
    profileName?: string
    hasInvestigationTrace?: boolean
    onShowReasoning?: () => void
}

interface BlocoMarkdownMensagemProps {
    conteudo: string
    fontesDaMensagem: WebSource[]
    mostrarCursor: boolean
    ultimaMensagem: boolean
    papel: string
    estaGerando: boolean
}

const BlocoMarkdownMensagem = React.memo(({
    conteudo,
    fontesDaMensagem,
    mostrarCursor,
    ultimaMensagem,
    papel,
    estaGerando,
}: BlocoMarkdownMensagemProps) => (
    <div
        data-bloco-mensagem="true"
        className={`w-full min-w-0 break-words select-text px-4 py-3 rounded-2xl text-sm leading-relaxed ${papel === 'user'
            ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/30'
            : 'bg-neutral-800/60 border border-white/5 text-neutral-200 rounded-tl-sm'
            } ${mostrarCursor && estaGerando && ultimaMensagem && papel === 'assistant'
                ? "[&>*:last-child]:after:content-[''] [&>*:last-child]:after:inline-block [&>*:last-child]:after:w-2.5 [&>*:last-child]:after:h-2.5 [&>*:last-child]:after:bg-purple-400 [&>*:last-child]:after:rounded-full [&>*:last-child]:after:ml-1.5 [&>*:last-child]:after:align-baseline [&>*:last-child]:after:animate-pulse"
                : ''
            }`}
        style={{ WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
    >
        {mostrarCursor && estaGerando && ultimaMensagem && papel === 'assistant' && !conteudo && (
            <div className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse" />
        )}
        <ReactMarkdown
            components={{
                p: ({ children }) => (
                    <p className="mb-2 break-words last:mb-0">
                        {renderizarNosComFontes(children, fontesDaMensagem)}
                    </p>
                ),
                strong: ({ children }) => (
                    <strong className="font-semibold text-white">
                        {renderizarNosComFontes(children, fontesDaMensagem)}
                    </strong>
                ),
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc list-outside space-y-1 break-words marker:text-purple-400">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal list-outside space-y-1 break-words marker:text-purple-400">{children}</ol>,
                li: ({ children }) => (
                    <li className="pl-1">
                        {renderizarNosComFontes(children, fontesDaMensagem)}
                    </li>
                ),
                code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !String(children).includes('\n')
                    return isInline ? (
                        <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-purple-200 border border-white/5 break-all" {...props}>
                            {children}
                        </code>
                    ) : (
                        <div className="my-3 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10 bg-[#0d1117]">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                <div className="flex items-center gap-1.5">
                                    <Terminal size={12} className="text-white/40" />
                                    <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{match?.[1] || 'code'}</span>
                                </div>
                            </div>
                            <div className="min-w-0 max-w-full overflow-x-auto p-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-purple-400/40">
                                <code className="block min-w-full w-max text-xs font-mono whitespace-pre text-neutral-300" {...props}>
                                    {children}
                                </code>
                            </div>
                        </div>
                    )
                },
                a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                        {children}
                    </a>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="my-2 rounded-r border-l-2 border-purple-500/50 bg-purple-500/5 py-1 pl-3 text-sm italic text-white/70 break-words">
                        {renderizarNosComFontes(children, fontesDaMensagem)}
                    </blockquote>
                ),
            }}
        >
            {conteudo}
        </ReactMarkdown>
    </div>
), (anterior, atual) => (
    anterior.conteudo === atual.conteudo
    && anterior.fontesDaMensagem === atual.fontesDaMensagem
    && anterior.mostrarCursor === atual.mostrarCursor
    && anterior.ultimaMensagem === atual.ultimaMensagem
    && anterior.papel === atual.papel
    && anterior.estaGerando === atual.estaGerando
))

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    messagesContainerRef,
    messagesEndRef,
    isGenerating,
    isAnalyzingImage,
    messageSources,
    messageSearchCards,
    expandedSources,
    onToggleSources,
    copiedMessageId,
    onCopyMessage,
    onEditUserMessage,
    onRegenerateResponse,
    hasInvestigationTrace,
    onShowReasoning,
}) => {
    const [raciocinioExpandidoPorMensagem, setRaciocinioExpandidoPorMensagem] = React.useState<Record<string, boolean>>({})
    const [mensagemEmEdicaoId, setMensagemEmEdicaoId] = React.useState<string | null>(null)
    const [conteudoEditado, setConteudoEditado] = React.useState('')

    const cancelarEdicao = React.useCallback(() => {
        setMensagemEmEdicaoId(null)
        setConteudoEditado('')
    }, [])

    const iniciarEdicao = React.useCallback((mensagem: ChatMessage) => {
        setMensagemEmEdicaoId(mensagem.id)
        setConteudoEditado(mensagem.content)
    }, [])

    const salvarEdicao = React.useCallback((mensagem: ChatMessage) => {
        const conteudoNormalizado = conteudoEditado.trim()
        const podeSalvarSemTexto = (mensagem.images?.length || 0) > 0

        if (!conteudoNormalizado && !podeSalvarSemTexto) return

        if (conteudoNormalizado !== mensagem.content) {
            onEditUserMessage(mensagem.id, conteudoNormalizado)
        }

        cancelarEdicao()
    }, [cancelarEdicao, conteudoEditado, onEditUserMessage])

    React.useEffect(() => {
        if (mensagemEmEdicaoId && !messages.some((mensagem) => mensagem.id === mensagemEmEdicaoId)) {
            cancelarEdicao()
        }
    }, [cancelarEdicao, mensagemEmEdicaoId, messages])

    const renderMarkdown = (
        content: string,
        fontesDaMensagem: WebSource[],
        showCursor: boolean,
        isLastMessage: boolean,
        role: string
    ) => (
        <BlocoMarkdownMensagem
            conteudo={content}
            fontesDaMensagem={fontesDaMensagem}
            mostrarCursor={showCursor}
            ultimaMensagem={isLastMessage}
            papel={role}
            estaGerando={isGenerating}
        />
    )

    const renderBlocoRaciocinio = (msgId: string, raciocinio: string) => {
        const expandido = Boolean(raciocinioExpandidoPorMensagem[msgId])
        return (
            <div className="w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50">
                <button
                    type="button"
                    onClick={() => setRaciocinioExpandidoPorMensagem((prev) => ({ ...prev, [msgId]: !expandido }))}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                    <span className="flex items-center gap-2 text-xs text-neutral-300">
                        <Brain size={14} className="text-purple-300" />
                        Raciocínio do modelo
                    </span>
                    <ChevronDown size={14} className={`text-neutral-500 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                </button>
                {expandido && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5">
                        <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">{raciocinio}</p>
                    </div>
                )}
            </div>
        )
    }

    const renderEditorMensagem = (mensagem: ChatMessage) => (
        <div className="w-full min-w-0 rounded-2xl rounded-tr-sm border border-white/10 bg-[#171a22] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <textarea
                value={conteudoEditado}
                onChange={(event) => setConteudoEditado(event.target.value)}
                onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault()
                        salvarEdicao(mensagem)
                    } else if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelarEdicao()
                    }
                }}
                className="min-h-[96px] w-full resize-none rounded-2xl border border-white/10 bg-[#0f1218] px-3 py-2 text-sm leading-relaxed text-white outline-none transition-colors focus:border-[#6f86d6]/60"
                placeholder="Edite sua mensagem"
                autoFocus
            />

            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-neutral-500">
                    {mensagem.images?.length
                        ? 'Ctrl/Cmd + Enter salva sem remover os anexos.'
                        : 'Ctrl/Cmd + Enter salva a edição.'}
                </span>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={cancelarEdicao}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                        title="Cancelar edição"
                    >
                        <X size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => salvarEdicao(mensagem)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#6f86d6]/30 bg-[#6f86d6]/15 text-[#d9e2ff] transition-colors hover:bg-[#6f86d6]/25"
                        title="Salvar edição"
                    >
                        <Check size={14} />
                    </button>
                </div>
            </div>
        </div>
    )

    return (
        <main
            ref={messagesContainerRef}
            className="flex-1 min-h-0 min-w-0 space-y-5 overflow-x-hidden overflow-y-auto bg-transparent px-8 py-8 select-text [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
            style={{
                WebkitAppRegion: 'no-drag',
                WebkitUserSelect: 'text',
                userSelect: 'text',
                WebkitUserDrag: 'none',
            } as React.CSSProperties}
        >
            {messages.map((msg, index) => {
                const fontesDaMensagem = messageSources[msg.id] || []
                const isLastMessage = index === messages.length - 1
                const raciocinioDaMensagem = (msg.raciocinio || '').trim()
                const estaEditandoMensagem = msg.role === 'user' && mensagemEmEdicaoId === msg.id

                // Hide the AI bubble when analyzing image
                const shouldHideForImageAnalysis = isAnalyzingImage && isLastMessage && msg.role === 'assistant' && !msg.content
                if (shouldHideForImageAnalysis) return null

                const hasCards = msg.role === 'assistant' && messageSearchCards[msg.id]?.length > 0

                return (
                    <div
                        key={msg.id}
                        className={`flex min-w-0 max-w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2c2f39] bg-[#1a1c21]">
                                <Sparkles size={14} className="text-[#919ec2]" />
                            </div>
                        )}

                        <div className={`flex min-w-0 max-w-[min(72%,58rem)] flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.role === 'assistant' && raciocinioDaMensagem && renderBlocoRaciocinio(msg.id, raciocinioDaMensagem)}
                            {(() => {
                                if (hasCards) {
                                    const cards = messageSearchCards[msg.id] || []
                                    return (
                                        <>
                                            {cards.map((card, cardIdx) => (
                                                <React.Fragment key={`tool-group-${msg.id}-${cardIdx}`}>
                                                    <ToolCard
                                                        key={`tool-${msg.id}-${cardIdx}`}
                                                        data={card}
                                                    />
                                                </React.Fragment>
                                            ))}
                                            {estaEditandoMensagem
                                                ? renderEditorMensagem(msg)
                                                : msg.content && renderMarkdown(msg.content, fontesDaMensagem, true, isLastMessage, msg.role)}
                                        </>
                                    )
                                }

                                if (msg.role === 'user' && msg.images && msg.images.length > 0) {
                                    return (
                                        <>
                                            <div className={`flex max-w-full flex-wrap gap-2 ${msg.images.length > 1 ? 'max-w-75' : ''}`}>
                                                {msg.images.map((img, imgIdx) => (
                                                    <div key={imgIdx} className="relative group/img">
                                                        <img
                                                            src={img}
                                                            alt={`Anexo ${imgIdx + 1}`}
                                                            className="max-h-50 max-w-50 cursor-pointer rounded-xl border border-white/10 object-cover transition-opacity hover:opacity-90"
                                                            draggable={false}
                                                            onClick={() => window.open(img, '_blank')}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {estaEditandoMensagem
                                                ? renderEditorMensagem(msg)
                                                : msg.content && renderMarkdown(msg.content, fontesDaMensagem, false, isLastMessage, msg.role)}
                                        </>
                                    )
                                }

                                if (estaEditandoMensagem) {
                                    return renderEditorMensagem(msg)
                                }

                                return renderMarkdown(msg.content, fontesDaMensagem, true, isLastMessage, msg.role)
                            })()}

                            <div className="mt-1 flex max-w-full flex-wrap items-center gap-2 px-1">
                                <span className="text-[10px] text-neutral-600">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.role === 'user' && !estaEditandoMensagem && (
                                    <button
                                        type="button"
                                        onClick={() => iniciarEdicao(msg)}
                                        disabled={isGenerating}
                                        className="rounded-lg p-1.5 text-neutral-500 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Editar mensagem"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                )}
                                {msg.role === 'assistant' && (
                                    <MessageActions
                                        onCopy={() => onCopyMessage(msg.id, msg.content)}
                                        onRegenerate={onRegenerateResponse}
                                        copied={copiedMessageId === msg.id}
                                        canRegenerate={isLastMessage && !isGenerating}
                                        sources={messageSources[msg.id]}
                                        sourcesExpanded={expandedSources === msg.id}
                                        onToggleSources={() => onToggleSources(msg.id)}
                                        hasInvestigationTrace={hasInvestigationTrace && isLastMessage}
                                        onShowReasoning={onShowReasoning}
                                    />
                                )}
                            </div>
                        </div>

                        {msg.role === 'user' && (
                            <div className="ml-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#202329]">
                                <div className="h-3 w-3 rounded-full bg-[#6c7483]" />
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Analyzing Image Indicator */}
            {isAnalyzingImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 py-4"
                >
                    <div className="flex items-center gap-2 text-neutral-400">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm">Analisando imagem selecionada</span>
                    </div>
                </motion.div>
            )}

            <div ref={messagesEndRef} />
        </main>
    )
}
