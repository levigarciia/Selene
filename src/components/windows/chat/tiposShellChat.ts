export type AbaShellChat = 'seletor-projetos' | 'perfil' | 'resumo-contexto'

export interface SeloAcaoHomeChat {
    texto: string
    tom?: 'azul' | 'dourado' | 'neutro' | 'roxo' | 'verde'
}

export interface AcaoHomeChat {
    id: string
    titulo: string
    descricao: string
    prompt: string
    tipo: 'projeto' | 'mcp' | 'investigacao' | 'web' | 'conversa' | 'geral'
    selos: SeloAcaoHomeChat[]
    projectId?: string
    conversationId?: string
    ativarWeb?: boolean
    ativarInvestigacao?: boolean
    ativarToolCalling?: boolean
}

export interface ItemHubContexto {
    id: string
    tipo: 'projeto' | 'atalho'
    titulo: string
    descricao: string
    badge?: string
    ativo?: boolean
    projectId?: string
}

export interface ItemResumoContextoAtivo {
    id: string
    titulo: string
    descricao: string
    quantidade?: number
    ativo: boolean
}

export interface ResumoContextoAtivo {
    contadorTotal: number
    itens: ItemResumoContextoAtivo[]
    provedor: string
    modelo: string
    perfilLatencia: string
    toolCallingAtivo: boolean
    webSearchEnabled: boolean
    investigateMode: boolean
}
