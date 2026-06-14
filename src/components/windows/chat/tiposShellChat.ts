export type AbaShellChat = 'hub-contexto' | 'seletor-projetos' | 'perfil' | 'resumo-contexto'

export interface SeloAcaoHomeChat {
    texto: string
    tom?: 'azul' | 'dourado' | 'neutro' | 'roxo' | 'verde'
}

export interface AcaoHomeChat {
    id: string
    titulo: string
    descricao: string
    prompt: string
    tipo: 'assistente' | 'projeto' | 'mcp' | 'investigacao' | 'web' | 'conversa' | 'geral'
    selos: SeloAcaoHomeChat[]
    assistantId?: string | null
    projectId?: string
    conversationId?: string
    ativarWeb?: boolean
    ativarInvestigacao?: boolean
    ativarToolCalling?: boolean
}

export interface ItemHubContexto {
    id: string
    tipo: 'assistente' | 'projeto' | 'atalho'
    titulo: string
    descricao: string
    badge?: string
    ativo?: boolean
    assistantId?: string | null
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

export interface ContextoSidebarChat {
    assistente: string
    projeto: string
    possuiAssistente: boolean
    possuiProjeto: boolean
    resumo: string
}
