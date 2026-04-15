import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Search, Wrench } from 'lucide-react'
import type { ResumoContextoAtivo } from '../tiposShellChat'

interface PopoverContextoChatProps {
    aberto: boolean
    resumo: ResumoContextoAtivo
    onClose: () => void
}

export const PopoverContextoChat: React.FC<PopoverContextoChatProps> = ({
    aberto,
    resumo,
    onClose,
}) => {
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

                    <div className="space-y-2">
                        {resumo.itens.map((item) => (
                            <div
                                key={item.id}
                                className={`rounded-2xl border px-3 py-3 ${
                                    item.ativo
                                        ? 'border-white/[0.08] bg-white/[0.04] text-white'
                                        : 'border-white/[0.04] bg-white/[0.02] text-[#98a0ae]'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[13px] font-medium">{item.titulo}</span>
                                    {item.quantidade ? (
                                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">
                                            {item.quantidade}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-1 text-[11px] text-[#88909d]">{item.descricao}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-xs text-[#a0a7b4]">
                        <div className="flex items-center justify-between">
                            <span>Provedor</span>
                            <span className="text-white">{resumo.provedor}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                            <span>Modelo</span>
                            <span className="max-w-[160px] truncate text-white">{resumo.modelo}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                            <span>Latência</span>
                            <span className="text-white">{resumo.perfilLatencia}</span>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[#88909d]">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${resumo.webSearchEnabled ? 'bg-[#223149] text-[#a8bee8]' : 'bg-white/[0.04]'}`}>
                            <Globe size={12} />
                            Web
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${resumo.investigateMode ? 'bg-[#30274a] text-[#c2b7ff]' : 'bg-white/[0.04]'}`}>
                            <Search size={12} />
                            Investigar
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${resumo.toolCallingAtivo ? 'bg-[#23382f] text-[#a8d8c4]' : 'bg-white/[0.04]'}`}>
                            <Wrench size={12} />
                            Tools
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
