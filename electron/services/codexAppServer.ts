import { spawn } from 'node:child_process';
import type { AcoesExternas } from './assinaturas';

/** Limite de texto reunido de uma única resposta, impedindo que um CLI defeituoso consuma a memória. */
const limiteResposta = 2 * 1024 ** 2;

type Mensagem = {
    id?: number | string;
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: { message?: string };
};

type Item = {
    type?: string;
    id?: string;
    text?: string;
    command?: string;
    aggregatedOutput?: string | null;
    exitCode?: number | null;
    status?: string;
    changes?: { path?: string; kind?: { type?: string }; diff?: string }[];
    action?: { type?: string; query?: string | null; queries?: string[] | null; url?: string | null };
    server?: string;
    tool?: string;
    arguments?: unknown;
    error?: { message?: string } | null;
};

/**
 * Traduz um item do Codex para a ferramenta equivalente da Selene, para a conversa mostrar o mesmo ícone,
 * rótulo e detalhe das ferramentas próprias. Itens sem trabalho visível devolvem `null`.
 */
export function apresentarItemCodex(item: Item): { nome: string; argumentos: Record<string, unknown> } | null {
    switch (item.type) {
        case 'commandExecution':
            return { nome: 'executar_terminal', argumentos: { comando: item.command } };
        case 'fileChange': {
            const [mudanca] = item.changes ?? [];
            const criacao = item.changes?.every((parte) => parte.kind?.type === 'add');
            return {
                nome: criacao ? 'escrever_arquivo' : 'editar_arquivo',
                argumentos: {
                    caminho: item.changes?.map((parte) => parte.path).join(', '),
                    ...(mudanca?.diff ? { patch: item.changes?.map((parte) => parte.diff).join('\n') } : {}),
                },
            };
        }
        case 'webSearch': {
            const acao = item.action;
            if (acao?.type === 'openPage' || acao?.type === 'findInPage') {
                return { nome: 'ler_pagina_web', argumentos: { url: acao.url ?? undefined } };
            }
            const consulta = acao?.query || acao?.queries?.join(' · ');
            return { nome: 'pesquisar_web', argumentos: consulta ? { consulta } : {} };
        }
        case 'mcpToolCall':
            return {
                nome: item.tool ?? 'ferramenta',
                argumentos:
                    item.arguments && typeof item.arguments === 'object'
                        ? (item.arguments as Record<string, unknown>)
                        : {},
            };
        default:
            return null;
    }
}

/** Resultado legível de um item concluído e se ele terminou em erro. */
function resultadoItem(item: Item): { resultado: string; erro: boolean } {
    switch (item.type) {
        case 'commandExecution':
            return {
                resultado: item.aggregatedOutput ?? '',
                erro: item.status === 'failed' || (item.exitCode !== null && item.exitCode !== undefined && item.exitCode !== 0),
            };
        case 'fileChange':
            return {
                resultado: (item.changes ?? []).map((parte) => parte.path).join('\n'),
                erro: item.status === 'failed',
            };
        case 'mcpToolCall':
            return { resultado: item.error?.message ?? '', erro: !!item.error };
        default:
            return { resultado: '', erro: false };
    }
}

/**
 * Conversa com o Codex pelo `codex app-server`, o mesmo protocolo usado pelas extensões oficiais. O texto chega
 * em trechos, as ferramentas do próprio harness aparecem na conversa e, sem acesso completo, cada pedido de
 * aprovação do Codex vira um cartão da Selene.
 */
