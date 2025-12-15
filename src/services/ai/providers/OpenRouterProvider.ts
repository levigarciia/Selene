import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { MensagemChat } from '../types'

export class OpenRouterProvider implements AIProvider {
    private client: OpenAI | null = null
    private model: string

    constructor(apiKey?: string, model?: string) {
        if (apiKey) {
            this.client = new OpenAI({
                apiKey,
                baseURL: 'https://openrouter.ai/api/v1',
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Selene'
                }
            })
        }
        this.model = model || 'openai/gpt-3.5-turbo'
    }

    isReady(): boolean {
        return !!this.client
    }

    async chat(mensagens: MensagemChat[]): Promise<string> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        try {
            const completion = await this.client.chat.completions.create({
                messages: mensagens,
                model: this.model
            })
            return completion.choices[0].message.content || ''
        } catch (error: any) {
            console.error('Erro no chat OpenRouter:', error)
            throw error
        }
    }

    async streamChat(mensagens: MensagemChat[], onChunk: (chunk: string) => void): Promise<void> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        try {
            const stream = await this.client.chat.completions.create({
                messages: mensagens,
                model: this.model,
                stream: true
            })

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    onChunk(content)
                }
            }
        } catch (error: any) {
            console.error('Erro no streaming OpenRouter:', error)
            throw error
        }
    }

    async transcribe(audioBlob: Blob): Promise<string | null> {
        // OpenRouter via Google Gemini Free tier often supports this
        if (!this.client) return null
        try {
            const base64 = await this.blobToBase64(audioBlob)
            const completion = await this.client.chat.completions.create({
                model: 'google/gemini-2.0-flash-lite-001', // Hardcoded successful model for free transcription
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_audio',
                                input_audio: { data: base64, format: 'mp3' }
                            },
                            { type: 'text', text: 'Transcreva.' }
                        ] as any
                    }
                ]
            })
            return completion.choices[0].message.content || ''
        } catch (e) {
            console.error('Falha transcrição OpenRouter', e)
            return null
        }
    }

    async analisarImagem(pergunta: string, dataUrl: string): Promise<string> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        // Auto-detect best vision model if default doesn't support it? 
        // Implementation kept simple as per previous logic.
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model, // User responsibility to pick a vision model
                messages: [
                    { role: 'system', content: 'Analise a imagem.' },
                    { role: 'user', content: conteudo as any }
                ]
            })
            return completion.choices[0].message.content || ''
        } catch (e) {
            console.error('Falha imagem OpenRouter', e)
            throw e
        }
    }

    private async blobToBase64(blob: Blob): Promise<string> {
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binario = ''
        for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i])
        return btoa(binario)
    }
}
