export class AudioService {
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private mediaStream: MediaStream | null = null;
    private onDataAvailable: (blob: Blob) => void;
    private onLevel?: (nivel: number) => void;
    private analyser: AnalyserNode | null = null;
    private animationFrame: number | null = null;
    private accSamples: Float32Array[] = [];
    private accLength = 0;
    private readonly accTargetMs = 5000; // flush a cada ~5s
    private nivelSuavizado = 0;

    constructor(onDataAvailable: (blob: Blob) => void, onLevel?: (nivel: number) => void) {
        this.onDataAvailable = onDataAvailable;
        this.onLevel = onLevel;
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

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
            this.audioContext = new AudioContext({ sampleRate: 16000 });
            const source = this.audioContext.createMediaStreamSource(stream);
            this.processor = this.audioContext.createScriptProcessor(8192, 1, 1);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            this.processor.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                // Acumula áudio
                this.accSamples.push(new Float32Array(input));
                this.accLength += input.length;

                if (this.onLevel) {
                    const soma = input.reduce((acc, val) => acc + val * val, 0);
                    const rms = Math.sqrt(soma / input.length);
                    this.nivelSuavizado = this.nivelSuavizado * 0.8 + rms * 0.2;
                    this.onLevel(Math.min(1, Math.max(0, this.nivelSuavizado)));
                }

                const accDurationMs = (this.accLength / this.audioContext!.sampleRate) * 1000;
                if (this.accLength > 0 && accDurationMs >= this.accTargetMs) {
                    this.flushAcumulado(this.audioContext!.sampleRate);
                }
            };

            source.connect(this.analyser);
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            console.log('Recording started (ScriptProcessor)');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    stop() {
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
        console.log('Recording stopped');
    }
}
