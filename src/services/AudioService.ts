export class AudioService {
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private mediaStream: MediaStream | null = null;
    private onDataAvailable: (blob: Blob) => void;
    private onLevel?: (nivel: number) => void;
    private onBarras?: (barras: number[]) => void;
    private analyser: AnalyserNode | null = null;
    private animationFrame: number | null = null;
    private accSamples: Float32Array[] = [];
    private accLength = 0;
    private readonly accTargetMs = 5000; // flush a cada ~5s
    private nivelSuavizado = 0;
    private barrasSuavizadas: number[] = [];
    private freqData: Uint8Array | null = null;
    private timeData: Uint8Array | null = null;
    private readonly qtdBarras = 24;

    constructor(onDataAvailable: (blob: Blob) => void, onLevel?: (nivel: number) => void, onBarras?: (barras: number[]) => void) {
        this.onDataAvailable = onDataAvailable;
        this.onLevel = onLevel;
        this.onBarras = onBarras;
    }

    // Converte Float32 -> PCM16 e gera um WAV pequeno por chunk
    private float32ParaWavPCM16(float32: Float32Array, sampleRate: number): Blob {
        const numCanais = 1;
        const amostras = float32.length;
        const bytesPorAmostra = 2;
        const blocoAmostras = numCanais * bytesPorAmostra;
        const bufferWav = new ArrayBuffer(44 + amostras * blocoAmostras);
        const view = new DataView(bufferWav);

        const escreverString = (offset: number, texto: string) => {
            for (let i = 0; i < texto.length; i++) {
                view.setUint8(offset + i, texto.charCodeAt(i));
            }
        };

        let offset = 0;
        escreverString(offset, 'RIFF'); offset += 4;
        view.setUint32(offset, 36 + amostras * blocoAmostras, true); offset += 4;
        escreverString(offset, 'WAVE'); offset += 4;
        escreverString(offset, 'fmt '); offset += 4;
        view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
        view.setUint16(offset, 1, true); offset += 2; // PCM
        view.setUint16(offset, numCanais, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, sampleRate * blocoAmostras, true); offset += 4; // ByteRate
        view.setUint16(offset, blocoAmostras, true); offset += 2; // BlockAlign
        view.setUint16(offset, bytesPorAmostra * 8, true); offset += 2; // BitsPerSample
        escreverString(offset, 'data'); offset += 4;
        view.setUint32(offset, amostras * blocoAmostras, true); offset += 4;

        for (let i = 0; i < amostras; i++) {
            const amostra = Math.max(-1, Math.min(1, float32[i]));
            view.setInt16(offset + i * 2, amostra < 0 ? amostra * 0x8000 : amostra * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    private flushAcumulado(sampleRate: number) {
        if (this.accLength === 0) return;
        const merged = new Float32Array(this.accLength);
        let offset = 0;
        for (const chunk of this.accSamples) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        const wav = this.float32ParaWavPCM16(merged, sampleRate);
        this.onDataAvailable(wav);
        this.accSamples = [];
        this.accLength = 0;
    }

    private calcularBarrasFrequencia(dados: Uint8Array, qtd: number): number[] {
        const barras = new Array(qtd).fill(0);
        const tamanho = dados.length;
        if (tamanho === 0) return barras;
        const passo = Math.max(1, Math.floor(tamanho / qtd));
        for (let i = 0; i < qtd; i++) {
            const inicio = i * passo;
            const fim = Math.min(inicio + passo, tamanho);
            let soma = 0;
            for (let j = inicio; j < fim; j++) {
                soma += dados[j];
            }
            const media = soma / Math.max(1, fim - inicio);
            barras[i] = Math.min(1, media / 255);
        }
        return barras;
    }

    private calcularNivelAudio(dados: Uint8Array): number {
        let soma = 0;
        for (let i = 0; i < dados.length; i++) {
            const valor = (dados[i] - 128) / 128;
            soma += valor * valor;
        }
        return Math.sqrt(soma / dados.length);
    }

    private suavizarBarras(barras: number[]): number[] {
        if (!this.barrasSuavizadas.length) {
            this.barrasSuavizadas = barras.slice();
            return this.barrasSuavizadas;
        }
        for (let i = 0; i < barras.length; i++) {
            this.barrasSuavizadas[i] = this.barrasSuavizadas[i] * 0.7 + barras[i] * 0.3;
        }
        const suavizadas = this.barrasSuavizadas.map((valor, index, lista) => {
            const anterior = lista[index - 1] ?? valor;
            const proximo = lista[index + 1] ?? valor;
            return (anterior + valor + proximo) / 3;
        });
        this.barrasSuavizadas = suavizadas;
        return this.barrasSuavizadas;
    }

    private iniciarAnaliseVisual() {
        if (!this.analyser) return;
        if (!this.freqData) {
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (!this.timeData) {
            this.timeData = new Uint8Array(this.analyser.fftSize);
        }

        const analisar = () => {
            if (!this.analyser || !this.freqData || !this.timeData) return;

            if (this.onLevel) {
                this.analyser.getByteTimeDomainData(this.timeData);
                const rms = this.calcularNivelAudio(this.timeData);
                this.nivelSuavizado = this.nivelSuavizado * 0.75 + rms * 0.25;
                this.onLevel(Math.min(1, Math.max(0, this.nivelSuavizado)));
            }

            if (this.onBarras) {
                this.analyser.getByteFrequencyData(this.freqData);
                const barras = this.calcularBarrasFrequencia(this.freqData, this.qtdBarras);
                this.onBarras(this.suavizarBarras(barras));
            }

            this.animationFrame = requestAnimationFrame(analisar);
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(analisar);
    }

    async start(microfoneId?: string) {
        try {
            const restricoesAudio: MediaTrackConstraints = {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            };
            if (microfoneId) {
                restricoesAudio.deviceId = { exact: microfoneId };
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: restricoesAudio });
            this.mediaStream = stream;
            this.audioContext = new AudioContext({ sampleRate: 16000 });
            const source = this.audioContext.createMediaStreamSource(stream);
            this.processor = this.audioContext.createScriptProcessor(8192, 1, 1);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.fftSize);

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.processor.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                // Acumula áudio
                this.accSamples.push(new Float32Array(input));
                this.accLength += input.length;

                const accDurationMs = (this.accLength / this.audioContext!.sampleRate) * 1000;
                if (this.accLength > 0 && accDurationMs >= this.accTargetMs) {
                    this.flushAcumulado(this.audioContext!.sampleRate);
                }
            };

            source.connect(this.analyser);
            this.analyser.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            this.iniciarAnaliseVisual();
            console.log('Recording started (ScriptProcessor)');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    async resumeIfNeeded() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    stop() {
        const sampleRateAtual = this.audioContext?.sampleRate ?? 16000;

        // Garante a transcrição do último trecho, mesmo em gravações curtas.
        if (this.accLength > 0) {
            this.flushAcumulado(sampleRateAtual);
        }

        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
            this.processor = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.accSamples = [];
        this.accLength = 0;
        this.nivelSuavizado = 0;
        if (this.onLevel) {
            this.onLevel(0);
        }
        if (this.onBarras) {
            this.onBarras(new Array(this.qtdBarras).fill(0));
        }
        this.barrasSuavizadas = [];
        this.freqData = null;
        this.timeData = null;
        console.log('Recording stopped');
    }
}
