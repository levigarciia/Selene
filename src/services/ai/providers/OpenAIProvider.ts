import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { MensagemChat } from '../types'

export class OpenAIProvider implements AIProvider {
    private client: OpenAI | null = null
    private model: string

    constructor(apiKey?: string, model?: string) {
        if (apiKey) {
            this.client = new OpenAI({
                apiKey,
                dangerouslyAllowBrowser: true
            })
        }
        this.model = model || 'gpt-4o'
    }

    isReady(): boolean {
        return !!this.client
    }

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('OpenAI não configurado.')
        try {
            const payload: any = {
                messages: mensagens,
                model: this.model
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: any) {
            console.error('Erro no chat OpenAI:', error)
            if (this.ehRateLimit(error)) throw new Error('Limite ou créditos esgotados na OpenAI.')
            throw error
        }
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenAI não configurado.')
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
        } catch (error: any) {
            console.error('Erro no streaming OpenAI:', error)
            if (this.ehRateLimit(error)) throw new Error('Limite ou créditos esgotados na OpenAI.')
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
            console.error('Erro transcrição OpenAI:', error)
            return null
        }
    }

    async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('OpenAI não configurado.')
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        try {
            const payload: any = {
                model: this.model,
                messages: [
                    { role: 'system', content: 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.' },
                    { role: 'user', content: conteudo as any }
                ]
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: any) {
            console.warn('[imagem][openai] falhou', error?.message)
            throw error
        }
    }

    async streamAnalisarImagem(
        pergunta: string,
        dataUrl: string,
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenAI não configurado.')
        
        const conteudo = [
            { type: 'text', text: pergunta },
            { type: 'image_url', image_url: { url: dataUrl } }
        ]

        try {
            const payload: any = {
                model: this.model,
                messages: [
                    { role: 'system', content: 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.' },
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
        } catch (error: any) {
            console.error('Erro streaming imagem OpenAI:', error)
            if (this.ehRateLimit(error)) throw new Error('Limite ou créditos esgotados na OpenAI.')
            throw error
        }
    }

    private ehRateLimit(err: any) {
        const status = err?.status || err?.statusCode || err?.code
        const mensagem = (err?.message || `${err || ''}`).toLowerCase()
        return status === 429 || mensagem.includes('rate limit') || mensagem.includes('quota')
    }

    private normalizarFinishReason(valor: string | null | undefined): MetaFimStream['finishReason'] {
        if (valor === 'stop') return 'stop'
        if (valor === 'length') return 'length'
        if (!valor) return null
        return 'other'
    }
}
