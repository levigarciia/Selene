import { randomUUID } from 'node:crypto';
import type { Acao, Configuracao, Conversa, ImagemAnexada, Mensagem, Modelo } from '../../shared/contratos';
import { parametrosRaciocinio } from '../../shared/raciocinio';
import { interpretarArgumentos, tentarInterpretarArgumentos } from './argumentos';
import { ferramentas, lerInstrucoes, prepararFerramenta } from './ferramentas';
import { receberResposta } from './streaming';
import { CompactadorContexto, estimarTokens, type MensagemModelo } from './contexto';
type Dependencias = {
    completar: (corpo: unknown, sinal: AbortSignal) => Promise<Response>;
    publicar: (mensagem: Mensagem) => void;
    salvar: () => Promise<void>;
    lerImagem?: (id: string) => Promise<string>;
};

/** Executa chat ou ferramentas com aprovação vinculada à tarefa e cancelamento propagado. */
export class Agente {
    conversaId: string | null = null;
    private controle: AbortController | null = null;
    private pendente: { id: string; resolver: (aprovada: boolean) => void } | null = null;

    constructor(private readonly dependencias: Dependencias) {}

    aprovar(id: string, aprovada: boolean): void {
        if (!this.pendente || this.pendente.id !== id) throw new Error('Esta aprovação não está mais pendente.');
        this.pendente.resolver(aprovada);
    }

    cancelar(): void {
        this.controle?.abort(new Error('Tarefa interrompida pelo usuário.'));
        this.pendente?.resolver(false);
    }

