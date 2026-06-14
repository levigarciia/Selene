export interface OpcoesChunkVoz {
    estrategia?: 'fixo' | 'vad'
    intervaloChunkMs?: number
    limiteMinimoChunkMs?: number
    limiteMaximoChunkMs?: number | null
    limiteSilencioMs?: number
    duracaoGracaSilencioMs?: number
    limiteRmsAtivacao?: number
    limiteRmsManutencao?: number
    preRollMs?: number
    multiplicadorRuidoAtivacao?: number
    multiplicadorRuidoManutencao?: number
}

export class AudioService {
    private audioContext: AudioContext | null = null
    private processor: ScriptProcessorNode | null = null
    private mediaStream: MediaStream | null = null
    private readonly onDataAvailable: (blob: Blob) => void
    private readonly onLevel?: (nivel: number) => void
    private readonly onBarras?: (barras: number[]) => void
    private analyser: AnalyserNode | null = null
    private animationFrame: number | null = null
    private accSamples: Float32Array[] = []
    private accLength = 0
    private readonly estrategiaChunk: 'fixo' | 'vad'
    private readonly accTargetMs: number
    private readonly limiteMinimoChunkMs: number
    private readonly limiteMaximoChunkMs: number | null
    private readonly limiteSilencioMs: number
    private readonly duracaoGracaSilencioMs: number
    private readonly limiteRmsAtivacao: number
    private readonly limiteRmsManutencao: number
    private readonly preRollMs: number
    private readonly multiplicadorRuidoAtivacao: number
    private readonly multiplicadorRuidoManutencao: number
    private nivelSuavizado = 0
    private barrasSuavizadas: number[] = []
    private freqData: Uint8Array | null = null
    private timeData: Uint8Array | null = null
    private readonly qtdBarras = 24
    private bufferPreRoll: Float32Array[] = []
    private bufferPreRollLength = 0
    private chunkEmAndamento = false
    private chunkTemFala = false
    private duracaoChunkAtualMs = 0
    private duracaoSilencioAtualMs = 0
    private duracaoSilencioObservadaMs = 0
    private rmsRuidoBase = 0.006
    private rmsSuavizadoVad = 0

    constructor(
        onDataAvailable: (blob: Blob) => void,
        onLevel?: (nivel: number) => void,
        onBarras?: (barras: number[]) => void,
        opcoesChunk: number | OpcoesChunkVoz = 5000
    ) {
        const opcoesNormalizadas = typeof opcoesChunk === 'number'
            ? { estrategia: 'fixo' as const, intervaloChunkMs: opcoesChunk }
            : opcoesChunk

        this.onDataAvailable = onDataAvailable
        this.onLevel = onLevel
        this.onBarras = onBarras
        this.estrategiaChunk = opcoesNormalizadas.estrategia || 'fixo'
        this.accTargetMs = opcoesNormalizadas.intervaloChunkMs ?? 5000
        this.limiteMinimoChunkMs = opcoesNormalizadas.limiteMinimoChunkMs ?? 900
        this.limiteMaximoChunkMs = opcoesNormalizadas.limiteMaximoChunkMs ?? null
        this.limiteSilencioMs = opcoesNormalizadas.limiteSilencioMs ?? 650
        this.duracaoGracaSilencioMs = opcoesNormalizadas.duracaoGracaSilencioMs ?? 450
        this.limiteRmsAtivacao = opcoesNormalizadas.limiteRmsAtivacao ?? 0.022
        this.limiteRmsManutencao = opcoesNormalizadas.limiteRmsManutencao ?? 0.015
        this.preRollMs = opcoesNormalizadas.preRollMs ?? 250
        this.multiplicadorRuidoAtivacao = opcoesNormalizadas.multiplicadorRuidoAtivacao ?? 3.4
        this.multiplicadorRuidoManutencao = opcoesNormalizadas.multiplicadorRuidoManutencao ?? 2.4
    }

