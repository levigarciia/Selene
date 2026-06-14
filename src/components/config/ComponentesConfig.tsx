/* eslint-disable react-refresh/only-export-components */
/**
 * Primitivos visuais para a tela de configurações.
 * Design baseado em linhas, sem cards pesados.
 */

import React from 'react'

export const classeInput =
    'w-full rounded-xl border border-white/[0.05] bg-[#0e1017] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#3a4150] focus:border-white/[0.12]'

/** Cabeçalho de grupo — uppercase discreto */
export const CabecalhoGrupo: React.FC<{ titulo: string }> = ({ titulo }) => (
    <div className="mb-2 mt-8 first:mt-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#454d5c]">{titulo}</span>
    </div>
)

/** Divisor sutil entre itens */
export const Divisor = () => <div className="border-b border-white/[0.035]" />

/** Linha de config: label à esquerda, controle à direita. vertical=true para campos de texto */
export const LinhaConfig: React.FC<{
    titulo: string
    descricao?: string
    children: React.ReactNode
    vertical?: boolean
}> = ({ titulo, descricao, children, vertical }) =>
    vertical ? (
        <div className="py-3">
            <label className="mb-1.5 block text-xs font-medium text-[#838d9e]">{titulo}</label>
            {descricao && <p className="mb-2 text-[11px] leading-relaxed text-[#4e5768]">{descricao}</p>}
            {children}
        </div>
    ) : (
        <div className="flex items-center justify-between gap-6 py-3.5">
            <div className="min-w-0 flex-1">
                <p className="text-[13px] text-[#cdd4e0]">{titulo}</p>
                {descricao && <p className="mt-0.5 text-[11px] leading-relaxed text-[#4e5768]">{descricao}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )

/** Toggle minimalista — ON: fundo claro + knob escuro */
export const Toggle: React.FC<{ ativo: boolean; aoAlternar: () => void }> = ({ ativo, aoAlternar }) => (
    <button
        type="button"
        onClick={aoAlternar}
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 ${
            ativo ? 'bg-white/[0.22]' : 'bg-white/[0.06]'
        }`}
    >
        <span className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full transition-all duration-150 ${
            ativo ? 'translate-x-4 bg-white' : 'bg-[#555d6b]'
        }`} />
    </button>
)

/** Pill selecionável */
export const classePill = (ativo: boolean) =>
    `rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-100 ${
        ativo
            ? 'border-white/[0.1] bg-white/[0.06] text-[#e8ecf2]'
            : 'border-white/[0.04] text-[#5c6675] hover:border-white/[0.07] hover:text-[#8b95a5]'
    }`

/** Tipo de memória automática – compatibilidade */
export interface AutoMemory {
    id: string
    text: string
    category: string
    confidence: number
    createdAt: number
}