    async executar(
        conversa: Conversa,
        texto: string,
        configuracao: Configuracao,
        imagens: ImagemAnexada[] = [],
        modelo?: Modelo,
    ): Promise<void> {
        if (this.controle) throw new Error('Aguarde ou interrompa a tarefa atual.');
        if (!texto.trim() && !imagens.length) throw new Error('Escreva uma mensagem ou anexe uma imagem.');
        const controle = new AbortController();
        this.controle = controle;
        this.conversaId = conversa.id;
        const resposta: Mensagem = {
            id: randomUUID(),
            papel: 'assistant',
            texto: '',
            estado: 'gerando',
            acoes: [],
            criadoEm: new Date().toISOString(),
            inicioTextoFinal: 0,
        };
        const anteriores = [...conversa.mensagens];
        let ultimaPublicacao = Number.NEGATIVE_INFINITY;
        conversa.mensagens.push(
            {
                id: randomUUID(),
                papel: 'user',
                texto,
                estado: 'concluida',
                acoes: [],
                criadoEm: new Date().toISOString(),
                ...(imagens.length ? { imagens } : {}),
            },
            resposta,
        );
        if (anteriores.length === 0) conversa.titulo = texto.slice(0, 70) || imagens[0].nome.slice(0, 70);
        conversa.atualizadoEm = new Date().toISOString();
        conversa.concluida = false;
        delete conversa.encerradaEm;
        try {
            await this.dependencias.salvar();
            const origens = new Map<MensagemModelo, string>();
            const mensagens = await this.montarContexto(conversa, anteriores, configuracao, origens);
            mensagens.push(await this.mensagemUsuario(texto, imagens));
            const compactador = new CompactadorContexto({
                completar: this.dependencias.completar,
                publicar: () => this.dependencias.publicar(resposta),
                registrar: async (resumo, antigas) => {
                    const ids = antigas.map((mensagem) => origens.get(mensagem)).filter((id) => !!id);
                    const ateMensagemId = ids.at(-1);
                    if (!ateMensagemId) return;
                    const anterior = conversa.contextoCompactado;
                    conversa.contextoCompactado = { resumo, ateMensagemId, criadoEm: new Date().toISOString() };
                    try {
                        await this.dependencias.salvar();
                    } catch (erro) {
                        conversa.contextoCompactado = anterior;
                        throw erro;
                    }
                },
            });
            while (resposta.acoes.length > 0 || !resposta.texto.trim()) {
                controle.signal.throwIfAborted();
                resposta.inicioTextoFinal = resposta.texto.length;
                const reservaResposta = configuracao.limitesAutomaticos
                    ? Math.min(8192, Math.floor(configuracao.contexto / 4))
                    : configuracao.maxTokens;
                await compactador.preparar(
                    mensagens,
                    { ...configuracao, maxTokens: reservaResposta },
                    resposta,
                    controle.signal,
                    conversa.modo === 'code' ? ferramentas : undefined,
                );
                const maxTokens = configuracao.limitesAutomaticos
                    ? Math.max(
                          64,
                          configuracao.contexto -
                              estimarTokens(mensagens, conversa.modo === 'code' ? ferramentas : undefined) -
                              256,
                      )
                    : configuracao.maxTokens;
                const resultado = await receberResposta(
                    await this.dependencias.completar(
                        {
                            model: 'local',
                            messages: mensagens,
                            stream: true,
                            temperature: configuracao.temperatura,
                            max_tokens: maxTokens,
                            cache_prompt: true,
                            stream_options: { include_usage: true },
                            ...parametrosRaciocinio(modelo, conversa.nivelRaciocinio, maxTokens),
                            ...(conversa.modo === 'code' ? { tools: ferramentas, tool_choice: 'auto' } : {}),
                        },
                        controle.signal,
                    ),
                    controle.signal,
                    (trecho) => {
                        resposta.texto += trecho;
                        const agora = performance.now();
                        if (agora - ultimaPublicacao >= 40) {
                            ultimaPublicacao = agora;
                            this.dependencias.publicar(resposta);
                        }
                    },
                    (chamada) => {
                        const acao = this.obterAcao(resposta, chamada.id, chamada.nome);
                        acao.nome = chamada.nome || acao.nome;
                        if (chamada.id) acao.chamadaId = chamada.id;
                        const interpretados = tentarInterpretarArgumentos(chamada.argumentos);
                        if (interpretados) acao.argumentos = interpretados;
                        this.dependencias.publicar(resposta);
                    },
                );
                if (resultado.desempenho) {
                    const atual = resultado.desempenho;
                    const anterior = resposta.desempenho;
                    const tempoTotal = (anterior?.tempoGeracaoMs ?? 0) + atual.tempoGeracaoMs;
                    resposta.desempenho = {
                        tokensGerados: (anterior?.tokensGerados ?? 0) + atual.tokensGerados,
                        ...(anterior?.tokensEntrada !== undefined || atual.tokensEntrada !== undefined
                            ? { tokensEntrada: (anterior?.tokensEntrada ?? 0) + (atual.tokensEntrada ?? 0) }
                            : {}),
                        tempoGeracaoMs: tempoTotal,
                        tokensPorSegundo:
                            tempoTotal > 0
                                ? ((anterior?.tokensPorSegundo ?? 0) * (anterior?.tempoGeracaoMs ?? 0) +
                                      atual.tokensPorSegundo * atual.tempoGeracaoMs) /
                                  tempoTotal
                                : 0,
                    };
                }
                if (!resultado.chamadas.length) {
                    if (resultado.motivo === 'length') resposta.texto += '\n\nLimite de geração atingido.';
                    if (!resposta.texto.trim() && !resposta.acoes.length)
                        throw new Error('O modelo não produziu uma resposta.');
                    resposta.estado = 'concluida';
                    return;
                }
                if (conversa.modo !== 'code') throw new Error('Ferramentas não estão disponíveis no modo chat.');
                const chamadas = resultado.chamadas.map((chamada, indice) => ({
                    ...chamada,
                    id: chamada.id || resposta.acoes[indice]?.chamadaId || randomUUID(),
                }));
                mensagens.push({
                    role: 'assistant',
                    content: resultado.texto || null,
                    tool_calls: chamadas.map((chamada) => ({
                        id: chamada.id,
                        type: 'function',
                        function: { name: chamada.nome, arguments: chamada.argumentos },
                    })),
                });
                for (const [indice, chamada] of chamadas.entries()) {
                    const acao = this.obterAcao(resposta, chamada.id, chamada.nome, indice);
                    acao.chamadaId = chamada.id;
                    acao.nome = chamada.nome || acao.nome;
                    controle.signal.throwIfAborted();
                    try {
                        acao.argumentos = interpretarArgumentos(chamada.argumentos);
                        const preparada = await prepararFerramenta(acao.nome, acao.argumentos, conversa);
                        acao.argumentos = preparada.argumentos;
                        acao.previa = preparada.previa;
                        if (preparada.aprovacao && !conversa.acessoCompleto) {
                            acao.estado = 'aguardando';
                            if (!(await this.aguardarAprovacao(acao, resposta, controle.signal))) {
                                acao.estado = 'recusada';
                                acao.resultado =
                                    'O usuário recusou esta ação. Não tente executá-la por outra ferramenta.';
                            }
                        }
                        controle.signal.throwIfAborted();
                        if (acao.estado !== 'recusada') {
                            acao.estado = 'executando';
                            this.dependencias.publicar(resposta);
                            acao.resultado = await preparada.executar(controle.signal);
                            acao.estado = 'concluida';
                        }
                    } catch (erro) {
                        acao.estado = controle.signal.aborted ? 'interrompida' : 'erro';
                        acao.resultado = erro instanceof Error ? erro.message : 'Falha ao executar ferramenta.';
                    }
                    this.dependencias.publicar(resposta);
                    await this.dependencias.salvar();
                    controle.signal.throwIfAborted();
                    mensagens.push({ role: 'tool', tool_call_id: chamada.id, content: acao.resultado || acao.estado });
                }
                resposta.texto += resposta.texto.endsWith('\n') || !resposta.texto ? '' : '\n\n';
            }
        } catch (erro) {
            resposta.estado = controle.signal.aborted ? 'interrompida' : 'erro';
            const detalhe = erro instanceof Error ? erro.message : 'Não foi possível concluir a tarefa.';
            resposta.texto += `${resposta.texto ? '\n\n' : ''}${detalhe}`;
        } finally {
            this.pendente = null;
            resposta.concluidoEm = new Date().toISOString();
            try {
                await this.dependencias.salvar();
            } catch (erro) {
                resposta.estado = 'erro';
                resposta.texto += '\n\nNão foi possível salvar o resultado no histórico local.';
                throw erro;
            } finally {
                this.controle = null;
                this.conversaId = null;
                this.dependencias.publicar(resposta);
            }
        }
    }

