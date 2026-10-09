import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConfiguracao, type Conversa, type Mensagem } from '../shared/contratos';
import { prepararFerramenta, resolverCaminho } from '../electron/services/ferramentas';
import { Persistencia } from '../electron/services/persistencia';
import { receberResposta } from '../electron/services/streaming';
import { Agente } from '../electron/services/agente';
import { executarProcesso } from '../electron/services/processos';
import { montarAtividade, obterPlano } from '../shared/atividade';

const pastas: string[] = [];
async function criarPasta() {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-teste-'));
    pastas.push(pasta);
    return pasta;
}
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});
function criarConversa(projeto: string | null, modo: 'chat' | 'code' = 'code'): Conversa {
    return {
        id: randomUUID(),
        titulo: 'Teste',
        modo,
        projeto,
        acessoCompleto: false,
        modeloId: null,
        mensagens: [],
        atualizadoEm: new Date().toISOString(),
    };
}
function respostaModelo(texto: string, chamada?: { nome: string; argumentos: object }) {
    const partes = [
        { choices: [{ delta: { content: texto } }] },
        ...(chamada
            ? [
                  {
                      choices: [
                          {
                              delta: {
                                  tool_calls: [
                                      {
                                          index: 0,
                                          id: randomUUID(),
                                          function: {
                                              name: chamada.nome,
                                              arguments: JSON.stringify(chamada.argumentos),
                                          },
                                      },
                                  ],
                              },
                          },
                      ],
                  },
              ]
            : []),
        { choices: [{ delta: {}, finish_reason: chamada ? 'tool_calls' : 'stop' }] },
    ];
    return new Response(partes.map((parte) => `data: ${JSON.stringify(parte)}\n\n`).join('') + 'data: [DONE]\n\n');
}