    private float32ParaWavPCM16(float32: Float32Array, sampleRate: number): Blob {
        const numCanais = 1
        const amostras = float32.length
        const bytesPorAmostra = 2
        const blocoAmostras = numCanais * bytesPorAmostra
        const bufferWav = new ArrayBuffer(44 + amostras * blocoAmostras)
        const view = new DataView(bufferWav)

        const escreverString = (offset: number, texto: string) => {
            for (let i = 0; i < texto.length; i++) {
                view.setUint8(offset + i, texto.charCodeAt(i))
            }
        }

        let offset = 0
        escreverString(offset, 'RIFF'); offset += 4
        view.setUint32(offset, 36 + amostras * blocoAmostras, true); offset += 4
        escreverString(offset, 'WAVE'); offset += 4
        escreverString(offset, 'fmt '); offset += 4
        view.setUint32(offset, 16, true); offset += 4
        view.setUint16(offset, 1, true); offset += 2
        view.setUint16(offset, numCanais, true); offset += 2
        view.setUint32(offset, sampleRate, true); offset += 4
        view.setUint32(offset, sampleRate * blocoAmostras, true); offset += 4
        view.setUint16(offset, blocoAmostras, true); offset += 2
        view.setUint16(offset, bytesPorAmostra * 8, true); offset += 2
        escreverString(offset, 'data'); offset += 4
        view.setUint32(offset, amostras * blocoAmostras, true); offset += 4

        for (let i = 0; i < amostras; i++) {
            const amostra = Math.max(-1, Math.min(1, float32[i]))
            view.setInt16(offset + i * 2, amostra < 0 ? amostra * 0x8000 : amostra * 0x7FFF, true)
        }

        return new Blob([view], { type: 'audio/wav' })
    }

    private calcularDuracaoMs(totalAmostras: number, sampleRate: number): number {
        return (totalAmostras / sampleRate) * 1000
    }

    private calcularRmsFloat32(dados: Float32Array): number {
        if (!dados.length) {
            return 0
        }

        let soma = 0
        for (let i = 0; i < dados.length; i++) {
            soma += dados[i] * dados[i]
        }
        return Math.sqrt(soma / dados.length)
    }

    private emitirChunkAcumulado(sampleRate: number) {
        if (this.accLength === 0) {
            return
        }

        if (this.estrategiaChunk === 'vad' && !this.chunkTemFala) {
            this.resetarChunkAtual()
            return
        }

        const merged = new Float32Array(this.accLength)
        let offset = 0
        for (const chunk of this.accSamples) {
            merged.set(chunk, offset)
            offset += chunk.length
        }

        this.onDataAvailable(this.float32ParaWavPCM16(merged, sampleRate))
        this.resetarChunkAtual()
    }

    private resetarChunkAtual() {
        this.accSamples = []
        this.accLength = 0
        this.chunkEmAndamento = false
        this.chunkTemFala = false
        this.duracaoChunkAtualMs = 0
        this.duracaoSilencioAtualMs = 0
        this.duracaoSilencioObservadaMs = 0
    }

    private adicionarAoChunk(amostras: Float32Array, sampleRate: number) {
        this.accSamples.push(amostras)
        this.accLength += amostras.length
        this.duracaoChunkAtualMs = this.calcularDuracaoMs(this.accLength, sampleRate)
    }

    private adicionarAoPreRoll(amostras: Float32Array, sampleRate: number) {
        this.bufferPreRoll.push(amostras)
        this.bufferPreRollLength += amostras.length

        while (
            this.bufferPreRoll.length > 0
            && this.calcularDuracaoMs(this.bufferPreRollLength, sampleRate) > this.preRollMs
        ) {
            const removido = this.bufferPreRoll.shift()
            if (!removido) {
                break
            }
            this.bufferPreRollLength = Math.max(0, this.bufferPreRollLength - removido.length)
        }
    }

    private iniciarChunkComPreRoll(sampleRate: number) {
        this.chunkEmAndamento = true
        this.chunkTemFala = false
        this.duracaoSilencioAtualMs = 0

        if (this.bufferPreRoll.length > 0) {
            for (const frame of this.bufferPreRoll) {
                this.adicionarAoChunk(frame, sampleRate)
            }
        }

        this.bufferPreRoll = []
        this.bufferPreRollLength = 0
    }

