import OpenAI from 'openai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { MensagemChat, MensagemHistoricoIA } from '../types'
import { criarConteudoTextoComImagens } from '../historicoMultimodal'
import { normalizarMensagemErroApi, obterStatusErroApi } from '../../../utils/errosApi'
import { normalizarChaveOpenRouter } from '../../../utils/chavesApi'

type RegistroGenerico = Record<string, unknown>
const MODELO_PADRAO_OPENROUTER = 'openrouter/auto'
const PADROES_MODELO_NAO_CONVERSACIONAL = [
    /(?:^|[/-])rerank(?:[/-]|$)/i,
    /(?:^|[/-])embed(?:ding)?(?:[/-]|$)/i,
]

export class OpenRouterProvider implements AIProvider {
    private client: OpenAI | null = null
    private model: string

    constructor(apiKey?: string, model?: string) {
        const chaveNormalizada = normalizarChaveOpenRouter(apiKey || '')
        if (chaveNormalizada) {
            this.client = new OpenAI({
                apiKey: chaveNormalizada,
                baseURL: 'https://openrouter.ai/api/v1',
                maxRetries: 0,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Selene'
                }
            })
        }
        this.model = model?.trim() || MODELO_PADRAO_OPENROUTER
    }

    isReady(): boolean {
        return !!this.client
    }

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        this.validarModeloConversacional()
        try {
            const payload: Record<string, unknown> = {
                messages: mensagens as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }
            if (opcoes.reasoningAtivo === false) {
                payload.include_reasoning = false
            }
            if (typeof opcoes.maxTokens === 'number') {
                payload.max_tokens = opcoes.maxTokens
            }

            const completion = await this.client.chat.completions.create(
                payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
                { signal: opcoes.signal }
            )
            return completion.choices[0].message.content || ''
        } catch (error: unknown) {
            console.error('Erro no chat OpenRouter:', error)
            throw this.normalizarErroOpenRouter(error)
        }
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        this.validarModeloConversacional()
        try {
            const payload: Record<string, unknown> = {
                messages: mensagens as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                model: this.model,
                stream: true
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature
            if (typeof opcoes.maxTokens === 'number') payload.max_tokens = opcoes.maxTokens
            if (opcoes.reasoningAtivo === false) {
                payload.include_reasoning = false
            }

            const stream = await this.client.chat.completions.create(
                payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
                { signal: opcoes.signal }
            )
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
            throw this.normalizarErroOpenRouter(error)
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
        this.validarModeloConversacional()
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
            const payload: Record<string, unknown> = {
                model: this.model, // User responsibility to pick a vision model
                messages: mensagens,
                ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
            }
            if (opcoes.reasoningAtivo === false) {
                payload.include_reasoning = false
            }

            const completion = await this.client.chat.completions.create(
                payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
                { signal: opcoes.signal }
            )
            return completion.choices[0].message.content || ''
        } catch (e) {
            console.error('Falha imagem OpenRouter', e)
            throw this.normalizarErroOpenRouter(e)
        }
    }

    async streamAnalisarImagem(
        pergunta: string,
        dataUrl: string,
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('OpenRouter não configurado.')
        this.validarModeloConversacional()
        
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
            const payload: Record<string, unknown> = {
                model: this.model,
                messages: mensagens,
                stream: true
            }
            if (typeof opcoes.temperature === 'number') payload.temperature = opcoes.temperature
            if (opcoes.reasoningAtivo === false) {
                payload.include_reasoning = false
            }

            const stream = await this.client.chat.completions.create(
                payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
                { signal: opcoes.signal }
            )
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
            throw this.normalizarErroOpenRouter(e)
        }
    }

    private normalizarErroOpenRouter(erro: unknown): Error {
        const status = obterStatusErroApi(erro)
        const mensagem = normalizarMensagemErroApi(
            erro,
            'Falha ao processar mensagem. Verifique sua conexão ou chaves de API.'
        )

        const erroNormalizado = new Error(mensagem)
        if (typeof status === 'number') {
            ;(erroNormalizado as Error & { status?: number }).status = status
        }
        return erroNormalizado
    }

    private validarModeloConversacional(): void {
        if (!PADROES_MODELO_NAO_CONVERSACIONAL.some((padrao) => padrao.test(this.model))) return

        throw new Error(
            `O modelo "${this.model}" existe no OpenRouter, mas não é um modelo de chat. ` +
            'Escolha um LLM conversacional, por exemplo openrouter/auto, openrouter/free, ' +
            'nvidia/nemotron-nano-9b-v2:free ou nvidia/nemotron-nano-12b-v2-vl:free.'
        )
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
                const itemRegistro = this.comoRegistro(item)
                const tipo = String(itemRegistro?.type || '').toLowerCase()
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
