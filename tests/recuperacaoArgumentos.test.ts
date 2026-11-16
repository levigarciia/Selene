import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { ErroArgumentosModelo, receberResposta } from '../electron/services/streaming';

const falha = 'Failed to parse tool call arguments as JSON: conteúdo privado';
const sinal = new AbortController().signal;

test('cancelamento durante a recuperação impede uma nova geração', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Teste',
        modo: 'code',
        atualizadoEm: new Date().toISOString(),
    });
    let chamadas = 0;
    const agente = new Agente({
        publicar: () => {},
        salvar: async () => {},
        completar: async () => {
            chamadas++;
            agente.cancelar();
            return new Response(JSON.stringify({ error: { message: falha } }), { status: 500 });
        },
    });
    await agente.executar(conversa, 'Crie um SVG', esquemaConfiguracao.parse({}));
    expect(chamadas).toBe(1);
    expect(conversa.mensagens.at(-1)?.estado).toBe('interrompida');
});

test('classifica falha HTTP e SSE sem expor argumentos no erro', async () => {
    for (const resposta of [
        new Response(JSON.stringify({ error: { message: falha } }), { status: 500 }),
        new Response(`data: ${JSON.stringify({ error: { message: falha } })}\n\n`),
    ]) {
        try {
            await receberResposta(resposta, sinal, () => {});
            throw new Error('A falha deveria ter sido propagada.');
        } catch (erro) {
            expect(erro).toBeInstanceOf(ErroArgumentosModelo);
            expect((erro as Error).message).not.toContain('conteúdo privado');
        }
    }
});

for (const persistente of [false, true]) {
    test(`recuperação de argumentos tem limite e preserva histórico: ${persistente}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
        });
        let chamadas = 0;
        const agente = new Agente({
            publicar: () => {},
            salvar: async () => {},
            completar: async (corpo) => {
                chamadas++;
                if (chamadas === 1 || persistente) {
                    return new Response(JSON.stringify({ error: { message: falha } }), { status: 500 });
                }
                expect(JSON.stringify(corpo)).toContain('Divida conteúdos grandes');
                return new Response(
                    'data: {"choices":[{"delta":{"content":"Pronto"},' +
                        '"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
                );
            },
        });
        await agente.executar(conversa, 'Crie um SVG', esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(2);
        expect(conversa.mensagens).toHaveLength(2);
        expect(conversa.mensagens.at(-1)?.estado).toBe(persistente ? 'erro' : 'concluida');
        expect(conversa.mensagens.at(-1)?.texto).not.toContain('conteúdo privado');
    });
}

for (const persistente of [false, true]) {
    test(`reenvia limite de geração sem executar ferramenta incompleta: ${persistente}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
        });
        let chamadas = 0;
        const agente = new Agente({
            publicar: () => {},
            salvar: async () => {},
            completar: async (corpo) => {
                chamadas++;
                if (chamadas === 2) {
                    const pedido = JSON.stringify(corpo);
                    expect(pedido).toContain('O limite de geração interrompeu');
                    expect(pedido).toContain('Continue a tarefa');
                    expect(pedido).not.toContain('teste.svg');
                    expect(conversa.mensagens.at(-1)?.estado).toBe('gerando');
                    if (!persistente)
                        return new Response(
                            'data: {"choices":[{"delta":{"content":"Recuperado"},' +
                                '"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
                        );
                }
                return new Response(
                    `data: ${JSON.stringify({
                        choices: [
                            {
                                delta: {
                                    tool_calls: [
                                        {
                                            index: 0,
                                            id: 'cortada',
                                            function: {
                                                name: 'escrever_arquivo',
                                                arguments: '{"caminho":"teste.svg","conteudo":"incompleto',
                                            },
                                        },
                                    ],
                                },
                                finish_reason: 'length',
                            },
                        ],
                    })}\n\ndata: [DONE]\n\n`,
                );
            },
        });
        await agente.executar(conversa, 'Crie um SVG', esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(2);
        expect(conversa.mensagens.at(-1)?.estado).toBe(persistente ? 'erro' : 'concluida');
        expect(conversa.mensagens.at(-1)?.texto).toContain(
            persistente ? 'Nenhuma ferramenta dessa geração foi executada' : 'Recuperado',
        );
        expect(conversa.mensagens.at(-1)?.acoes[0]?.estado).toBe('erro');
    });
}
