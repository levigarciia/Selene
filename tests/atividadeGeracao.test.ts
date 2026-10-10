import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MensagemConversa } from '../src/components/MensagemConversa';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa, type Mensagem } from '../shared/contratos';
import type { PreviaNavegador } from '../shared/web';

const mensagem: Mensagem = {
    id: randomUUID(),
    papel: 'assistant',
    texto: '',
    estado: 'gerando',
    criadoEm: new Date().toISOString(),
    acoes: [{ id: 'acao', nome: 'ler_arquivo', argumentos: {}, estado: 'executando', resultado: '' }],
};
const executar = async () => undefined;

test('prévia aparece somente no navegador de uma tarefa ativa e some ao encerrar', () => {
    const previa: PreviaNavegador = {
        conversaId: randomUUID(), origem: 'navegador', aberto: true, carregando: false,
        url: 'https://example.org/', titulo: 'Página', largura: 1100, altura: 800,
    };
    const atual: Mensagem = {
        ...mensagem,
        acoes: [{ ...mensagem.acoes[0]!, nome: 'controlar_navegador' }],
    };
    const renderizar = (atual: Mensagem, emExecucao = true, previaNavegador = previa) =>
        renderToStaticMarkup(createElement(MensagemConversa, {
            mensagem: atual, emExecucao, previaNavegador, executar,
        }));
    expect(renderizar(atual)).toContain('navegador-inline');
    expect(renderizar(atual, false)).not.toContain('navegador-inline');
    for (const estado of ['concluida', 'interrompida', 'erro'] as const) {
        expect(renderizar({ ...atual, estado })).not.toContain('navegador-inline');
    }
    for (const origem of ['pesquisa', 'leitura'] as const) {
        expect(renderizar(atual, true, { ...previa, origem })).not.toContain('navegador-inline');
    }
    for (const nome of ['pesquisar_web', 'ler_pagina_web']) {
        expect(renderizar({ ...atual, acoes: [{ ...atual.acoes[0]!, nome }] }))
            .not.toContain('navegador-inline');
    }
});

function apresentar(atual: Mensagem, emExecucao: boolean): string {
    return renderToStaticMarkup(createElement(MensagemConversa, { mensagem: atual, emExecucao, executar }));
}

test('brilho acompanha somente ações da mensagem em execução e cessa ao encerrar', () => {
    expect(apresentar(mensagem, true)).toContain('texto-em-andamento');
    expect(apresentar(mensagem, false)).not.toContain('texto-em-andamento');
    expect(apresentar({ ...mensagem, estado: 'concluida' }, true)).not.toContain('texto-em-andamento');
    expect(apresentar({ ...mensagem, concluidoEm: new Date().toISOString() }, true)).not.toContain(
        'texto-em-andamento',
    );
});

test('resposta em streaming não repete Trabalhando e raciocínio perde o brilho após encerrar', () => {
    expect(apresentar({ ...mensagem, acoes: [], texto: 'Respondendo' }, true)).not.toContain('Trabalhando');
    const raciocinando = { ...mensagem, acoes: [], raciocinio: 'Analisando', faseGeracao: 'raciocinando' as const };
    expect(apresentar(raciocinando, true)).toContain('texto-em-andamento');
    expect(apresentar(raciocinando, false)).not.toContain('texto-em-andamento');
    expect(apresentar({ ...raciocinando, faseGeracao: 'respondendo' }, true)).not.toContain('texto-em-andamento');
});

for (const cancelar of [false, true]) {
    test(`encerra ações fragmentadas ao ${cancelar ? 'cancelar' : 'falhar'} durante o streaming`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
        });
        const agente = new Agente({
            salvar: async () => {},
            publicar: (atual) => {
                if (cancelar && atual.acoes.length) agente.cancelar();
            },
            completar: async () =>
                new Response(
                    [
                        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"acao","function":{"name":"ler_arquivo","arguments":"{"}}]}}]}',
                        'data: {"error":{"message":"Falha de teste"}}',
                    ].join('\n\n') + '\n\n',
                ),
        });
        await agente.executar(conversa, 'Leia o arquivo', esquemaConfiguracao.parse({}));
        const final = conversa.mensagens.at(-1)!;
        expect(final.estado).toBe(cancelar ? 'interrompida' : 'erro');
        expect(final.acoes[0].estado).toBe(cancelar ? 'interrompida' : 'erro');
        expect(final.faseGeracao).toBeUndefined();
        expect(agente.conversaId).toBeNull();
    });
}
