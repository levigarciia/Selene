import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConfiguracao, esquemaDados, type Conversa } from '../shared/contratos';
import { backendParaGpus, escolherDispositivo, interpretarDispositivos } from '../electron/services/dispositivosMotor';
import { Persistencia } from '../electron/services/persistencia';
import { receberResposta } from '../electron/services/streaming';
import { Agente } from '../electron/services/agente';
import { mesmaConfiguracaoMotor } from '../shared/configuracaoMotor';

test('somente processamento, contexto e camadas exigem recarregar o motor', () => {
    const atual = esquemaConfiguracao.parse({});
    expect(
        mesmaConfiguracaoMotor(atual, { ...atual, temperatura: 0.2, maxTokens: 512, instrucao: 'Nova instrução' }),
    ).toBe(true);
    expect(mesmaConfiguracaoMotor(atual, { ...atual, backend: 'cpu' })).toBe(false);
    expect(mesmaConfiguracaoMotor(atual, { ...atual, contexto: 4096 })).toBe(true);
    expect(mesmaConfiguracaoMotor(atual, { ...atual, limitesAutomaticos: false })).toBe(false);
    const manual = { ...atual, limitesAutomaticos: false };
    expect(mesmaConfiguracaoMotor(manual, { ...manual, contexto: 4096 })).toBe(false);
    expect(mesmaConfiguracaoMotor(atual, { ...atual, camadasGpu: 20 })).toBe(true);
    expect(mesmaConfiguracaoMotor(manual, { ...manual, camadasGpu: 20 })).toBe(false);
});

const pastas: string[] = [];
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

function respostaEventos(eventos: object[]): Response {
    return new Response(eventos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join('') + 'data: [DONE]\n\n');
}

test('seleciona a GPU dedicada com o índice do próprio backend', () => {
    const dispositivos = interpretarDispositivos(
        '  Vulkan0: AMD Radeon(TM) Graphics (512 MiB, 100 MiB free)\n' +
            '  Vulkan1: AMD Radeon RX 7700 XT (12272 MiB, 10000 MiB free)\n' +
            '  ROCm0: AMD Radeon RX 7700 XT (12272 MiB, 10000 MiB free)',
    );
    expect(escolherDispositivo(dispositivos, 'vulkan').id).toBe('Vulkan1');
    expect(escolherDispositivo(dispositivos, 'rocm').id).toBe('ROCm0');
    expect(() => escolherDispositivo([], 'rocm')).toThrow('Nenhuma GPU');
    expect(backendParaGpus(['AMD Radeon(TM) Graphics', 'AMD Radeon RX 7700 XT'])).toBe('rocm');
    expect(backendParaGpus(['NVIDIA GeForce RTX 4070'])).toBe('vulkan');
    expect(backendParaGpus([])).toBe('cpu');
});

test('migra o padrão Vulkan antigo e preserva escolhas posteriores e CPU', async () => {
    for (const [backend, perfilMotor, esperado] of [
        ['vulkan', undefined, 'auto'],
        ['cpu', undefined, 'cpu'],
        ['vulkan', 1, 'vulkan'],
        ['rocm', 1, 'rocm'],
    ] as const) {
        const pasta = await mkdtemp(join(tmpdir(), 'selene-desempenho-'));
        pastas.push(pasta);
        const dados = esquemaDados.parse({ versao: 1, configuracao: { backend }, modelos: [], conversas: [] });
        await writeFile(join(pasta, 'selene.json'), JSON.stringify({ ...dados, perfilMotor }));
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        expect(persistencia.dados.configuracao.backend).toBe(esperado);
        expect(persistencia.dados.perfilMotor).toBe(1);
    }
});

test('recebe tempos nativos em eventos sem escolhas e ignora métricas inválidas', async () => {
    for (const valido of [true, false]) {
        const resposta = await receberResposta(
            respostaEventos([
                { choices: [{ delta: { content: 'Resposta completa.' }, finish_reason: 'stop' }] },
                {
                    choices: [],
                    timings: { predicted_n: 100, predicted_ms: 2000, predicted_per_second: valido ? 50 : -1 },
                },
            ]),
            new AbortController().signal,
            () => {},
        );
        expect(resposta.texto).toBe('Resposta completa.');
        expect(resposta.desempenho).toEqual(
            valido ? { tokensGerados: 100, tempoGeracaoMs: 2000, tokensPorSegundo: 50 } : undefined,
        );
    }
});

test('registra tokens de entrada medidos pelo motor sem estimar quando estão ausentes', async () => {
    for (const [prompt, uso, esperado] of [
        [120, undefined, 120],
        [120, 150, 150],
        [undefined, -1, undefined],
    ] as const) {
        const resposta = await receberResposta(
            respostaEventos([
                { choices: [{ delta: { content: 'Resposta' }, finish_reason: 'stop' }] },
                {
                    choices: [],
                    timings: {
                        predicted_n: 100,
                        predicted_ms: 2000,
                        predicted_per_second: 50,
                        prompt_n: prompt,
                    },
                    usage: uso === undefined ? undefined : { prompt_tokens: uso },
                },
            ]),
            new AbortController().signal,
            () => {},
        );
        expect(resposta.desempenho?.tokensEntrada).toBe(esperado);
        expect(resposta.desempenho?.tokensGerados).toBe(100);
    }
});

