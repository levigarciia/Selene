import { expect, test } from 'bun:test';
import {
    codificarAudio,
    corrigirCabecalhoWav,
    dividirFala,
    idiomaFala,
    modeloFalaRespostas,
    textoParaFala,
} from '../shared/audio';

const lfm = { id: 'a', nome: 'LFM3 Omni 2B', caminho: 'lfm3-omni-2b-q4.gguf', tamanho: 1 };

test('fala somente com o LFM3 Omni local', () => {
    expect(modeloFalaRespostas(lfm)).toBe(true);
    expect(modeloFalaRespostas({ ...lfm, nome: 'Qwen3.5 9B', caminho: 'qwen.gguf' })).toBe(false);
    expect(modeloFalaRespostas(undefined)).toBe(false);
});

test('remove marcações e código antes da leitura', () => {
    const texto = '# Título\n\n* **Um** item com `x` e [link](http://a.b)\n\n```ts\nconst a = 1;\n```\nFim.';
    expect(textoParaFala(texto)).toBe('Título Um item com x e link Fim.');
});

test('agrupa frases sem ultrapassar o limite e sem perder texto', () => {
    const texto = 'Primeira frase. Segunda frase! Terceira? ' + 'palavra '.repeat(30);
    const trechos = dividirFala(texto, 40);
    expect(trechos.every((trecho) => trecho.length <= 40)).toBe(true);
    expect(trechos.join(' ').replace(/\s+/g, ' ')).toBe(texto.trim());
});

test('detecta português e inglês', () => {
    expect(idiomaFala('Um mais um é dois.')).toBe('pt');
    expect(idiomaFala('One plus one is two.')).toBe('en');
});

test('corrige os tamanhos do WAV transmitido', () => {
    const wav = codificarAudio(new Float32Array(100));
    const dados = new DataView(wav.buffer);
    dados.setUint32(4, 0xffffffff, true);
    dados.setUint32(40, 0xffffffff, true);
    corrigirCabecalhoWav(wav);
    expect(dados.getUint32(4, true)).toBe(wav.length - 8);
    expect(dados.getUint32(40, true)).toBe(200);
    expect(() => corrigirCabecalhoWav(new Uint8Array(50))).toThrow();
});
