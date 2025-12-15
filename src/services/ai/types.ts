export type MensagemChat = { role: 'system' | 'user' | 'assistant'; content: string }
export type AcaoTexto = 'corrigir' | 'markdown' | 'resumir' | 'detalhar' | 'reescrever'
export type TomTexto = 'formal' | 'casual' | 'tecnico'
export type ConteudoMultimodal = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

// Provedores suportados
export type ProvedorID = 'openai' | 'gemini' | 'openrouter' | 'lmstudio'

// Configuração geral (pode ser usada pela Factory ou Service principal)
export interface AIConfig {
    activeProvider?: ProvedorID
    openai?: { key: string; model?: string }
    gemini?: { key: string }
    openRouter?: { key: string; model?: string }
    lmStudio?: { baseUrl: string; model?: string }
}
