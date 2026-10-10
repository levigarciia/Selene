import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaConversa, esquemaConfiguracao } from '../shared/contratos';
import { esquemaNavegador, validarUrlWeb, type ServicoWeb } from '../shared/web';
import { obterFerramentas, prepararFerramenta } from '../electron/services/ferramentas';
import { Agente } from '../electron/services/agente';
import { validarDestinoPublico } from '../electron/services/enderecoWeb';

const conversa = (modo: 'chat' | 'code') =>
    esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Pesquisa',
        modo,
        atualizadoEm: new Date().toISOString(),
    });
const resposta = (nome?: string, argumentos = {}) =>
    new Response(
        `data: ${JSON.stringify({
            choices: [
                {
                    delta: nome
                        ? {
                              tool_calls: [
                                  {
                                      index: 0,
                                      id: randomUUID(),
                                      function: { name: nome, arguments: JSON.stringify(argumentos) },
                                  },
                              ],
                          }
                        : { content: 'Fonte: [Exemplo](https://example.org)' },
                    finish_reason: nome ? 'tool_calls' : 'stop',
                },
            ],
        })}\n\ndata: [DONE]\n\n`,
    );

describe('Pesquisa e navegador', () => {
    test('pesquisa e leitura recebem o identificador da conversa', async () => {
        const chat = conversa('chat');
        const chamadas: string[] = [];
        const web: ServicoWeb = {
            pesquisar: async (_consulta, _sinal, id) => {
                chamadas.push(`pesquisa:${id}`);
                return 'Resultado';
            },
            ler: async (_url, _sinal, id) => {
                chamadas.push(`leitura:${id}`);
                return 'Fonte';
            },
            preparar: () => {
                throw new Error('Não deve controlar navegador no Chat.');
            },
        };
        for (const [nome, entrada] of [
            ['pesquisar_web', { consulta: 'Electron' }],
            ['ler_pagina_web', { url: 'https://example.org' }],
        ] as const) {
            const preparada = await prepararFerramenta(nome, entrada, chat, web);
            expect(preparada.aprovacao).toBe(false);
            await preparada.executar(new AbortController().signal);
        }
        expect(chamadas).toEqual([`pesquisa:${chat.id}`, `leitura:${chat.id}`]);
    });
    test('Chat oferece somente pesquisa e não admite ferramentas de computador', async () => {
        const nomes = obterFerramentas('chat', true).map((item) => item.function.name);
        expect(nomes).toEqual(['pesquisar_web', 'ler_pagina_web']);
        expect(obterFerramentas('chat', false)).toEqual([]);
        expect(obterFerramentas('code', true).some((item) => item.function.name === 'controlar_navegador')).toBe(true);
        await expect(prepararFerramenta('executar_terminal', {}, conversa('chat'))).rejects.toThrow('modo Code');
    });

    test('URLs de arquivos, scripts e credenciais são rejeitadas', () => {
        for (const url of ['file:///C:/privado.txt', 'javascript:alert(1)', 'https://usuario:senha@example.org']) {
            expect(() => validarUrlWeb(url)).toThrow();
        }
        expect(validarUrlWeb('https://example.org')).toBe('https://example.org/');
        expect(esquemaNavegador.parse({ acao: 'clicar', referencia: 'e1' }).observacao).toBeUndefined();
        expect(() => esquemaNavegador.parse({ acao: 'clicar' })).toThrow();
        expect(() =>
            esquemaNavegador.parse({ acao: 'abrir', url: 'https://example.org', script: 'alert(1)' }),
        ).toThrow();
    });

    test('leitura de pesquisa não acessa serviços locais do computador', async () => {
        for (const url of ['http://localhost:7000', 'http://127.0.0.1', 'http://192.168.1.1', 'http://[::1]']) {
            await expect(validarDestinoPublico(url)).rejects.toThrow();
        }
    });

    test('pesquisa funciona sem pasta de projeto e registra resultados no histórico do Chat', async () => {
        const chat = conversa('chat');
        const corpos: Record<string, unknown>[] = [];
        const web: ServicoWeb = {
            pesquisar: async () => 'Fonte real de teste: https://example.org',
            ler: async () => 'Texto da fonte',
            preparar: () => {
                throw new Error('Não deveria controlar navegador no Chat.');
            },
        };
        const agente = new Agente({
            web,
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                corpos.push(corpo as Record<string, unknown>);
                return corpos.length === 1 ? resposta('pesquisar_web', { consulta: 'Teste' }) : resposta();
            },
        });
        await agente.executar(chat, 'Pesquise', esquemaConfiguracao.parse({}));
        expect(chat.mensagens.at(-1)?.estado).toBe('concluida');
        expect(chat.mensagens.at(-1)?.acoes[0].resultado).toContain('Fonte real');
        expect(JSON.stringify(corpos[1])).toContain('Fonte real');
        await agente.executar(chat, 'Continue', esquemaConfiguracao.parse({}));
        expect(JSON.stringify(corpos.at(-1))).toContain('Fonte real');
    });

    test('aprovação recusada não executa a interação e acesso completo executa', async () => {
        let executadas = 0;
        for (const acessoCompleto of [false, true]) {
            const code = { ...conversa('code'), acessoCompleto };
            let etapa = 0;
            const web: ServicoWeb = {
                pesquisar: async () => '',
                ler: async () => '',
                preparar: () => ({
                    previa: 'Abrir site',
                    executar: async () => {
                        executadas++;
                        return 'Página';
                    },
                }),
            };
            const agente = new Agente({
                web,
                salvar: async () => {},
                publicar: (mensagem) => {
                    const pendente = mensagem.acoes.find((acao) => acao.estado === 'aguardando');
                    if (pendente) agente.aprovar(pendente.id, false);
                },
                completar: async () =>
                    etapa++ === 0
                        ? resposta('controlar_navegador', { acao: 'abrir', url: 'https://example.org' })
                        : resposta(),
            });
            await agente.executar(code, 'Abra o site', esquemaConfiguracao.parse({}));
            expect(code.mensagens.at(-1)?.acoes[0].estado).toBe(acessoCompleto ? 'concluida' : 'recusada');
        }
        expect(executadas).toBe(1);
    });
});
