import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
    esquemaModeloAssinatura,
    modelosAssinatura,
    type EstadoAssinatura,
    type ModeloAssinaturaDisponivel,
    type ModelosAssinatura,
    type ProvedorAssinatura,
} from '../../shared/assinaturas';
import { responderCodexAppServer } from './codexAppServer';

/** Limite de texto reunido de uma única resposta, impedindo que um CLI defeituoso consuma a memória. */
const limiteResposta = 2 * 1024 ** 2;
const tempoLimiteVerificacaoMs = 15000;

/** Comandos pelos quais a Selene localiza cada CLI oficial. Nomes fixos, sem caminhos informados pela interface. */
const binarios: Record<ProvedorAssinatura, string> = { chatgpt: 'codex', claude: 'claude' };

/** Valida o modelo antes de qualquer processo ser criado. Identificadores fora do padrão são recusados. */
export function validarModeloAssinatura(modelo: string): string {
    const validado = esquemaModeloAssinatura.safeParse(modelo);
    if (!validado.success) throw new Error('Identificador de modelo inválido.');
    return validado.data;
}

/** Inicia um CLI oficial sem shell. A credencial permanece no CLI e não passa pela Selene. */
function executar(binario: string, argumentos: string[], cwd?: string): ChildProcess {
    return spawn(binario, argumentos, { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Transforma o corpo de mensagens da Selene em um único texto para o CLI, preservando papéis e ordem.
 * Partes que não são texto são ignoradas, pois os CLIs de assinatura não recebem imagens nesta etapa.
 */
export function montarPromptAssinatura(corpo: unknown): string {
    const mensagens = (corpo as { messages?: unknown }).messages;
    if (!Array.isArray(mensagens)) throw new Error('Corpo de solicitação inválido para o CLI.');
    return mensagens
        .map((mensagem: { role?: unknown; content?: unknown }) => {
            const papel = typeof mensagem.role === 'string' ? mensagem.role : 'user';
            const conteudo =
                typeof mensagem.content === 'string'
                    ? mensagem.content
                    : Array.isArray(mensagem.content)
                      ? mensagem.content
                            .filter((parte: { type?: unknown }) => parte.type === 'text')
                            .map((parte: { text?: unknown }) => String(parte.text ?? ''))
                            .join('\n')
                      : '';
            return conteudo ? `[${papel}]\n${conteudo}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

/**
 * Atende uma solicitação do agente pelo CLI oficial e devolve um fluxo SSE. O cancelamento do agente
 * chega ao processo do CLI, e falhas viram erro legível na conversa.
 */
export async function assinaturaCompletar(
    alvo: { provedor: ProvedorAssinatura; id: string },
    corpo: unknown,
    sinal: AbortSignal,
    opcoes: { acessoCompleto?: boolean; pasta?: string | null; acoes?: AcoesExternas } = {},
): Promise<Response> {
    const prompt = montarPromptAssinatura(corpo);
    const pasta = opcoes.pasta || tmpdir();
    const acessoCompleto = !!opcoes.acessoCompleto;
    const fila = new FilaFluxo();
    const fluxo = fila.criar();
    let publicado = '';
    const publicar = (trecho: string) => {
        // Uma resposta final diferente do que já foi transmitido não é reenviada, para não duplicar texto.
        if (!trecho.startsWith(publicado)) return;
        const novo = trecho.slice(publicado.length);
        publicado = trecho;
        if (novo) fila.enqueue(`data: ${JSON.stringify({ choices: [{ delta: { content: novo }, finish_reason: null }] })}\n\n`);
    };
    const resposta =
        alvo.provedor === 'claude'
            ? responderClaudeSdk(alvo.id, prompt, sinal, pasta, acessoCompleto, publicar, opcoes.acoes)
            : responderCodexAppServer(
                  validarModeloAssinatura(alvo.id),
                  prompt,
                  sinal,
                  pasta,
                  acessoCompleto,
                  publicar,
                  opcoes.acoes,
              );
    // O fluxo é devolvido antes da resposta terminar: o texto aparece enquanto o harness trabalha, e as
    // aprovações pedidas no meio da execução chegam à interface sem esperar o fim.
    void resposta.then(
        (texto) => {
            if (texto && !publicado) publicar(texto);
            fila.enqueue(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
            fila.fechar();
        },
        (erro: unknown) => fila.falhar(erro instanceof Error ? erro : new Error(String(erro))),
    );
    return respostaEmFluxo(fluxo);
}

/** Ponte com o agente para mostrar e aprovar as ferramentas do próprio harness na conversa. */
export type AcoesExternas = {
    iniciar: (chamadaId: string, nome: string, argumentos: Record<string, unknown>) => void;
    aprovar: (chamadaId: string, nome: string, argumentos: Record<string, unknown>, sinal: AbortSignal) => Promise<boolean>;
    concluir: (chamadaId: string, resultado: string, erro: boolean) => void;
};

/** Ferramentas internas do Claude Code que não representam trabalho visível para o usuário. */
const ferramentasOcultasClaude = new Set(['ToolSearch']);

const estadosTarefaClaude: Record<string, string> = {
    pending: 'pendente',
    in_progress: 'em andamento',
    completed: 'concluida',
};

/**
 * Traduz uma ferramenta do Claude Code para a ferramenta equivalente da Selene, para a conversa mostrar o
 * mesmo ícone, rótulo e detalhe. Só afeta a apresentação: o harness continua recebendo os argumentos originais.
 * Devolve `null` para ferramentas internas que não devem aparecer.
 */
export function apresentarFerramentaClaude(
    nome: string,
    entrada: Record<string, unknown>,
): { nome: string; argumentos: Record<string, unknown> } | null {
    if (ferramentasOcultasClaude.has(nome)) return null;
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor : undefined);
    switch (nome) {
        case 'WebSearch':
            return { nome: 'pesquisar_web', argumentos: { consulta: texto(entrada.query) } };
        case 'WebFetch':
            return { nome: 'ler_pagina_web', argumentos: { url: texto(entrada.url) } };
        case 'Read':
            return { nome: 'ler_arquivo', argumentos: { caminho: texto(entrada.file_path) } };
        case 'Write':
            return {
                nome: 'escrever_arquivo',
                argumentos: { caminho: texto(entrada.file_path), conteudo: texto(entrada.content) },
            };
        case 'Edit':
        case 'MultiEdit':
        case 'NotebookEdit':
            return {
                nome: 'editar_arquivo',
                argumentos: {
                    caminho: texto(entrada.file_path) ?? texto(entrada.notebook_path),
                    novo: texto(entrada.new_string) ?? texto(entrada.new_source),
                },
            };
        case 'Bash':
        case 'PowerShell':
            return { nome: 'executar_terminal', argumentos: { comando: texto(entrada.command) } };
        case 'Glob':
            return { nome: 'listar_arquivos', argumentos: { caminho: texto(entrada.pattern) } };
        case 'Grep':
            return { nome: 'listar_arquivos', argumentos: { consulta: texto(entrada.pattern) } };
        case 'TodoWrite': {
            const tarefas = Array.isArray(entrada.todos) ? entrada.todos : [];
            return {
                nome: 'atualizar_plano',
                argumentos: {
                    etapas: tarefas.slice(0, 20).map((tarefa: { content?: unknown; status?: unknown }) => ({
                        descricao: String(tarefa.content ?? ''),
                        estado: estadosTarefaClaude[String(tarefa.status)] ?? 'pendente',
                    })),
                },
            };
        }
        default:
            return { nome, argumentos: entrada };
    }
}

let caminhoClaude: Promise<string> | null = null;

/** Localiza o executável do Claude Code instalado, que guarda o login da inscrição. */
function localizarClaude(): Promise<string> {
    caminhoClaude ??= rodar(process.platform === 'win32' ? 'where.exe' : 'which', ['claude'], tempoLimiteVerificacaoMs)
        .then(({ codigo, saida }) => {
            const caminho = codigo === 0 ? primeiraLinha(saida) : undefined;
            if (!caminho) throw new Error('O comando claude não foi encontrado no computador.');
            return caminho;
        })
        .catch((erro: unknown) => {
            caminhoClaude = null;
            throw erro;
        });
    return caminhoClaude;
}

/** Texto legível de um `tool_result`, que pode vir como texto ou como lista de partes. */
function textoResultado(conteudo: unknown): string {
    if (typeof conteudo === 'string') return conteudo;
    if (!Array.isArray(conteudo)) return '';
    return conteudo
        .map((parte: { type?: unknown; text?: unknown }) => (parte.type === 'text' ? String(parte.text ?? '') : ''))
        .filter(Boolean)
        .join('\n');
}

/**
 * Conversa com o Claude pelo Agent SDK, usando o Claude Code instalado e o login da inscrição. As ferramentas
 * são as do próprio harness: com acesso completo elas rodam soltas; sem ele, cada pedido de permissão vira um
 * cartão de aprovação na Selene.
 */
async function responderClaudeSdk(
    modelo: string,
    prompt: string,
    sinal: AbortSignal,
    pasta: string,
    acessoCompleto: boolean,
    publicar: (texto: string) => void,
    acoes?: AcoesExternas,
): Promise<string> {
    const modeloValidado = validarModeloAssinatura(modelo);
    if (sinal.aborted) throw new Error('Tarefa interrompida pelo usuário.');
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const controle = new AbortController();
    const abortar = () => controle.abort();
    sinal.addEventListener('abort', abortar, { once: true });
    let texto = '';
    let tamanho = 0;
    try {
        const conversa = query({
            prompt,
            options: {
                model: modeloValidado,
                cwd: pasta,
                abortController: controle,
                includePartialMessages: true,
                pathToClaudeCodeExecutable: await localizarClaude(),
                systemPrompt: { type: 'preset', preset: 'claude_code' },
                permissionMode: acessoCompleto ? 'bypassPermissions' : 'default',
                ...(acessoCompleto ? { allowDangerouslySkipPermissions: true } : {}),
                canUseTool: async (nome, argumentos, { signal, toolUseID }) => {
                    const apresentada = apresentarFerramentaClaude(nome, argumentos) ?? { nome, argumentos };
                    const aprovada = acoes
                        ? await acoes.aprovar(toolUseID, apresentada.nome, apresentada.argumentos, signal)
                        : false;
                    return aprovada
                        ? { behavior: 'allow', updatedInput: argumentos }
                        : { behavior: 'deny', message: 'O usuário recusou esta ação. Não tente executá-la de outra forma.' };
                },
            },
        });
        for await (const mensagem of conversa) {
            if (mensagem.type === 'stream_event') {
                const evento = mensagem.event;
                if (evento.type === 'message_start' && texto && !texto.endsWith('\n\n')) texto += '\n\n';
                if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
                    tamanho += evento.delta.text.length;
                    if (tamanho > limiteResposta) throw new Error('A resposta do Claude excedeu o limite de tamanho.');
                    texto += evento.delta.text;
                    publicar(texto);
                }
            } else if (mensagem.type === 'assistant') {
                for (const parte of mensagem.message.content) {
                    if (parte.type === 'tool_use') {
                        const apresentada = apresentarFerramentaClaude(
                            parte.name,
                            (parte.input ?? {}) as Record<string, unknown>,
                        );
                        if (apresentada) acoes?.iniciar(parte.id, apresentada.nome, apresentada.argumentos);
                    }
                }
            } else if (mensagem.type === 'user' && Array.isArray(mensagem.message.content)) {
                for (const parte of mensagem.message.content) {
                    if (typeof parte === 'object' && parte.type === 'tool_result') {
                        acoes?.concluir(parte.tool_use_id, textoResultado(parte.content), !!parte.is_error);
                    }
                }
            } else if (mensagem.type === 'result') {
                if (mensagem.subtype !== 'success' || mensagem.is_error) {
                    const detalhe = 'errors' in mensagem ? mensagem.errors?.join('\n') : undefined;
                    throw new Error(detalhe || ('result' in mensagem && mensagem.result) || 'O Claude encerrou a resposta com erro.');
                }
                if (!texto.trim()) texto = mensagem.result;
            }
        }
    } catch (erro) {
        if (sinal.aborted) throw new Error('Tarefa interrompida pelo usuário.');
        throw erro;
    } finally {
        sinal.removeEventListener('abort', abortar);
    }
    if (sinal.aborted) throw new Error('Tarefa interrompida pelo usuário.');
    if (!texto.trim()) throw new Error('O Claude não retornou uma resposta.');
    return texto;
}

class FilaFluxo {
    private controlador?: ReadableStreamDefaultController<Uint8Array>;
    private pendentes: Uint8Array[] = [];
    private codificador = new TextEncoder();
    private fechado = false;

    criar(): ReadableStream<Uint8Array> {
        return new ReadableStream({
            start: (controlador) => {
                this.controlador = controlador;
                this.pendentes.splice(0).forEach((parte) => controlador.enqueue(parte));
                if (this.erro) controlador.error(this.erro);
                else if (this.fechado) controlador.close();
            },
            cancel: () => {
                this.controlador = undefined;
            },
        });
    }

    enqueue(texto: string): void {
        if (this.fechado) return;
        const parte = this.codificador.encode(texto);
        if (this.controlador) this.controlador.enqueue(parte);
        else this.pendentes.push(parte);
    }

    fechar(): void {
        this.fechado = true;
        this.controlador?.close();
    }

    /** Encerra o fluxo com erro, para o agente mostrar a falha na conversa. */
    falhar(erro: Error): void {
        if (this.fechado) return;
        this.fechado = true;
        if (this.controlador) this.controlador.error(erro);
        else this.erro = erro;
    }

    private erro?: Error;
}

/**
 * Entrega o fluxo SSE do harness no formato usado pelo agente. Assim a inscrição segue o mesmo caminho
 * de conversa, persistência e cancelamento dos demais provedores.
 */
function respostaEmFluxo(fluxo: ReadableStream<Uint8Array>): Response {
    return new Response(fluxo, { headers: { 'Content-Type': 'text/event-stream' } });
}

/** Extrai a primeira linha não vazia da saída, limitada para não expor textos longos na interface. */
export function primeiraLinha(saida: string): string | undefined {
    const linha = saida
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.length > 0);
    return linha?.slice(0, 160);
}

/** Cache de modelos que o Codex CLI mantém atualizado com a conta, observado no CLI 0.162. */
const esquemaCacheCodex = z.object({
    models: z.array(
        z.object({
            slug: z.string(),
            display_name: z.string().optional(),
            visibility: z.string().optional(),
            priority: z.number().optional(),
        }),
    ),
});

/** Extrai os modelos visíveis do cache do Codex, na ordem de prioridade do próprio CLI. */
export function interpretarCacheCodex(conteudo: string): ModeloAssinaturaDisponivel[] {
    const validado = esquemaCacheCodex.safeParse(JSON.parse(conteudo));
    if (!validado.success) return [];
    return validado.data.models
        .filter((modelo) => modelo.visibility === 'list' && esquemaModeloAssinatura.safeParse(modelo.slug).success)
        .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
        .map((modelo) => ({ id: modelo.slug, nome: modelo.display_name || modelo.slug }));
}

const familiasClaude = ['fable', 'opus', 'sonnet', 'haiku'];

function compararVersoes(a: number[], b: number[]): number {
    for (let indice = 0; indice < Math.max(a.length, b.length); indice++) {
        const diferenca = (a[indice] ?? 0) - (b[indice] ?? 0);
        if (diferenca) return diferenca;
    }
    return 0;
}

/**
 * Escolhe a versão mais recente de cada família Claude a partir dos ids do catálogo público do OpenRouter
 * (`anthropic/claude-opus-5.5`) e converte para o id aceito pelo Claude Code (`claude-opus-5-5`).
 */
export function interpretarModelosClaude(ids: string[]): ModeloAssinaturaDisponivel[] {
    const recentes = new Map<string, { versao: number[]; id: string; nome: string }>();
    for (const id of ids) {
        const partes = /^anthropic\/claude-([a-z]+)-(\d+(?:\.\d+)*)$/.exec(id);
        if (!partes || !familiasClaude.includes(partes[1])) continue;
        const [, familia, texto] = partes;
        const versao = texto.split('.').map(Number);
        const atual = recentes.get(familia);
        if (atual && compararVersoes(versao, atual.versao) <= 0) continue;
        recentes.set(familia, {
            versao,
            id: `claude-${familia}-${versao.join('-')}`,
            nome: `Claude ${familia[0].toUpperCase()}${familia.slice(1)} ${texto}`,
        });
    }
    return familiasClaude.flatMap((familia) => {
        const modelo = recentes.get(familia);
        return modelo ? [{ id: modelo.id, nome: modelo.nome }] : [];
    });
}

/**
 * Lista os modelos de cada inscrição. O Codex publica o catálogo da conta no próprio cache; o Claude vem
 * do catálogo público do OpenRouter. Assim novos lançamentos aparecem sem atualizar a Selene. Se a consulta
 * falhar, o Claude cai para os apelidos que o CLI resolve sozinho para a versão atual.
 */
export async function listarModelosAssinatura(
    idsCatalogo: () => Promise<string[]> = async () => [],
    pastaUsuario = homedir(),
): Promise<ModelosAssinatura> {
    let chatgpt: ModeloAssinaturaDisponivel[] = [];
    try {
        chatgpt = interpretarCacheCodex(await readFile(join(pastaUsuario, '.codex', 'models_cache.json'), 'utf8'));
    } catch {
        // Sem cache, o Codex ainda não foi usado neste computador; a lista fica vazia até o primeiro login.
    }
    let claude: ModeloAssinaturaDisponivel[] = [];
    try {
        claude = interpretarModelosClaude(await idsCatalogo());
    } catch {
        // Sem rede, os apelidos continuam funcionando.
    }
    return {
        chatgpt: chatgpt.length ? chatgpt : modelosAssinatura.chatgpt,
        claude: claude.length ? claude : modelosAssinatura.claude,
    };
}

/** Verifica se o CLI existe e se há uma sessão ativa, sem iniciar uma conversa. */
export async function verificarAssinatura(provedor: ProvedorAssinatura): Promise<EstadoAssinatura> {
    const binario = binarios[provedor];
    const comando = provedor === 'chatgpt' ? ['login', 'status'] : ['auth', 'status'];
    try {
        const { codigo, saida } = await rodar(binario, comando, tempoLimiteVerificacaoMs);
        if (codigo === 0) {
            return { estado: 'pronto', mensagem: 'Conta conectada.', conta: primeiraLinha(saida) };
        }
        return { estado: 'nao-autenticado', mensagem: 'Conecte a inscrição pelo CLI oficial.' };
    } catch (erro) {
        const ausente = (erro as NodeJS.ErrnoException).code === 'ENOENT';
        return ausente
            ? { estado: 'nao-instalado', mensagem: `O comando ${binario} não foi encontrado no computador.` }
            : { estado: 'nao-autenticado', mensagem: 'Não foi possível verificar a sessão do CLI.' };
    }
}

/** Coleta a saída de um comando curto, com tempo limite e limite de tamanho. */
function rodar(
    binario: string,
    argumentos: string[],
    tempo: number,
): Promise<{ codigo: number | null; saida: string }> {
    return new Promise((resolver, rejeitar) => {
        const processo = executar(binario, argumentos);
        let saida = '';
        const encerrar = setTimeout(() => processo.kill(), tempo);
        processo.stdout?.on('data', (parte: Buffer) => (saida += parte.toString('utf8')));
        processo.stderr?.on('data', (parte: Buffer) => (saida += parte.toString('utf8')));
        processo.on('error', (erro) => {
            clearTimeout(encerrar);
            rejeitar(erro);
        });
        processo.on('close', (codigo) => {
            clearTimeout(encerrar);
            resolver({ codigo, saida: saida.slice(0, limiteResposta) });
        });
    });
}

export { executar, limiteResposta };