test('reduz publicações sem perder texto, conclusão ou métricas do agente', async () => {
    const conversa: Conversa = {
        id: randomUUID(),
        titulo: 'Teste',
        modo: 'chat',
        projeto: null,
        acessoCompleto: false,
        modeloId: null,
        mensagens: [],
        atualizadoEm: new Date().toISOString(),
    };
    let publicacoes = 0;
    let requisicao: Record<string, unknown> = {};
    let salvamentos = 0;
    const agente = new Agente({
        salvar: async () => {
            salvamentos++;
        },
        publicar: () => {
            publicacoes++;
        },
        completar: async (corpo) => {
            requisicao = corpo as Record<string, unknown>;
            return respostaEventos([
                ...Array.from({ length: 500 }, () => ({ choices: [{ delta: { content: 'ação ' } }] })),
                {
                    choices: [{ delta: {}, finish_reason: 'stop' }],
                    timings: { predicted_n: 500, predicted_ms: 10000, predicted_per_second: 50 },
                },
            ]);
        },
    });
    await agente.executar(conversa, 'Teste sintético', esquemaConfiguracao.parse({}));
    expect(conversa.mensagens[1].texto).toBe('ação '.repeat(500));
    expect(conversa.mensagens[1].estado).toBe('concluida');
    expect(conversa.mensagens[1].desempenho?.tokensPorSegundo).toBe(50);
    expect(publicacoes).toBeLessThan(50);
    expect(salvamentos).toBe(2);
    expect(requisicao.cache_prompt).toBe(true);
    expect(agente.conversaId).toBeNull();
});

test('mede cache sem duplicar entrada e prioriza o uso compatível do motor', async () => {
    for (const [tempos, uso, entrada, cache] of [
        [{ prompt_n: 100, cache_n: 900 }, undefined, 1000, 900],
        [
            { prompt_n: 100, cache_n: 900 },
            { prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 850 } },
            1000,
            850,
        ],
        [{ prompt_n: 100 }, { prompt_tokens: 1000 }, 1000, undefined],
        [
            { prompt_n: 100, cache_n: 900 },
            { prompt_tokens: 10, prompt_tokens_details: { cached_tokens: 20 } },
            10,
            undefined,
        ],
    ] as const) {
        const resultado = await receberResposta(
            respostaEventos([
                {
                    choices: [{ delta: { content: 'Resposta' }, finish_reason: 'stop' }],
                    timings: { predicted_n: 10, predicted_ms: 100, predicted_per_second: 100, ...tempos },
                    usage: uso,
                },
            ]),
            new AbortController().signal,
            () => {},
        );
        expect(resultado.desempenho?.tokensEntrada).toBe(entrada);
        expect(resultado.desempenho?.tokensEntradaCache).toBe(cache);
    }
});

test('acumula cache das ferramentas somente quando todas as chamadas foram medidas', async () => {
    for (const medirSegunda of [true, false]) {
        const conversa = esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [],
            conversas: [{ id: randomUUID(), titulo: 'Cache', modo: 'chat', atualizadoEm: new Date().toISOString() }],
        }).conversas[0];
        let chamadas = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            web: {
                pesquisar: async () => 'Resultado',
                ler: async () => 'Fonte',
                preparar: () => {
                    throw new Error('Não deve abrir navegador.');
                },
            },
            completar: async () => {
                const primeira = chamadas++ === 0;
                return respostaEventos([
                    {
                        choices: [
                            {
                                delta: primeira
                                    ? {
                                          tool_calls: [
                                              {
                                                  index: 0,
                                                  id: 'web',
                                                  function: {
                                                      name: 'pesquisar_web',
                                                      arguments: '{"consulta":"cache"}',
                                                  },
                                              },
                                          ],
                                      }
                                    : { content: 'Resposta' },
                                finish_reason: primeira ? 'tool_calls' : 'stop',
                            },
                        ],
                        timings: { prompt_n: 100, predicted_n: 10, predicted_ms: 1000, predicted_per_second: 10 },
                        usage: {
                            prompt_tokens: 1000,
                            ...(primeira || medirSegunda ? { prompt_tokens_details: { cached_tokens: 900 } } : {}),
                        },
                    },
                ]);
            },
        });
        await agente.executar(conversa, 'Pesquise', esquemaConfiguracao.parse({}));
        expect(conversa.mensagens.at(-1)?.desempenho?.tokensEntrada).toBe(2000);
        expect(conversa.mensagens.at(-1)?.desempenho?.tokensEntradaCache).toBe(medirSegunda ? 1800 : undefined);
        const medicoes = conversa.mensagens.at(-1)?.medicoesModelo;
        expect(medicoes).toHaveLength(2);
        expect(medicoes?.map((medicao) => medicao.tokensEntrada)).toEqual([1000, 1000]);
        expect(medicoes?.map((medicao) => medicao.tokensEntradaCache)).toEqual([900, medirSegunda ? 900 : undefined]);
    }
});
