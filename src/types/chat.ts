export type Role = 'user' | 'assistant'

export type StatusResumoImagem = 'pendente' | 'gerando' | 'concluido' | 'falhou'

export interface ImagemMensagemChat {
    src: string
    resumo?: string
    statusResumo?: StatusResumoImagem
}

export interface ChatMessage {
    id: string
    role: Role
    content: string
    raciocinio?: string
    timestamp: number
    images?: string[] // Base64 encoded images
    imagensContexto?: ImagemMensagemChat[]
}
