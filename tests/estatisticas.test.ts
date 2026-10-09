import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaDados, type RegistroUso } from '../shared/contratos';
import { calcularEstatisticas, reunirRegistrosUso } from '../shared/estatisticas';
import { Persistencia } from '../electron/services/persistencia';

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
