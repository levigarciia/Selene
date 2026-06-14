export type PerfilLatencia = 'rapido' | 'equilibrado' | 'completo'
export type AcaoTexto = 'corrigir' | 'markdown' | 'resumir' | 'detalhar' | 'reescrever'
export type TomTexto = 'formal' | 'casual' | 'tecnico'
export type ConteudoMultimodal = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export type ConteudoMensagemChat = string | ConteudoMultimodal[]
export type MensagemHistoricoIA = { role: 'user' | 'assistant'; content: string; images?: string[] }
export type MensagemChat = { role: 'system' | 'user' | 'assistant'; content: ConteudoMensagemChat }

// Provedores suportados
export type ProvedorID = 'openai' | 'gemini' | 'openrouter' | 'local'

// Configuração geral (pode ser usada pela Factory ou Service principal)
export interface AIConfig {
    activeProvider?: ProvedorID
    openai?: { key: string; model?: string }
    gemini?: { key: string }
    openRouter?: { key: string; model?: string }
    local?: { model?: string }
}
