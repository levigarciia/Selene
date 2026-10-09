import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { obterPedidoParaRegerarChat, prepararReenvioChat } from '../electron/services/reenvioChat';
import { Agente } from '../electron/services/agente';

function criarConversa() {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Conversa de teste',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
        mensagens: ['Primeiro pedido', 'Primeira resposta', 'Segundo pedido', 'Segunda resposta'].map(
            (texto, indice) => ({
                id: randomUUID(),
                papel: indice % 2 === 0 ? 'user' : 'assistant',
                texto,
                estado: 'concluida',
                criadoEm: new Date().toISOString(),
            }),
        ),
    });
    conversa.contextoCompactado = {
        resumo: 'Resumo antigo que não deve ser reutilizado.',
        ateMensagemId: conversa.mensagens[2].id,
        criadoEm: new Date().toISOString(),
    };
    return conversa;
}

function resposta() {
    return new Response(
        'data: {"choices":[{"delta":{"content":"Nova resposta"},"finish_reason":"stop"}]}\n\n' + 'data: [DONE]\n\n',
    );
}

describe('Edição e reenvio no chat', () => {
    test('regera uma resposta antiga a partir de seu pedido sem incluir respostas posteriores', async () => {
        const conversa = criarConversa();
        const pedido = obterPedidoParaRegerarChat(conversa, conversa.mensagens[1].id);
        const entradas: string[] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                entradas.push(JSON.stringify(corpo));
                return resposta();
            },
        });
        await agente.executar(conversa, pedido.texto, esquemaConfiguracao.parse({}), [], undefined, pedido.id);
        expect(conversa.mensagens).toHaveLength(2);
        expect(conversa.mensagens[0].id).toBe(pedido.id);
        expect(conversa.mensagens[1].texto).toBe('Nova resposta');
        expect(entradas[0]).not.toContain('Primeira resposta');
        expect(entradas[0]).not.toContain('Segundo pedido');
        expect(() => obterPedidoParaRegerarChat({ ...conversa, modo: 'code' }, conversa.mensagens[1].id)).toThrow(
            'somente no modo chat',
        );
        expect(() => obterPedidoParaRegerarChat(conversa, pedido.id)).toThrow('resposta encerrada');
    });
    test('prepara a edição sem alterar o original e invalida o resumo', () => {
        const conversa = criarConversa();
        const original = structuredClone(conversa);
        const preparada = prepararReenvioChat(conversa, conversa.mensagens[2].id, '  Pedido corrigido  ');
        expect(preparada.mensagens).toHaveLength(3);
        expect(preparada.mensagens.slice(0, 2)).toEqual(original.mensagens.slice(0, 2));
        expect(preparada.mensagens[2].texto).toBe('Pedido corrigido');
        expect(preparada.contextoCompactado).toBeUndefined();
        expect(conversa).toEqual(original);
    });

    test('recusa modo code, respostas do modelo, mensagens inexistentes e texto inválido', () => {
        const conversa = criarConversa();
        const id = conversa.mensagens[0].id;
        expect(() => prepararReenvioChat({ ...conversa, modo: 'code' }, id, 'Texto')).toThrow('somente no modo chat');
        expect(() => prepararReenvioChat(conversa, conversa.mensagens[1].id, 'Texto')).toThrow('usuário');
        expect(() => prepararReenvioChat(conversa, randomUUID(), 'Texto')).toThrow('usuário');
        expect(() => prepararReenvioChat(conversa, id, '   ')).toThrow('mensagem');
        expect(() => prepararReenvioChat(conversa, id, 'a'.repeat(30001))).toThrow('30000');
    });

    test('gera somente com o histórico anterior e a mensagem corrigida, preservando anexos e rascunho', async () => {
        const conversa = criarConversa();
        const mensagem = conversa.mensagens[2];
        mensagem.imagens = [
            {
                id: randomUUID(),
                nome: 'Imagem.png',
                mime: 'image/jpeg',
                tamanho: 3,
                largura: 1,
                altura: 1,
            },
        ];
        conversa.rascunho = 'Rascunho independente';
        const pedidos: string[] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            lerImagem: async () => 'data:image/jpeg;base64,aW1h',
            completar: async (corpo) => {
                pedidos.push(JSON.stringify(corpo));
                return resposta();
            },
        });
        await agente.executar(
            conversa,
            'Pedido corrigido',
            esquemaConfiguracao.parse({ contexto: 16384 }),
            [],
            undefined,
            mensagem.id,
        );
        expect(pedidos).toHaveLength(1);
        expect(pedidos[0]).toContain('Primeira resposta');
        expect(pedidos[0]).toContain('Pedido corrigido');
        expect(pedidos[0]).toContain('data:image/jpeg;base64,aW1h');
        expect(pedidos[0]).not.toContain('Segundo pedido');
        expect(pedidos[0]).not.toContain('Segunda resposta');
        expect(pedidos[0]).not.toContain('Resumo antigo');
        expect(conversa.mensagens).toHaveLength(4);
        expect(conversa.mensagens[2].imagens).toEqual(mensagem.imagens);
        expect(conversa.mensagens[2].id).toBe(mensagem.id);
        expect(conversa.mensagens[3].texto).toBe('Nova resposta');
        expect(conversa.rascunho).toBe('Rascunho independente');
    });

    test('restaura a conversa inteira quando não consegue persistir a edição', async () => {
        const conversa = criarConversa();
        const original = structuredClone(conversa);
        let inferencias = 0;
        const agente = new Agente({
            salvar: async () => {
                throw new Error('Falha ao salvar');
            },
            publicar: () => {},
            completar: async () => {
                inferencias++;
                return resposta();
            },
        });
        await expect(
            agente.executar(
                conversa,
                'Corrigido',
                esquemaConfiguracao.parse({}),
                [],
                undefined,
                conversa.mensagens[0].id,
            ),
        ).rejects.toThrow('Falha ao salvar');
        expect(conversa).toEqual(original);
        expect(inferencias).toBe(0);
        expect(agente.conversaId).toBeNull();
    });
});
