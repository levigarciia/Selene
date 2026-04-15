import type { Role } from './chat'

export type NivelIntervencaoOverlay = 'conservador' | 'equilibrado' | 'agressivo'

export type StatusIntervencaoOverlay =
    | 'avaliando'
    | 'respondendo'
    | 'pronto'
    | 'dispensado'
    | 'abortado'

export interface ConfiguracaoOverlayProativo {
    habilitado: boolean
    nivelIntervencao: NivelIntervencaoOverlay
    sonecaAte?: number | null
    cooldownMs: number
}

export interface MensagemContextoOverlay {
    role: Role
    content: string
}

export interface ContextoOverlayProativo {
    transcricaoConfirmada: string
    transcricaoParcial: string
    rascunhoAtual: string
    mensagensRecentes: MensagemContextoOverlay[]
}

export interface DecisaoDeteccaoOverlay {
    intervir: boolean
    motivo: string
    confianca: number
    resumo: string
}

export interface IntervencaoOverlay {
    id: string
    gatilho: string
    confianca: number
    resposta: string
    resumo: string
    status: StatusIntervencaoOverlay
    createdAt: number
}
