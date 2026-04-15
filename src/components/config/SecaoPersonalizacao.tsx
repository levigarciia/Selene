/**
 * Seção de personalização — assistentes, memórias e comportamento.
 * Design em linhas compactas, sem cards de wrapper.
 */

import React, { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, Toggle, classeInput } from './ComponentesConfig'
import type { AutoMemory } from './ComponentesConfig'
import type { Memory } from '../../hooks/useUserProfile'
import type { UseAssistantsReturn } from '../../hooks/useAssistants'
import type { AssistenteConfig } from '../../utils/assistentesPadrao'

export interface SecaoPersonalizacaoProps {
    memories: Memory[]; addMemory: (c: string) => void; removeMemory: (id: string) => void
    autoMemories?: AutoMemory[]; removeAutoMemory?: (id: string) => void; clearAutoMemories?: () => void
    crossChatEnabled?: boolean; setCrossChatEnabled?: (v: boolean) => void
    memoryAutopilotEnabled?: boolean; setMemoryAutopilotEnabled?: (v: boolean) => void
    assistentes?: UseAssistantsReturn
    onAbrirEditorAssistente?: (a: AssistenteConfig | null) => void
}

export const SecaoPersonalizacao: React.FC<SecaoPersonalizacaoProps> = ({
    memories, addMemory, removeMemory,
    autoMemories, removeAutoMemory, clearAutoMemories,
    crossChatEnabled, setCrossChatEnabled,
    memoryAutopilotEnabled, setMemoryAutopilotEnabled,
    assistentes, onAbrirEditorAssistente,
}) => {
    const [novaMemoria, setNovaMemoria] = useState('')

    const assistentesOrdenados = useMemo(() => {
        if (!assistentes) return []
        return [...assistentes.assistants].sort((a, b) => {
            if (a.origem !== b.origem) return a.origem === 'padrao' ? -1 : 1
            return a.nome.localeCompare(b.nome, 'pt-BR')
        })
    }, [assistentes])

    const adicionarMemoria = () => {
        if (!novaMemoria.trim()) return
        addMemory(novaMemoria.trim())
        setNovaMemoria('')
    }

    return (
        <>
            {/* Assistentes */}
            {assistentes && (
                <>
                    <CabecalhoGrupo titulo="Assistentes" />

                    <div className="space-y-1 py-2">
                        {/* Selene padrão */}
                        <button
                            type="button"
                            onClick={() => { assistentes.selectAssistant(null); if (!assistentes.useDefaultPrompt) assistentes.toggleDefaultPrompt() }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                                assistentes.useDefaultPrompt ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                            }`}
                        >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm">🌙</span>
                            <span className="min-w-0 flex-1">
                                <span className="text-[13px] text-[#cdd4e0]">Selene padrão</span>
                                {assistentes.useDefaultPrompt && <span className="ml-2 text-[10px] text-[#5c6675]">ativo</span>}
                            </span>
                        </button>

                        {assistentesOrdenados.map((a) => {
                            const ativo = !assistentes.useDefaultPrompt && assistentes.activeAssistant?.id === a.id
                            return (
                                <div key={a.id} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${ativo ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                                    <button type="button" onClick={() => assistentes.selectAssistant(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm"
                                            style={{ color: a.color || '#8b5cf6', borderColor: `${a.color || '#8b5cf6'}33`, backgroundColor: `${a.color || '#8b5cf6'}15` }}>
                                            {a.icon || '✨'}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="text-[13px] text-[#cdd4e0]">{a.nome}</span>
                                            {ativo && <span className="ml-2 text-[10px] text-[#5c6675]">ativo</span>}
                                            <span className="mt-0.5 block truncate text-[11px] text-[#4e5768]">{a.descricao || '–'}</span>
                                        </span>
                                    </button>
                                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        {onAbrirEditorAssistente && <button type="button" onClick={() => onAbrirEditorAssistente(a)} className="rounded-md p-1 text-[#5c6675] hover:bg-white/[0.04] hover:text-[#9ca3b2]" title="Editar"><Plus size={12} className="rotate-45" /></button>}
                                        {a.origem === 'personalizado' && (
                                            <button type="button" onClick={() => { if (confirm(`Remover "${a.nome}"?`)) assistentes.removeAssistant(a.id) }}
                                                className="rounded-md p-1 text-[#5c6675] hover:bg-[#1f1318] hover:text-[#c4808f]" title="Excluir"><Trash2 size={12} /></button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex gap-2 py-2">
                        <button type="button" onClick={() => onAbrirEditorAssistente?.(null)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-[#838d9e] transition-colors hover:bg-white/[0.03] hover:text-[#cdd4e0]">
                            <Plus size={12} /> Novo
                        </button>
                        <button type="button" onClick={assistentes.restoreDefaults}
                            className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-[#838d9e] transition-colors hover:bg-white/[0.03] hover:text-[#cdd4e0]">
                            Restaurar padrões
                        </button>
                    </div>
                </>
            )}

            {/* Memórias manuais */}
            <CabecalhoGrupo titulo="Memórias manuais" />

            <div className="flex gap-2 py-3">
                <input type="text" value={novaMemoria} onChange={(e) => setNovaMemoria(e.target.value)}
                    placeholder="Adicionar nova memória…" className={`flex-1 ${classeInput}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') adicionarMemoria() }} />
                <button type="button" onClick={adicionarMemoria} disabled={!novaMemoria.trim()}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-[#cdd4e0] transition-colors disabled:opacity-30 hover:bg-white/[0.07]">
                    Adicionar
                </button>
            </div>

            <div className="space-y-0.5">
                {memories.length === 0
                    ? <p className="py-3 text-xs text-[#4e5768]">Nenhuma memória cadastrada.</p>
                    : memories.map((m) => (
                        <div key={m.id} className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.02]">
                            <p className="flex-1 text-[13px] leading-relaxed text-[#b0b8c7]">{m.content}</p>
                            <button type="button" onClick={() => removeMemory(m.id)}
                                className="shrink-0 rounded-md p-1 text-[#4e5768] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#1f1318] hover:text-[#c4808f]">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
            </div>

            {/* Memórias automáticas */}
            {autoMemories !== undefined && (
                <>
                    <CabecalhoGrupo titulo="Memórias automáticas" />
                    {autoMemories.length === 0
                        ? <p className="py-3 text-xs text-[#4e5768]">Nenhuma memória automática ainda.</p>
                        : (
                            <>
                                {autoMemories.map((m) => (
                                    <div key={m.id} className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.02]">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] leading-relaxed text-[#b0b8c7]">{m.text}</p>
                                            <div className="mt-1.5 flex gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-[#454d5c]">{m.category}</span>
                                                <span className="text-[10px] text-[#454d5c]">{Math.round(m.confidence * 100)}%</span>
                                            </div>
                                        </div>
                                        {removeAutoMemory && (
                                            <button type="button" onClick={() => removeAutoMemory(m.id)}
                                                className="shrink-0 rounded-md p-1 text-[#4e5768] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#1f1318] hover:text-[#c4808f]">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {clearAutoMemories && (
                                    <button type="button" onClick={() => { if (confirm(`Apagar ${autoMemories.length} memórias automáticas?`)) clearAutoMemories() }}
                                        className="mt-2 rounded-lg border border-[#3d2028] px-3 py-1.5 text-xs text-[#c4808f] transition-colors hover:bg-[#1f1318]">
                                        Limpar todas
                                    </button>
                                )}
                            </>
                        )}
                </>
            )}

            {/* Comportamento */}
            {(setCrossChatEnabled || setMemoryAutopilotEnabled) && (
                <>
                    <CabecalhoGrupo titulo="Comportamento" />
                    {setCrossChatEnabled && (
                        <>
                            <LinhaConfig titulo="Contexto entre conversas" descricao="Busca trechos relevantes do histórico para enriquecer respostas.">
                                <Toggle ativo={!!crossChatEnabled} aoAlternar={() => setCrossChatEnabled(!crossChatEnabled)} />
                            </LinhaConfig>
                            <Divisor />
                        </>
                    )}
                    {setMemoryAutopilotEnabled && (
                        <LinhaConfig titulo="Memória automática" descricao="Detecta preferências e contexto durante as conversas.">
                            <Toggle ativo={!!memoryAutopilotEnabled} aoAlternar={() => setMemoryAutopilotEnabled(!memoryAutopilotEnabled)} />
                        </LinhaConfig>
                    )}
                </>
            )}
        </>
    )
}
