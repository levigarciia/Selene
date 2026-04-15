
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Check, X, Sparkles, FileText, ListChecks, PenSquare, Highlighter } from 'lucide-react'
import { DiffVisual } from '../../feedback'
import { gerarDiffPorLinhas } from '../../../utils/diff'
import { useAI } from '../../../hooks/useAI'

export type AcaoAssistente = 'corrigir' | 'markdown' | 'resumir' | 'detalhar' | 'reescrever'
export type TomReescrita = 'formal' | 'casual' | 'tecnico'

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return fallback
}

export default function GrammarWindow() {
    const { criarOuObterServico } = useAI()

    // Estados
    const [status, setStatus] = useState<'ocioso' | 'processando' | 'erro'>('ocioso')
    const [erro, setErro] = useState<string | null>(null)
    const [textoOriginal, setTextoOriginal] = useState('')
    const [textoEditavel, setTextoEditavel] = useState('')
    const [acaoAtual, setAcaoAtual] = useState<AcaoAssistente>('corrigir')
    const [tomReescrita, setTomReescrita] = useState<TomReescrita>('formal')

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Diff
    const diff = useMemo(() =>
        gerarDiffPorLinhas(textoOriginal, textoEditavel),
        [textoOriginal, textoEditavel])

    const bloqueado = status === 'processando'

    // Focar textarea quando carregar ou terminar processamento
    useEffect(() => {
        if (!bloqueado && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [bloqueado])

    // Handler de execução
    const executarAcao = useCallback(async (acao: AcaoAssistente, texto?: string) => {
        const servico = criarOuObterServico()
        const alvo = (texto ?? textoOriginal ?? '').trim()

        if (!servico) {
            setErro('Configure uma chave de API nas configurações principais.')
            setStatus('erro')
            return
        }

        if (!alvo) {
            setErro('Nenhum texto para processar.')
            setStatus('erro')
            return
        }

        setStatus('processando')
        setErro(null)
        setAcaoAtual(acao)
        // Se receber texto novo (do atalho), atualiza original
        if (texto) {
            setTextoOriginal(texto)
            setTextoEditavel(texto) // Reseta editavel para o novo original enquanto processa
        }

        try {
            const resultado = await servico.transformarTexto(alvo, acao, tomReescrita)
            setTextoEditavel(resultado.trim())
            setStatus('ocioso')
        } catch (error: unknown) {
            console.error(error)
            setErro(obterMensagemErro(error, 'Erro ao processar texto.'))
            setStatus('erro')
        }
    }, [criarOuObterServico, textoOriginal, tomReescrita])

    // Listener de Atalho (IPC)
    useEffect(() => {
        const removeListener = window.electronAPI?.onAtalhoGramatical?.((texto) => {
            console.log('[GrammarWindow] Recebido texto via atalho:', texto)
            if (texto) {
                executarAcao('corrigir', texto)
            } else {
                setErro('Nenhum texto capturado. Selecione algo antes de usar o atalho.')
                setStatus('erro')
            }
        })
        return () => removeListener?.()
    }, [executarAcao])

    // Ações da UI
    const handleFechar = () => {
        window.close() // O main process deve interceptar se quiser só esconder
    }

    const handleAplicar = async () => {
        try {
            // 1. Copiar texto corrigido para clipboard
            await navigator.clipboard.writeText(textoEditavel)

            // 2. Enviar para main process que vai:
            //    - Esconder a janela
            //    - Aguardar app original recuperar foco
            //    - Simular Ctrl+V
            window.electronAPI?.aplicarTextoGramatical?.()
        } catch (err) {
            console.error('[GrammarWindow] Falha ao aplicar texto:', err)
            setErro('Falha ao aplicar texto.')
        }
    }

    return (
        <div className="h-screen w-screen bg-[#0a0a0c] text-neutral-100 flex flex-col p-4 overflow-hidden selection:bg-purple-500/30">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-100">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <p className="text-xs uppercase text-white/60 font-semibold tracking-wide">Assistente gramatical</p>
                        <h2 className="text-lg font-semibold text-white leading-none">
                            {acaoAtual === 'corrigir' ? 'Correção' :
                                acaoAtual === 'markdown' ? 'Markdown' :
                                    acaoAtual === 'resumir' ? 'Resumo' :
                                        acaoAtual === 'detalhar' ? 'Detalhar' : 'Reescrever'}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                    {status === 'processando' && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-100 animate-pulse">
                            Processando...
                        </span>
                    )}
                    <button
                        onClick={handleFechar}
                        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        title="Fechar (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="grid grid-cols-5 gap-2 mb-4">
                <button
                    onClick={() => executarAcao('corrigir')}
                    disabled={bloqueado}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${bloqueado
                        ? 'bg-white/5 border-white/10 text-white/40 cursor-wait'
                        : 'bg-white/10 border-white/10 text-white hover:border-purple-300/40 hover:bg-purple-500/10'
                        }`}
                >
                    <Sparkles size={16} />
                    Corrigir
                </button>
                <button
                    onClick={() => executarAcao('markdown')}
                    disabled={bloqueado}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${bloqueado
                        ? 'bg-white/5 border-white/10 text-white/40 cursor-wait'
                        : 'bg-white/10 border-white/10 text-white hover:border-blue-300/40 hover:bg-blue-500/10'
                        }`}
                >
                    <Highlighter size={16} />
                    Markdown
                </button>
                <button
                    onClick={() => executarAcao('resumir')}
                    disabled={bloqueado}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${bloqueado
                        ? 'bg-white/5 border-white/10 text-white/40 cursor-wait'
                        : 'bg-white/10 border-white/10 text-white hover:border-emerald-300/40 hover:bg-emerald-500/10'
                        }`}
                >
                    <ListChecks size={16} />
                    Resumir
                </button>
                <button
                    onClick={() => executarAcao('detalhar')}
                    disabled={bloqueado}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${bloqueado
                        ? 'bg-white/5 border-white/10 text-white/40 cursor-wait'
                        : 'bg-white/10 border-white/10 text-white hover:border-amber-300/40 hover:bg-amber-500/10'
                        }`}
                >
                    <FileText size={16} />
                    Detalhar
                </button>
                <div className="flex gap-2">
                    <select
                        value={tomReescrita}
                        onChange={(e) => setTomReescrita(e.target.value as TomReescrita)}
                        disabled={bloqueado}
                        className="w-24 bg-white/5 border border-white/10 text-white/80 rounded-xl text-xs px-2 py-2 outline-none focus:border-purple-300/60"
                    >
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="tecnico">Técnico</option>
                    </select>
                    <button
                        onClick={() => executarAcao('reescrever')}
                        disabled={bloqueado}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${bloqueado
                            ? 'bg-white/5 border-white/10 text-white/40 cursor-wait'
                            : 'bg-white/10 border-white/10 text-white hover:border-purple-300/40 hover:bg-purple-500/10'
                            }`}
                    >
                        <PenSquare size={16} />
                        Reescrever
                    </button>
                </div>
            </div>

            {erro && (
                <div className="mb-4 text-sm text-red-200 bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2">
                    {erro}
                </div>
            )}

            {/* Content Grid */}
            <div className="flex-1 grid grid-cols-[1fr_1fr] gap-4 min-h-0">
                {/* Left: Original / Diff */}
                <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex items-center justify-between text-white/70 text-sm">
                        <span>Original / Diff</span>
                        <span className="text-white/40 text-xs">Vermelho: removido • Verde: adicionado</span>
                    </div>
                    <div className="flex-1 bg-neutral-900/50 border border-white/10 rounded-2xl overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/15">
                        {textoOriginal ? (
                            <DiffVisual linhas={diff} carregando={status === 'processando'} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm">
                                <Sparkles size={24} className="mb-2 opacity-50" />
                                <p>Aguardando texto...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Editable Result */}
                <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex items-center justify-between">
                        <span className="text-white/70 text-sm">Resultado (editável)</span>
                        <span className="text-white/40 text-xs">{textoEditavel.length} chars</span>
                    </div>

                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={textoEditavel}
                            onChange={(e) => setTextoEditavel(e.target.value)}
                            disabled={status === 'processando'}
                            className="w-full h-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-purple-400/60 resize-none leading-relaxed scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent font-sans"
                            placeholder="O resultado aparecerá aqui..."
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={handleFechar}
                            className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAplicar}
                            disabled={bloqueado || !textoEditavel}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition-colors ${bloqueado || !textoEditavel
                                ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                }`}
                        >
                            <Check size={16} />
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
