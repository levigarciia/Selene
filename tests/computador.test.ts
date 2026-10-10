import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { esquemaComputador, type ServicoComputador } from '../shared/computador';
import { esquemaConversa, esquemaConfiguracao } from '../shared/contratos';
import { obterFerramentas, prepararFerramenta } from '../electron/services/ferramentas';
import { Agente } from '../electron/services/agente';
import { selecionarElementosComputador } from '../shared/elementosComputador';

describe('Controle autorizado do computador', () => {
    test('preserva campos editáveis depois de uma árvore extensa sem alterar a entrada', () => {
        const elementos = Array.from({ length: 250 }, (_, indice) => ({
            tipo: 'ControlType.Button: botão', nome: String(indice), editavel: false, habilitado: true,
        }));
        const campo = { tipo: 'ControlType.Edit: texto', nome: 'Mensagem', editavel: true, habilitado: true };
        elementos.push(campo);
        const selecionados = selecionarElementosComputador(elementos);
        expect(selecionados).toHaveLength(200);
        expect(selecionados[0]).toBe(campo);
        expect(elementos[0].nome).toBe('0');
        expect(elementos.at(-1)).toBe(campo);
    });

    test('rejeita código arbitrário e ações sem referência', () => {
        for (const entrada of [
            { acao: 'observar', script: 'x' },
            { acao: 'clicar' },
            { acao: 'digitar', observacao: randomUUID(), texto: 'x' },
            { acao: 'pressionar', observacao: randomUUID(), tecla: 'Executar' },
        ]) {
            expect(esquemaComputador.safeParse(entrada).success).toBe(false);
        }
        expect(esquemaComputador.parse({ acao: 'clicar', referencia: 'e1' }).observacao).toBeUndefined();
    });

    test('o Chat não oferece nem executa controle nativo', async () => {
        expect(obterFerramentas('chat', true, true).some((item) => item.function.name === 'controlar_computador')).toBe(
            false,
        );
        const chat = esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Chat',
            modo: 'chat',
            atualizadoEm: new Date().toISOString(),
        });
        await expect(prepararFerramenta('controlar_computador', { acao: 'observar' }, chat)).rejects.toThrow(
            'modo Code',
        );
    });

    test('captura recusada não executa e a sessão sempre é encerrada', async () => {
        let executadas = 0;
        let encerradas = 0;
        for (const acessoCompleto of [false, true]) {
            const code = esquemaConversa.parse({
                id: randomUUID(),
                titulo: 'Code',
                modo: 'code',
                acessoCompleto,
                atualizadoEm: new Date().toISOString(),
            });
            const computador: ServicoComputador = {
                preparar: () => ({
                    previa: 'Captura da tela inteira',
                    executar: async () => {
                        executadas++;
                        return 'Observação do aplicativo';
                    },
                }),
                imagem: () => undefined,
                fecharConversa: (id) => {
                    expect(id).toBe(code.id);
                    encerradas++;
                },
            };
            let etapa = 0;
            const agente = new Agente({
                computador,
                salvar: async () => {},
                publicar: (mensagem) => {
                    const pendente = mensagem.acoes.find((acao) => acao.estado === 'aguardando');
                    if (pendente) agente.aprovar(pendente.id, false);
                },
                completar: async () =>
                    new Response(
                        `data: ${JSON.stringify({
                            choices: [
                                {
                                    delta:
                                        etapa++ === 0
                                            ? {
                                                  tool_calls: [
                                                      {
                                                          index: 0,
                                                          id: randomUUID(),
                                                          function: {
                                                              name: 'controlar_computador',
                                                              arguments: JSON.stringify({ acao: 'observar' }),
                                                          },
                                                      },
                                                  ],
                                              }
                                            : { content: 'Concluído' },
                                    finish_reason: etapa === 1 ? 'tool_calls' : 'stop',
                                },
                            ],
                        })}\n\n`,
                    ),
            });
            await agente.executar(code, 'Observe o computador', esquemaConfiguracao.parse({}));
            expect(code.mensagens.at(-1)?.acoes[0].estado).toBe(acessoCompleto ? 'concluida' : 'recusada');
        }
        expect(executadas).toBe(1);
        expect(encerradas).toBe(2);
    });
});