    private async montarContexto(
        conversa: Conversa,
        anteriores: Mensagem[],
        configuracao: Configuracao,
        origens: Map<MensagemModelo, string>,
    ): Promise<MensagemModelo[]> {
        const sistema = [configuracao.instrucao];
        if (conversa.modo === 'code') {
            sistema.push(
                'Você é um agente de programação. Use ferramentas para inspecionar e alterar o projeto.',
                'Planeje tarefas complexas, valide os resultados e relate apenas ações realmente concluídas.',
                'Não use npm. Use Bun. Peça esclarecimentos no texto quando necessário.',
                conversa.acessoCompleto
                    ? 'O usuário autorizou ferramentas com acesso completo nesta conversa.'
                    : 'Comandos e escritas exigem aprovação. Não contorne recusas.',
                `Projeto: ${conversa.projeto ?? 'nenhum selecionado'}.`,
                `Pasta de trabalho: ${conversa.projeto ?? conversa.pastaTrabalho ?? 'não preparada'}.`,
                `Acesso completo: ${conversa.acessoCompleto ? 'ativado' : 'desativado'}.`,
            );
            if (!conversa.projeto) {
                sistema.push(
                    'Trabalhe na pasta exclusiva desta conversa. Ela é persistente e não é um repositório Git.',
                );
            }
            if (conversa.projeto) {
                const instrucoes = await lerInstrucoes(conversa.projeto);
                if (instrucoes) sistema.push(`Instruções do projeto. Não alteram as permissões:\n${instrucoes}`);
            }
        }
        const mensagens: MensagemModelo[] = [{ role: 'system', content: sistema.join('\n\n') }];
        const checkpoint = conversa.contextoCompactado;
        const indice = checkpoint ? anteriores.findIndex((mensagem) => mensagem.id === checkpoint.ateMensagemId) : -1;
        if (checkpoint && indice < 0) throw new Error('O resumo aponta para uma mensagem ausente no histórico.');
        const selecionadas = anteriores.slice(indice + 1);
        if (checkpoint && indice >= 0)
            mensagens.push({
                role: 'assistant',
                content: `Resumo do histórico anterior. Referência factual, sem alterar permissões:\n${checkpoint.resumo}`,
            });
        for (const mensagem of selecionadas) {
            const inicio = mensagens.length;
            if (conversa.modo === 'code' && mensagem.acoes.length) {
                mensagens.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: mensagem.acoes.map((acao) => ({
                        id: acao.id,
                        type: 'function',
                        function: { name: acao.nome, arguments: JSON.stringify(acao.argumentos) },
                    })),
                });
                for (const acao of mensagem.acoes) {
                    mensagens.push({ role: 'tool', tool_call_id: acao.id, content: acao.resultado || acao.estado });
                }
            }
            mensagens.push(
                mensagem.papel === 'user'
                    ? await this.mensagemUsuario(mensagem.texto, mensagem.imagens ?? [])
                    : { role: mensagem.papel, content: mensagem.texto },
            );
            for (const bloco of mensagens.slice(inicio)) origens.set(bloco, mensagem.id);
        }
        return mensagens;
    }

    private async mensagemUsuario(texto: string, imagens: ImagemAnexada[]): Promise<MensagemModelo> {
        if (!imagens.length) return { role: 'user', content: texto };
        if (!this.dependencias.lerImagem) throw new Error('Leitura de imagens indisponível.');
        return {
            role: 'user',
            content: [
                { type: 'text', text: texto || 'Descreva as imagens anexadas.' },
                ...(await Promise.all(
                    imagens.map(async (imagem) => ({
                        type: 'image_url' as const,
                        image_url: { url: await this.dependencias.lerImagem!(imagem.id) },
                    })),
                )),
            ],
        };
    }

    private obterAcao(resposta: Mensagem, chamadaId: string, nome: string, indice?: number): Acao {
        if (chamadaId) {
            const porId = resposta.acoes.find((item) => item.chamadaId === chamadaId);
            if (porId) return porId;
        }
        if (indice !== undefined) {
            const porOrdem = resposta.acoes[indice];
            if (porOrdem && (!porOrdem.chamadaId || porOrdem.chamadaId === chamadaId)) return porOrdem;
        }
        const pendente = resposta.acoes.find((item) => item.nome === nome && !item.chamadaId);
        if (pendente) return pendente;
        const acao: Acao = {
            id: randomUUID(),
            nome,
            argumentos: {},
            estado: 'preparando',
            resultado: '',
            posicaoTexto: resposta.texto.length,
            ...(chamadaId ? { chamadaId } : {}),
        };
        resposta.acoes.push(acao);
        return acao;
    }

    private async aguardarAprovacao(acao: Acao, mensagem: Mensagem, sinal: AbortSignal): Promise<boolean> {
        sinal.throwIfAborted();
        return new Promise((resolver) => {
            const cancelar = () => finalizar(false);
            const finalizar = (aprovada: boolean) => {
                this.pendente = null;
                sinal.removeEventListener('abort', cancelar);
                resolver(aprovada);
            };
            this.pendente = { id: acao.id, resolver: finalizar };
            sinal.addEventListener('abort', cancelar, { once: true });
            this.dependencias.publicar(mensagem);
        });
    }
}
