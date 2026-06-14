import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { MensagemChat, MensagemHistoricoIA } from '../types'
import { criarConteudoTextoComImagens } from '../historicoMultimodal'

type RegistroGenerico = Record<string, unknown>

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
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                messages: mensagens as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {}),
                ...(typeof opcoes.maxTokens === 'number' ? { max_tokens: opcoes.maxTokens } : {})
            }

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: unknown) {
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
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                messages: mensagens as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                stream: true,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {}),
                ...(typeof opcoes.maxTokens === 'number' ? { max_tokens: opcoes.maxTokens } : {})
            }

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
        const systemPrompt = opcoes.systemPromptOverride ?? 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.'
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
            const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                model: this.model,
                messages: mensagens,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }

            const completion = await this.client.chat.completions.create(payload, { signal: opcoes.signal })
            return completion.choices[0].message.content || ''
        } catch (error: unknown) {
            console.warn('[imagem][openai] falhou', this.obterMensagemErro(error))
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
        const systemPrompt = opcoes.systemPromptOverride ?? 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.'
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
                stream: true,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }

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
            console.error('Erro streaming imagem OpenAI:', error)
            if (this.ehRateLimit(error)) throw new Error('Limite ou créditos esgotados na OpenAI.')
            throw error
        }
    }

    private ehRateLimit(err: unknown) {
        const erro = err as { status?: number; statusCode?: number; code?: string | number; message?: string }
        const status = erro.status || erro.statusCode || erro.code
        const mensagem = (erro.message || `${err || ''}`).toLowerCase()
        return status === 429 || mensagem.includes('rate limit') || mensagem.includes('quota')
    }

    private obterMensagemErro(erro: unknown): string {
        if (erro instanceof Error && erro.message) {
            return erro.message
        }
        return String(erro ?? '')
    }

    private normalizarFinishReason(valor: string | null | undefined): MetaFimStream['finishReason'] {
        if (valor === 'stop') return 'stop'
        if (valor === 'length') return 'length'
        if (!valor) return null
        return 'other'
    }

    private extrairPartesStream(
        choice?: unknown,
        delta?: unknown
    ): { conteudo: string; raciocinio: string } {
        let conteudo = ''
        let raciocinio = ''
        const deltaRegistro = this.comoRegistro(delta)
        const choiceRegistro = this.comoRegistro(choice)
        const mensagemChoice = this.comoRegistro(choiceRegistro?.message)

        if (Array.isArray(deltaRegistro?.content)) {
            for (const item of deltaRegistro.content) {
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
            conteudo += this.extrairTextoVariado(deltaRegistro?.content)
        }

        const fallbackConteudo = [
            deltaRegistro?.text,
            choiceRegistro?.text,
            choiceRegistro?.content,
            mensagemChoice?.content
        ].map((valor) => this.extrairTextoVariado(valor)).join('')
        if (!conteudo) {
            conteudo += fallbackConteudo
        }

        const fallbackRaciocinio = [
            deltaRegistro?.reasoning,
            deltaRegistro?.reasoning_content,
            deltaRegistro?.reasoningContent,
            deltaRegistro?.thinking,
            choiceRegistro?.reasoning,
            choiceRegistro?.reasoning_content,
            choiceRegistro?.reasoningContent,
            choiceRegistro?.thinking,
            mensagemChoice?.reasoning
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

    private comoRegistro(valor: unknown): RegistroGenerico | undefined {
        return valor && typeof valor === 'object' ? valor as RegistroGenerico : undefined
    }

    private normalizarHistorico(historico?: MensagemHistoricoIA[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        if (!Array.isArray(historico) || historico.length === 0) return []
        return historico.map((mensagem) => ({
            role: mensagem.role,
            content: mensagem.role === 'user' && mensagem.images?.length
                ? criarConteudoTextoComImagens(mensagem.content, mensagem.images)
                : mensagem.content
        } as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam))
    }
}
