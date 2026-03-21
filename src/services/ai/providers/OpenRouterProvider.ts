import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
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

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        try {
            const payload: any = {
                messages: mensagens,
                model: this.model
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: any) {
            console.error('Erro no chat OpenRouter:', error)
            throw error
        }
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        try {
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                messages: mensagens as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                stream: true
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const stream = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of stream) {
                finishReason = this.normalizarFinishReason(chunk.choices?.[0]?.finish_reason)
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    onChunk(content)
                }
            }

            opcoes.onFimStream?.({ finishReason })
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

    async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        // Auto-detect best vision model if default doesn't support it? 
        // Implementation kept simple as per previous logic.
        try {
            const payload: any = {
                model: this.model, // User responsibility to pick a vision model
                messages: [
                    { role: 'system', content: 'Analise a imagem.' },
                    { role: 'user', content: conteudo as any }
                ]
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (e) {
            console.error('Falha imagem OpenRouter', e)
            throw e
        }
    }

    async streamAnalisarImagem(
        pergunta: string,
        dataUrl: string,
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        try {
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                model: this.model,
                messages: [
                    { role: 'system', content: 'Analise a imagem e responda em português do Brasil.' },
                    { role: 'user', content: conteudo as any }
                ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                stream: true
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const stream = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of stream) {
                finishReason = this.normalizarFinishReason(chunk.choices?.[0]?.finish_reason)
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    onChunk(content)
                }
            }

            opcoes.onFimStream?.({ finishReason })
        } catch (e) {
            console.error('Falha streaming imagem OpenRouter', e)
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

    private normalizarFinishReason(valor: string | null | undefined): MetaFimStream['finishReason'] {
        if (valor === 'stop') return 'stop'
        if (valor === 'length') return 'length'
        if (!valor) return null
        return 'other'
    }
}
