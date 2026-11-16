import type { Modelo } from './contratos';
import { exigeRuntimeLfm3 } from './runtimeModelo';

export const limiteAudioSegundos = 60;
export const taxaAudio = 16000;

/** Habilita anexos de áudio somente quando o modelo informa suporte de entrada. */
export function modeloAceitaAudio(modelo?: Modelo): boolean {
    if (!modelo || modelo.assinatura) return false;
    if (modelo.openrouter) return modelo.openrouter.audio === true;
    return exigeRuntimeLfm3(modelo);
}

export const limiteTrechoFala = 320;

/** Indica quando o motor local consegue devolver as respostas também em voz. */
export function modeloFalaRespostas(modelo?: Modelo): boolean {
    return !!modelo && !modelo.assinatura && !modelo.openrouter && exigeRuntimeLfm3(modelo);
}

/** Remove marcações e blocos de código que não fazem sentido quando lidos em voz alta. */
export function textoParaFala(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[*+-]|\d+[.)])\s+/gm, '')
        .replace(/[*_~|#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Divide a fala em frases agrupadas, para que a reprodução comece antes de toda a síntese. */
export function dividirFala(texto: string, limite = limiteTrechoFala): string[] {
    const frases = texto.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [];
    const trechos: string[] = [];
    let atual = '';
    for (const frase of frases.flatMap((item) => fatiar(item, limite))) {
        if (atual && atual.length + frase.length > limite) {
            trechos.push(atual.trim());
            atual = '';
        }
        atual += frase;
    }
    if (atual.trim()) trechos.push(atual.trim());
    return trechos;
}

function fatiar(frase: string, limite: number): string[] {
    if (frase.length <= limite) return [frase];
    const partes: string[] = [];
    let resto = frase;
    while (resto.length > limite) {
        const espaco = resto.lastIndexOf(' ', limite);
        const corte = espaco > 0 ? espaco + 1 : limite;
        partes.push(resto.slice(0, corte));
        resto = resto.slice(corte);
    }
    return resto ? [...partes, resto] : partes;
}

/** Escolhe o idioma da voz entre português e inglês pelos sinais mais comuns do português. */
export function idiomaFala(texto: string): 'pt' | 'en' {
    return /[ãõçáéíóúâêôà]|\b(que|uma|para|com|voce|isso|nao)\b/i.test(texto) ? 'pt' : 'en';
}

/** Ajusta os tamanhos do WAV transmitido pelo motor, que chega com duração desconhecida no cabeçalho. */
export function corrigirCabecalhoWav(bytes: Uint8Array): Uint8Array {
    const dados = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const texto = (inicio: number) => String.fromCharCode(...bytes.slice(inicio, inicio + 4));
    if (bytes.length < 44 || texto(0) !== 'RIFF' || texto(8) !== 'WAVE') {
        throw new Error('O motor devolveu um áudio inválido.');
    }
    for (let posicao = 12; posicao + 8 <= bytes.length;) {
        if (texto(posicao) === 'data') {
            dados.setUint32(4, bytes.length - 8, true);
            dados.setUint32(posicao + 4, bytes.length - posicao - 8, true);
            return bytes;
        }
        posicao += 8 + dados.getUint32(posicao + 4, true);
    }
    throw new Error('O motor devolveu um áudio sem dados.');
}

/** Codifica amostras mono normalizadas para o formato WAV PCM16 aceito pelo motor. */
export function codificarAudio(amostras: Float32Array): Uint8Array {
    if (!amostras.length || amostras.length > taxaAudio * limiteAudioSegundos) {
        throw new Error('O áudio deve ter duração entre zero e 60 segundos.');
    }
    const bytes = new Uint8Array(44 + amostras.length * 2);
    const dados = new DataView(bytes.buffer);
    const escrever = (posicao: number, texto: string) => {
        for (let i = 0; i < texto.length; i++) bytes[posicao + i] = texto.charCodeAt(i);
    };
    escrever(0, 'RIFF');
    dados.setUint32(4, bytes.length - 8, true);
    escrever(8, 'WAVEfmt ');
    dados.setUint32(16, 16, true);
    dados.setUint16(20, 1, true);
    dados.setUint16(22, 1, true);
    dados.setUint32(24, taxaAudio, true);
    dados.setUint32(28, taxaAudio * 2, true);
    dados.setUint16(32, 2, true);
    dados.setUint16(34, 16, true);
    escrever(36, 'data');
    dados.setUint32(40, amostras.length * 2, true);
    amostras.forEach((valor, indice) => {
        if (!Number.isFinite(valor)) throw new Error('O áudio contém amostras inválidas.');
        const limitado = Math.max(-1, Math.min(1, valor));
        dados.setInt16(44 + indice * 2, limitado * (limitado < 0 ? 32768 : 32767), true);
    });
    return bytes;
}

/** Valida o WAV normalizado na fronteira do processo principal antes de persistir. */
export function validarAudio(bytes: Uint8Array): void {
    const dados = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const texto = (inicio: number, fim: number) => String.fromCharCode(...bytes.slice(inicio, fim));
    if (bytes.length <= 44 || bytes.length > 44 + taxaAudio * limiteAudioSegundos * 2 ||
        texto(0, 4) !== 'RIFF' || texto(8, 16) !== 'WAVEfmt ' || texto(36, 40) !== 'data' ||
        dados.getUint32(4, true) !== bytes.length - 8 || dados.getUint32(16, true) !== 16 ||
        dados.getUint16(20, true) !== 1 || dados.getUint16(22, true) !== 1 ||
        dados.getUint32(24, true) !== taxaAudio || dados.getUint32(28, true) !== taxaAudio * 2 ||
        dados.getUint16(32, true) !== 2 || dados.getUint16(34, true) !== 16 ||
        dados.getUint32(40, true) !== bytes.length - 44 || (bytes.length - 44) % 2 !== 0) {
        throw new Error('Áudio inválido. Envie um WAV PCM16 mono de até 60 segundos.');
    }
}