export function responderCodexAppServer(
    modelo: string,
    prompt: string,
    sinal: AbortSignal,
    pasta: string,
    acessoCompleto: boolean,
    publicar: (texto: string) => void,
    acoes?: AcoesExternas,
): Promise<string> {
    if (sinal.aborted) return Promise.reject(new Error('Tarefa interrompida pelo usuário.'));
    const processo = spawn('codex', ['app-server', '-c', 'web_search="live"'], {
        cwd: pasta,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return new Promise<string>((resolver, rejeitar) => {
        let proximoId = 1;
        const pendentes = new Map<number, { resolver: (valor: unknown) => void; rejeitar: (erro: Error) => void }>();
        const itens = new Map<string, Item>();
        const comDelta = new Set<string>();
        let texto = '';
        let pendente = '';
        let tamanho = 0;
        let encerrado = false;
        let erroStderr = '';

        const finalizar = (erro?: Error) => {
            if (encerrado) return;
            encerrado = true;
            sinal.removeEventListener('abort', abortar);
            pendentes.forEach((item) => item.rejeitar(erro ?? new Error('O Codex encerrou a conexão.')));
            pendentes.clear();
            processo.kill();
            if (sinal.aborted) return rejeitar(new Error('Tarefa interrompida pelo usuário.'));
            if (erro) return rejeitar(erro);
            if (!texto.trim()) return rejeitar(new Error('O Codex não retornou uma resposta.'));
            resolver(texto);
        };
        const abortar = () => finalizar(new Error('Tarefa interrompida pelo usuário.'));
        sinal.addEventListener('abort', abortar, { once: true });

        const enviar = (mensagem: Mensagem) => {
            if (!encerrado) processo.stdin?.write(`${JSON.stringify(mensagem)}\n`);
        };
        const pedir = (method: string, params: unknown) =>
            new Promise<unknown>((resolverPedido, rejeitarPedido) => {
                const id = proximoId++;
                pendentes.set(id, { resolver: resolverPedido, rejeitar: rejeitarPedido });
                enviar({ id, method, params: params as Record<string, unknown> });
            });
        const acrescentar = (trecho: string) => {
            tamanho += trecho.length;
            if (tamanho > limiteResposta) return finalizar(new Error('A resposta do Codex excedeu o limite de tamanho.'));
            texto += trecho;
            publicar(texto);
        };
        const aprovar = async (itemId: string, nome: string, argumentos: Record<string, unknown>) =>
            acoes ? acoes.aprovar(itemId, nome, argumentos, sinal) : false;

        /** Atende pedidos do Codex. Pedidos desconhecidos são recusados para não deixar a tarefa parada. */
        const atenderPedido = async (mensagem: Mensagem) => {
            const params = (mensagem.params ?? {}) as Record<string, unknown>;
            const itemId = String(params.itemId ?? mensagem.id);
            try {
                switch (mensagem.method) {
                    case 'item/commandExecution/requestApproval': {
                        const aprovada = await aprovar(itemId, 'executar_terminal', {
                            comando: typeof params.command === 'string' ? params.command : undefined,
                        });
                        return enviar({ id: mensagem.id, result: { decision: aprovada ? 'accept' : 'decline' } });
                    }
                    case 'item/fileChange/requestApproval': {
                        const item = itens.get(itemId);
                        const apresentada = (item && apresentarItemCodex(item)) ?? {
                            nome: 'editar_arquivo',
                            argumentos: { caminho: typeof params.grantRoot === 'string' ? params.grantRoot : undefined },
                        };
                        const aprovada = await aprovar(itemId, apresentada.nome, apresentada.argumentos);
                        return enviar({ id: mensagem.id, result: { decision: aprovada ? 'accept' : 'decline' } });
                    }
                    case 'item/permissions/requestApproval': {
                        const aprovada = await aprovar(itemId, 'permissoes', {
                            acao: typeof params.reason === 'string' ? params.reason : 'Ampliar as permissões do Codex',
                        });
                        return enviar({
                            id: mensagem.id,
                            result: { permissions: aprovada ? (params.permissions ?? {}) : {}, scope: 'turn' },
                        });
                    }
                    default:
                        return enviar({
                            id: mensagem.id,
                            error: { message: `Pedido não suportado pela Selene: ${mensagem.method}` },
                        });
                }
            } catch (erro) {
                enviar({ id: mensagem.id, error: { message: erro instanceof Error ? erro.message : 'Falha.' } });
            }
        };

        const observarNotificacao = (method: string, params: Record<string, unknown>) => {
            switch (method) {
                case 'item/agentMessage/delta': {
                    const itemId = String(params.itemId ?? '');
                    if (!comDelta.has(itemId)) {
                        comDelta.add(itemId);
                        if (texto && !texto.endsWith('\n\n')) acrescentar('\n\n');
                    }
                    if (typeof params.delta === 'string') acrescentar(params.delta);
                    return;
                }
                case 'item/started': {
                    const item = params.item as Item | undefined;
                    if (!item?.id) return;
                    itens.set(item.id, item);
                    // A busca só informa a consulta ao terminar; ela é registrada em `item/completed`.
                    if (item.type === 'webSearch') return;
                    const apresentada = apresentarItemCodex(item);
                    if (apresentada) acoes?.iniciar(item.id, apresentada.nome, apresentada.argumentos);
                    return;
                }
                case 'item/completed': {
                    const item = params.item as Item | undefined;
                    if (!item?.id) return;
                    itens.set(item.id, item);
                    if (item.type === 'agentMessage') {
                        if (!comDelta.has(item.id) && item.text) {
                            comDelta.add(item.id);
                            if (texto && !texto.endsWith('\n\n')) acrescentar('\n\n');
                            acrescentar(item.text);
                        }
                        return;
                    }
                    const apresentada = apresentarItemCodex(item);
                    if (!apresentada) return;
                    acoes?.iniciar(item.id, apresentada.nome, apresentada.argumentos);
                    const { resultado, erro } = resultadoItem(item);
                    acoes?.concluir(item.id, resultado, erro);
                    return;
                }
                case 'turn/completed': {
                    const turno = params.turn as { status?: string; error?: { message?: string } | null } | undefined;
                    if (turno?.status === 'failed') {
                        return finalizar(new Error(turno.error?.message || 'O ChatGPT interrompeu a resposta.'));
                    }
                    return finalizar();
                }
                case 'error': {
                    const detalhe = params as { error?: { message?: string }; willRetry?: boolean };
                    if (!detalhe.willRetry) finalizar(new Error(detalhe.error?.message || 'O Codex encerrou com erro.'));
                    return;
                }
            }
        };

        const observar = (linha: string) => {
            const bruto = linha.trim();
            if (!bruto.startsWith('{')) return;
            let mensagem: Mensagem;
            try {
                mensagem = JSON.parse(bruto) as Mensagem;
            } catch {
                return;
            }
            if (mensagem.method && mensagem.id !== undefined) return void atenderPedido(mensagem);
            if (mensagem.method) return observarNotificacao(mensagem.method, mensagem.params ?? {});
            if (typeof mensagem.id === 'number') {
                const pedido = pendentes.get(mensagem.id);
                pendentes.delete(mensagem.id);
                if (mensagem.error) pedido?.rejeitar(new Error(mensagem.error.message || 'O Codex recusou o pedido.'));
                else pedido?.resolver(mensagem.result);
            }
        };

        processo.stdout?.on('data', (parte: Buffer) => {
            pendente += parte.toString('utf8');
            const linhas = pendente.split('\n');
            pendente = linhas.pop() ?? '';
            linhas.forEach(observar);
        });
        processo.stderr?.on('data', (parte: Buffer) => {
            erroStderr = (erroStderr + parte.toString('utf8')).slice(-2000);
        });
        processo.on('error', (falha) => finalizar(falha));
        processo.on('close', (codigo) => {
            if (encerrado) return;
            const detalhe = erroStderr.trim().split('\n').at(-1);
            finalizar(new Error(detalhe || `O Codex terminou com código ${codigo}.`));
        });

        void (async () => {
            await pedir('initialize', {
                clientInfo: { name: 'selene', title: 'Selene', version: '1.0.0' },
                capabilities: { experimentalApi: false, requestAttestation: false },
            });
            enviar({ method: 'initialized' });
            const inicio = (await pedir('thread/start', {
                model: modelo,
                cwd: pasta,
                // Mesmo mapeamento do t3code: aprovação pede tudo que não é confiável; acesso completo roda solto.
                approvalPolicy: acessoCompleto ? 'never' : 'untrusted',
                sandbox: acessoCompleto ? 'danger-full-access' : 'read-only',
                ephemeral: true,
            })) as { thread?: { id?: string } };
            const threadId = inicio.thread?.id;
            if (!threadId) throw new Error('O Codex não abriu a conversa.');
            await pedir('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }] });
        })().catch((erro: unknown) => finalizar(erro instanceof Error ? erro : new Error(String(erro))));
    });
}
