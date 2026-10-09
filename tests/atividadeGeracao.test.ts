import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MensagemConversa } from '../src/components/MensagemConversa';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa, type Mensagem } from '../shared/contratos';

const mensagem: Mensagem = {
    id: randomUUID(),
    papel: 'assistant',
    texto: '',
    estado: 'gerando',
    criadoEm: new Date().toISOString(),
    acoes: [{ id: 'acao', nome: 'ler_arquivo', argumentos: {}, estado: 'executando', resultado: '' }],
};
const executar = async () => undefined;

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
