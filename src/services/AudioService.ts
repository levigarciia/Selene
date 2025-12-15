export class AudioService {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private onDataAvailable: (blob: Blob) => void;

    constructor(onDataAvailable: (blob: Blob) => void) {
        this.onDataAvailable = onDataAvailable;
    }

    private async acelerarAudio(blob: Blob, fator: number): Promise<Blob> {
        if (typeof window === 'undefined') return blob;
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioCtx) return blob;

        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioCtx = new AudioCtx();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

            const alvoLength = Math.max(1, Math.ceil(decoded.length / fator));
            const offline = new OfflineAudioContext(decoded.numberOfChannels, alvoLength, decoded.sampleRate);

            const source = offline.createBufferSource();
            source.buffer = decoded;
            source.playbackRate.value = fator;
            source.connect(offline.destination);
            source.start(0);

            const renderizado = await offline.startRendering();
            audioCtx.close();

            const wav = this.audioBufferParaWav(renderizado);
            return wav;
        } catch (erro) {
            console.warn('Falha ao acelerar audio, usando blob original', erro);
            return blob;
        }
    }

    private audioBufferParaWav(buffer: AudioBuffer): Blob {
        const numCanais = buffer.numberOfChannels;
        const amostras = buffer.length;
        const taxaAmostragem = buffer.sampleRate;
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
        view.setUint32(offset, taxaAmostragem, true); offset += 4;
        view.setUint32(offset, taxaAmostragem * blocoAmostras, true); offset += 4; // ByteRate
        view.setUint16(offset, blocoAmostras, true); offset += 2; // BlockAlign
        view.setUint16(offset, bytesPorAmostra * 8, true); offset += 2; // BitsPerSample
        escreverString(offset, 'data'); offset += 4;
        view.setUint32(offset, amostras * blocoAmostras, true); offset += 4;

        const canais: Float32Array[] = [];
        for (let c = 0; c < numCanais; c++) {
            canais.push(buffer.getChannelData(c));
        }

        let idx = 0;
        for (let i = 0; i < amostras; i++) {
            for (let c = 0; c < numCanais; c++) {
                const amostra = Math.max(-1, Math.min(1, canais[c][i]));
                view.setInt16(offset + idx, amostra < 0 ? amostra * 0x8000 : amostra * 0x7FFF, true);
                idx += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    private async processarChunk(chunk: Blob) {
        const acelerado = await this.acelerarAudio(chunk, 2);
        this.onDataAvailable(acelerado);
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    void this.processarChunk(event.data);
                }
            };

            // 3-second chunks for better "real-time" feel without spamming API
            this.mediaRecorder.start(3000);
            console.log('Recording started');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            console.log('Recording stopped');
        }
    }
}
