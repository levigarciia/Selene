export type Role = 'user' | 'assistant'

export type StatusResumoImagem = 'pendente' | 'gerando' | 'concluido' | 'falhou'

export interface ImagemMensagemChat {
    src: string
    resumo?: string
    statusResumo?: StatusResumoImagem
}

export interface ArquivoAnexo {
    id: string
    name: string
    type: 'pdf' | 'docx' | 'txt' | 'md' | 'other'
    size: number
    content: string
    status?: 'processando' | 'concluido' | 'erro'
    arquivoOriginal?: File
}

export interface ChatMessage {
    id: string
    role: Role
    content: string
    raciocinio?: string
    timestamp: number
    images?: string[] // Imagens codificadas em Base64
    imagensContexto?: ImagemMensagemChat[]
    arquivos?: ArquivoAnexo[]
}
