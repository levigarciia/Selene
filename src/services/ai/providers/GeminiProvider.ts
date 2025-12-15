import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider } from '../AIProvider'
import type { MensagemChat } from '../types'

export class GeminiProvider implements AIProvider {
    private client: GoogleGenerativeAI | null = null

    constructor(apiKey?: string) {
        if (apiKey) {
            this.client = new GoogleGenerativeAI(apiKey)
        }
    }

    isReady(): boolean {
        return !!this.client
    }

    async chat(mensagens: MensagemChat[]): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        try {
            const systemInstruction = mensagens.find((m) => m.role === 'system')?.content
            const conteudo = mensagens
                .filter((m) => m.role !== 'system')
                .map((m) => `${m.role === 'assistant' ? 'Assistente:' : 'Usuário:'}\n${m.content}`)
                .join('\n\n')

            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction
            })
            const result = await model.generateContent(conteudo)
            const response = await result.response
            return response.text()
        } catch (error: any) {
            console.error('Erro no chat Gemini:', error)
            throw new Error(`Erro Gemini: ${error.message || 'Erro desconhecido'}`)
        }
    }

    async streamChat(mensagens: MensagemChat[], onChunk: (chunk: string) => void): Promise<void> {
        if (!this.client) throw new Error('Gemini não configurado.')
        try {
            const systemInstruction = mensagens.find((m) => m.role === 'system')?.content
            const conteudo = mensagens
                .filter((m) => m.role !== 'system')
                .map((m) => `${m.role === 'assistant' ? 'Assistente:' : 'Usuário:'}\n${m.content}`)
                .join('\n\n')

            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction
            })

            const result = await model.generateContentStream(conteudo)

            for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) {
                    onChunk(text)
                }
            }
        } catch (error: any) {
            console.error('Erro no streaming Gemini:', error)
            throw new Error(`Erro Gemini: ${error.message || 'Erro desconhecido'}`)
        }
    }

    async transcribe(audioBlob: Blob): Promise<string | null> {
        if (!this.client) return null
        try {
            const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
            const base64 = await this.blobToBase64(audioBlob)
            if (!base64) return null

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: base64,
                        mimeType: audioBlob.type || 'audio/webm'
                    }
                },
                { text: 'Transcreva o audio enviado em texto simples, sem traducoes ou comentarios.' }
            ])
            const texto = result.response.text()
            if (this.pareceRecusa(texto)) return null
            return texto
        } catch (error) {
            console.error('Erro na transcricao Gemini:', error)
            return null
        }
    }

    async analisarImagem(pergunta: string, dataUrl: string): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        const { base64, mimeType } = this.extrairBase64(dataUrl)

        const model = this.client.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.'
        })

        const result = await model.generateContent([
            { text: pergunta },
            { inlineData: { data: base64, mimeType } }
        ])
        return result.response.text()
    }

    private async blobToBase64(blob: Blob): Promise<string> {
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binario = ''
        for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i])
        return btoa(binario)
    }

    private extrairBase64(dataUrl: string) {
        const [cabecalho, base64] = dataUrl.split(',')
        const mimeType = cabecalho?.split(':')[1]?.split(';')[0] || 'image/png'
        return { base64: base64 || '', mimeType }
    }

    private pareceRecusa(texto: string) {
        const t = texto.toLowerCase()
        return t.includes('não consigo ouvir') || t.includes('cannot listen')
    }
}
