export type Role = 'user' | 'assistant'

export interface ChatMessage {
    id: string
    role: Role
    content: string
    timestamp: number
    images?: string[] // Base64 encoded images
}
