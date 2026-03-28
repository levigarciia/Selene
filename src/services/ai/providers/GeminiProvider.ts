import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider } from '../AIProvider'
import type { OpcoesRequisicaoIA } from '../AIProvider'
import type { MetaFimStream } from '../AIProvider'
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

    async chat(mensagens: MensagemChat[], opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        try {
            const systemInstruction = mensagens.find((m) => m.role === 'system')?.content
            const conteudo = mensagens
                .filter((m) => m.role !== 'system')
                .map((m) => `${m.role === 'assistant' ? 'Assistente:' : 'Usuário:'}\n${m.content}`)
                .join('\n\n')

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
        } catch (error: any) {
            console.error('Erro no chat Gemini:', error)
            throw new Error(`Erro Gemini: ${error.message || 'Erro desconhecido'}`)
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
            const systemInstruction = mensagens.find((m) => m.role === 'system')?.content
            const conteudo = mensagens
                .filter((m) => m.role !== 'system')
                .map((m) => `${m.role === 'assistant' ? 'Assistente:' : 'Usuário:'}\n${m.content}`)
                .join('\n\n')

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
                finishReason = this.normalizarFinishReasonGemini((chunk as any)?.candidates?.[0]?.finishReason)
                const partes = this.extrairPartesTextoGemini(chunk as any)
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

    async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
        if (!this.client) throw new Error('Gemini não configurado.')
        if (opcoes.signal?.aborted) throw criarErroAbortado()
        const { base64, mimeType } = this.extrairBase64(dataUrl)
        const systemInstruction = this.resolverInstrucaoSistemaImagem(opcoes)

        const generationConfig = this.construirConfigGeracao(opcoes)
        const model = this.client.getGenerativeModel({
            model: 'gemini-2.0-flash',
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(generationConfig ? { generationConfig } : {})
        })

        const result = await model.generateContent([
            { text: pergunta },
            { inlineData: { data: base64, mimeType } }
        ])
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
            const { base64, mimeType } = this.extrairBase64(dataUrl)
            const systemInstruction = this.resolverInstrucaoSistemaImagem(opcoes)

            const generationConfig = this.construirConfigGeracao(opcoes)
            const model = this.client.getGenerativeModel({
                model: 'gemini-2.0-flash',
                ...(systemInstruction ? { systemInstruction } : {}),
                ...(generationConfig ? { generationConfig } : {})
            })

            const result = await model.generateContentStream([
                { text: pergunta },
                { inlineData: { data: base64, mimeType } }
            ])
            let finishReason: MetaFimStream['finishReason'] = null

            for await (const chunk of result.stream) {
                if (opcoes.signal?.aborted) throw criarErroAbortado()
                finishReason = this.normalizarFinishReasonGemini((chunk as any)?.candidates?.[0]?.finishReason)
                const partes = this.extrairPartesTextoGemini(chunk as any)
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
        } catch (error: any) {
            console.error('Erro no streaming de imagem Gemini:', error)
            throw new Error(`Erro Gemini: ${error.message || 'Erro desconhecido'}`)
        }
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

    private extrairPartesTextoGemini(chunk: any): { conteudo: string; raciocinio: string } {
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
}

function criarErroAbortado(): Error {
    const erro = new Error('Abortado pelo usuário')
    ;(erro as Error & { name?: string }).name = 'AbortError'
    return erro
}
