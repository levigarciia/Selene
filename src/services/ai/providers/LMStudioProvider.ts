import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { MensagemChat } from '../types'

export class LMStudioProvider implements AIProvider {
    private client: OpenAI | null = null
    private model: string

    constructor(baseUrl?: string, model?: string) {
        if (baseUrl) {
            this.client = new OpenAI({
                apiKey: 'lm-studio',
                baseURL: baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/v1`,
                dangerouslyAllowBrowser: true
            })
        }
        this.model = model || 'local-model'
    }

    isReady(): boolean {
        return !!this.client
    }

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('LM Studio não configurado.')
        try {
            const payload: any = {
                messages: mensagens,
                model: this.model
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices?.[0]?.message?.content || ''
        } catch (error) {
            console.error('Erro no chat LM Studio:', error)
            throw error
        }
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('LM Studio não configurado.')
        try {
            const payload: any = {
                messages: mensagens,
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
        } catch (error) {
            console.error('Erro no streaming LM Studio:', error)
            throw error
        }
    }

    async transcribe(audioBlob: Blob): Promise<string | null> {
        if (!this.client) return null
        try {
            const arquivo = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
            const resposta = await this.client.audio.transcriptions.create({
                file: arquivo,
                model: 'whisper-1'
            })
            return resposta.text
        } catch (error) {
            console.error('Erro transcrição LM Studio:', error)
            return null // Fallback mechanism in Service will handle this
        }
    }

    async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('LM Studio não configurado.')
        // LM Studio vision format
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        try {
            const payload: any = {
                model: this.model,
                messages: [
                    { role: 'system', content: 'Analise a imagem.' },
                    { role: 'user', content: conteudo as any }
                ]
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (e) {
            console.error('Erro imagem LM Studio', e)
            throw e
        }
    }

    async streamAnalisarImagem(
        pergunta: string,
        dataUrl: string,
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('LM Studio não configurado.')
        
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        try {
            const payload: any = {
                model: this.model,
                messages: [
                    { role: 'system', content: 'Analise a imagem e responda em português do Brasil.' },
                    { role: 'user', content: conteudo as any }
                ],
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
            console.error('Erro streaming imagem LM Studio', e)
            throw e
        }
    }

    private normalizarFinishReason(valor: string | null | undefined): MetaFimStream['finishReason'] {
        if (valor === 'stop') return 'stop'
        if (valor === 'length') return 'length'
        if (!valor) return null
        return 'other'
    }
}
