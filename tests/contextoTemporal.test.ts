import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { criarContextoTemporal } from '../electron/services/contextoTemporal';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao, esquemaConversa } from '../shared/contratos';
import type { MensagemModelo } from '../electron/services/contexto';

test('data usa o fuso do usuário mesmo quando o dia UTC já mudou', () => {
    const instante = new Date('2026-10-11T02:30:00Z');
    expect(criarContextoTemporal(instante, 'America/Manaus')).toContain('2026-10-10');
    expect(criarContextoTemporal(instante, 'Asia/Tokyo')).toContain('2026-10-11');
    expect(criarContextoTemporal(instante, 'America/Manaus')).toContain('GMT-04:00');
    expect(() => criarContextoTemporal(new Date('inválida'))).toThrow('Data local inválida');
});

test('Chat e Code recebem a data atual em todas as chamadas, preservando instruções e histórico', async () => {
    for (const modo of ['chat', 'code'] as const) {
        const conversa = esquemaConversa.parse({
            id: randomUUID(),
            modo,
            titulo: 'Data atual',
            acessoCompleto: true,
            atualizadoEm: new Date().toISOString(),
            mensagens: [
                {
                    id: randomUUID(),
                    papel: 'assistant',
                    texto: 'Hoje é fevereiro de 2025.',
                    criadoEm: new Date().toISOString(),
                    estado: 'concluida',
                },
            ],
        });
        const chamadas: MensagemModelo[][] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            contextoProjetoChat: () => ({ instrucao: 'Instrução do projeto.', referencias: '' }),
            web: {
                pesquisar: async () => 'Fonte de teste',
                ler: async () => 'Fonte',
                preparar: () => {
                    throw new Error('Não deveria controlar navegador.');
                },
            },
            completar: async (corpo) => {
                chamadas.push(structuredClone((corpo as { messages: MensagemModelo[] }).messages));
                const primeira = chamadas.length === 1;
                return new Response(
                    `data: ${JSON.stringify({
                        choices: [
                            {
                                delta: primeira
                                    ? {
                                          tool_calls: [
                                              {
                                                  index: 0,
                                                  id: 'pesquisa',
                                                  function: { name: 'pesquisar_web', arguments: '{"consulta":"data"}' },
                                              },
                                          ],
                                      }
                                    : { content: 'Resposta.' },
                                finish_reason: primeira ? 'tool_calls' : 'stop',
                            },
                        ],
                    })}\n\ndata: [DONE]\n\n`,
                );
            },
        });
        await agente.executar(conversa, 'Que dia é hoje?', esquemaConfiguracao.parse({}));
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(chamadas).toHaveLength(2);
        for (const mensagens of chamadas) {
            const temporais = mensagens.filter(
                (item) =>
                    item.role === 'system' &&
                    typeof item.content === 'string' &&
                    item.content.includes('Data atual do usuário:'),
            );
            expect(temporais).toHaveLength(1);
            expect(temporais[0].content).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
            expect(temporais[0].content).toContain('Datas antigas no histórico');
            expect(mensagens.some((item) => item.content === 'Hoje é fevereiro de 2025.')).toBe(true);
            expect(mensagens[0].content).toContain(modo === 'chat' ? 'Instrução do projeto.' : 'Responda em português');
        }
    }
});
