import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaDados } from '../shared/contratos';
import { descartarEntradasLegadas } from '../shared/limpezaUso';
import { reunirRegistrosUso } from '../shared/estatisticas';
import { montarPainelEstatisticas } from '../shared/painelEstatisticas';
import { Persistencia } from '../electron/services/persistencia';

test('limpeza remove entradas legadas sem perder custos, saída ou novas medições e impede sua restauração', async () => {
    const agora = new Date().toISOString();
    const desempenhoAntigo = {
        tokensEntrada: 7675755,
        tokensGerados: 100,
        tempoGeracaoMs: 1000,
        tokensPorSegundo: 100,
    };
    const mensagemAntiga = {
        id: randomUUID(),
        papel: 'assistant',
        texto: 'Histórico preservado',
        estado: 'concluida',
        criadoEm: agora,
        desempenho: desempenhoAntigo,
    };
    const medicao = {
        criadoEm: agora,
        modeloId: randomUUID(),
        finalidade: 'resposta',
        contextoEstimado: 100,
        limiteContexto: 8192,
        tokensEntrada: 50,
        tokensGerados: 10,
        tempoGeracaoMs: 1000,
        tokensPorSegundo: 10,
    };
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [],
        conversas: [
            {
                id: randomUUID(),
                titulo: 'Teste',
                modo: 'chat',
                atualizadoEm: agora,
                mensagens: [
                    mensagemAntiga,
                    {
                        ...mensagemAntiga,
                        id: randomUUID(),
                        desempenho: medicao,
                        medicoesModelo: [medicao],
                    },
                ],
            },
        ],
        registrosUso: [
            {
                ...desempenhoAntigo,
                tokensEntrada: 582,
                custoUsd: 0.003,
                provedor: 'openrouter',
                mensagemId: randomUUID(),
                conversaId: randomUUID(),
                modo: 'chat',
                modeloId: null,
                criadoEm: agora,
            },
            {
                ...desempenhoAntigo,
                tokensEntrada: 60,
                tokensEntradaCache: 0,
                mensagemId: randomUUID(),
                conversaId: randomUUID(),
                modo: 'chat',
                modeloId: null,
                criadoEm: agora,
            },
        ],
    });
    expect(descartarEntradasLegadas(dados)).toEqual({ registros: 2, tokens: 7676337 });
    expect(dados.conversas[0]!.mensagens[0]!.texto).toBe('Histórico preservado');
    expect(dados.conversas[0]!.mensagens[0]!.desempenho?.tokensEntrada).toBeUndefined();
    expect(dados.conversas[0]!.mensagens[1]!.medicoesModelo).toHaveLength(1);
    const painel = montarPainelEstatisticas(dados.registrosUso, 'total');
    expect(painel.tokensEntrada).toBe(110);
    expect(painel.tokensGerados).toBe(310);
    expect(painel.custoUsd).toBe(0.003);
    expect(painel.tokensEntradaSemMedicaoCache).toBe(50);
    expect(descartarEntradasLegadas(dados)).toEqual({ registros: 0, tokens: 0 });
    dados.conversas[0]!.mensagens[0]!.desempenho = desempenhoAntigo;
    expect(
        reunirRegistrosUso(dados).find((registro) => registro.mensagemId === mensagemAntiga.id)?.tokensEntrada,
    ).toBeUndefined();
    const pasta = await mkdtemp(join(tmpdir(), 'selene-limpeza-'));
    try {
        const persistencia = new Persistencia(pasta);
        persistencia.dados = dados;
        await persistencia.salvar();
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reaberta.dados.entradasUsoDescartadas).toHaveLength(2);
        reaberta.dados.conversas = [];
        await reaberta.salvar();
        await reaberta.abrir();
        expect(montarPainelEstatisticas(reaberta.dados.registrosUso, 'total').tokensEntrada).toBe(110);
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});
