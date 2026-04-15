import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, FolderClosed, Settings, Sparkles } from 'lucide-react'
import type { ItemHubContexto } from '../tiposShellChat'

interface HubContextoChatProps {
    aberto: boolean
    itens: ItemHubContexto[]
    provedor: string
    modelo: string
    perfilLatencia: string
    onClose: () => void
    onSelecionarAssistente: (assistantId: string | null) => void
    onSelecionarProjeto: (projectId: string) => void
    onAbrirAssistentes: () => void
    onAbrirProjetos: () => void
    onAbrirConfiguracoes: () => void
}

export const HubContextoChat: React.FC<HubContextoChatProps> = ({
    aberto,
    itens,
    provedor,
    modelo,
    perfilLatencia,
    onClose,
    onSelecionarAssistente,
    onSelecionarProjeto,
    onAbrirAssistentes,
    onAbrirProjetos,
    onAbrirConfiguracoes,
}) => {
    const assistentes = itens.filter((item) => item.tipo === 'assistente')
    const projetos = itens.filter((item) => item.tipo === 'projeto')

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
                        className="absolute inset-0 z-20"
                        aria-label="Fechar hub de contexto"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute left-3 top-14 z-30 w-[420px] rounded-3xl border border-white/[0.06] bg-[#121417] p-4 shadow-2xl"
                    >
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-white">Selecionar contexto</p>
                                <p className="text-xs text-[#88909d]">Escolha assistentes e projetos sem sair do chat.</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-right text-xs text-[#a0a7b4]">
                                <div>{provedor}</div>
                                <div className="text-white">{modelo}</div>
                                <div>{perfilLatencia}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <section className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#68707d]">Assistentes</div>
                                    <button
                                        type="button"
                                        onClick={onAbrirAssistentes}
                                        className="text-[11px] text-[#9fb4de] transition-colors hover:text-white"
                                    >
                                        Abrir painel
                                    </button>
                                </div>

                                {assistentes.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onSelecionarAssistente(item.assistantId ?? null)}
                                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                                            item.ativo
                                                ? 'border-[#5b57b0]/60 bg-[#201f38] text-white'
                                                : 'border-white/[0.05] bg-white/[0.03] text-[#d6dbe5] hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Bot size={15} className="text-[#b8b6ff]" />
                                            <span className="truncate text-[13px] font-medium">{item.titulo}</span>
                                        </div>
                                        <div className="mt-1 text-[11px] text-[#88909d]">{item.descricao}</div>
                                    </button>
                                ))}
                            </section>

                            <section className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#68707d]">Projetos</div>
                                    <button
                                        type="button"
                                        onClick={onAbrirProjetos}
                                        className="text-[11px] text-[#9fb4de] transition-colors hover:text-white"
                                    >
                                        Ver recentes
                                    </button>
                                </div>

                                {projetos.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => item.projectId && onSelecionarProjeto(item.projectId)}
                                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                                            item.ativo
                                                ? 'border-[#5b57b0]/60 bg-[#201f38] text-white'
                                                : 'border-white/[0.05] bg-white/[0.03] text-[#d6dbe5] hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FolderClosed size={15} className="text-[#f0c769]" />
                                            <span className="truncate text-[13px] font-medium">{item.titulo}</span>
                                        </div>
                                        <div className="mt-1 text-[11px] text-[#88909d]">{item.descricao}</div>
                                    </button>
                                ))}
                            </section>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={onAbrirAssistentes}
                                className="flex items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-sm text-[#d7dce6] transition-colors hover:bg-white/[0.06]"
                            >
                                <Sparkles size={15} className="text-[#b8b6ff]" />
                                Gerenciar assistentes
                            </button>
                            <button
                                type="button"
                                onClick={onAbrirConfiguracoes}
                                className="flex items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-sm text-[#d7dce6] transition-colors hover:bg-white/[0.06]"
                            >
                                <Settings size={15} className="text-[#9fb4de]" />
                                Ajustar provedor
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
