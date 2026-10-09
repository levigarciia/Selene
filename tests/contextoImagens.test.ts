import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConfiguracao, esquemaConversa, type Conversa, type Mensagem } from '../shared/contratos';
import { Agente } from '../electron/services/agente';
import { AnexosImagens } from '../electron/services/anexosImagens';
import { estimarTokens, type MensagemModelo } from '../electron/services/contexto';
import { Persistencia } from '../electron/services/persistencia';

const pastas: string[] = [];
const entrada = { nome: 'Teste.png', dados: 'data:image/png;base64,aW1hZ2Vt' };

async function criarPasta() {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-contexto-'));
    pastas.push(pasta);
    return pasta;
}

afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

function criarConversa(): Conversa {
    return esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Teste',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });
}

function criarMensagem(papel: 'user' | 'assistant', texto: string): Mensagem {
    return { id: randomUUID(), papel, texto, estado: 'concluida', acoes: [], criadoEm: new Date().toISOString() };
}

function resposta(texto: string, motivo = 'stop', chamada?: { nome: string; argumentos: object }): Response {
    const delta = chamada
        ? {
              tool_calls: [
                  {
                      index: 0,
                      id: 'ferramenta',
                      function: {
                          name: chamada.nome,
                          arguments: JSON.stringify(chamada.argumentos),
                      },
                  },
              ],
          }
        : { content: texto };
    return new Response(
        `data: ${JSON.stringify({ choices: [{ delta, finish_reason: chamada ? 'tool_calls' : motivo }] })}` +
            '\n\ndata: [DONE]\n\n',
    );
}

function historicoLongo(conversa: Conversa) {
    conversa.mensagens.push(
        criarMensagem('user', 'Objetivo: preservar a decisão do projeto Alfa. ' + 'Detalhe. '.repeat(650)),
        criarMensagem('assistant', 'Decisão: usar Bun. A escrita foi recusada. ' + 'Descoberta. '.repeat(650)),
    );
}

describe('Anexos de imagens', () => {
    test('limpeza de rascunhos antigos e exclusão preservam referências compartilhadas', async () => {
        const pasta = await criarPasta();
        const conversa = criarConversa();
        const anexos = new AnexosImagens(
            pasta,
            () => [conversa],
            () => ({ bytes: Buffer.from('ok'), largura: 1, altura: 1 }),
        );
        const [usada, rascunho] = await anexos.importar([entrada, entrada]);
        conversa.mensagens.push({ ...criarMensagem('user', ''), imagens: [usada] });
        await anexos.descartar([usada.id]);
        const reabertos = new AnexosImagens(
            pasta,
            () => [conversa],
            () => ({ bytes: Buffer.from('ok'), largura: 1, altura: 1 }),
        );
        await reabertos.preparar();
        await expect(readFile(join(pasta, `${rascunho.id}.jpg`))).rejects.toThrow();
        expect(await reabertos.ler(usada.id)).toBe(usada.previa);
        await reabertos.excluirSemReferencia([usada.id]);
        expect(await reabertos.ler(usada.id)).toBe(usada.previa);
        conversa.mensagens = [];
        await reabertos.excluirSemReferencia([usada.id]);
        await expect(readFile(join(pasta, `${usada.id}.jpg`))).rejects.toThrow();
        await expect(reabertos.excluirSemReferencia(['../fora'])).rejects.toThrow();
    });
    test('cópias normalizadas sobrevivem ao reinício e descartar não apaga anexos usados', async () => {
        const pasta = await criarPasta();
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        const conversas = () => persistencia.dados.conversas;
        const normalizar = () => ({ bytes: Buffer.from('imagem normalizada'), largura: 120, altura: 80 });
        const anexos = new AnexosImagens(join(pasta, 'attachments'), conversas, normalizar);
        const [imagem] = await anexos.importar([entrada]);
        const conversa = criarConversa();
        conversa.mensagens.push({ ...criarMensagem('user', ''), imagens: [imagem] });
        persistencia.dados.conversas.push(conversa);
        await persistencia.salvar();
        await anexos.descartar([imagem.id]);
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        const restaurados = new AnexosImagens(join(pasta, 'attachments'), () => reaberta.dados.conversas, normalizar);
        expect(await restaurados.ler(imagem.id)).toBe(imagem.previa);
        expect(reaberta.dados.conversas[0].mensagens[0].imagens?.[0].nome).toBe('Teste.png');
        expect(await readFile(join(pasta, 'attachments', `${imagem.id}.jpg`), 'utf8')).toBe('imagem normalizada');
        expect(JSON.stringify(reaberta.dados)).not.toContain('base64');
    });

    test('recusa IDs desconhecidos, duplicação, MIME inválido e limites de tamanho ou quantidade', async () => {
        const anexos = new AnexosImagens(
            await criarPasta(),
            () => [],
            () => ({ bytes: Buffer.from('ok'), largura: 1, altura: 1 }),
        );
        expect(() => anexos.obter(['../../segredo'])).toThrow('não encontrada');
        await expect(anexos.importar([{ ...entrada, dados: 'data:image/svg+xml;base64,aW1hZ2Vt' }])).rejects.toThrow();
        await expect(anexos.importar(Array(5).fill(entrada))).rejects.toThrow('quatro');
        await expect(
            anexos.importar([
                { ...entrada, dados: 'data:image/png;base64,' + Buffer.alloc(10 * 1024 ** 2 + 1).toString('base64') },
            ]),
        ).rejects.toThrow('10 MB');
        const [imagem] = await anexos.importar([entrada]);
        expect(() => anexos.obter([imagem.id, imagem.id])).toThrow('inválida');
        await anexos.descartar([imagem.id]);
        await expect(anexos.ler(imagem.id)).rejects.toThrow('não encontrada');
    });

    test('envia somente imagem como conteúdo multimodal e mantém os bytes no histórico seguinte', async () => {
        const conversa = criarConversa();
        const [imagem] = await new AnexosImagens(
            await criarPasta(),
            () => [],
            () => ({ bytes: Buffer.from('ok'), largura: 1, altura: 1 }),
        ).importar([entrada]);
        const requisicoes: { messages: MensagemModelo[] }[] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            lerImagem: async () => imagem.previa,
            completar: async (corpo) => {
                requisicoes.push(structuredClone(corpo) as (typeof requisicoes)[number]);
                return resposta('Imagem vista.');
            },
        });
        const configuracao = esquemaConfiguracao.parse({ contexto: 16384 });
        await agente.executar(conversa, '', configuracao, [imagem]);
        await agente.executar(conversa, 'Qual era a imagem?', configuracao);
        expect(conversa.titulo).toBe('Teste.png');
        expect(conversa.mensagens[0].imagens?.[0].id).toBe(imagem.id);
        expect(requisicoes[0].messages.at(-1)?.content).toEqual([
            { type: 'text', text: 'Descreva as imagens anexadas.' },
            { type: 'image_url', image_url: { url: imagem.previa } },
        ]);
        expect(JSON.stringify(requisicoes[1].messages)).toContain(imagem.previa);
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(estimarTokens(requisicoes[0].messages)).toBeLessThan(5000);
    });
});