describe('Arquivos e permissões', () => {
    test('impede travessia relativa, absoluta e por junction', async () => {
        const pasta = await criarPasta();
        const projeto = join(pasta, 'projeto');
        const fora = join(pasta, 'fora');
        await mkdir(projeto);
        await mkdir(fora);
        await writeFile(join(fora, 'segredo.txt'), 'privado');
        await symlink(fora, join(projeto, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
        await expect(resolverCaminho('../fora/segredo.txt', projeto, false)).rejects.toThrow('fora do projeto');
        await expect(resolverCaminho(join(fora, 'segredo.txt'), projeto, false)).rejects.toThrow('fora do projeto');
        await expect(resolverCaminho('atalho/segredo.txt', projeto, false)).rejects.toThrow('fora do projeto');
        expect(await resolverCaminho('atalho/segredo.txt', projeto, true)).toContain('segredo.txt');
    });
    test('a prévia não escreve e uma alteração concorrente impede a sobrescrita', async () => {
        const pasta = await criarPasta();
        const caminho = join(pasta, 'arquivo.txt');
        await writeFile(caminho, 'original');
        const ferramenta = await prepararFerramenta(
            'escrever_arquivo',
            {
                caminho: 'arquivo.txt',
                conteudo: 'novo',
            },
            criarConversa(pasta),
        );
        expect(ferramenta.aprovacao).toBe(true);
        expect(await readFile(caminho, 'utf8')).toBe('original');
        await writeFile(caminho, 'modificado externamente');
        await expect(ferramenta.executar(new AbortController().signal)).rejects.toThrow('mudou após');
        expect(await readFile(caminho, 'utf8')).toBe('modificado externamente');
    });
    test('edita uma ocorrência única e preserva cifrões literais no novo texto', async () => {
        const pasta = await criarPasta();
        const caminho = join(pasta, 'arquivo.txt');
        await writeFile(caminho, 'texto original');
        const ferramenta = await prepararFerramenta(
            'editar_arquivo',
            {
                caminho: 'arquivo.txt',
                anterior: 'original',
                novo: '$& atualizado',
            },
            criarConversa(pasta),
        );
        await ferramenta.executar(new AbortController().signal);
        expect(await readFile(caminho, 'utf8')).toBe('texto $& atualizado');
        await expect(
            prepararFerramenta(
                'editar_arquivo',
                {
                    caminho: 'arquivo.txt',
                    anterior: 'ausente',
                    novo: 'novo',
                },
                criarConversa(pasta),
            ),
        ).rejects.toThrow('exatamente uma vez');
    });
    test('cancelamento impede escrita e encerra um comando em execução', async () => {
        const pasta = await criarPasta();
        const ferramenta = await prepararFerramenta(
            'escrever_arquivo',
            {
                caminho: 'novo.txt',
                conteudo: 'novo',
            },
            criarConversa(pasta),
        );
        const controle = new AbortController();
        controle.abort(new Error('interrompido'));
        await expect(ferramenta.executar(controle.signal)).rejects.toThrow('interrompido');
        const comando = new AbortController();
        const processo = executarProcesso(
            process.execPath,
            ['-e', 'setTimeout(() => {}, 100000)'],
            pasta,
            comando.signal,
        );
        setTimeout(() => comando.abort(new Error('comando interrompido')), 100);
        await expect(processo).rejects.toThrow('comando interrompido');
    });
});

describe('Persistência', () => {
    test('restaura tarefas interrompidas e preserva a permissão escolhida', async () => {
        const pasta = await criarPasta();
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        const conversa = criarConversa(pasta);
        conversa.acessoCompleto = true;
        conversa.mensagens.push({
            id: randomUUID(),
            papel: 'assistant',
            texto: 'parcial',
            estado: 'gerando',
            criadoEm: new Date().toISOString(),
            acoes: [
                { id: randomUUID(), nome: 'executar_terminal', argumentos: {}, estado: 'aguardando', resultado: '' },
            ],
        });
        persistencia.dados.conversas.push(conversa);
        const primeira = persistencia.salvar();
        conversa.titulo = 'Título atualizado';
        await Promise.all([primeira, persistencia.salvar()]);
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        const restaurada = reaberta.dados.conversas[0];
        expect(restaurada.titulo).toBe('Título atualizado');
        expect(restaurada.acessoCompleto).toBe(true);
        expect(restaurada.mensagens[0].estado).toBe('interrompida');
        expect(restaurada.mensagens[0].acoes[0].estado).toBe('interrompida');
    });
    test('não sobrescreve um histórico corrompido', async () => {
        const pasta = await criarPasta();
        await writeFile(join(pasta, 'selene.json'), '{ inválido');
        await expect(new Persistencia(pasta).abrir()).rejects.toThrow('original foi preservado');
        expect(await readFile(join(pasta, 'selene.json'), 'utf8')).toBe('{ inválido');
    });
});

describe('Streaming', () => {
    test('preserva textos completos, ordem das ações e resposta final com acesso completo', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta);
        conversa.acessoCompleto = true;
        const plano = {
            etapas: [
                { descricao: 'Escrever arquivo', estado: 'em andamento' as const },
                { descricao: 'Validar resultado', estado: 'pendente' as const },
            ],
        };
        const respostas = [
            respostaModelo('Vou planejar.\n\nEste parágrafo precisa ficar inteiro.', {
                nome: 'atualizar_plano',
                argumentos: plano,
            }),
            respostaModelo('Agora vou escrever o arquivo.', {
                nome: 'escrever_arquivo',
                argumentos: { caminho: 'feito.txt', conteudo: 'feito' },
            }),
            respostaModelo('Concluído.\n\nArquivo salvo e validado.'),
        ];
        const agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                expect(mensagem.acoes.some((acao) => acao.estado === 'aguardando')).toBe(false);
            },
            completar: async () => {
                const resposta = respostas.shift();
                if (!resposta) throw new Error('Geração inesperada.');
                return resposta;
            },
        });
        await agente.executar(conversa, 'Escreva um arquivo', esquemaConfiguracao.parse({}));
        const mensagem = conversa.mensagens[1];
        expect(conversa.acessoCompleto).toBe(true);
        expect(mensagem.estado).toBe('concluida');
        expect(await readFile(join(pasta, 'feito.txt'), 'utf8')).toBe('feito');
        expect(mensagem.texto.slice(mensagem.inicioTextoFinal)).toBe('Concluído.\n\nArquivo salvo e validado.');
        expect(montarAtividade(mensagem).map((bloco) => bloco.tipo)).toEqual([
            'texto',
            'acao',
            'texto',
            'acao',
            'texto',
        ]);
        expect(
            montarAtividade(mensagem)
                .filter((bloco) => bloco.tipo === 'texto')
                .map((bloco) => bloco.texto)
                .join(''),
        ).toBe(mensagem.texto);
        expect(obterPlano(mensagem)).toEqual(plano.etapas);
        expect(mensagem.concluidoEm).toBeDefined();
        const persistencia = new Persistencia(pasta);
        persistencia.dados.conversas.push(conversa);
        await persistencia.salvar();
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reaberta.dados.conversas[0]).toEqual(conversa);
    });
    test('mensagens antigas preservam o texto sem dividir parágrafos ou palavras', () => {
        const mensagem: Mensagem = {
            id: randomUUID(),
            papel: 'assistant',
            texto: 'Primeiro parágrafo.\n\nSegundo parágrafo completo.',
            estado: 'concluida',
            criadoEm: new Date().toISOString(),
            acoes: [{ id: 'antiga', nome: 'ler_arquivo', argumentos: {}, estado: 'concluida', resultado: 'ok' }],
        };
        expect(montarAtividade(mensagem)[0]).toEqual({ tipo: 'texto', texto: mensagem.texto });
        expect(obterPlano(mensagem)).toEqual([]);
    });
    test('preserva UTF 8 e chamadas fragmentadas em pacotes de um byte', async () => {
        const eventos = [
            { choices: [{ delta: { content: 'Olá, ação.' } }] },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 0,
                                    id: 'chamada',
                                    function: {
                                        name: 'ler_',
                                        arguments: '{"caminho":',
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 0,
                                    function: {
                                        name: 'arquivo',
                                        arguments: '"ação.txt"}',
                                    },
                                },
                            ],
                        },
                        finish_reason: 'tool_calls',
                    },
                ],
            },
        ];
        const bytes = new TextEncoder().encode(
            eventos.map((evento) => `data: ${JSON.stringify(evento)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n',
        );
        const fluxo = new ReadableStream<Uint8Array>({
            start(controle) {
                for (const byte of bytes) controle.enqueue(new Uint8Array([byte]));
                controle.close();
            },
        });
        const resultado = await receberResposta(new Response(fluxo), new AbortController().signal, () => {});
        expect(resultado.texto).toBe('Olá, ação.');
        expect(resultado.chamadas).toEqual([
            { id: 'chamada', nome: 'ler_arquivo', argumentos: '{"caminho":"ação.txt"}' },
        ]);
    });
    test('detecta resposta truncada', async () => {
        const resposta = new Response('data: {"choices":[{"delta":{"content":"parcial"}}]}\n\n');
        await expect(receberResposta(resposta, new AbortController().signal, () => {})).rejects.toThrow(
            'antes de confirmar',
        );
    });
});

describe('Ciclo do agente', () => {
    test('escrita aguarda aprovação, é recusada e devolve a decisão ao modelo', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta);
        let rodada = 0;
        let ultima: Mensagem | null = null;
        let contexto: unknown = null;
        let sinalizar: () => void = () => {};
        const aguardando = new Promise<void>((resolver) => {
            sinalizar = resolver;
        });
        const agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                ultima = structuredClone(mensagem);
                if (mensagem.acoes[0]?.estado === 'aguardando') sinalizar();
            },
            completar: async (corpo) => {
                contexto = corpo;
                return rodada++ === 0
                    ? respostaModelo('', {
                          nome: 'escrever_arquivo',
                          argumentos: { caminho: 'negado.txt', conteudo: 'não deve existir' },
                      })
                    : respostaModelo('Ação recusada.');
            },
        });
        const execucao = agente.executar(conversa, 'escreva', esquemaConfiguracao.parse({}));
        await aguardando;
        await expect(readFile(join(pasta, 'negado.txt'))).rejects.toThrow();
        agente.aprovar((ultima as unknown as Mensagem).acoes[0].id, false);
        await execucao;
        expect(conversa.mensagens[1].acoes[0].estado).toBe('recusada');
        expect(JSON.stringify(contexto)).toContain('O usuário recusou');
        expect(conversa.mensagens[1].estado).toBe('concluida');
        await expect(readFile(join(pasta, 'negado.txt'))).rejects.toThrow();
    });
    test('aprovação executa, enquanto acesso completo dispensa a aprovação', async () => {
        for (const acessoCompleto of [false, true]) {
            const pasta = await criarPasta();
            const conversa = criarConversa(pasta);
            conversa.acessoCompleto = acessoCompleto;
            let rodada = 0;
            let agente: Agente;
            agente = new Agente({
                salvar: async () => {},
                publicar: (mensagem) => {
                    const acao = mensagem.acoes[0];
                    if (acao?.estado === 'aguardando') agente.aprovar(acao.id, true);
                },
                completar: async () =>
                    rodada++ === 0
                        ? respostaModelo('', {
                              nome: 'escrever_arquivo',
                              argumentos: { caminho: 'aprovado.txt', conteudo: 'salvo' },
                          })
                        : respostaModelo('Arquivo salvo.'),
            });
            await agente.executar(conversa, 'escreva', esquemaConfiguracao.parse({}));
            expect(await readFile(join(pasta, 'aprovado.txt'), 'utf8')).toBe('salvo');
        }
    });
    test('cancelar uma aprovação pendente interrompe a tarefa', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta);
        let agente: Agente;
        agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                if (mensagem.acoes[0]?.estado === 'aguardando') agente.cancelar();
            },
            completar: async () =>
                respostaModelo('', {
                    nome: 'escrever_arquivo',
                    argumentos: { caminho: 'cancelado.txt', conteudo: 'ausente' },
                }),
        });
        await agente.executar(conversa, 'escreva', esquemaConfiguracao.parse({}));
        expect(conversa.mensagens[1].estado).toBe('interrompida');
        expect(agente.conversaId).toBe(null);
        await expect(readFile(join(pasta, 'cancelado.txt'))).rejects.toThrow();
    });
    test('chat não recebe ferramentas e não executa chamadas inventadas pelo modelo', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta, 'chat');
        let requisicao: unknown;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                requisicao = corpo;
                return respostaModelo('', {
                    nome: 'escrever_arquivo',
                    argumentos: { caminho: 'intruso.txt', conteudo: 'x' },
                });
            },
        });
        await agente.executar(conversa, 'olá', esquemaConfiguracao.parse({}));
        expect((requisicao as Record<string, unknown>).tools).toBeUndefined();
        expect(conversa.mensagens[1].estado).toBe('erro');
        await expect(readFile(join(pasta, 'intruso.txt'))).rejects.toThrow();
    });
    test('argumentos fragmentados e JSON informal não encerram a tarefa', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta);
        conversa.acessoCompleto = true;
        let rodada = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async () => {
                if (rodada++ === 0) {
                    const id = 'chamada';
                    const argumentos = '{caminho: "poema.txt", conteudo: "verso"}';
                    const partes = [
                        {
                            choices: [
                                {
                                    delta: {
                                        tool_calls: [
                                            { index: 0, id, function: { name: 'escrever_arquivo', arguments: '' } },
                                        ],
                                    },
                                },
                            ],
                        },
                        ...[...argumentos].map((caractere) => ({
                            choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: caractere } }] } }],
                        })),
                        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
                    ];
                    return new Response(
                        partes.map((parte) => `data: ${JSON.stringify(parte)}\n\n`).join('') + 'data: [DONE]\n\n',
                    );
                }
                return respostaModelo('Arquivo salvo.');
            },
        });
        await agente.executar(conversa, 'escreva um poema', esquemaConfiguracao.parse({}));
        expect(await readFile(join(pasta, 'poema.txt'), 'utf8')).toBe('verso');
        expect(conversa.mensagens[1].estado).toBe('concluida');
        expect(conversa.mensagens[1].acoes).toHaveLength(1);
        expect(conversa.mensagens[1].acoes[0].estado).toBe('concluida');
    });
    test('JSON irrecuperável volta ao modelo sem encerrar a tarefa', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa(pasta);
        let contexto: unknown = null;
        let rodada = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                contexto = corpo;
                return rodada++ === 0
                    ? new Response(
                          [
                              {
                                  choices: [
                                      {
                                          delta: {
                                              tool_calls: [
                                                  {
                                                      index: 0,
                                                      id: 'chamada',
                                                      function: {
                                                          name: 'escrever_arquivo',
                                                          arguments: '{caminho',
                                                      },
                                                  },
                                              ],
                                          },
                                      },
                                  ],
                              },
                              { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
                          ]
                              .map((parte) => `data: ${JSON.stringify(parte)}\n\n`)
                              .join('') + 'data: [DONE]\n\n',
                      )
                    : respostaModelo('Não consegui gravar o arquivo.');
            },
        });
        await agente.executar(conversa, 'escreva', esquemaConfiguracao.parse({}));
        expect(conversa.mensagens[1].estado).toBe('concluida');
        expect(conversa.mensagens[1].acoes[0].estado).toBe('erro');
        expect(JSON.stringify(contexto)).toContain('JSON de objeto válido');
    });
});
