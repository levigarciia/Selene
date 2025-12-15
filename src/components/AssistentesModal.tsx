import { forwardRef, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Save, Check, X, Sparkles, Wand2, Trash } from 'lucide-react'
import { ASSISTENTES_PADRAO, criarAssistenteVazio } from '../utils/assistentesPadrao'
import type { AssistenteConfig } from '../utils/assistentesPadrao'

type AssistentesModalProps = {
    aberto: boolean
    aoFechar: () => void
    assistentes: AssistenteConfig[]
    assistenteSelecionadoId: string
    aoSelecionar: (id: string) => void
    aoSalvar: (assistente: AssistenteConfig) => void
    aoAdicionar: (assistente: AssistenteConfig) => void
    aoAplicar: (assistente: AssistenteConfig) => void
    aoRestaurarPadrao: () => void
    aoRemover: (id: string) => void
}

const AssistentesModal = forwardRef<HTMLDivElement, AssistentesModalProps>(({
    aberto,
    aoFechar,
    assistentes,
    assistenteSelecionadoId,
    aoSelecionar,
    aoSalvar,
    aoAdicionar,
    aoAplicar,
    aoRestaurarPadrao,
    aoRemover
}, ref) => {
    const assistenteAtual = useMemo(
        () => assistentes.find((a) => a.id === assistenteSelecionadoId) ?? assistentes[0] ?? ASSISTENTES_PADRAO[0],
        [assistentes, assistenteSelecionadoId]
    )

    const [rascunho, setRascunho] = useState<AssistenteConfig>(assistenteAtual)

    useEffect(() => {
        if (assistenteAtual) {
            setRascunho(assistenteAtual)
        }
    }, [assistenteAtual?.id])

    const salvarAtual = () => {
        aoSalvar(rascunho)
    }

    const aplicarNaSessao = () => {
        aoSalvar(rascunho)
        aoAplicar(rascunho)
        aoFechar()
    }

    const removerAssistente = (id: string, origem: AssistenteConfig['origem']) => {
        if (origem !== 'personalizado') return
        const confirmar = window.confirm('Remover este assistente personalizado?')
        if (!confirmar) return
        aoRemover(id)
    }

    const criarNovoAssistente = () => {
        const novo = criarAssistenteVazio()
        aoAdicionar(novo)
        aoSelecionar(novo.id)
        setRascunho(novo)
    }

    return (
        <AnimatePresence>
            {aberto && (
                <motion.div
                    ref={ref}
                    key="assistentes-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-auto"
                    onPointerEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
                    onPointerLeave={() => window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={aoFechar} />
                    <motion.div
                        initial={{ scale: 0.97, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.97, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                        className="relative w-full max-w-5xl h-[70vh] bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-100">
                                    <Wand2 size={18} />
                                </div>
                                <div>
                                    <p className="text-sm text-white/60">Biblioteca de Assistentes</p>
                                    <h2 className="text-lg font-semibold text-white leading-none">Presets de system prompt</h2>
                                </div>
                            </div>
                            <button
                                onClick={aoFechar}
                                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label="Fechar assistentes"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-[260px_1fr] h-[calc(70vh-70px)]">
                            <div className="border-r border-white/10 bg-black/30 backdrop-blur-sm overflow-y-auto">
                                <div className="p-3 space-y-2">
                                    {assistentes.map((assistente) => {
                                        const selecionado = assistente.id === assistenteAtual?.id
                                        return (
                                            <div
                                                key={assistente.id}
                                                className={`relative rounded-xl border px-3 py-2 transition-colors ${selecionado
                                                    ? 'border-purple-400/60 bg-purple-500/10 text-white shadow-inner shadow-purple-500/10'
                                                    : 'border-white/5 hover:border-white/20 text-white/80 hover:text-white'
                                                    }`}
                                            >
                                                <button
                                                    onClick={() => aoSelecionar(assistente.id)}
                                                    className="w-full text-left"
                                                >
                                                    <div className="flex items-center justify-between pr-8">
                                                        <span className="text-sm font-medium">{assistente.nome}</span>
                                                        {assistente.origem === 'personalizado' ? (
                                                            <span className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">Custom</span>
                                                        ) : (
                                                            <span className="text-[10px] uppercase tracking-wide text-white/40">Padrão</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-white/60 mt-1 line-clamp-2">{assistente.descricao}</p>
                                                </button>
                                                {assistente.origem === 'personalizado' && (
                                                    <button
                                                        onClick={() => removerAssistente(assistente.id, assistente.origem)}
                                                        className="absolute right-1.5 top-1.5 p-1 rounded-md text-white/60 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                                                        aria-label="Remover assistente personalizado"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}

                                    <button
                                        onClick={criarNovoAssistente}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-white/80 hover:text-white hover:border-white/40 py-2 transition-colors"
                                    >
                                        <Plus size={16} />
                                        Criar novo assistente
                                    </button>

                                    <button
                                        onClick={aoRestaurarPadrao}
                                        className="w-full text-xs text-white/60 hover:text-white transition-colors"
                                    >
                                        Restaurar presets padrão
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] uppercase text-white/50 font-semibold">Nome</label>
                                        <input
                                            value={rascunho.nome}
                                            onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
                                            placeholder="Assistente Geral"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] uppercase text-white/50 font-semibold">Descrição curta</label>
                                        <input
                                            value={rascunho.descricao}
                                            onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
                                            placeholder="Explique a essência do preset"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] uppercase text-white/50 font-semibold">System Prompt</label>
                                        <div className="flex items-center gap-2 text-xs text-white/60">
                                            <Sparkles size={14} className="text-purple-300" />
                                            <span>Defina o comportamento completo do assistente</span>
                                        </div>
                                    </div>
                                    <textarea
                                        value={rascunho.prompt}
                                        onChange={(e) => setRascunho({ ...rascunho, prompt: e.target.value })}
                                        className="min-h-[280px] w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-purple-400/70 resize-none leading-relaxed scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent"
                                        placeholder="Descreva como o assistente deve se comportar..."
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-white/50">
                                        Sincronizado localmente. Use "Aplicar" para ativar na sessão.
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={salvarAtual}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm transition-colors"
                                        >
                                            <Save size={16} />
                                            Salvar preset
                                        </button>
                                        <button
                                            onClick={aplicarNaSessao}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors shadow-lg shadow-purple-500/20"
                                        >
                                            <Check size={16} />
                                            Aplicar na sessão
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
})

AssistentesModal.displayName = 'AssistentesModal'

export default AssistentesModal
