import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { estimarTokens, type MensagemModelo } from '../electron/services/contexto';
import { esquemaConfiguracao, esquemaConversa, type Modelo } from '../shared/contratos';

function criarModelo(provedor: string, maxTokens?: number): Modelo {
    return {
        id: randomUUID(),
        nome: provedor,
        caminho: `${provedor}/teste`,
        tamanho: 0,
        openrouter: {
            id: `${provedor}/teste`,
            contexto: 1048576,
            maxTokens,
            imagens: false,
            ferramentas: false,
            raciocinio: false,
        },
    };
}

const cenarios = [
    { nome: 'local', modelo: undefined, automatico: true, esperado: 8192 },
    { nome: 'Google', modelo: criarModelo('google', 65536), automatico: true, esperado: 8192 },
    { nome: 'Anthropic', modelo: criarModelo('anthropic', 64000), automatico: true, esperado: 8192 },
    { nome: 'OpenAI', modelo: criarModelo('openai'), automatico: true, esperado: 8192 },
    { nome: 'modelo com saída pequena', modelo: criarModelo('teste', 1024), automatico: true, esperado: 1024 },
    { nome: 'manual', modelo: criarModelo('teste'), automatico: false, esperado: 16000 },
    { nome: 'manual com limite do modelo', modelo: criarModelo('teste', 1024), automatico: false, esperado: 1024 },
];

for (const cenario of cenarios) {
    test(`saudação mantém entrada pequena e limita saída no modelo ${cenario.nome}`, async () => {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Teste',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
        });
        let solicitacoes = 0;
        let limiteEnviado = 0;
        let entradaEstimada = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                solicitacoes++;
                const pedido = corpo as { messages: MensagemModelo[]; max_tokens: number };
                limiteEnviado = pedido.max_tokens;
                entradaEstimada = estimarTokens(pedido.messages);
                expect(pedido.messages.map((mensagem) => mensagem.role)).toEqual(['system', 'user']);
                expect(pedido.messages[1].content).toBe('oi');
                const eventos = [
                    { choices: [{ delta: { content: 'Olá!' }, finish_reason: 'stop' }] },
                    { choices: [], usage: { prompt_tokens: 50, completion_tokens: 3 } },
                ];
                return new Response(
                    eventos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join('') + 'data: [DONE]\n\n',
                );
            },
        });
        await agente.executar(
            conversa,
            'oi',
            esquemaConfiguracao.parse({
                contexto: 1048576,
                limitesAutomaticos: cenario.automatico,
                maxTokens: 16000,
            }),
            [],
            cenario.modelo,
        );
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(solicitacoes).toBe(1);
        expect(limiteEnviado).toBe(cenario.esperado);
        expect(entradaEstimada).toBeLessThan(1024);
        expect(conversa.mensagens.at(-1)?.desempenho?.tokensEntrada).toBe(50);
        expect(conversa.mensagens.at(-1)?.medicoesModelo).toHaveLength(1);
        expect(conversa.mensagens.at(-1)?.medicoesModelo?.[0]).toMatchObject({
            tokensEntrada: 50,
            tokensGerados: 3,
            modeloId: cenario.modelo?.id ?? null,
            finalidade: 'resposta',
        });
    });
}
