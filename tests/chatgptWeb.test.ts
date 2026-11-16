import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { navegacaoChatGptPermitida, pedidoInicialChatGpt, urlConversaChatGpt } from '../shared/chatgptWeb';
import { ConversaChatGpt } from '../electron/services/conversaChatGpt';
import { esquemaConversa } from '../shared/contratos';
import { removerModelosRemotosOrfaos } from '../electron/services/persistencia';
import { esquemaDados } from '../shared/contratos';

function conversa() {
    return esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Conversa',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });
}

test('ChatGPT aceita somente rotas de conversa e páginas HTTPS explícitas de autenticação', () => {
    expect(urlConversaChatGpt('https://chatgpt.com/c/abc-123?token=privado')).toBe('https://chatgpt.com/c/abc-123');
    for (const url of [
        'file:///segredo',
        'http://chatgpt.com/c/a',
        'https://chatgpt.com.evil/c/a',
        'https://usuario:senha@chatgpt.com/c/a',
        'https://chatgpt.com/auth/login',
    ]) {
        expect(urlConversaChatGpt(url)).toBeNull();
    }
    expect(navegacaoChatGptPermitida('https://auth.openai.com/log-in')).toBe(true);
    for (const url of [
        'https://localhost',
        'https://chatgpt.com:4321',
        'javascript:alert(1)',
        'https://chatgpt.com.evil',
        'https://auth.openai.com@evil.com',
    ]) {
        expect(navegacaoChatGptPermitida(url)).toBe(false);
    }
});

test('histórico é importado como contexto e pedidos vazios ou grandes demais falham explicitamente', () => {
    expect(pedidoInicialChatGpt([{ papel: 'user', texto: 'Olá' }])).toBe('Olá');
    expect(
        pedidoInicialChatGpt([
            { papel: 'assistant', texto: 'Contexto' },
            { papel: 'user', texto: 'Continue' },
        ]),
    ).toContain('Pedido atual do usuário:\nContinue');
    expect(() => pedidoInicialChatGpt([])).toThrow('Escreva');
    expect(() => pedidoInicialChatGpt([{ papel: 'user', texto: 'x'.repeat(100001) }])).toThrow('grande demais');
});

test('conversa pelo site persiste a intenção antes do clique e a confirmação antes de concluir', async () => {
    const item = conversa();
    const estados: boolean[] = [];
    const executor = new ConversaChatGpt({
        salvar: async () => {
            estados.push(item.chatgptWeb?.envioIncerto ?? false);
        },
        publicar: () => {},
        navegador: {
            responder: async (pedido) => {
                await pedido.antesDeEnviar();
                expect(item.chatgptWeb?.envioIncerto).toBe(true);
                await pedido.confirmarEnvio('https://chatgpt.com/c/abc');
                pedido.publicar('Resposta parcial');
                return 'Resposta completa';
            },
        },
    });
    await executor.executar(item, 'Olá');
    expect(estados).toContain(true);
    expect(item.chatgptWeb).toEqual({ url: 'https://chatgpt.com/c/abc', envioIncerto: false });
    expect(item.mensagens.at(-1)?.texto).toBe('Resposta completa');
    expect(item.mensagens.at(-1)?.estado).toBe('concluida');
    expect(item.mensagens.at(-1)?.acoes).toEqual([]);
    expect(executor.conversaId).toBeNull();
});

test('envio incerto não é repetido e Code não pode usar o navegador de conversa', async () => {
    const item = conversa();
    let chamadas = 0;
    const executor = new ConversaChatGpt({
        salvar: async () => {},
        publicar: () => {},
        navegador: {
            responder: async (pedido) => {
                chamadas++;
                await pedido.antesDeEnviar();
                await pedido.registrarConversa('https://chatgpt.com/c/envio-incerto');
                throw new Error('Envio sem confirmação');
            },
        },
    });
    await executor.executar(item, 'Primeiro pedido');
    expect(item.mensagens.at(-1)?.estado).toBe('erro');
    expect(item.chatgptWeb).toEqual({ url: 'https://chatgpt.com/c/envio-incerto', envioIncerto: true });
    await expect(executor.executar(item, 'Não duplicar')).rejects.toThrow('Confira');
    expect(chamadas).toBe(1);
    item.modo = 'code';
    await expect(executor.executar(item, 'Pedido Code')).rejects.toThrow('somente no Chat');
});

test('retomada usa o link salvo e envia somente o pedido novo', async () => {
    const item = conversa();
    item.chatgptWeb = { url: 'https://chatgpt.com/c/original', envioIncerto: false };
    item.mensagens.push({
        id: randomUUID(), papel: 'user', texto: 'Contexto que já existe no site',
        estado: 'concluida', acoes: [], criadoEm: new Date().toISOString(),
    });
    const executor = new ConversaChatGpt({
        salvar: async () => {},
        publicar: () => {},
        navegador: {
            responder: async (pedido) => {
                expect(pedido.url).toBe('https://chatgpt.com/c/original');
                expect(pedido.texto).toBe('Continue');
                await pedido.antesDeEnviar();
                await pedido.confirmarEnvio('https://chatgpt.com/c/original');
                return 'Continuando';
            },
        },
    });
    await executor.executar(item, 'Continue');
    expect(item.chatgptWeb.url).toBe('https://chatgpt.com/c/original');
    expect(item.mensagens.at(-1)?.estado).toBe('concluida');
});

test('cancelamento preserva a resposta parcial e falha inicial ao salvar não envia ao site', async () => {
    const item = conversa();
    let executor: ConversaChatGpt;
    executor = new ConversaChatGpt({
        salvar: async () => {},
        publicar: () => {},
        navegador: {
            responder: async (pedido) => {
                pedido.publicar('Parcial');
                executor.cancelar();
                pedido.sinal.throwIfAborted();
                return '';
            },
        },
    });
    await executor.executar(item, 'Pedido');
    expect(item.mensagens.at(-1)?.estado).toBe('interrompida');
    expect(item.mensagens.at(-1)?.texto).toContain('Parcial');
    const vazia = conversa();
    let enviou = false;
    const falha = new ConversaChatGpt({
        salvar: async () => {
            throw new Error('Disco indisponível');
        },
        publicar: () => {},
        navegador: {
            responder: async () => {
                enviou = true;
                return '';
            },
        },
    });
    await expect(falha.executar(vazia, 'Não enviar')).rejects.toThrow('Disco');
    expect(enviou).toBe(false);
    expect(vazia.mensagens).toHaveLength(0);
    expect(falha.conversaId).toBeNull();
});

test('modelo do site sobrevive às migrações sem ser tratado como modelo local órfão', () => {
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        conversas: [],
        modelos: [
            {
                id: randomUUID(),
                nome: 'ChatGPT',
                caminho: 'chatgpt:web',
                tamanho: 0,
                chatgptWeb: true,
            },
        ],
    });
    expect(removerModelosRemotosOrfaos(dados)).toBe(false);
    expect(dados.modelos).toHaveLength(1);
});
