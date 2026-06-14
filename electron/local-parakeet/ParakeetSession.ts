import { EventEmitter } from 'events'
import { parakeetModelManager, type ParakeetModelName } from './ParakeetModelManager.js'

export interface ParakeetSessionConfig {
    modelName: ParakeetModelName
    language?: string
    speakerLabel?: string
}

type TarefaFila = {
    wavData: Buffer
    chunkIndex: number
}

export class ParakeetSession extends EventEmitter {
    public readonly sessionId: string
    public readonly speakerLabel: string | null

    private readonly modelName: ParakeetModelName
    private readonly language: string
    private fila: TarefaFila[] = []
    private processando = false
    private ativo = true
    private contadorChunks = 0
    private promessaDrenagem: Promise<void> = Promise.resolve()

    constructor(sessionId: string, config: ParakeetSessionConfig) {
        super()
        this.sessionId = sessionId
        this.modelName = config.modelName
        this.language = config.language || 'multi'
        this.speakerLabel = config.speakerLabel || null
    }

    appendChunk(wavData: Buffer): void {
        if (!this.ativo) {
            return
        }

        this.contadorChunks += 1
        this.fila.push({
            wavData,
            chunkIndex: this.contadorChunks
        })
        void this.processarFila()
    }

    async stop(): Promise<void> {
        this.ativo = false
        await this.promessaDrenagem
    }

    getInfo() {
        return {
            sessionId: this.sessionId,
            modelName: this.modelName,
            language: this.language,
            speakerLabel: this.speakerLabel,
            active: this.ativo,
            pendingChunks: this.fila.length
        }
    }

    private async processarFila(): Promise<void> {
        if (this.processando) {
            return this.promessaDrenagem
        }

        this.processando = true
        this.promessaDrenagem = (async () => {
            while (this.fila.length > 0) {
                const item = this.fila.shift()
                if (!item) {
                    continue
                }

                try {
                    const sidecar = await parakeetModelManager.getSidecar()
                    const resultado = await sidecar.transcreverWav(this.modelName, item.wavData, this.language)
                    this.emit('complete', {
                        sessionId: this.sessionId,
                        text: (resultado.text || '').trim(),
                        chunkIndex: item.chunkIndex,
                        speakerLabel: this.speakerLabel || undefined
                    })
                } catch (erro) {
                    this.emit('error', {
                        sessionId: this.sessionId,
                        chunkIndex: item.chunkIndex,
                        error: erro instanceof Error ? erro.message : 'Falha ao transcrever chunk',
                        speakerLabel: this.speakerLabel || undefined
                    })
                }
            }
        })()

        try {
            await this.promessaDrenagem
        } finally {
            this.processando = false
        }
    }
}
