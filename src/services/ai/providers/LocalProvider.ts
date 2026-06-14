import OpenAI from 'openai'
import type { AIProvider, OpcoesRequisicaoIA, MetaFimStream } from '../AIProvider'
import type { MensagemChat } from '../types'

type RegistroGenerico = Record<string, unknown>

export class LocalProvider implements AIProvider {
    private client: OpenAI | null = null
    private baseUrlAtual = ''
    private readonly model: string

    constructor(model?: string) {
        this.model = model?.trim() || 'qwen3.5-4b-q4'
    }

    isReady(): boolean {
        return !!this.model && !!window.electronAPI?.localLLM
    }

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        const { client, model } = await this.obterClientEDefinirModelo()
        const payload: Record<string, unknown> = {
            messages: mensagens as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            model: model,
            ...(typeof opcoes.temperature === 'number' ? { temperature: opcoes.temperature } : {})
        }
        if (typeof opcoes.maxTokens === 'number') {
            payload.max_tokens = opcoes.maxTokens
        }
        if (opcoes.reasoningAtivo === false) {
            payload.reasoning = false
            payload.reasoning_budget = 0
            payload.chat_template_kwargs = {
                enable_thinking: false,
                thinking: false,
                reasoning: false
            }
        }

        const completion = await client.chat.completions.create(
            payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
            { signal: opcoes.signal }
        )
        return completion.choices?.[0]?.message?.content || ''
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        const api = window.electronAPI?.localLLM
        if (!api) {
            throw new Error('Host local de IA indisponível neste ambiente.')
        }

        const reqId = Math.random().toString(36).substring(2, 11)

        let abortListener: (() => void) | undefined
        if (opcoes.signal) {
            abortListener = () => {
                void api.cancelStreamChat(reqId)
            }
            opcoes.signal.addEventListener('abort', abortListener)
        }

        let finishReason: MetaFimStream['finishReason'] = null
        let resolvePromessa!: () => void
        let rejeitaPromessa!: (err: Error) => void

        const promessa = new Promise<void>((resolve, reject) => {
            resolvePromessa = resolve
            rejeitaPromessa = reject
        })

        const limparChunks = api.onStreamChunk((evento) => {
            if (evento.reqId !== reqId) return
            
            const linha = evento.data
            if (linha.startsWith('data: ')) {
                const dados = linha.substring(6).trim()
                if (dados === '[DONE]') return

                try {
                    const parsed = JSON.parse(dados) as RegistroGenerico
                    const choices = Array.isArray(parsed.choices) ? parsed.choices : []
                    const choice = this.comoRegistro(choices[0])
                    finishReason = this.normalizarFinishReason(this.extrairTextoVariado(choice?.finish_reason))
                    const delta = choice?.delta

                    const partes = this.extrairPartesStream(choice, delta)
                    if (partes.raciocinio) {
                        opcoes.onEventoStream?.({
                            tipo: 'raciocinio',
                            texto: partes.raciocinio,
                            origem: 'delta_raciocinio'
                        })
                    }
                    if (partes.conteudo) {
                        onChunk(partes.conteudo)
                    }
                } catch (err) {
                    console.warn('[LocalProvider] Erro ao processar chunk JSON:', err, dados)
                }
            }
        })

        const limparFim = api.onStreamEnd((evento) => {
            if (evento.reqId !== reqId) return
            
            limparListeners()
            if (evento.success) {
                opcoes.onFimStream?.({ finishReason })
                resolvePromessa()
            } else {
                rejeitaPromessa(new Error(evento.error || 'Erro desconhecido no streaming local.'))
            }
        })

        function limparListeners() {
            limparChunks()
            limparFim()
            if (opcoes.signal && abortListener) {
                opcoes.signal.removeEventListener('abort', abortListener)
            }
        }

        try {
            await api.streamChat(reqId, this.model, mensagens, {
                temperature: opcoes.temperature,
                maxTokens: opcoes.maxTokens,
                reasoningAtivo: opcoes.reasoningAtivo
            })
            await promessa
        } catch (erro) {
            limparListeners()
            throw erro
        }
    }

    async transcribe(): Promise<string | null> {
        return null
    }

    async analisarImagem(): Promise<string> {
        throw new Error('O provedor local ainda não suporta análise de imagem no v1.')
    }

    async streamAnalisarImagem(): Promise<void> {
        throw new Error('O provedor local ainda não suporta análise de imagem no v1.')
    }

    private async obterClientEDefinirModelo(): Promise<{ client: OpenAI; model: string }> {
        const api = window.electronAPI?.localLLM
        if (!api) {
            throw new Error('Host local de IA indisponível neste ambiente.')
        }

        const servidor = await api.ensureServer(this.model)
        if (!servidor.success || !servidor.baseUrl) {
            throw new Error(servidor.error || 'Falha ao iniciar host local de IA.')
        }

        if (!this.client || this.baseUrlAtual !== servidor.baseUrl) {
            this.baseUrlAtual = servidor.baseUrl
            this.client = new OpenAI({
                apiKey: 'selene-local',
                baseURL: servidor.baseUrl,
                dangerouslyAllowBrowser: true
            })
        }

        return { client: this.client, model: servidor.modelId || this.model }
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

        if (!conteudo) {
            conteudo += [
                deltaRegistro?.text,
                choiceRegistro?.text,
                choiceRegistro?.content,
                mensagemChoice?.content
            ].map((valor) => this.extrairTextoVariado(valor)).join('')
        }

        if (!raciocinio) {
            raciocinio += [
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
        }

        return { conteudo, raciocinio }
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

}
