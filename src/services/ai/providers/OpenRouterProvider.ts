import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { MensagemChat, MensagemHistoricoIA } from '../types'
import { criarConteudoTextoComImagens } from '../historicoMultimodal'

type RegistroGenerico = Record<string, unknown>

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
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                messages: mensagens as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: unknown) {
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
                const choice = chunk.choices?.[0]
                const delta = choice?.delta
                const partes = this.extrairPartesStream(choice, delta)
                const raciocinio = partes.raciocinio
                if (raciocinio) {
                    opcoes.onEventoStream?.({
                        tipo: 'raciocinio',
                        texto: raciocinio,
                        origem: 'delta_raciocinio'
                    })
                }

                const content = partes.conteudo
                if (content) {
                    onChunk(content)
                }
            }

            opcoes.onFimStream?.({ finishReason })
        } catch (error: unknown) {
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
                        ] as unknown as OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content']
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
        const systemPrompt = opcoes.systemPromptOverride ?? 'Analise a imagem.'
        const mensagens: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
        if (systemPrompt.trim()) {
            mensagens.push({ role: 'system', content: systemPrompt })
        }
        mensagens.push(...this.normalizarHistorico(opcoes.historico))
        mensagens.push({
            role: 'user',
            content: conteudo as unknown as OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content']
        })

        // Auto-detect best vision model if default doesn't support it? 
        // Implementation kept simple as per previous logic.
        try {
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                model: this.model, // User responsibility to pick a vision model
                messages: mensagens,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }

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
        const systemPrompt = opcoes.systemPromptOverride ?? 'Analise a imagem e responda em português do Brasil.'
        const mensagens: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
        if (systemPrompt.trim()) {
            mensagens.push({ role: 'system', content: systemPrompt })
        }
        mensagens.push(...this.normalizarHistorico(opcoes.historico))
        mensagens.push({
            role: 'user',
            content: conteudo as unknown as OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content']
        })

        try {
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                model: this.model,
                messages: mensagens,
                stream: true
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature

            const stream = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of stream) {
                finishReason = this.normalizarFinishReason(chunk.choices?.[0]?.finish_reason)
                const choice = chunk.choices?.[0]
                const delta = choice?.delta
                const partes = this.extrairPartesStream(choice, delta)
                const raciocinio = partes.raciocinio
                if (raciocinio) {
                    opcoes.onEventoStream?.({
                        tipo: 'raciocinio',
                        texto: raciocinio,
                        origem: 'delta_raciocinio'
                    })
                }

                const content = partes.conteudo
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

    private extrairPartesStream(
        choice?: OpenAI.Chat.Completions.ChatCompletionChunk.Choice,
        delta?: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta
    ): { conteudo: string; raciocinio: string } {
        let conteudo = ''
        let raciocinio = ''

        if (Array.isArray(delta?.content)) {
            for (const item of delta.content) {
                const tipo = String(item?.type || '').toLowerCase()
                const texto = this.extrairTextoVariado(item)
                if (!texto) continue
                if (tipo.includes('reason') || tipo.includes('think')) {
                    raciocinio += texto
                } else {
                    conteudo += texto
                }
            }
        } else {
            conteudo += this.extrairTextoVariado(delta?.content)
        }

        const fallbackConteudo = [
            delta?.text,
            choice?.text,
            choice?.content,
            choice?.message?.content
        ].map((valor) => this.extrairTextoVariado(valor)).join('')
        if (!conteudo) {
            conteudo += fallbackConteudo
        }

        const fallbackRaciocinio = [
            delta?.reasoning,
            delta?.reasoning_content,
            delta?.reasoningContent,
            delta?.thinking,
            choice?.reasoning,
            choice?.reasoning_content,
            choice?.reasoningContent,
            choice?.thinking,
            choice?.message?.reasoning
        ].map((valor) => this.extrairTextoVariado(valor)).join('')
        if (!raciocinio) {
            raciocinio += fallbackRaciocinio
        }

        return {
            conteudo,
            raciocinio
        }
    }

    private extrairTextoVariado(valor: unknown): string {
        if (typeof valor === 'string') return valor
        if (Array.isArray(valor)) {
            return valor.map((item) => this.extrairTextoVariado(item)).join('')
        }
        if (valor && typeof valor === 'object') {
            const registro = valor as RegistroGenerico
            return [
                this.extrairTextoVariado(registro.text),
                this.extrairTextoVariado(registro.content),
                this.extrairTextoVariado(registro.reasoning),
            ].join('')
        }
        return ''
    }

    private normalizarHistorico(historico?: MensagemHistoricoIA[]): MensagemChat[] {
        if (!Array.isArray(historico) || historico.length === 0) return []
        return historico.map((mensagem) => ({
            role: mensagem.role,
            content: mensagem.role === 'user' && mensagem.images?.length
                ? criarConteudoTextoComImagens(mensagem.content, mensagem.images)
                : mensagem.content
        }))
    }
}