describe('Compactação automática', () => {
    test('resume em partes, continua o pedido e restaura checkpoint sem perder o histórico original', async () => {
        const pasta = await criarPasta();
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        const conversa = criarConversa();
        historicoLongo(conversa);
        persistencia.dados.conversas.push(conversa);
        const originais = structuredClone(conversa.mensagens);
        let resumos = 0;
        const requisicoes: { messages: MensagemModelo[]; tools?: unknown; max_tokens: number }[] = [];
        const completar = async (corpo: unknown) => {
            const requisicao = corpo as (typeof requisicoes)[number];
            requisicoes.push(structuredClone(requisicao));
            if (String(requisicao.messages[0].content).startsWith('Resuma')) {
                resumos++;
                expect(requisicao.tools).toBeUndefined();
                expect(estimarTokens(requisicao.messages) + requisicao.max_tokens).toBeLessThan(8192);
                return resposta('Objetivo: projeto Alfa. Decisão: Bun. Escrita recusada. Pendente: revisão.');
            }
            return resposta('Continuando a revisão.');
        };
        const agente = new Agente({ completar, salvar: () => persistencia.salvar(), publicar: () => {} });
        await agente.executar(conversa, 'Continue com a revisão, sem escrever.', esquemaConfiguracao.parse({}));
        expect(resumos).toBeGreaterThan(1);
        expect(conversa.mensagens.slice(0, 2)).toEqual(originais);
        expect(conversa.contextoCompactado?.ateMensagemId).toBe(originais[1].id);
        expect(conversa.mensagens.at(-1)?.compactacoes?.length).toBe(1);
        expect(requisicoes.at(-1)?.messages.at(-1)?.content).toBe('Continue com a revisão, sem escrever.');
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        const restaurada = reaberta.dados.conversas[0];
        const novo = new Agente({ completar, salvar: () => reaberta.salvar(), publicar: () => {} });
        await novo.executar(
            restaurada,
            'Qual decisão foi tomada?',
            esquemaConfiguracao.parse({ instrucao: 'Instrução atual.' }),
        );
        expect(requisicoes.at(-1)?.messages[0].content).toBe('Instrução atual.');
        expect(JSON.stringify(requisicoes.at(-1))).toContain('Escrita recusada');
        expect(JSON.stringify(requisicoes.at(-1))).not.toContain('Detalhe. '.repeat(20));
        expect(resumos).toBeGreaterThan(1);
    });

    test('cancelamento durante o resumo não altera o checkpoint nem o histórico', async () => {
        const conversa = criarConversa();
        historicoLongo(conversa);
        const originais = structuredClone(conversa.mensagens);
        let agente: Agente;
        let chamadas = 0;
        agente = new Agente({
            salvar: async () => {},
            publicar: (mensagem) => {
                if (mensagem.faseContexto === 'compactando') agente.cancelar();
            },
            completar: async () => {
                chamadas++;
                return resposta('Não deve gerar.');
            },
        });
        await agente.executar(conversa, 'Continue.', esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(0);
        expect(conversa.contextoCompactado).toBeUndefined();
        expect(conversa.mensagens.slice(0, 2)).toEqual(originais);
        expect(conversa.mensagens.at(-1)?.estado).toBe('interrompida');
        expect(conversa.mensagens.at(-1)?.faseContexto).toBeUndefined();
        expect(agente.conversaId).toBeNull();
    });

    test('resumo vazio, truncado ou falha HTTP preserva o histórico e informa erro', async () => {
        for (const completar of [
            async () => resposta(''),
            async () => resposta('incompleto', 'length'),
            async () => new Response('Falha', { status: 500 }),
        ]) {
            const conversa = criarConversa();
            historicoLongo(conversa);
            const originais = structuredClone(conversa.mensagens);
            const agente = new Agente({ completar, salvar: async () => {}, publicar: () => {} });
            await agente.executar(conversa, 'Continue.', esquemaConfiguracao.parse({}));
            expect(conversa.contextoCompactado).toBeUndefined();
            expect(conversa.mensagens.slice(0, 2)).toEqual(originais);
            expect(conversa.mensagens.at(-1)?.estado).toBe('erro');
            expect(conversa.mensagens.at(-1)?.faseContexto).toBeUndefined();
        }
    });

    test('falha ao persistir resumo restaura o checkpoint anterior', async () => {
        const conversa = criarConversa();
        historicoLongo(conversa);
        let salvamentos = 0;
        const agente = new Agente({
            completar: async () => resposta('Resumo curto.'),
            publicar: () => {},
            salvar: async () => {
                if (++salvamentos === 2) throw new Error('Falha ao gravar.');
            },
        });
        await agente.executar(conversa, 'Continue.', esquemaConfiguracao.parse({}));
        expect(conversa.contextoCompactado).toBeUndefined();
        expect(conversa.mensagens.at(-1)?.estado).toBe('erro');
        expect(conversa.mensagens.at(-1)?.texto).toContain('Falha ao gravar');
    });

    test('compacta resultados de ferramentas durante a tarefa e continua sem repetir a execução', async () => {
        const projeto = await criarPasta();
        await writeFile(
            join(projeto, 'grande.txt'),
            'Resultado importante: projeto Alfa. ' + 'Informação. '.repeat(1300),
        );
        const conversa = criarConversa();
        conversa.modo = 'code';
        conversa.projeto = projeto;
        let rodadas = 0;
        let resumos = 0;
        let final: MensagemModelo[] = [];
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async (corpo) => {
                const { messages } = corpo as { messages: MensagemModelo[] };
                if (String(messages[0].content).startsWith('Resuma')) {
                    resumos++;
                    return resposta('Arquivo grande.txt lido. Resultado importante: projeto Alfa. Pendente: explicar.');
                }
                if (++rodadas === 1)
                    return resposta('', 'stop', { nome: 'ler_arquivo', argumentos: { caminho: 'grande.txt' } });
                final = structuredClone(messages);
                return resposta('O projeto é Alfa.');
            },
        });
        await agente.executar(conversa, 'Leia grande.txt e explique o projeto.', esquemaConfiguracao.parse({}));
        expect(resumos).toBeGreaterThan(0);
        expect(rodadas).toBe(2);
        expect(conversa.mensagens.at(-1)?.acoes.length).toBe(1);
        expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
        expect(conversa.mensagens.at(-1)?.compactacoes?.length).toBe(1);
        expect(final.some((mensagem) => mensagem.content === 'Leia grande.txt e explique o projeto.')).toBe(true);
        expect(JSON.stringify(final)).toContain('Arquivo grande.txt lido');
        for (let indice = 0; indice < final.length; indice++) {
            if (final[indice].role === 'tool')
                expect(
                    final
                        .slice(0, indice)
                        .some((mensagem) =>
                            mensagem.tool_calls?.some((chamada) => chamada.id === final[indice].tool_call_id),
                        ),
                ).toBe(true);
        }
    });

    test('mensagem impossível de acomodar falha explicitamente sem truncar o pedido', async () => {
        const conversa = criarConversa();
        const texto = 'Mensagem extensa. '.repeat(2000);
        let chamadas = 0;
        const agente = new Agente({
            salvar: async () => {},
            publicar: () => {},
            completar: async () => {
                chamadas++;
                return resposta('Não deve gerar.');
            },
        });
        await agente.executar(conversa, texto, esquemaConfiguracao.parse({}));
        expect(chamadas).toBe(0);
        expect(conversa.mensagens[0].texto).toBe(texto);
        expect(conversa.mensagens[1].estado).toBe('erro');
        expect(conversa.mensagens[1].texto).toContain('contexto');
    });
});
