import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
import type { ConteudoMultimodal, MensagemChat } from '../types'

type GeminiChunkParcial = {
    candidates?: Array<{
        finishReason?: string
        content?: {
            parts?: Array<{ text?: string; thought?: boolean; type?: string }>
        }
    }>
    text?: () => string
}

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

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        try {
            const { systemInstruction, conteudo } = this.normalizarMensagensParaGemini(mensagens)

            const generationConfig = this.construirConfigGeracao(opcoes)
            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction,
                ...(generationConfig ? { generationConfig } : {})
            })
            const result = await model.generateContent(conteudo)
            if (opcoes.signal?.aborted) throw criarErroAbortado()
            const response = await result.response
            return response.text()
        } catch (error: unknown) {
            console.error('Erro no chat Gemini:', error)
            throw new Error(`Erro Gemini: ${this.obterMensagemErro(error, 'Erro desconhecido')}`)
        }
    }

    async streamChat(
        mensagens: MensagemChat[],
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        try {
            const { systemInstruction, conteudo } = this.normalizarMensagensParaGemini(mensagens)

            const generationConfig = this.construirConfigGeracao(opcoes)
            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction,
                ...(generationConfig ? { generationConfig } : {})
            })

            const result = await model.generateContentStream(conteudo)
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of result.stream) {
                if (opcoes.signal?.aborted) throw criarErroAbortado()
                const chunkParcial = chunk as GeminiChunkParcial
                finishReason = this.normalizarFinishReasonGemini(chunkParcial.candidates?.[0]?.finishReason)
                const partes = this.extrairPartesTextoGemini(chunkParcial)
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
            }
            opcoes.onFimStream?.({ finishReason })
        } catch (error: unknown) {
            console.error('Erro no streaming Gemini:', error)
            throw new Error(`Erro Gemini: ${this.obterMensagemErro(error, 'Erro desconhecido')}`)
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

    async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        const systemInstruction = this.resolverInstrucaoSistemaImagem(opcoes)
        const mensagens: MensagemChat[] = []
        if (systemInstruction) {
            mensagens.push({ role: 'system', content: systemInstruction })
        }
        if (Array.isArray(opcoes.historico) && opcoes.historico.length > 0) {
            mensagens.push(...opcoes.historico.map((mensagem) => ({
                role: mensagem.role,
                content: mensagem.images?.length
                    ? this.criarConteudoMultimodalGemini(mensagem.content, mensagem.images)
                    : mensagem.content
            })))
        }
        mensagens.push({
            role: 'user',
            content: this.criarConteudoMultimodalGemini(pergunta, [dataUrl])
        })
        const promptGemini = this.normalizarMensagensParaGemini(mensagens)

        const generationConfig = this.construirConfigGeracao(opcoes)
        const model = this.client.getGenerativeModel({
            model: 'gemini-2.0-flash',
            ...(promptGemini.systemInstruction ? { systemInstruction: promptGemini.systemInstruction } : {}),
            ...(generationConfig ? { generationConfig } : {})
        })

        const result = await model.generateContent(promptGemini.conteudo)
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        return result.response.text()
    }

    async streamAnalisarImagem(
        pergunta: string,
        dataUrl: string,
        onChunk: (chunk: string) => void,
        opcoes: OpcoesRequisicaoIA = {}
    ): Promise<void> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        try {
            const systemInstruction = this.resolverInstrucaoSistemaImagem(opcoes)
            const mensagens: MensagemChat[] = []
            if (systemInstruction) {
                mensagens.push({ role: 'system', content: systemInstruction })
            }
            if (Array.isArray(opcoes.historico) && opcoes.historico.length > 0) {
                mensagens.push(...opcoes.historico.map((mensagem) => ({
                    role: mensagem.role,
                    content: mensagem.images?.length
                        ? this.criarConteudoMultimodalGemini(mensagem.content, mensagem.images)
                        : mensagem.content
                })))
            }
            mensagens.push({
                role: 'user',
                content: this.criarConteudoMultimodalGemini(pergunta, [dataUrl])
            })
            const promptGemini = this.normalizarMensagensParaGemini(mensagens)

            const generationConfig = this.construirConfigGeracao(opcoes)
            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                ...(promptGemini.systemInstruction ? { systemInstruction: promptGemini.systemInstruction } : {}),
                ...(generationConfig ? { generationConfig } : {})
            })

            const result = await model.generateContentStream(promptGemini.conteudo)
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of result.stream) {
                if (opcoes.signal?.aborted) throw criarErroAbortado()
                const chunkParcial = chunk as GeminiChunkParcial
                finishReason = this.normalizarFinishReasonGemini(chunkParcial.candidates?.[0]?.finishReason)
                const partes = this.extrairPartesTextoGemini(chunkParcial)
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
            }
            opcoes.onFimStream?.({ finishReason })
        } catch (error: unknown) {
            console.error('Erro no streaming de imagem Gemini:', error)
            throw new Error(`Erro Gemini: ${this.obterMensagemErro(error, 'Erro desconhecido')}`)
        }
    }

    private obterMensagemErro(erro: unknown, fallback: string): string {
        if (erro instanceof Error && erro.message) {
            return erro.message
        }
        return fallback
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

    private criarConteudoMultimodalGemini(texto: string, imagens: string[]): ConteudoMultimodal[] {
        const conteudo: ConteudoMultimodal[] = []
        if (texto.trim()) {
            conteudo.push({ type: 'text', text: texto })
        }
        for (const imagem of imagens) {
            conteudo.push({ type: 'image_url', image_url: { url: imagem } })
        }
        return conteudo
    }

    private pareceRecusa(texto: string) {
        const t = texto.toLowerCase()
        return t.includes('não consigo ouvir') || t.includes('cannot listen')
    }

    private construirConfigGeracao(opcoes: OpcoesRequisicaoIA): { temperature?: number } | undefined {
        const config: { temperature?: number } = {}
        if (typeof opcoes.temperature === 'number') {
            config.temperature = opcoes.temperature
        }
        if (Object.keys(config).length === 0) return undefined
        return config
    }

    private resolverInstrucaoSistemaImagem(opcoes: OpcoesRequisicaoIA): string | undefined {
        if (Object.prototype.hasOwnProperty.call(opcoes, 'systemPromptOverride')) {
            const sobrescrita = (opcoes.systemPromptOverride || '').trim()
            return sobrescrita || undefined
        }

        return 'Você é um assistente que analisa imagens e responde em português do Brasil, de forma objetiva.'
    }

    private normalizarFinishReasonGemini(valor: string | undefined): MetaFimStream['finishReason'] {
        if (!valor) return null
        const motivo = valor.toUpperCase()
        if (motivo === 'STOP' || motivo === 'FINISH_REASON_STOP') return 'stop'
        if (motivo.includes('MAX_TOKENS') || motivo.includes('TOKEN') || motivo.includes('LENGTH')) return 'length'
        return 'other'
    }

    private extrairPartesTextoGemini(chunk: GeminiChunkParcial): { conteudo: string; raciocinio: string } {
        const partes = chunk?.candidates?.[0]?.content?.parts
        if (!Array.isArray(partes) || partes.length === 0) {
            const texto = typeof chunk?.text === 'function' ? chunk.text() : ''
            return { conteudo: texto || '', raciocinio: '' }
        }

        let conteudo = ''
        let raciocinio = ''

        for (const parte of partes) {
            const textoParte = typeof parte?.text === 'string' ? parte.text : ''
            if (!textoParte) continue

            const ehRaciocinio = Boolean(parte?.thought) || parte?.type === 'thought'
            if (ehRaciocinio) {
                raciocinio += textoParte
            } else {
                conteudo += textoParte
            }
        }

        return { conteudo, raciocinio }
    }

    private normalizarMensagensParaGemini(mensagens: MensagemChat[]): {
        systemInstruction?: string
        conteudo: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>
    } {
        const system = mensagens.find((mensagem) => mensagem.role === 'system')
        const systemInstruction = typeof system?.content === 'string' ? system.content : undefined
        const conteudo: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = []

        for (const mensagem of mensagens) {
            if (mensagem.role === 'system') continue

            conteudo.push({ text: `${mensagem.role === 'assistant' ? 'Assistente' : 'Usuário'}:\n` })

            if (typeof mensagem.content === 'string') {
                conteudo.push({ text: mensagem.content })
            } else {
                for (const parte of mensagem.content) {
                    if (parte.type === 'text') {
                        conteudo.push({ text: parte.text })
                        continue
                    }

                    const { base64, mimeType } = this.extrairBase64(parte.image_url.url)
                    conteudo.push({
                        inlineData: {
                            data: base64,
                            mimeType
                        }
                    })
                }
            }

            conteudo.push({ text: '\n\n' })
        }

        return { systemInstruction, conteudo }
    }
}

function criarErroAbortado(): Error {
    const erro = new Error('Abortado pelo usuário')
    ;(erro as Error & { name?: string }).name = 'AbortError'
    return erro
}
