import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codificarAudio, modeloAceitaAudio, validarAudio } from '../shared/audio';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { AnexosImagens } from '../electron/services/anexosImagens';
import { Agente } from '../electron/services/agente';
import { estimarTokens, type MensagemModelo } from '../electron/services/contexto';

const pastas: string[] = [];
const modelo = { id: randomUUID(), nome: 'LFM3 Omni 2B', caminho: 'lfm3-omni-2b-q4.gguf', tamanho: 1 };
const bytes = Buffer.from(codificarAudio(new Float32Array(16000).fill(0.1)));
const entrada = { nome: 'Voz.wav', dados: `data:audio/wav;base64,${bytes.toString('base64')}` };
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

test('normalização e validação recusam WAV inválido, estéreo, truncamento e duração excessiva', () => {
    expect(() => validarAudio(bytes)).not.toThrow();
    for (const alterado of [Buffer.from('qualquer arquivo'), bytes.subarray(0, -1), Buffer.from(bytes)]) {
        if (alterado.length === bytes.length) alterado.writeUInt16LE(2, 22);
        expect(() => validarAudio(alterado)).toThrow();
    }
    expect(() => codificarAudio(new Float32Array(16000 * 61))).toThrow('60 segundos');
    expect(() => codificarAudio(new Float32Array([NaN]))).toThrow('inválidas');
    expect(modeloAceitaAudio(modelo)).toBe(true);
    expect(modeloAceitaAudio({ ...modelo, nome: 'Qwen', caminho: 'qwen.gguf' })).toBe(false);
    expect(modeloAceitaAudio({ ...modelo, openrouter: {
        id: 'teste', imagens: false, audio: true, ferramentas: false, raciocinio: false, contexto: 8192,
    } })).toBe(true);
});

test('áudio persiste, volta no histórico multimodal, é estimado sem base64 e respeita descarte', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-audio-'));
    pastas.push(pasta);
    const conversa = esquemaConversa.parse({ id: randomUUID(), titulo: 'Teste', modo: 'chat',
        atualizadoEm: new Date().toISOString() });
    const anexos = new AnexosImagens(pasta, () => [conversa], () => { throw new Error('Não é imagem.'); });
    const [audio] = await anexos.importar([entrada]);
    expect(audio.mime).toBe('audio/wav');
    expect(await readFile(join(pasta, `${audio.id}.wav`))).toEqual(bytes);
    const pedidos: { messages: MensagemModelo[] }[] = [];
    const agente = new Agente({ salvar: async () => {}, publicar: () => {}, lerImagem: (id) => anexos.ler(id),
        completar: async (corpo) => {
            pedidos.push(structuredClone(corpo) as { messages: MensagemModelo[] });
            return new Response('data: {"choices":[{"delta":{"content":"Ouvido"},"finish_reason":"stop"}]}' +
                '\n\ndata: [DONE]\n\n');
        } });
    await agente.executar(conversa, '', esquemaConfiguracao.parse({}), [audio], modelo);
    await agente.executar(conversa, 'Qual era o áudio?', esquemaConfiguracao.parse({}), [], modelo);
    await agente.executar(conversa, 'Transcreva literalmente.', esquemaConfiguracao.parse({}), [audio], modelo);
    const esperado = { type: 'input_audio', input_audio: { data: bytes.toString('base64'), format: 'wav' } } as const;
    expect(pedidos[0].messages.at(-1)?.content).toContainEqual(esperado);
    expect(pedidos[0].messages.at(-1)?.content).toContainEqual({ type: 'text',
        text: 'Responda ao pedido falado no áudio. Se não conseguir entender, diga isso.' });
    expect(pedidos[2].messages.at(-1)?.content).toContainEqual({ type: 'text', text: 'Transcreva literalmente.' });
    expect(pedidos[1].messages.some((mensagem) => Array.isArray(mensagem.content) &&
        mensagem.content.some((parte) => parte.type === 'input_audio'))).toBe(true);
    expect(estimarTokens(pedidos[0].messages)).toBeLessThan(bytes.length);
    await anexos.descartar([audio.id]);
    const restaurados = new AnexosImagens(pasta, () => [conversa], () => { throw new Error('Não é imagem.'); });
    await restaurados.preparar();
    expect(await restaurados.ler(audio.id)).toBe(entrada.dados);
    const [rascunho] = await restaurados.importar([entrada]);
    await restaurados.descartar([rascunho.id]);
    await expect(restaurados.ler(rascunho.id)).rejects.toThrow('não encontrada');
    await expect(restaurados.importar([{ ...entrada, dados: 'data:audio/wav;base64,aW52YWxpZG8=' }]))
        .rejects.toThrow('Áudio inválido');
    await expect(agente.executar(conversa, '', esquemaConfiguracao.parse({}), [audio]))
        .rejects.toThrow('não aceita áudio');
});