    private processarFrameFixo(amostras: Float32Array, sampleRate: number) {
        this.accSamples.push(amostras)
        this.accLength += amostras.length

        const duracaoMs = this.calcularDuracaoMs(this.accLength, sampleRate)
        if (this.accLength > 0 && duracaoMs >= this.accTargetMs) {
            this.onDataAvailable(this.float32ParaWavPCM16(this.juntarAmostras(), sampleRate))
            this.resetarChunkAtual()
        }
    }

    private juntarAmostras(): Float32Array {
        const merged = new Float32Array(this.accLength)
        let offset = 0
        for (const chunk of this.accSamples) {
            merged.set(chunk, offset)
            offset += chunk.length
        }
        return merged
    }

    private processarFrameComVad(amostras: Float32Array, sampleRate: number) {
        const rms = this.calcularRmsFloat32(amostras)
        const fatorSuavizacao = rms >= this.rmsSuavizadoVad ? 0.35 : 0.12
        this.rmsSuavizadoVad = this.rmsSuavizadoVad * (1 - fatorSuavizacao) + rms * fatorSuavizacao
        const rmsDeteccao = Math.max(rms, this.rmsSuavizadoVad)
        const duracaoFrameMs = this.calcularDuracaoMs(amostras.length, sampleRate)
        const limiteAtivacaoDinamico = Math.max(
            this.limiteRmsAtivacao,
            this.rmsRuidoBase * this.multiplicadorRuidoAtivacao
        )
        const limiteManutencaoDinamico = Math.max(
            this.limiteRmsManutencao,
            this.rmsRuidoBase * this.multiplicadorRuidoManutencao
        )
        const houveAtivacao = rmsDeteccao >= limiteAtivacaoDinamico
        const manterFala = rmsDeteccao >= limiteManutencaoDinamico

        if (!this.chunkEmAndamento || !manterFala) {
            this.rmsRuidoBase = this.rmsRuidoBase * 0.92 + rms * 0.08
        } else {
            this.rmsRuidoBase = this.rmsRuidoBase * 0.995 + rms * 0.005
        }

        if (!this.chunkEmAndamento) {
            if (!houveAtivacao) {
                this.adicionarAoPreRoll(amostras, sampleRate)
                return
            }

            this.iniciarChunkComPreRoll(sampleRate)
        }

        this.adicionarAoChunk(amostras, sampleRate)

        if (houveAtivacao || manterFala) {
            this.chunkTemFala = true
            this.duracaoSilencioAtualMs = 0
            this.duracaoSilencioObservadaMs = 0
        } else {
            this.duracaoSilencioObservadaMs += duracaoFrameMs
            if (this.duracaoSilencioObservadaMs > this.duracaoGracaSilencioMs) {
                this.duracaoSilencioAtualMs += duracaoFrameMs
            }
        }

        if (
            this.limiteMaximoChunkMs !== null
            && this.limiteMaximoChunkMs > 0
            && this.duracaoChunkAtualMs >= this.limiteMaximoChunkMs
        ) {
            this.emitirChunkAcumulado(sampleRate)
            return
        }

        if (
            this.chunkTemFala
            && this.duracaoChunkAtualMs >= this.limiteMinimoChunkMs
            && this.duracaoSilencioAtualMs >= this.limiteSilencioMs
        ) {
            this.emitirChunkAcumulado(sampleRate)
        }
    }

    private calcularBarrasFrequencia(dados: Uint8Array<ArrayBufferLike>, qtd: number): number[] {
        const barras = new Array(qtd).fill(0)
        const tamanho = dados.length
        if (tamanho === 0) return barras
        const passo = Math.max(1, Math.floor(tamanho / qtd))
        for (let i = 0; i < qtd; i++) {
            const inicio = i * passo
            const fim = Math.min(inicio + passo, tamanho)
            let soma = 0
            for (let j = inicio; j < fim; j++) {
                soma += dados[j]
            }
            const media = soma / Math.max(1, fim - inicio)
            barras[i] = Math.min(1, media / 255)
        }
        return barras
    }

    private calcularNivelAudio(dados: Uint8Array<ArrayBufferLike>): number {
        let soma = 0
        for (let i = 0; i < dados.length; i++) {
            const valor = (dados[i] - 128) / 128
            soma += valor * valor
        }
        return Math.sqrt(soma / dados.length)
    }

