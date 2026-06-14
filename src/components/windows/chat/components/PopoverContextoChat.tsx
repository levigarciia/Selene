import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Check, FolderClosed, Images, Plug } from 'lucide-react'
import type { ItemHubContexto, ResumoContextoAtivo } from '../tiposShellChat'

interface PopoverContextoChatProps {
    aberto: boolean
    resumo: ResumoContextoAtivo
    itensContexto: ItemHubContexto[]
    onClose: () => void
    onSelecionarAssistente: (assistantId: string | null) => void
    onSelecionarProjeto: (projectId: string) => void
}

export const PopoverContextoChat: React.FC<PopoverContextoChatProps> = ({
    aberto,
    resumo,
    itensContexto,
    onClose,
    onSelecionarAssistente,
    onSelecionarProjeto,
}) => {
    const assistentes = itensContexto.filter((item) => item.tipo === 'assistente')
    const projetos = itensContexto.filter((item) => item.tipo === 'projeto')
    const imagens = resumo.itens.find((item) => item.id === 'imagens')
    const apps = resumo.itens.find((item) => item.id === 'apps')

    return (
        <AnimatePresence>
            {aberto && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-full left-0 z-50 mb-3 w-[320px] rounded-3xl border border-white/[0.08] bg-[#111216] p-4 shadow-2xl"
                >
                    <div className="mb-3 flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-white">Contexto ativo</p>
                            <p className="text-xs text-[#88909d]">Tudo que está influenciando a próxima resposta.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-2 py-1 text-xs text-[#96a0b0] transition-colors hover:bg-white/[0.05] hover:text-white"
                        >
                            Fechar
                        </button>
                    </div>

                    <div className="space-y-3">
                        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                                    <Bot size={14} className="text-[#b8b6ff]" />
                                    Assistente
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {assistentes.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onSelecionarAssistente(item.assistantId ?? null)}
                                        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                                            item.ativo
                                                ? 'border-[#5b57b0]/55 bg-[#201f38] text-white'
                                                : 'border-white/[0.04] bg-white/[0.02] text-[#d6dbe5] hover:bg-white/[0.05]'
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-[12px] font-medium">{item.titulo}</span>
                                            <span className="mt-0.5 block truncate text-[11px] text-[#88909d]">
                                                {item.descricao}
                                            </span>
                                        </span>
                                        {item.ativo && <Check size={13} className="mt-0.5 shrink-0 text-[#b8b6ff]" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                                    <FolderClosed size={14} className="text-[#f0c769]" />
                                    Projeto
                                </div>
                            </div>

                            {projetos.length > 0 ? (
                                <div className="space-y-1.5">
                                    {projetos.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => item.projectId && onSelecionarProjeto(item.projectId)}
                                            className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                                                item.ativo
                                                    ? 'border-[#5b57b0]/55 bg-[#201f38] text-white'
                                                    : 'border-white/[0.04] bg-white/[0.02] text-[#d6dbe5] hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-[12px] font-medium">{item.titulo}</span>
                                                <span className="mt-0.5 block truncate text-[11px] text-[#88909d]">
                                                    {item.descricao}
                                                </span>
                                            </span>
                                            {item.ativo && <Check size={13} className="mt-0.5 shrink-0 text-[#b8b6ff]" />}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[12px] text-[#98a0ae]">
                                    Sem contexto de projeto
                                </div>
                            )}
                        </section>

                        <div className="grid grid-cols-2 gap-2">
                            {[imagens, apps].filter(Boolean).map((item) => (
                                <div
                                    key={item!.id}
                                    className={`rounded-2xl border px-3 py-3 ${
                                        item!.ativo
                                            ? 'border-white/[0.08] bg-white/[0.04] text-white'
                                            : 'border-white/[0.04] bg-white/[0.02] text-[#98a0ae]'
                                    }`}
                                >
                                    <div className="mb-1 flex items-center gap-2 text-[12px] font-medium">
                                        {item!.id === 'imagens'
                                            ? <Images size={13} className="text-[#9fb4de]" />
                                            : <Plug size={13} className="text-[#9fb4de]" />}
                                        {item!.titulo}
                                    </div>
                                    <div className="truncate text-[11px] text-[#88909d]">{item!.descricao}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
