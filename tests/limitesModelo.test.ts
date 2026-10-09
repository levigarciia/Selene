import { expect, test } from 'bun:test';
import { contextoAposFalha, contextoDoServidor } from '../electron/services/limitesModelo';
import { esquemaConfiguracao } from '../shared/contratos';
import { esquemaConversa } from '../shared/contratos';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { estimarTokens, type MensagemModelo } from '../electron/services/contexto';

test('usa o contexto informado pelo motor sem o teto antigo e migra configurações antigas', () => {
    expect(contextoDoServidor({ default_generation_settings: { n_ctx: 262144 } })).toBe(262144);
    expect(esquemaConfiguracao.parse({ contexto: 4096, maxTokens: 512 }).limitesAutomaticos).toBe(true);
    for (const valor of [null, {}, { default_generation_settings: { n_ctx: 0 } }]) {
        expect(() => contextoDoServidor(valor)).toThrow('contexto válido');
    }
});

test('reduz contexto apenas em falhas de memória e encerra as tentativas no limite mínimo', () => {
    expect(contextoAposFalha('n_ctx_train = 262144\nfailed to allocate buffer', 0)).toBe(131072);
    expect(contextoAposFalha('out of memory', 16384)).toBe(8192);
    expect(contextoAposFalha('out of memory', 2048)).toBeNull();
    expect(contextoAposFalha('modelo inválido', 8192)).toBeNull();
});

test('resposta usa o contexto carregado em vez do limite manual antigo', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Limites',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        completar: async (corpo) => {
            const pedido = corpo as { messages: MensagemModelo[]; max_tokens: number };
            expect(pedido.max_tokens).toBeGreaterThan(200000);
            expect(pedido.max_tokens + estimarTokens(pedido.messages)).toBeLessThan(262144);
            return new Response(
                'data: {"choices":[{"delta":{"content":"Pronto"},' + '"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
            );
        },
    });
    await agente.executar(conversa, 'Olá', esquemaConfiguracao.parse({ contexto: 262144, maxTokens: 64 }));
    expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
    expect(conversa.mensagens.at(-1)?.usoContexto?.limite).toBe(262144);
});
