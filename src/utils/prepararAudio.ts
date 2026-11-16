import { codificarAudio, limiteAudioSegundos, taxaAudio } from '../../shared/audio';
import type { EntradaImagem } from '../../shared/contratos';

/** Converte formatos decodificáveis pelo navegador em WAV mono limitado antes da importação. */
export async function prepararAudio(arquivo: File): Promise<EntradaImagem> {
    const contexto = new AudioContext({ sampleRate: taxaAudio });
    try {
        const audio = await contexto.decodeAudioData(await arquivo.arrayBuffer());
        if (!audio.length || audio.duration > limiteAudioSegundos) {
            throw new Error('Cada áudio deve ter até 60 segundos.');
        }
        const amostras = new Float32Array(audio.length);
        for (let canal = 0; canal < audio.numberOfChannels; canal++) {
            const dados = audio.getChannelData(canal);
            for (let i = 0; i < amostras.length; i++) amostras[i] += dados[i] / audio.numberOfChannels;
        }
        const bytes = codificarAudio(amostras);
        const dados = await new Promise<string>((resolver, rejeitar) => {
            const leitor = new FileReader();
            leitor.onload = () => resolver(String(leitor.result));
            leitor.onerror = () => rejeitar(new Error('Não foi possível ler o áudio.'));
            leitor.readAsDataURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }));
        });
        return { nome: arquivo.name, dados };
    } finally {
        await contexto.close();
    }
}
