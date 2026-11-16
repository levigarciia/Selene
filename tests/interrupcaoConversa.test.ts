import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { pedeInterrupcaoResposta } from '../shared/interrupcaoConversa';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import { Agente } from '../electron/services/agente';

test('reconhece interrupções explícitas sem interceptar perguntas, código ou citações', () => {
    for (const texto of ['PARA', 'Pare!', 'Que isso para de repetir', 'Por favor, pare com isso.']) {
        expect(pedeInterrupcaoResposta(texto)).toBe(true);
    }
    for (const texto of [
        'Para que serve?',
        'Use a palavra para',
        '"PARA"',
        'cancele o pedido de compra',
        'Faça um botão para parar',
        'const para = 1;',
    ]) {
        expect(pedeInterrupcaoResposta(texto)).toBe(false);
    }
});

test('pedido para parar no Chat não chama o modelo nem carrega pesos e preserva o histórico', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Teste',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant',
                texto: 'Resposta anterior',
                estado: 'concluida',
                acoes: [],
                criadoEm: new Date().toISOString(),
            },
        ],
    });
    let chamadas = 0;
    let carregamentos = 0;
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        completar: async () => {
            chamadas++;
            throw new Error('Não deveria gerar uma resposta.');
        },
    });
    await agente.executar(conversa, 'PARA', esquemaConfiguracao.parse({}), [], undefined, undefined, {
        ligandoModelo: true,
        executar: async () => {
            carregamentos++;
            return esquemaConfiguracao.parse({});
        },
    });
    expect(chamadas).toBe(0);
    expect(carregamentos).toBe(0);
    expect(conversa.mensagens[0].texto).toBe('Resposta anterior');
    expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
    expect(conversa.mensagens.at(-1)?.texto).toBe('Certo, parei.');
});
