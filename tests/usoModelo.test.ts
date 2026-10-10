import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaConversa } from '../shared/contratos';
import { Agente } from '../electron/services/agente';
import { esquemaConfiguracao } from '../shared/contratos';
import { montarPainelEstatisticas } from '../shared/painelEstatisticas';
import { reunirRegistrosUso } from '../shared/estatisticas';

test('audita milhões de tokens como soma de contextos por chamada, incluindo cache, sem duplicar eventos', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Auditoria',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });
    let chamadas = 0;
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        web: {
            pesquisar: async () => 'Fonte de teste',
            ler: async () => 'Conteúdo de teste',
            preparar: () => {
                throw new Error('Não deve usar navegador.');
            },
        },
        completar: async () => {
            chamadas++;
            const terminou = chamadas === 31;
            const uso = {
                prompt_tokens: 100000,
                completion_tokens: 10,
                prompt_tokens_details: { cached_tokens: 90000 },
            };
            const eventos = [
                {
                    choices: [
                        {
                            delta: terminou
                                ? { content: 'Pronto' }
                                : {
                                      tool_calls: [
                                          {
                                              index: 0,
                                              id: `pesquisa${chamadas}`,
                                              function: { name: 'pesquisar_web', arguments: '{"consulta":"teste"}' },
                                          },
                                      ],
                                  },
                            finish_reason: terminou ? 'stop' : 'tool_calls',
                        },
                    ],
                    usage: uso,
                },
                { choices: [], usage: uso },
            ];
            return new Response(
                eventos.map((evento) => `data: ${JSON.stringify(evento)}\n\n`).join('') + 'data: [DONE]\n\n',
            );
        },
    });
    await agente.executar(conversa, 'Pesquise', esquemaConfiguracao.parse({ contexto: 200000 }));
    const resposta = conversa.mensagens.at(-1)!;
    expect(resposta.estado).toBe('concluida');
    expect(chamadas).toBe(31);
    expect(resposta.medicoesModelo).toHaveLength(31);
    expect(resposta.desempenho?.tokensEntrada).toBe(3100000);
    expect(resposta.desempenho?.tokensEntradaCache).toBe(2790000);
    const registros = reunirRegistrosUso({ conversas: [conversa], registrosUso: [] });
    const depoisDeExcluir = reunirRegistrosUso({ conversas: [], registrosUso: registros });
    expect(depoisDeExcluir[0]?.medicoesModelo).toHaveLength(31);
    const painel = montarPainelEstatisticas(depoisDeExcluir, 'total');
    expect(painel.tokensEntrada).toBe(3100000);
    expect(painel.tokensEntradaSemCache).toBe(310000);
    expect(painel.tokensEntradaCache).toBe(2790000);
});
