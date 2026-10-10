import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaDados, type RegistroUso } from '../shared/contratos';
import { calcularEstatisticas, reunirRegistrosUso } from '../shared/estatisticas';
import { Persistencia } from '../electron/services/persistencia';
import { montarPainelEstatisticas } from '../shared/painelEstatisticas';

function registro(data: Date, tokens = 100): RegistroUso {
    return {
        mensagemId: randomUUID(),
        conversaId: randomUUID(),
        modo: 'code',
        modeloId: null,
        criadoEm: data.toISOString(),
        tokensGerados: tokens,
        tokensEntrada: 50,
        tempoGeracaoMs: 2000,
        tokensPorSegundo: tokens / 2,
    };
}

test('estatísticas respeitam semana civil, mês, futuro e velocidade ponderada', () => {
    const agora = new Date(2026, 9, 9, 12);
    const registros = [
        registro(new Date(2026, 9, 5)),
        registro(new Date(2026, 9, 4)),
        registro(new Date(2026, 8, 30)),
        registro(new Date(2026, 9, 10)),
        { ...registro(agora, 200), tempoGeracaoMs: 1000 },
    ];
    const semana = calcularEstatisticas(registros, 'semana', agora);
    expect(semana.respostas).toBe(2);
    expect(semana.tokensRegistrados).toBe(400);
    expect(semana.tokensPorSegundo).toBe(100);
    expect(calcularEstatisticas(registros, 'mes', agora).respostas).toBe(3);
    expect(calcularEstatisticas(registros, 'total', agora).respostas).toBe(4);
});

test('painel agrupa modelos e sessões, preenche dias vazios e respeita janelas móveis', () => {
    const agora = new Date(2026, 9, 10, 12);
    const modelo = randomUUID();
    const primeiro = { ...registro(new Date(2026, 9, 4), 100), modeloId: modelo };
    const segundo = { ...registro(new Date(2026, 9, 10, 11), 200), modeloId: modelo, conversaId: primeiro.conversaId };
    const antigo = registro(new Date(2026, 9, 3, 23, 59));
    const futuro = registro(new Date(2026, 9, 11));
    const painel = montarPainelEstatisticas([primeiro, segundo, antigo, futuro], '7dias', agora);
    expect(painel.sessoes).toBe(1);
    expect(painel.respostas).toBe(2);
    expect(painel.tokensRegistrados).toBe(400);
    expect(painel.modelos).toHaveLength(1);
    expect(painel.modelos[0]).toMatchObject({ entrada: 100, saida: 300, total: 400, sessoes: 1 });
    expect(painel.serie).toHaveLength(7);
    expect(painel.serie[1].total).toBe(0);
    expect(painel.serie.reduce((soma, dia) => soma + dia.total, 0)).toBe(painel.tokensRegistrados);
    expect(montarPainelEstatisticas([primeiro, segundo], '24h', agora).tokensRegistrados).toBe(250);
    expect(montarPainelEstatisticas([], 'total', agora).serie).toEqual([{ dia: '2026-10-10', total: 0 }]);
});

test('cache é parte da entrada e registros antigos permanecem sem divisão medida', () => {
    const agora = new Date();
    const antigo = { ...registro(agora), tokensEntrada: 1000 };
    const medido = { ...registro(agora), tokensEntrada: 1000, tokensEntradaCache: 800 };
    const resultado = montarPainelEstatisticas([antigo, medido], 'total', agora);
    expect(resultado.tokensEntrada).toBe(2000);
    expect(resultado.tokensEntradaCache).toBe(800);
    expect(resultado.tokensEntradaSemCache).toBe(200);
    expect(resultado.tokensEntradaSemMedicaoCache).toBe(1000);
    expect(resultado.entradasCacheMedidas).toBe(1);
    expect(resultado.tokensRegistrados).toBe(2200);
    expect(
        resultado.tokensEntradaCache +
            resultado.tokensEntradaSemCache +
            resultado.tokensEntradaSemMedicaoCache +
            resultado.tokensGerados,
    ).toBe(resultado.tokensRegistrados);
});

test('conversa nova não herda tokens antigos enquanto aguarda a resposta', () => {
    const agora = new Date();
    const antigo = { ...registro(agora), tokensEntrada: 999000 };
    const mensagemId = randomUUID();
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [],
        registrosUso: [antigo],
        conversas: [
            {
                id: randomUUID(),
                titulo: 'oi',
                modo: 'chat',
                atualizadoEm: agora.toISOString(),
                mensagens: [
                    {
                        id: mensagemId,
                        papel: 'assistant',
                        texto: '',
                        estado: 'gerando',
                        criadoEm: agora.toISOString(),
                        provedor: 'openrouter',
                    },
                ],
            },
        ],
    });
    const registros = reunirRegistrosUso(dados);
    expect(montarPainelEstatisticas(registros, 'total', agora).tokensEntrada).toBe(999000);
    const destaConversa = registros.filter((item) => item.conversaId === dados.conversas[0].id);
    expect(destaConversa[0].tokensEntrada).toBeUndefined();
    expect(montarPainelEstatisticas(destaConversa, 'total', agora).tokensEntrada).toBe(0);
    dados.conversas[0].mensagens[0].desempenho = {
        tokensEntrada: 50,
        tokensGerados: 3,
        tokensPorSegundo: 3,
        tempoGeracaoMs: 1000,
    };
    const medidos = reunirRegistrosUso(dados);
    expect(montarPainelEstatisticas(medidos, 'total', agora).tokensEntrada).toBe(999050);
    expect(medidos.find((item) => item.mensagemId === mensagemId)?.tokensEntrada).toBe(50);
});

