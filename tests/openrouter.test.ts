import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaDados } from '../shared/contratos';
import { calcularEstatisticas, reunirRegistrosUso } from '../shared/estatisticas';
import { Persistencia } from '../electron/services/persistencia';
import { receberResposta } from '../electron/services/streaming';
import { montarPainelEstatisticas } from '../shared/painelEstatisticas';
import { parametrosRaciocinio } from '../shared/raciocinio';

test('OpenRouter recebe tokens, cache e raciocínio no SSE sem tempos do motor local', async () => {
    const eventos = [
        { choices: [{ delta: { reasoning: 'Pensando' } }] },
        { choices: [{ delta: { content: 'Resposta' }, finish_reason: 'stop' }] },
        {
            choices: [],
            usage: {
                prompt_tokens: 90,
                completion_tokens: 12,
                prompt_tokens_details: { cached_tokens: 20 },
                cost: 0.003,
            },
        },
    ];
    const bytes = new TextEncoder().encode(
        eventos.map((evento) => `data: ${JSON.stringify(evento)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n',
    );
    let indice = 0;
    const fluxo = new ReadableStream({
        pull(controlador) {
            if (indice === bytes.length) controlador.close();
            else controlador.enqueue(bytes.slice(indice, ++indice));
        },
    });
    let raciocinio = '';
    const resultado = await receberResposta(
        new Response(fluxo),
        new AbortController().signal,
        () => {},
        undefined,
        (trecho) => {
            raciocinio += trecho;
        },
    );
    expect(resultado.texto).toBe('Resposta');
    expect(raciocinio).toBe('Pensando');
    expect(resultado.desempenho).toMatchObject({ tokensEntrada: 90, tokensGerados: 12, tokensEntradaCache: 20 });
});

test('gastos persistem sem duplicar após reabrir, trocar modelo, editar ou excluir conversa', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-openrouter-'));
    try {
        const persistencia = new Persistencia(pasta);
        const modeloId = randomUUID();
        persistencia.dados = esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [],
            conversas: [
                {
                    id: randomUUID(),
                    titulo: 'Custos',
                    modo: 'chat',
                    modeloId: randomUUID(),
                    atualizadoEm: new Date().toISOString(),
                    mensagens: [
                        {
                            id: randomUUID(),
                            papel: 'assistant',
                            texto: 'Resposta',
                            estado: 'concluida',
                            criadoEm: new Date().toISOString(),
                            provedor: 'openrouter',
                            modeloUsoId: modeloId,
                            custoUsd: 0.003,
                        },
                    ],
                },
            ],
        });
        await persistencia.salvar();
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reunirRegistrosUso(reaberta.dados)).toHaveLength(1);
        expect(reaberta.dados.registrosUso[0].modeloId).toBe(modeloId);
        reaberta.dados.conversas[0].mensagens = [];
        await reaberta.salvar();
        reaberta.dados.conversas = [];
        await reaberta.salvar();
        const painel = montarPainelEstatisticas(reaberta.dados.registrosUso, 'total');
        expect(painel.custoUsd).toBeCloseTo(0.003);
        expect(painel.modelos[0].custoUsd).toBeCloseTo(0.003);
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});

test('custo zero é medido e ausência de custo permanece explícita', () => {
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [],
        conversas: [
            {
                id: randomUUID(),
                titulo: 'Custos',
                modo: 'chat',
                atualizadoEm: new Date().toISOString(),
                mensagens: [0, undefined].map((custoUsd) => ({
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: '',
                    estado: 'interrompida',
                    criadoEm: new Date().toISOString(),
                    provedor: 'openrouter',
                    custoUsd,
                })),
            },
        ],
    });
    const resultado = calcularEstatisticas(reunirRegistrosUso(dados), 'total');
    expect(resultado.custoUsd).toBe(0);
    expect(resultado.custosMedidos).toBe(1);
    expect(resultado.custosPendentes).toBe(1);
});

test('raciocínio remoto usa parâmetros OpenRouter', () => {
    const modelo = {
        id: randomUUID(),
        nome: 'Remoto',
        caminho: 'teste/remoto',
        tamanho: 0,
        openrouter: { id: 'teste/remoto', contexto: 8192, imagens: false, ferramentas: true, raciocinio: true },
    };
    expect(parametrosRaciocinio(modelo, 'alto', 1000)).toEqual({ reasoning: { effort: 'high' } });
    expect(parametrosRaciocinio(modelo, 'desativado', 1000)).toEqual({ reasoning: { enabled: false } });
});
