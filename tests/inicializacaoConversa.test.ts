import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa, type Mensagem } from '../shared/contratos';

function criarConversa() {
    return esquemaConversa.parse({ id: randomUUID(), titulo: 'Teste', modo: 'chat', atualizadoEm: 'agora' });
}

function resposta() {
    return new Response(
        'data: {"choices":[{"delta":{"content":"Resposta pronta"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    );
}

test('persiste o pedido e mostra inicialização antes da inferência, usando o contexto carregado', async () => {
    const conversa = criarConversa();
    let liberar!: () => void;
    let iniciou!: () => void;
    const iniciada = new Promise<void>((resolver) => {
        iniciou = resolver;
    });
    const espera = new Promise<void>((resolver) => {
        liberar = resolver;
    });
    let inferencias = 0;
    let persistiu = false;
    const agente = new Agente({
        salvar: async () => {
            persistiu = true;
        },
        publicar: () => {},
        completar: async () => {
            inferencias++;
            return resposta();
        },
    });
    const execucao = agente.executar(
        conversa,
        'Meu pedido',
        esquemaConfiguracao.parse({ contexto: 2048 }),
        [],
        undefined,
        undefined,
        {
            ligandoModelo: true,
            executar: async () => {
                iniciou();
                await espera;
                return esquemaConfiguracao.parse({ contexto: 16384 });
            },
        },
    );
    await iniciada;
    expect(persistiu).toBe(true);
    expect(conversa.mensagens[0].texto).toBe('Meu pedido');
    expect(conversa.mensagens[1].faseGeracao).toBe('ligandoModelo');
    expect(inferencias).toBe(0);
    expect(agente.conversaId).toBe(conversa.id);
    liberar();
    await execucao;
    expect(conversa.mensagens[1].estado).toBe('concluida');
    expect(conversa.mensagens[1].faseGeracao).toBeUndefined();
    expect(conversa.mensagens[1].usoContexto?.limite).toBe(16384);
    expect(inferencias).toBe(1);
});

test('falha ao ligar o motor encerra o status e mantém o pedido com erro no histórico', async () => {
    const conversa = criarConversa();
    let inferencias = 0;
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        completar: async () => {
            inferencias++;
            return resposta();
        },
    });
    await agente.executar(conversa, 'Meu pedido', esquemaConfiguracao.parse({}), [], undefined, undefined, {
        ligandoModelo: true,
        executar: async () => {
            throw new Error('Falha ao carregar GGUF');
        },
    });
    expect(conversa.mensagens[0].texto).toBe('Meu pedido');
    expect(conversa.mensagens[1].estado).toBe('erro');
    expect(conversa.mensagens[1].texto).toContain('Falha ao carregar GGUF');
    expect(conversa.mensagens[1].faseGeracao).toBeUndefined();
    expect(agente.conversaId).toBeNull();
    expect(inferencias).toBe(0);
});

test('cancelar durante a inicialização não inicia inferência nem deixa o brilho ativo', async () => {
    const conversa = criarConversa();
    const publicadas: Mensagem[] = [];
    let inferencias = 0;
    const agente = new Agente({
        salvar: async () => {},
        publicar: (mensagem) => publicadas.push(structuredClone(mensagem)),
        completar: async () => {
            inferencias++;
            return resposta();
        },
    });
    await agente.executar(conversa, 'Meu pedido', esquemaConfiguracao.parse({}), [], undefined, undefined, {
        ligandoModelo: true,
        executar: async () => {
            agente.cancelar();
            return esquemaConfiguracao.parse({});
        },
    });
    expect(conversa.mensagens[1].estado).toBe('interrompida');
    expect(publicadas.at(-1)?.faseGeracao).toBeUndefined();
    expect(inferencias).toBe(0);
    expect(agente.conversaId).toBeNull();
});
