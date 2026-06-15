/**
 * Seção de personalização — estilo/tom, instruções personalizadas e memórias.
 * Design em linhas compactas, sem cards de wrapper.
 */

import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, Toggle, classeInput } from './ComponentesConfig'
import type { AutoMemory } from './ComponentesConfig'
import type { Memory } from '../../hooks/useUserProfile'
import type { EstiloTom, UsePersonalizacaoReturn } from '../../hooks/usePersonalizacao'
import { ESTILOS_TOM } from '../../utils/personalizacao'

export interface SecaoPersonalizacaoProps {
    memories: Memory[]; addMemory: (c: string) => void; removeMemory: (id: string) => void
    autoMemories?: AutoMemory[]; removeAutoMemory?: (id: string) => void; clearAutoMemories?: () => void
    crossChatEnabled?: boolean; setCrossChatEnabled?: (v: boolean) => void
    memoryAutopilotEnabled?: boolean; setMemoryAutopilotEnabled?: (v: boolean) => void
    personalizacao?: UsePersonalizacaoReturn
}

export const SecaoPersonalizacao: React.FC<SecaoPersonalizacaoProps> = ({
    memories, addMemory, removeMemory,
    autoMemories, removeAutoMemory, clearAutoMemories,
    crossChatEnabled, setCrossChatEnabled,
    memoryAutopilotEnabled, setMemoryAutopilotEnabled,
    personalizacao,
}) => {
    const [novaMemoria, setNovaMemoria] = useState('')

    const adicionarMemoria = () => {
        if (!novaMemoria.trim()) return
        addMemory(novaMemoria.trim())
        setNovaMemoria('')
    }

    return (
        <>
            {/* Personalização — estilo/tom e instruções */}
            {personalizacao && (
                <>
                    <CabecalhoGrupo titulo="Personalização" />

                    {/* Dropdown de estilo e tom */}
                    <LinhaConfig
                        titulo="Estilo e tom"
                        descricao="Define como a Selene se comunica nas respostas."
                    >
                        <select
                            id="select-estilo-tom"
                            value={personalizacao.estiloTom}
                            onChange={(e) => personalizacao.setEstiloTom(e.target.value as EstiloTom)}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[#cdd4e0] outline-none transition-colors focus:border-white/20 hover:bg-white/[0.06] cursor-pointer"
                        >
                            {(Object.entries(ESTILOS_TOM) as [EstiloTom, typeof ESTILOS_TOM[EstiloTom]][]).map(([chave, info]) => (
                                <option key={chave} value={chave} className="bg-[#131316] text-[#cdd4e0]">
                                    {info.label}
                                </option>
                            ))}
                        </select>
                    </LinhaConfig>

                    {/* Descrição do estilo selecionado */}
                    <p className="px-1 pb-2 text-[11px] text-[#4e5768]">
                        {ESTILOS_TOM[personalizacao.estiloTom].descricao}
                    </p>

                    <Divisor />

                    {/* Instruções personalizadas */}
                    <div className="py-3 space-y-2">
                        <p className="text-[12px] font-medium text-[#cdd4e0]">Instruções personalizadas</p>
                        <p className="text-[11px] text-[#4e5768]">
                            Outras preferências de tom, estilo e comportamento que a Selene deve seguir.
                        </p>
                        <textarea
                            id="instrucoes-personalizadas"
                            value={personalizacao.instrucoesPersonalizadas}
                            onChange={(e) => personalizacao.setInstrucoesPersonalizadas(e.target.value)}
                            placeholder="Outras preferências de tom, estilo e comportamento"
                            rows={4}
                            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-[#cdd4e0] placeholder:text-[#3a404d] outline-none transition-colors focus:border-white/20 focus:bg-white/[0.04] leading-relaxed"
                        />
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