test('trocar modelo não transfere consumo legado nem altera o modelo registrado na resposta', async () => {
    const agora = new Date();
    const google = randomUUID();
    const anterior = randomUUID();
    const legado = { ...registro(agora), tokensEntrada: 790135, modeloId: google };
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [],
        registrosUso: [legado],
        conversas: [
            {
                id: legado.conversaId,
                titulo: 'Histórico antigo',
                modo: 'code',
                modeloId: google,
                atualizadoEm: agora.toISOString(),
                mensagens: [
                    {
                        id: legado.mensagemId,
                        papel: 'assistant',
                        texto: 'Resposta antiga',
                        estado: 'concluida',
                        criadoEm: agora.toISOString(),
                        desempenho: legado,
                    },
                    {
                        id: randomUUID(),
                        papel: 'assistant',
                        texto: 'Resposta identificada',
                        estado: 'concluida',
                        criadoEm: agora.toISOString(),
                        modeloUsoId: anterior,
                        desempenho: { ...registro(agora), tokensEntrada: 100 },
                    },
                ],
            },
            {
                id: randomUUID(),
                titulo: 'oi',
                modo: 'chat',
                modeloId: google,
                atualizadoEm: agora.toISOString(),
                mensagens: [
                    {
                        id: randomUUID(),
                        papel: 'assistant',
                        texto: 'Olá',
                        estado: 'concluida',
                        criadoEm: agora.toISOString(),
                        modeloUsoId: google,
                        provedor: 'openrouter',
                        desempenho: { ...registro(agora), tokensEntrada: 50 },
                    },
                ],
            },
        ],
    });
    const pasta = await mkdtemp(join(tmpdir(), 'selene-atribuicao-'));
    try {
        await writeFile(join(pasta, 'selene.json'), JSON.stringify(dados));
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        const backups = (await readdir(pasta)).filter((nome) => nome.startsWith('selene.antesCorrecaoUso.'));
        expect(backups).toHaveLength(1);
        expect(JSON.parse(await readFile(join(pasta, backups[0]!), 'utf8')).registrosUso[0].modeloId).toBe(google);
        expect(JSON.parse(await readFile(join(pasta, 'selene.json'), 'utf8')).registrosUso[0].modeloId).toBeNull();
        const validar = () => {
            const registros = reunirRegistrosUso(persistencia.dados);
            const painel = montarPainelEstatisticas(registros, 'total', agora);
            expect(painel.tokensEntrada).toBe(790285);
            expect(painel.modelos.find((item) => item.id === google)?.entrada).toBe(50);
            expect(painel.modelos.find((item) => item.id === anterior)?.entrada).toBe(100);
            expect(painel.modelos.find((item) => item.id === 'desconhecido')?.entrada).toBe(790135);
            expect(registros).toHaveLength(3);
        };
        validar();
        persistencia.dados.conversas[0].modeloId = randomUUID();
        await persistencia.salvar();
        validar();
        persistencia.dados.conversas = [];
        await persistencia.salvar();
        await persistencia.abrir();
        validar();
        expect((await readdir(pasta)).filter((nome) => nome.startsWith('selene.antesCorrecaoUso.'))).toHaveLength(1);
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});

test('migra métricas antigas antes de apagar e preserva o consumo sem duplicar após reinício', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-estatisticas-'));
    try {
        const uso = registro(new Date());
        const dados = esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [],
            conversas: [
                {
                    id: uso.conversaId,
                    titulo: 'Uso antigo',
                    modo: 'code',
                    atualizadoEm: uso.criadoEm,
                    mensagens: [
                        {
                            id: uso.mensagemId,
                            papel: 'assistant',
                            texto: 'Resposta',
                            estado: 'concluida',
                            criadoEm: uso.criadoEm,
                            desempenho: {
                                tokensGerados: 100,
                                tokensEntrada: 50,
                                tempoGeracaoMs: 2000,
                                tokensPorSegundo: 50,
                            },
                        },
                    ],
                },
            ],
        });
        await writeFile(join(pasta, 'selene.json'), JSON.stringify(dados));
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        expect(reunirRegistrosUso(persistencia.dados)).toHaveLength(1);
        persistencia.dados.conversas = [];
        await persistencia.salvar();
        await persistencia.salvar();
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reaberta.dados.registrosUso).toHaveLength(1);
        expect(calcularEstatisticas(reaberta.dados.registrosUso, 'total').tokensRegistrados).toBe(150);
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});
