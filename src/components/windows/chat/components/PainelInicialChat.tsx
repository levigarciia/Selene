import React from 'react'
import type { AcaoHomeChat, SeloAcaoHomeChat } from '../tiposShellChat'

interface PainelInicialChatProps {
    acoesPrincipais: AcaoHomeChat[]
    promptsRapidos: AcaoHomeChat[]
    onSelecionarAcao: (acao: AcaoHomeChat) => void
}

function obterClasseSelo(selo: SeloAcaoHomeChat, indice: number): string {
    const tom = selo.tom || 'neutro'
    const mapa = {
        azul: 'bg-[#253a61] text-[#9ab4ef]',
        dourado: 'bg-[#4a3721] text-[#efc279]',
        neutro: 'bg-[#343741] text-[#e3e7ef]',
        roxo: 'bg-[#352a51] text-[#c2b7ff]',
        verde: 'bg-[#213d34] text-[#9dd7bf]',
    }

    return `${indice === 0 ? 'ml-0' : ''} ${mapa[tom]}`
}

export const PainelInicialChat: React.FC<PainelInicialChatProps> = ({
    acoesPrincipais,
    promptsRapidos,
    onSelecionarAcao,
}) => {
    const acoesCompactas = acoesPrincipais.slice(0, 3)
    const promptsCompactos = promptsRapidos.slice(0, 3)

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1" />

            <div className="px-7 pb-4">
                <div className="mx-auto w-full max-w-[54rem]">
                    <div className="mb-3 flex flex-wrap justify-center gap-3 pb-1">
                    {acoesCompactas.map((acao) => (
                        <button
                            key={acao.id}
                            type="button"
                            onClick={() => onSelecionarAcao(acao)}
                            className="w-[188px] shrink-0 rounded-2xl border border-white/[0.04] bg-[#121318] px-4 py-3 text-left transition-colors hover:bg-[#16181d]"
                        >
                            <div className="truncate text-[13px] font-medium text-[#c8d1e1]">
                                {acao.titulo}
                            </div>
                            <div className="mt-1 line-clamp-1 text-[11.5px] text-[#71798a]">
                                {acao.descricao}
                            </div>
                            <div className="mt-3 flex items-center">
                                {acao.selos.slice(0, 2).map((selo, indice) => (
                                    <span
                                        key={`${acao.id}-${selo.texto}-${indice}`}
                                        className={`-ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#2b2d33] px-1.5 text-[8.5px] font-semibold ${obterClasseSelo(selo, indice)}`}
                                    >
                                        {selo.texto}
                                    </span>
                                ))}
                            </div>
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            <div className="relative px-7 pb-5">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#141416] via-[#141416]/80 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#141416] via-[#141416]/80 to-transparent" />

                <div className="mx-auto w-full max-w-[54rem] overflow-hidden">
                    <div className="flex flex-wrap justify-center gap-3 px-4">
                        {promptsCompactos.map((prompt) => (
                            <button
                                key={prompt.id}
                                type="button"
                                onClick={() => onSelecionarAcao(prompt)}
                                className="w-[190px] shrink-0 rounded-2xl bg-[#0f1014] px-4 py-3 text-left transition-colors hover:bg-[#15171c]"
                            >
                                <div className="truncate text-[13px] font-medium text-[#cfd3dd]">
                                    {prompt.titulo}
                                </div>
                                <div className="mt-1 truncate text-[11.5px] text-[#828998]">
                                    {prompt.descricao}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