    private suavizarBarras(barras: number[]): number[] {
        if (!this.barrasSuavizadas.length) {
            this.barrasSuavizadas = barras.slice()
            return this.barrasSuavizadas
        }
        for (let i = 0; i < barras.length; i++) {
            this.barrasSuavizadas[i] = this.barrasSuavizadas[i] * 0.7 + barras[i] * 0.3
        }
        const suavizadas = this.barrasSuavizadas.map((valor, index, lista) => {
            const anterior = lista[index - 1] ?? valor
            const proximo = lista[index + 1] ?? valor
            return (anterior + valor + proximo) / 3
        })
        this.barrasSuavizadas = suavizadas
        return this.barrasSuavizadas
    }

    private iniciarAnaliseVisual() {
        if (!this.analyser) return
        if (!this.freqData) {
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount)
        }
        if (!this.timeData) {
            this.timeData = new Uint8Array(this.analyser.fftSize)
        }

        const analisar = () => {
            if (!this.analyser || !this.freqData || !this.timeData) return

            if (this.onLevel) {
                this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>)
                const rms = this.calcularNivelAudio(this.timeData)
                this.nivelSuavizado = this.nivelSuavizado * 0.75 + rms * 0.25
                this.onLevel(Math.min(1, Math.max(0, this.nivelSuavizado)))
            }

            if (this.onBarras) {
                this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>)
                const barras = this.calcularBarrasFrequencia(this.freqData, this.qtdBarras)
                this.onBarras(this.suavizarBarras(barras))
            }

            this.animationFrame = requestAnimationFrame(analisar)
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }
        this.animationFrame = requestAnimationFrame(analisar)
    }

    async start(microfoneId?: string) {
        try {
            const restricoesAudio: MediaTrackConstraints = {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
            if (microfoneId) {
                restricoesAudio.deviceId = { exact: microfoneId }
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: restricoesAudio })
            this.mediaStream = stream
            this.audioContext = new AudioContext({ sampleRate: 16000 })
            const source = this.audioContext.createMediaStreamSource(stream)
            this.processor = this.audioContext.createScriptProcessor(2048, 1, 1)
            this.analyser = this.audioContext.createAnalyser()
            this.analyser.fftSize = 256
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount)
            this.timeData = new Uint8Array(this.analyser.fftSize)

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume()
            }

            this.processor.onaudioprocess = (event) => {
                const input = new Float32Array(event.inputBuffer.getChannelData(0))
                const sampleRate = this.audioContext?.sampleRate ?? 16000

                if (this.estrategiaChunk === 'vad') {
                    this.processarFrameComVad(input, sampleRate)
                    return
                }

                this.processarFrameFixo(input, sampleRate)
            }

            source.connect(this.analyser)
            this.analyser.connect(this.processor)
            this.processor.connect(this.audioContext.destination)
            this.iniciarAnaliseVisual()
            console.log('Recording started (ScriptProcessor)')
        } catch (error) {
            console.error('Error accessing microphone:', error)
            throw error
        }
    }

    async resumeIfNeeded() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
        }
    }

    stop() {
        const sampleRateAtual = this.audioContext?.sampleRate ?? 16000

        if (this.accLength > 0) {
            this.emitirChunkAcumulado(sampleRateAtual)
        } else {
            this.resetarChunkAtual()
        }

        if (this.processor) {
            this.processor.disconnect()
            this.processor.onaudioprocess = null
            this.processor = null
        }
        if (this.analyser) {
            this.analyser.disconnect()
            this.analyser = null
        }
        if (this.audioContext) {
            this.audioContext.close()
            this.audioContext = null
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop())
            this.mediaStream = null
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }
        this.bufferPreRoll = []
        this.bufferPreRollLength = 0
        this.nivelSuavizado = 0
        if (this.onLevel) {
            this.onLevel(0)
        }
        if (this.onBarras) {
            this.onBarras(new Array(this.qtdBarras).fill(0))
        }
        this.barrasSuavizadas = []
        this.freqData = null
        this.timeData = null
        this.rmsRuidoBase = 0.006
        this.rmsSuavizadoVad = 0
        console.log('Recording stopped')
    }
}
