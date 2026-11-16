import { app, BrowserWindow, dialog, ipcMain, nativeImage, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { open, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { esquemaIconeProjeto } from '../shared/iconesProjetos';
import { esquemaProjetoChat, esquemaEdicaoProjetoChat } from '../shared/projetosChat';
import { ProjetosChat, contextoProjetoChat } from './services/projetosChat';
import {
    esquemaNovoProjeto,
    esquemaProjeto,
    esquemaRascunho,
    esquemaConversa,
    esquemaAlteracao,
    esquemaBackend,
    esquemaConfiguracao,
    esquemaPerfilModelo,
    esquemaEntradaImagem,
    type Conversa,
    type Estado,
    type Modelo,
    type Evento,
    type Resultado,
} from '../shared/contratos';
import { Persistencia } from './services/persistencia';
import { MotorLocal } from './services/motor';
import type { Agente } from './services/agente';
import { criarAgente, type ContextoAgentes } from './services/fabricaAgentes';
import { ServidorMcp } from './services/servidorMcp';
import { Subagentes } from './services/subagentes';
import { ChatGptWeb } from './services/chatgptWeb';
import { ConversaChatGpt } from './services/conversaChatGpt';
import { Checkpoints } from './services/checkpoints';
import { provedoresAssinatura, type ProvedorAssinatura } from '../shared/assinaturas';
import { excluirAlteracoesConversa, lerPatchTurno } from './services/alteracoesTurno';
import { EnviosCode } from './services/enviosCode';
import { OpenRouter } from './services/openrouter';
import { Memorias } from './services/memorias';
import { modeloExtracaoMemoria } from '../shared/memoria';
import { esforcosDoProvedor, esquemaOrdenacaoOpenRouter, nomeModeloOpenRouter } from '../shared/openrouter';
import { Navegador } from './services/navegador';
import { Computador } from './services/computador';
import { obterPedidoParaRegerarChat, prepararReenvioChat } from './services/reenvioChat';
import { catalogoModelos, encontrarModeloLocal, type ModeloCatalogo } from '../shared/catalogo';
import { DownloadsModelos } from './services/downloadModelos';
import { AnexosImagens } from './services/anexosImagens';
import { limiteTrechoFala, modeloAceitaAudio } from '../shared/audio';
import { permitirMicrofone } from '../shared/permissaoMicrofone';
import { prepararPastaTrabalho, cadastrarProjeto, criarProjetoGerenciado, isolarConversa } from './services/projetos';
import { Atualizacoes } from './services/atualizacoes';
import electronUpdater from 'electron-updater';
import { shell } from 'electron';
import { urlRelease } from '../shared/atualizacoes';
import { configuracaoParaModelo } from '../shared/configuracaoMotor';
import { consultarHardware } from './services/hardwareLocal';
import { Operacoes } from './services/operacoes';
import { AcessoWeb } from './services/acessoWeb';
import { esquemaConfiguracaoWeb } from '../shared/acessoWeb';
import { exportarMarkdown } from '../shared/exportacao';
import {
    listarModelosAssinatura,
    localizarExecutavel,
    verificarAssinatura,
} from './services/assinaturas';
import { esquemaNovoModeloAssinatura } from '../shared/assinaturas';
import { consultarLimites } from './services/limitesAssinatura';
import { Terminais } from './services/terminais';
import {
    criarBranch,
    executarAcaoGit,
    lerStatus,
    lerPullRequest,
    listarGitHubDoProjeto,
    repositoriosDoProjeto,
    resolverRepositorioGitHub,
    trocarBranch,
} from './services/repositorio';
import { esquemaUrlPullRequest, vincularPullRequest, desvincularPullRequest } from '../shared/pullRequests';
import { esquemaItemGitHubNoChat, instrucaoItemGitHub } from '../shared/abrirItemGitHub';
import { esquemaMetodoMesclagem, esquemaShaPullRequest } from '../shared/detalhesPullRequest';
import { lerDetalhesPullRequest, lerArquivosPullRequest, mesclarPullRequest } from './services/detalhesPullRequest';
import {
    esquemaAcaoGit,
    esquemaDimensoesTerminal,
    esquemaEditor,
    esquemaConsultaGitHub,
    esquemaScriptProjeto,
    type Editor,
} from '../shared/repositorio';

app.setName('Selene');
app.setPath('userData', join(app.getPath('appData'), 'Selene'));
const pastaTeste = process.env.SELENE_TESTE_DADOS;
/** Janela usada pela Selene para compactar o histórico enviado às inscrições, que não informam o limite real. */
const contextoAssinatura = 200_000;
if (pastaTeste && process.env.SELENE_TESTE === '1') app.setPath('userData', pastaTeste);
const instanciaPrincipal = app.requestSingleInstanceLock();
if (!instanciaPrincipal) app.quit();
app.on('second-instance', () => {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.show();
    janela.focus();
});
let janela: BrowserWindow | null = null;
let persistencia: Persistencia;
let motor: MotorLocal;
let agente: Agente;
let enviosCode: EnviosCode;
let openrouter: OpenRouter;
let memorias: Memorias;
let navegador: Navegador;
let computador: Computador;
let downloads: DownloadsModelos;
let anexos: AnexosImagens;
let atualizacoes: Atualizacoes;
let acessoWeb: AcessoWeb;
let servidorMcp: ServidorMcp;
let subagentes: Subagentes;
let chatgptWeb: ChatGptWeb;
let conversaChatGpt: ConversaChatGpt;
let contextoAgentes: ContextoAgentes;
const agentesFilhos = new Set<Agente>();
let entregarAoPai: (paiId: string, texto: string) => Promise<void> = async () => undefined;
const operacoes = new Operacoes();
const terminais = new Terminais((evento) => {
    if (janela && !janela.isDestroyed()) janela.webContents.send('selene:evento', evento);
});
let tarefa: Promise<void> | null = null;
let encerramentoAutorizado = false;
let restauracaoAtiva = false;
let rtkDisponivel = false;
const uuid = z.string().uuid();
const urlDesenvolvimento = !app.isPackaged ? process.env.SELENE_VITE_URL : undefined;
if (urlDesenvolvimento && urlDesenvolvimento !== 'http://127.0.0.1:5173') {
    throw new Error('Origem de desenvolvimento inválida.');
}
const urlInterface = urlDesenvolvimento ?? pathToFileURL(join(__dirname, '../dist/index.html')).href;

function estado(): Estado {
    return structuredClone({
        ...persistencia.dados,
        motor: motor.estado,
        openrouterConfigurado: openrouter?.configurado ?? false,
        conversaEmExecucao: agente?.conversaId ?? conversaChatGpt?.conversaId ?? null,
        rtkDisponivel,
        subagentesEmExecucao: subagentes?.emExecucao() ?? [],
        downloads: downloads?.estadosAtuais ?? [],
        atualizacao: atualizacoes?.estado,
    });
}

function publicar(evento: Evento): void {
    if (janela && !janela.isDestroyed()) janela.webContents.send('selene:evento', evento);
    acessoWeb?.publicar(evento);
}

function publicarEstado(): void {
    if (persistencia && motor) publicar({ tipo: 'estado', estado: estado() });
}

function validarRemetente(evento: IpcMainInvokeEvent): void {
    if (
        !janela ||
        evento.sender !== janela.webContents ||
        evento.senderFrame !== janela.webContents.mainFrame ||
        (evento.senderFrame.url !== urlInterface && evento.senderFrame.url !== `${urlInterface}/`)
    ) {
        throw new Error('Origem IPC não autorizada.');
    }
}

function registrar<T extends z.ZodType>(
    nome: string,
    esquema: T,
    executar: (argumentos: z.infer<T>) => Promise<unknown> | unknown,
): void {
    operacoes.registrar(nome, esquema, executar);
    ipcMain.handle(`selene:${nome}`, async (evento, ...entrada): Promise<Resultado<unknown>> => {
        try {
            validarRemetente(evento);
            return await operacoes.executar(nome, entrada);
        } catch (erro) {
            return { ok: false, erro: erro instanceof Error ? erro.message : 'Operação não concluída.' };
        }
    });
}

/** Expõe a operação somente à janela do desktop, fora do acesso web, para ações que executam processos. */
function registrarDesktop<T extends z.ZodType>(
    nome: string,
    esquema: T,
    executar: (argumentos: z.infer<T>) => Promise<unknown> | unknown,
): void {
    ipcMain.handle(`selene:${nome}`, async (evento, ...entrada): Promise<Resultado<unknown>> => {
        try {
            validarRemetente(evento);
            return { ok: true, valor: await executar(esquema.parse(entrada)) };
        } catch (erro) {
            return { ok: false, erro: erro instanceof Error ? erro.message : 'Operação não concluída.' };
        }
    });
}

function projetoPorId(id: string) {
    const projeto = persistencia.dados.projetos.find((item) => item.id === id);
    if (!projeto) throw new Error('Projeto não encontrado.');
    return projeto;
}

function editorPorProtocolo(editor: Editor): string | null {
    if (editor === 'vscode') return 'vscode';
    if (editor === 'cursor') return 'cursor';
    return null;
}

function registrarRepositorio(): void {
    const contextoGit = (id: string, conversaId?: string) => {
        const projeto = projetoPorId(id);
        const conversa = conversaId ? conversaPorId(conversaId) : undefined;
        if (conversa && (conversa.modo !== 'code'
            || (conversa.projetoId !== id && conversa.projeto !== projeto.caminho))) {
            throw new Error('A conversa não pertence a este projeto Code.');
        }
        return { conversa, pasta: conversa?.pastaRepositorio ?? projeto.caminho };
    };
    registrarDesktop('lerPatchTurno', z.tuple([uuid, uuid, z.string().min(1).max(4000)]), ([id, mensagemId, caminho]) => {
        const mensagem = conversaPorId(id).mensagens.find((item) => item.id === mensagemId);
        if (!mensagem?.alteracoes?.arquivos.some((arquivo) => arquivo.caminho === caminho)) {
            throw new Error('Este arquivo não pertence às alterações do turno.');
        }
        return lerPatchTurno(pastaAlteracoes(), id, mensagemId, caminho);
    });
    const validarRestauracao = (id: string, mensagemId: string) => {
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code' || !conversa.mensagens.some((item) => item.id === mensagemId && item.checkpoint)) {
            throw new Error('Checkpoint não pertence a esta conversa Code.');
        }
        if (agente.conversaId || [...agentesFilhos].some((item) => item.conversaId)) {
            throw new Error('Encerre as tarefas antes de restaurar arquivos.');
        }
        return new Checkpoints(join(pastaAlteracoes(), 'checkpoints'));
    };
    registrarDesktop('prepararRestauracao', z.tuple([uuid, uuid]), ([id, mensagemId]) =>
        validarRestauracao(id, mensagemId).preparar(id, mensagemId));
    registrarDesktop('restaurarTurno', z.tuple([uuid, uuid, z.string().regex(/^[a-f0-9]{64}$/)]),
        async ([id, mensagemId, token]) => {
            if (restauracaoAtiva) throw new Error('Aguarde a restauração atual.');
            const checkpoints = validarRestauracao(id, mensagemId);
            restauracaoAtiva = true;
            try {
            await checkpoints.restaurar(id, mensagemId, token);
            const conversa = conversaPorId(id);
            delete conversa.sessaoAssinatura;
            const mensagem = conversa.mensagens.find((item) => item.id === mensagemId)!;
            mensagem.checkpoint = false;
            mensagem.checkpointRestaurado = true;
            await salvar();
            } finally {
                restauracaoAtiva = false;
            }
        });
    registrarDesktop('isolarConversa', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        await isolarConversa(conversaPorId(id), app.getPath('userData'));
        await salvar();
    });
    registrarDesktop('desvincularPullRequest', z.tuple([uuid, esquemaUrlPullRequest]), async ([id, url]) => {
        desvincularPullRequest(conversaPorId(id), url);
        await salvar();
    });
    registrarDesktop('abrirItemGitHubNoChat', z.tuple([esquemaItemGitHubNoChat]), async ([entrada]) => {
        const partes = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(issues|pull)\/([1-9]\d*)$/i.exec(entrada.url)!;
        const [, repositorio, caminho, numero] = partes;
        const projetos = entrada.projetoId ? [projetoPorId(entrada.projetoId)]
            : persistencia.dados.projetos.filter((projeto) => !projeto.oculto);
        for (const projeto of projetos) {
            const descoberta = await repositoriosDoProjeto(projeto.caminho).catch(() => ({ repositorios: [], avisos: [] }));
            let alvo = descoberta.repositorios.find((item) => item.github.toLowerCase() === repositorio.toLowerCase());
            if (!alvo) {
                for (const candidato of descoberta.repositorios) {
                    const canonico = await resolverRepositorioGitHub(candidato.pasta, candidato.github).catch(() => null);
                    if (canonico?.toLowerCase() === repositorio.toLowerCase()) { alvo = candidato; break; }
                }
            }
            if (!alvo) continue;
            const tipo = caminho.toLowerCase() === 'pull' ? 'pr' : 'issue';
            const pr = tipo === 'pr' ? await lerPullRequest(alvo.pasta, entrada.url) : null;
            const titulo = pr?.titulo ?? entrada.titulo ?? `Issue #${numero}`;
            const conversa = esquemaConversa.parse({
                id: randomUUID(), modo: 'code', projetoId: projeto.id, projeto: projeto.caminho,
                pastaRepositorio: alvo.pasta,
                titulo: `${tipo === 'pr' ? 'Revisar PR' : 'Investigar issue'} #${numero}`,
                rascunho: instrucaoItemGitHub({ titulo, url: entrada.url }, tipo, alvo.pasta),
                atualizadoEm: new Date().toISOString(),
            });
            if (pr) {
                vincularPullRequest(conversa, pr.url);
                conversa.pullRequests = [pr];
            }
            persistencia.dados.conversas.unshift(conversa);
            await salvar();
            return conversa;
        }
        throw new Error('Não foi encontrado um projeto local para este repositório. Adicione a pasta do projeto.');
    });
    const pastaDoPr = (id: string, url: string) => {
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code' || !conversa.pullRequests?.some((pr) =>
            pr.url.toLowerCase() === url.toLowerCase())) {
            throw new Error('O PR não está vinculado a esta conversa Code.');
        }
        return conversa.pastaRepositorio ?? conversa.projeto ?? conversa.pastaTrabalho ?? app.getPath('userData');
    };
    registrarDesktop('detalhesPullRequest', z.tuple([uuid, esquemaUrlPullRequest]), ([id, url]) =>
        lerDetalhesPullRequest(pastaDoPr(id, url), url));
    registrarDesktop('arquivosPullRequest', z.tuple([uuid, esquemaUrlPullRequest]), ([id, url]) =>
        lerArquivosPullRequest(pastaDoPr(id, url), url));
    registrarDesktop('mesclarPullRequest',
        z.tuple([uuid, esquemaUrlPullRequest, esquemaShaPullRequest, esquemaMetodoMesclagem]),
        async ([id, url, sha, metodo]) => {
            const detalhes = await mesclarPullRequest(pastaDoPr(id, url), url, sha, metodo);
            const conversa = conversaPorId(id);
            conversa.pullRequests = conversa.pullRequests?.map((pr) =>
                pr.url.toLowerCase() === url.toLowerCase() ? detalhes.pr : pr);
            await salvar();
            return detalhes;
        });
    const branch = z.string().trim().min(1).max(250);
    registrarDesktop('statusRepositorio', z.tuple([uuid, uuid.optional()]), ([id, conversaId]) =>
        lerStatus(contextoGit(id, conversaId).pasta));
    registrarDesktop('trocarBranch', z.tuple([uuid, branch, z.boolean(), uuid.optional()]), ([id, nome, criar, conversaId]) =>
        criar ? criarBranch(contextoGit(id, conversaId).pasta, nome) : trocarBranch(contextoGit(id, conversaId).pasta, nome),
    );
    registrarDesktop(
        'acaoGit',
        z.tuple([uuid, esquemaAcaoGit, z.string().max(5000), uuid.optional()]),
        async ([id, acao, mensagem, conversaId]) => {
            const { conversa, pasta } = contextoGit(id, conversaId);
            const url = await executarAcaoGit(pasta, acao, mensagem);
            if (url && conversa) {
                vincularPullRequest(conversa, url);
                await salvar();
            }
            return url;
        },
    );
    registrarDesktop('editoresDisponiveis', z.tuple([]), () =>
        esquemaEditor.options.filter((editor) => {
            const protocolo = editorPorProtocolo(editor);
            return !protocolo || !!app.getApplicationNameForProtocol(`${protocolo}://`);
        }),
    );
    registrarDesktop('abrirNoEditor', z.tuple([uuid, esquemaEditor]), async ([id, editor]) => {
        const pasta = projetoPorId(id).caminho;
        const protocolo = editorPorProtocolo(editor);
        if (!protocolo) {
            const erro = await shell.openPath(pasta);
            if (erro) throw new Error(erro);
            return;
        }
        await shell.openExternal(`${protocolo}://file/${pasta.replaceAll('\\', '/')}`);
    });
    registrarDesktop(
        'salvarScriptsProjeto',
        z.tuple([uuid, z.array(esquemaScriptProjeto).max(20)]),
        async ([id, scripts]) => {
            projetoPorId(id).scripts = scripts;
            await salvar();
        },
    );
    registrarDesktop('listarGitHub', z.tuple([uuid, esquemaConsultaGitHub]), async ([id, consulta]) => {
        const pasta = projetoPorId(id).caminho;
        return listarGitHubDoProjeto(pasta, consulta);
    });
    registrarDesktop('abrirGitHub', z.tuple([z.string().url().max(2000)]), async ([url]) => {
        if (new URL(url).origin !== 'https://github.com') throw new Error('Endereço do GitHub inválido.');
        await shell.openExternal(url);
    });
    registrarDesktop('vincularPullRequest', z.tuple([uuid, esquemaUrlPullRequest]), async ([id, url]) => {
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code') throw new Error('Pull requests pertencem às conversas Code.');
        const pr = await lerPullRequest(conversa.projeto ?? app.getPath('userData'), url);
        conversa.pullRequests = conversa.pullRequests?.map((item) =>
            item.url.toLowerCase() === url.toLowerCase() ? pr : item);
        vincularPullRequest(conversa, pr.url);
        conversa.pullRequests = conversa.pullRequests!.map((item) =>
            item.url.toLowerCase() === pr.url.toLowerCase() ? pr : item);
        await salvar();
    });
    registrarDesktop('atualizarPullRequests', z.tuple([uuid]), async ([id]) => {
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code') throw new Error('Pull requests pertencem às conversas Code.');
        const resultados = await Promise.allSettled((conversa.pullRequests ?? []).map(async (pr) => ({
            anterior: pr.url, atual: await lerPullRequest(conversa.projeto ?? app.getPath('userData'), pr.url),
        })));
        const atualizados = resultados.flatMap((resultado) =>
            resultado.status === 'fulfilled' ? [resultado.value] : []);
        if (atualizados.length) {
            conversa.pullRequests = conversa.pullRequests?.map((pr) =>
                atualizados.find((item) => item.anterior.toLowerCase() === pr.url.toLowerCase())?.atual ?? pr);
            conversa.pullRequests = conversa.pullRequests?.filter((pr, indice, todos) =>
                todos.findIndex((item) => item.url.toLowerCase() === pr.url.toLowerCase()) === indice);
            await salvar();
        }
        return conversa.pullRequests ?? [];
    });
    registrarDesktop(
        'abrirTerminal',
        z.tuple([uuid, esquemaDimensoesTerminal, z.string().max(2000).optional()]),
        ([id, dimensoes, comando]) => terminais.abrir(id, projetoPorId(id).caminho, dimensoes, comando),
    );
    registrarDesktop('historicoTerminal', z.tuple([uuid]), ([id]) => terminais.historico(id));
    registrarDesktop('escreverTerminal', z.tuple([uuid, z.string().max(100000)]), ([id, dados]) =>
        terminais.escrever(id, dados),
    );
    registrarDesktop('redimensionarTerminal', z.tuple([uuid, esquemaDimensoesTerminal]), ([id, dimensoes]) =>
        terminais.redimensionar(id, dimensoes),
    );
    registrarDesktop('fecharTerminal', z.tuple([uuid]), ([id]) => terminais.fechar(id));
}

function conversaPorId(id: string) {
    const conversa = persistencia.dados.conversas.find((item) => item.id === id);
    if (!conversa) throw new Error('Conversa não encontrada.');
    return conversa;
}

function exigirLivre(id?: string): void {
    if (restauracaoAtiva) throw new Error('Aguarde a restauração dos arquivos.');
    const filhas = subagentes?.emExecucao() ?? [];
    const ocupada = id ? agente.conversaId === id || conversaChatGpt?.conversaId === id || filhas.includes(id)
        : !!agente.conversaId || !!conversaChatGpt?.conversaId;
    if (ocupada) throw new Error('Interrompa a tarefa antes de alterar esta configuração.');
}

async function salvar(): Promise<void> {
    await persistencia.salvar();
    publicarEstado();
}

async function excluirConversas(ids: string[]): Promise<void> {
    for (const id of ids) exigirLivre(id);
    for (const id of ids) navegador?.fecharConversa(id);
    for (const id of ids) computador?.fecharConversa(id);
    const idsImagens = [
        ...new Set(
            ids.flatMap((id) =>
                conversaPorId(id).mensagens.flatMap((mensagem) => mensagem.imagens?.map((imagem) => imagem.id) ?? []),
            ),
        ),
    ];
    const anteriores = persistencia.dados.conversas;
    const removidas = new Set(ids);
    persistencia.dados.conversas = anteriores.filter((conversa) => !removidas.has(conversa.id));
    try {
        await salvar();
    } catch (erro) {
        persistencia.dados.conversas = anteriores;
        throw erro;
    }
    await anexos.excluirSemReferencia(idsImagens);
    await Promise.allSettled(ids.map((id) => excluirAlteracoesConversa(pastaAlteracoes(), id)));
}

async function idsCatalogoOpenRouter(): Promise<string[]> {
    return (await openrouter.modelos()).map((modelo) => modelo.id);
}

/**
 * Devolve o modelo cadastrado da inscrição, cadastrando-o se preciso. Sem `id`, usa o primeiro modelo que o
 * provedor anuncia; um `id` fora da lista do provedor é recusado.
 */
async function cadastrarModeloAssinatura(provedor: ProvedorAssinatura, id?: string, nome?: string): Promise<Modelo> {
    const anunciados = (await listarModelosAssinatura(idsCatalogoOpenRouter))[provedor];
    const anunciado = id ? anunciados.find((modelo) => modelo.id === id) : anunciados[0];
    if (!anunciado) throw new Error('Modelo de assinatura desconhecido.');
    const existente = persistencia.dados.modelos.find(
        (modelo) => modelo.assinatura?.provedor === provedor && modelo.assinatura.id === anunciado.id,
    );
    if (existente) return existente;
    const modelo: Modelo = {
        id: randomUUID(),
        nome: nome ?? anunciado.nome,
        caminho: `${provedor}:${anunciado.id}`,
        tamanho: 0,
        assinatura: { provedor, id: anunciado.id },
    };
    persistencia.dados.modelos.push(modelo);
    try {
        await salvar();
    } catch (erro) {
        persistencia.dados.modelos = persistencia.dados.modelos.filter((item) => item.id !== modelo.id);
        throw erro;
    }
    return modelo;
}

/** Executa uma conversa filha com um agente próprio, em paralelo ao agente principal. */
async function executarConversaFilha(conversa: Conversa, texto: string, sinal: AbortSignal): Promise<void> {
    if (restauracaoAtiva) throw new Error('Aguarde a restauração dos arquivos.');
    if (sinal.aborted) return;
    const modelo = persistencia.dados.modelos.find((item) => item.id === conversa.modeloId);
    if (!modelo?.assinatura) throw new Error('Subagentes exigem um modelo de inscrição.');
    const filho = criarAgente(contextoAgentes, false);
    agentesFilhos.add(filho);
    const abortar = () => filho.cancelar();
    sinal.addEventListener('abort', abortar, { once: true });
    try {
        const configuracao = configuracaoParaModelo(persistencia.dados.configuracao, modelo);
        const execucao = filho.executar(conversa, texto, configuracao, [], modelo, undefined, {
            ligandoModelo: false,
            executar: async () => ({ ...configuracao, contexto: contextoAssinatura }),
        });
        if (sinal.aborted) filho.cancelar();
        await execucao;
    } finally {
        sinal.removeEventListener('abort', abortar);
        agentesFilhos.delete(filho);
    }
}

/** Provedores de inscrição prontos para receber subagentes, com os modelos que anunciam. */
async function capacidadesSubagentes() {
    const modelos = await listarModelosAssinatura(idsCatalogoOpenRouter);
    return Promise.all(
        provedoresAssinatura.map(async (provedor) => {
            const estado = await verificarAssinatura(provedor);
            return {
                provedor,
                disponivel: estado.estado === 'pronto',
                ...(estado.estado === 'pronto' ? {} : { motivo: estado.mensagem }),
                modelos: modelos[provedor],
            };
        }),
    );
}

function pastaAlteracoes(): string {
    return join(app.getPath('userData'), 'alteracoes');
}

function itemCatalogo(id: string): ModeloCatalogo {
    const item = catalogoModelos.find((modelo) => modelo.id === id);
    if (!item) throw new Error('Modelo não encontrado no catálogo.');
    return item;
}

async function registrarDownload(item: ModeloCatalogo, caminho: string): Promise<void> {
    const existente = persistencia.dados.modelos.find((modelo) => modelo.catalogoId === item.id);
    if (existente) return;
    const modelo = {
        id: randomUUID(),
        nome: item.nome,
        caminho,
        tamanho: item.tamanho,
        catalogoId: item.id,
    };
    persistencia.dados.modelos.push(modelo);
    try {
        await salvar();
    } catch (erro) {
        persistencia.dados.modelos = persistencia.dados.modelos.filter((item) => item.id !== modelo.id);
        throw erro;
    }
}

async function carregarModelo(id: string): Promise<void> {
    const modelo = persistencia.dados.modelos.find((item) => item.id === id);
    if (!modelo) throw new Error('Modelo não encontrado.');
    if (modelo.openrouter || modelo.assinatura || modelo.chatgptWeb) {
        throw new Error('Modelo remoto não pode ser carregado no motor local.');
    }
    const configuracao = configuracaoParaModelo(persistencia.dados.configuracao, modelo);
    await motor.carregar(modelo, configuracao);
}

function registrarOperacoes(): void {
    registrarDesktop('cadastrarChatGptWeb', z.tuple([]), async () => {
        exigirLivre();
        const existente = persistencia.dados.modelos.find((modelo) => modelo.chatgptWeb);
        if (existente) return existente;
        const modelo: Modelo = {
            id: randomUUID(), nome: 'ChatGPT', caminho: 'chatgpt:web', tamanho: 0, chatgptWeb: true,
        };
        persistencia.dados.modelos.push(modelo);
        await salvar();
        return modelo;
    });
    registrarDesktop('abrirChatGptWeb', z.tuple([uuid.optional()]), ([id]) => {
        const conversa = id ? conversaPorId(id) : undefined;
        if (conversa && conversa.modo !== 'chat') throw new Error('ChatGPT pelo site pertence ao Chat.');
        return chatgptWeb.abrir(conversa?.chatgptWeb?.url);
    });
    registrarDesktop('confirmarRevisaoChatGpt', z.tuple([uuid]), async ([id]) => {
        exigirLivre(id);
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'chat' || !conversa.chatgptWeb?.envioIncerto) {
            throw new Error('Não há envio incerto para revisar nesta conversa.');
        }
        conversa.chatgptWeb.envioIncerto = false;
        await salvar();
    });
    registrar('acessoWeb', z.tuple([]), () => acessoWeb.estado);
    registrar('configurarAcessoWeb', z.tuple([esquemaConfiguracaoWeb]), ([configuracao]) =>
        acessoWeb.configurar(configuracao),
    );
    registrar('renovarChaveWeb', z.tuple([]), () => acessoWeb.renovarChave());
    registrar('previasNavegador', z.tuple([]), () => navegador.listarPrevias());
    registrar('previasComputador', z.tuple([]), () => computador.listarPrevias());
    registrar('pararComputador', z.tuple([z.string().uuid()]), ([id]) => {
        conversaPorId(id);
        computador.fecharConversa(id);
        if (agente.conversaId === id) agente.cancelar();
    });
    registrar('atualizarNavegador', z.tuple([uuid]), async ([id]) => {
        if (conversaPorId(id).modo !== 'code') throw new Error('O navegador pertence ao modo Code.');
        return navegador.atualizarConversa(id);
    });
    const projetosChat = new ProjetosChat(persistencia.dados, salvar, () => agente.conversaId);
    registrar('criarProjetoChat', z.tuple([esquemaProjetoChat.shape.nome]), ([nome]) => projetosChat.criar(nome));
    registrar('editarProjetoChat', z.tuple([uuid, esquemaEdicaoProjetoChat]), ([id, edicao]) =>
        projetosChat.editar(id, edicao),
    );
    registrar('removerProjetoChat', z.tuple([uuid]), ([id]) => projetosChat.remover(id));
    registrar('removerArquivoProjetoChat', z.tuple([uuid, uuid]), ([id, arquivoId]) =>
        projetosChat.removerArquivo(id, arquivoId),
    );
    registrar('moverConversaProjetoChat', z.tuple([uuid, uuid.nullable()]), ([id, projetoId]) =>
        projetosChat.mover(conversaPorId(id), projetoId),
    );
    registrar('importarArquivosProjetoChat', z.tuple([uuid]), async ([id]) => {
        projetosChat.obter(id);
        const escolha = await dialog.showOpenDialog(janela!, {
            title: 'Adicionar referências ao projeto de Chat',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Texto', extensions: ['txt', 'md', 'csv', 'json'] }],
        });
        if (!escolha.canceled) await projetosChat.importar(id, escolha.filePaths);
    });
    const vazio = z.tuple([]);
    registrar('estado', vazio, estado);
    registrar(
        'configurarOpenRouter',
        z.tuple([
            z
                .string()
                .trim()
                .max(500)
                .refine((chave) => !/[\r\n]/.test(chave), 'Chave inválida.'),
        ]),
        async ([chave]) => {
            exigirLivre();
            await openrouter.configurar(chave);
            publicarEstado();
        },
    );
    registrar('verificarAssinaturas', vazio, async () => {
        const [chatgpt, claude] = await Promise.all([
            verificarAssinatura('chatgpt'),
            verificarAssinatura('claude'),
        ]);
        return { chatgpt, claude };
    });
    registrar('modelosAssinatura', vazio, () => listarModelosAssinatura(idsCatalogoOpenRouter));
    registrar('limitesAssinaturas', vazio, async () => {
        const [chatgpt, claude] = await Promise.all([consultarLimites('chatgpt'), consultarLimites('claude')]);
        return { chatgpt, claude };
    });
    registrar('adicionarModeloAssinatura', z.tuple([esquemaNovoModeloAssinatura]), async ([entrada]) => {
        exigirLivre();
        return cadastrarModeloAssinatura(entrada.assinatura.provedor, entrada.assinatura.id, entrada.nome);
    });
    registrar('catalogoOpenRouter', z.tuple([z.boolean(), esquemaOrdenacaoOpenRouter]), ([atualizar, ordenacao]) =>
        openrouter.modelos(atualizar, ordenacao),
    );
    registrar('saldoOpenRouter', z.tuple([]), () => openrouter.saldo());
    registrar('cadastrarModeloOpenRouter', z.tuple([z.string().min(1).max(200)]), async ([id]) => {
        const item = (await openrouter.modelos()).find((modelo) => modelo.id === id);
        if (!item) throw new Error('Modelo ausente no catálogo OpenRouter.');
        let modelo = persistencia.dados.modelos.find((modelo) => modelo.openrouter?.id === id);
        const remoto = {
            id: item.id,
            contexto: item.context_length,
            maxTokens: item.top_provider?.max_completion_tokens ?? undefined,
            imagens: item.architecture.input_modalities.includes('image'),
            audio: item.architecture.input_modalities.includes('audio'),
            ferramentas: item.supported_parameters.includes('tools'),
            raciocinio: item.supported_parameters.includes('reasoning'),
            esforcos: esforcosDoProvedor(item.reasoning?.supported_efforts),
        };
        const nome = nomeModeloOpenRouter(item.name);
        if (modelo) {
            modelo.nome = nome;
            modelo.openrouter = remoto;
        } else {
            modelo = { id: randomUUID(), nome, caminho: item.id, tamanho: 0, openrouter: remoto };
            persistencia.dados.modelos.push(modelo);
        }
        await salvar();
        return modelo;
    });
    registrar('consultarHardware', vazio, () =>
        consultarHardware(join(app.getPath('userData'), 'runtime'), persistencia.dados.configuracao.backend),
    );
    registrar('configurarModelo', z.tuple([uuid, esquemaPerfilModelo.nullable()]), async ([id, perfil]) => {
        exigirLivre();
        if (['carregando', 'instalando'].includes(motor.estado.fase)) throw new Error('Aguarde a operação do motor.');
        const modelo = persistencia.dados.modelos.find((item) => item.id === id);
        if (!modelo) throw new Error('Modelo não encontrado.');
        const anterior = modelo.perfil;
        if (perfil) modelo.perfil = perfil;
        else delete modelo.perfil;
        try {
            await salvar();
        } catch (erro) {
            modelo.perfil = anterior;
            throw erro;
        }
        if (motor.estado.modeloId === id) {
            motor.aplicarConfiguracao(configuracaoParaModelo(persistencia.dados.configuracao, modelo));
        }
    });
    registrar('verificarAtualizacao', vazio, () => atualizacoes.verificar());
    registrar('reiniciarAtualizacao', vazio, () => atualizacoes.reiniciar());
    registrar('abrirRelease', z.tuple([z.string().max(80).optional()]), async ([versao]) => {
        await shell.openExternal(urlRelease(versao));
    });
    registrar('anexarImagens', z.tuple([z.array(esquemaEntradaImagem).min(1).max(4)]), ([imagens]) =>
        anexos.importar(imagens),
    );
    registrar('lerImagem', z.tuple([uuid]), ([id]) => anexos.ler(id));
    registrar('sintetizarFala', z.tuple([z.string().trim().min(1).max(limiteTrechoFala)]), async ([texto]) => {
        const audio = await motor.sintetizarFala(texto, AbortSignal.timeout(120000));
        return `data:audio/wav;base64,${Buffer.from(audio).toString('base64')}`;
    });
    registrar('descartarImagens', z.tuple([z.array(uuid).max(32)]), ([ids]) => anexos.descartar(ids));
    registrar('importarProjetor', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        const modelo = persistencia.dados.modelos.find((item) => item.id === id);
        if (!modelo) throw new Error('Modelo não encontrado.');
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openFile'],
            title: 'Importar projetor visual correspondente ao modelo',
            filters: [{ name: 'GGUF', extensions: ['gguf'] }],
        });
        exigirLivre();
        if (escolha.canceled) return;
        const caminho = await realpath(escolha.filePaths[0]);
        const arquivo = await open(caminho, 'r');
        try {
            const assinatura = Buffer.alloc(4);
            await arquivo.read(assinatura, 0, 4, 0);
            if (assinatura.toString() !== 'GGUF') throw new Error('Projetor visual GGUF inválido.');
        } finally {
            await arquivo.close();
        }
        modelo.projetorVisual = caminho;
        await salvar();
        if (motor.estado.modeloId === id) {
            motor.estado.recarregamentoPendente = true;
            publicarEstado();
        }
    });
    registrar('adicionarProjeto', z.tuple([esquemaNovoProjeto]), async ([entrada]) => {
        if (entrada.tipo !== 'pasta') {
            const projeto = await criarProjetoGerenciado(persistencia.dados, app.getPath('userData'), entrada);
            await salvar();
            return projeto;
        }
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openDirectory'],
            title: 'Adicionar projeto',
        });
        if (escolha.canceled) return null;
        const projeto = await cadastrarProjeto(persistencia.dados, escolha.filePaths[0]);
        await salvar();
        return projeto;
    });
    registrar('alterarProjeto', z.tuple([uuid, esquemaProjeto.shape.nome]), async ([id, nome]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.nome = nome;
        await salvar();
    });
    registrar('salvarIconeProjeto', z.tuple([uuid, esquemaIconeProjeto.nullable()]), async ([id, icone]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.icone = icone;
        await salvar();
    });
    registrar('importarIconeProjeto', z.tuple([uuid]), async ([id]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        const escolha = await dialog.showOpenDialog(janela!, {
            title: 'Escolher ícone do projeto',
            properties: ['openFile'],
            filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'ico'] }],
        });
        if (escolha.canceled) return false;
        const arquivo = escolha.filePaths[0];
        const metadados = await stat(arquivo);
        if (!metadados.isFile() || metadados.size > 2 * 1024 ** 2) {
            throw new Error('Escolha uma imagem de até 2 MB.');
        }
        const imagem = nativeImage.createFromPath(arquivo);
        if (imagem.isEmpty()) throw new Error('Não foi possível abrir a imagem do ícone.');
        const tamanho = imagem.getSize();
        const escala = Math.min(1, 96 / Math.max(tamanho.width, tamanho.height));
        projeto.icone = esquemaIconeProjeto.parse({
            tipo: 'imagem',
            dados: imagem
                .resize({
                    width: Math.max(1, Math.round(tamanho.width * escala)),
                    height: Math.max(1, Math.round(tamanho.height * escala)),
                })
                .toDataURL(),
        });
        await salvar();
        return true;
    });
    registrar('removerProjeto', z.tuple([uuid]), async ([id]) => {
        const projeto = persistencia.dados.projetos.find((item) => item.id === id);
        if (!projeto) throw new Error('Projeto não encontrado.');
        projeto.oculto = true;
        terminais.fecharProjeto(id);
        await salvar();
    });
    registrar('promoverRascunho', z.tuple([esquemaRascunho]), async ([entrada]) => {
        const existente = persistencia.dados.conversas.find((item) => item.id === entrada.id);
        if (existente) return existente;
        if (entrada.modeloId && !persistencia.dados.modelos.some((item) => item.id === entrada.modeloId)) {
            throw new Error('Modelo não encontrado.');
        }
        const projeto = entrada.projetoId
            ? persistencia.dados.projetos.find((item) => item.id === entrada.projetoId)
            : persistencia.dados.projetos.find((item) => item.caminho === entrada.projeto);
        if ((entrada.projetoId || entrada.projeto) && !projeto) throw new Error('Projeto não encontrado.');
        if (entrada.projetoChatId) {
            if (entrada.modo !== 'chat') throw new Error('Projetos de Chat exigem conversas Chat.');
            projetosChat.obter(entrada.projetoChatId);
        }
        const { rascunho, ...opcoes } = entrada;
        const caminhoProjeto = entrada.modo === 'code' && projeto ? await realpath(projeto.caminho) : null;
        const promovida = persistencia.dados.conversas.find((item) => item.id === entrada.id);
        if (promovida) return promovida;
        const conversa = {
            ...opcoes,
            projeto: caminhoProjeto,
            projetoId: entrada.modo === 'code' ? (projeto?.id ?? null) : null,
            acessoCompleto: entrada.modo === 'code' && entrada.acessoCompleto,
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
        };
        persistencia.dados.conversas.unshift(conversa);
        await salvar();
        return conversa;
    });
    registrar('nova', z.tuple([z.enum(['chat', 'code']), uuid.optional()]), async ([modo, origemId]) => {
        const origem = origemId ? conversaPorId(origemId) : undefined;
        const projeto =
            modo === 'code' && origem?.modo === 'code' && origem.projeto ? await realpath(origem.projeto) : null;
        const conversa = {
            id: randomUUID(),
            titulo: 'Nova conversa',
            modo,
            projeto,
            projetoId: origem?.projetoId ?? null,
            projetoChatId: modo === 'chat' && origem?.modo === 'chat' ? origem.projetoChatId : null,
            acessoCompleto: false,
            modeloId: motor.estado.modeloId ?? null,
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
        };
        persistencia.dados.conversas.unshift(conversa);
        await salvar();
        return conversa;
    });
    registrar('alterar', z.tuple([uuid, esquemaAlteracao]), async ([id, alteracao]) => {
        exigirLivre(id);
        const conversa = conversaPorId(id);
        if (alteracao.modeloId && !persistencia.dados.modelos.some((modelo) => modelo.id === alteracao.modeloId)) {
            throw new Error('Modelo não encontrado.');
        }
        Object.assign(conversa, alteracao, { atualizadoEm: new Date().toISOString() });
        if (alteracao.concluida !== undefined) {
            if (alteracao.concluida) conversa.encerradaEm = conversa.atualizadoEm;
            else delete conversa.encerradaEm;
        }
        if (conversa.modo === 'chat') conversa.acessoCompleto = false;
        await salvar();
    });
    registrar('excluir', z.tuple([uuid]), async ([id]) => {
        await excluirConversas([id]);
    });
    registrar('excluirConcluidas', z.tuple([z.enum(['chat', 'code']).optional()]), async ([modo = 'code']) => {
        const ids = persistencia.dados.conversas
            .filter((conversa) => conversa.modo === modo && conversa.concluida)
            .map((conversa) => conversa.id);
        await excluirConversas(ids);
        return ids;
    });
    registrar('projeto', z.tuple([uuid, z.string().min(1).nullable().optional()]), async ([id, caminho]) => {
        exigirLivre(id);
        const conversa = conversaPorId(id);
        if (conversa.modo !== 'code') throw new Error('Projetos estão disponíveis somente no modo Code.');
        if (caminho === null) {
            delete conversa.pastaRepositorio;
            await prepararPastaTrabalho(conversa, app.getPath('userData'));
            conversa.projeto = null;
            conversa.projetoId = null;
            conversa.atualizadoEm = new Date().toISOString();
            await salvar();
            return true;
        }
        if (caminho !== undefined) {
            if (!persistencia.dados.projetos.some((item) => item.caminho === caminho)) {
                throw new Error('Projeto recente não encontrado. Escolha a pasta novamente.');
            }
            const projeto = await realpath(caminho);
            if (!(await stat(projeto)).isDirectory()) throw new Error('O projeto precisa ser uma pasta.');
            conversa.projeto = projeto;
            delete conversa.pastaRepositorio;
            conversa.projetoId = persistencia.dados.projetos.find((item) => item.caminho === projeto)!.id;
            conversa.atualizadoEm = new Date().toISOString();
            await salvar();
            return true;
        }
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openDirectory'],
            title: 'Escolher projeto',
        });
        exigirLivre(id);
        if (escolha.canceled) return false;
        conversa.projeto = await realpath(escolha.filePaths[0]);
        delete conversa.pastaRepositorio;
        conversa.projetoId = (await cadastrarProjeto(persistencia.dados, conversa.projeto)).id;
        conversa.atualizadoEm = new Date().toISOString();
        await salvar();
        return true;
    });
    registrar('importar', vazio, async () => {
        const escolha = await dialog.showOpenDialog(janela!, {
            properties: ['openFile'],
            title: 'Importar modelo GGUF',
            filters: [{ name: 'GGUF', extensions: ['gguf'] }],
        });
        if (escolha.canceled) return;
        const caminho = await realpath(escolha.filePaths[0]);
        if (persistencia.dados.modelos.some((modelo) => modelo.caminho === caminho)) return;
        const arquivo = await open(caminho, 'r');
        try {
            const assinatura = Buffer.alloc(4);
            await arquivo.read(assinatura, 0, 4, 0);
            if (assinatura.toString() !== 'GGUF') throw new Error('O arquivo não tem uma assinatura GGUF válida.');
        } finally {
            await arquivo.close();
        }
        const metadados = await stat(caminho);
        persistencia.dados.modelos.push({
            id: randomUUID(),
            nome: basename(caminho),
            caminho,
            tamanho: metadados.size,
        });
        await salvar();
    });
    registrar('removerModelo', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        const modelo = persistencia.dados.modelos.find((item) => item.id === id);
        if (!modelo) throw new Error('Modelo não encontrado.');
        if (motor.estado.modeloId === id) motor.parar();
        if (modelo.catalogoId) {
            const item = itemCatalogo(modelo.catalogoId);
            const destino = join(app.getPath('userData'), 'models', `${item.id}.gguf`);
            if (modelo.caminho !== destino) throw new Error('Caminho do download inválido.');
            await rm(destino, { force: true });
        }
        persistencia.dados.modelos = persistencia.dados.modelos.filter((modelo) => modelo.id !== id);
        for (const conversa of persistencia.dados.conversas) if (conversa.modeloId === id) conversa.modeloId = null;
        await salvar();
    });
    registrar('baixarModelo', z.tuple([z.string().min(1).max(120)]), ([id]) => {
        const item = itemCatalogo(id);
        if (encontrarModeloLocal(item, persistencia.dados.modelos)) return;
        downloads.iniciar(item);
    });
    registrar('cancelarDownload', z.tuple([z.string().min(1).max(120)]), ([id]) => {
        itemCatalogo(id);
        downloads.cancelar(id);
    });
    registrar('favoritarModelo', z.tuple([z.string().min(1).max(240), z.boolean()]), async ([id, favorito]) => {
        if (id.startsWith('openrouter:')) {
            if (favorito && !(await openrouter.modelos()).some((modelo) => `openrouter:${modelo.id}` === id))
                throw new Error('Modelo ausente no catálogo OpenRouter.');
        } else itemCatalogo(id);
        const favoritos = persistencia.dados.favoritosCatalogo.filter((atual) => atual !== id);
        persistencia.dados.favoritosCatalogo = favorito ? [...favoritos, id] : favoritos;
        await salvar();
    });
    registrar('instalar', z.tuple([esquemaBackend]), async ([backend]) => {
        exigirLivre();
        await motor.instalar(backend);
    });
    registrar('carregar', z.tuple([uuid]), async ([id]) => {
        exigirLivre();
        await carregarModelo(id);
    });
    registrar('pararMotor', vazio, () => {
        exigirLivre();
        motor.parar();
    });
    registrar('configurar', z.tuple([esquemaConfiguracao]), async ([configuracao]) => {
        exigirLivre();
        if (!configuracao.limitesAutomaticos && configuracao.maxTokens > configuracao.contexto / 2) {
            throw new Error('O limite de resposta deve ocupar no máximo metade do contexto.');
        }
        if (['carregando', 'instalando'].includes(motor.estado.fase)) throw new Error('Aguarde a operação do motor.');
        const anterior = persistencia.dados.configuracao;
        persistencia.dados.configuracao = configuracao;
        try {
            await salvar();
        } catch (erro) {
            persistencia.dados.configuracao = anterior;
            throw erro;
        }
        const modelo = persistencia.dados.modelos.find((item) => item.id === motor.estado.modeloId);
        motor.aplicarConfiguracao(configuracaoParaModelo(configuracao, modelo));
    });
    async function enviarMensagem(
        id: string,
        texto: string,
        ids: string[],
        mensagemId?: string,
        envioId?: string,
    ): Promise<void> {
        exigirLivre();
        if (['carregando', 'instalando'].includes(motor.estado.fase)) throw new Error('Aguarde o motor local.');
        const conversa = conversaPorId(id);
        const preparada = mensagemId ? prepararReenvioChat(conversa, mensagemId, texto) : conversa;
        const imagens = mensagemId ? (preparada.mensagens.at(-1)?.imagens ?? []) : anexos.obter(ids);
        if (!texto && !imagens.length) throw new Error('Escreva uma mensagem ou anexe uma imagem.');
        if (!conversa.modeloId) throw new Error('Selecione um modelo.');
        if (conversa.modo === 'code' && !conversa.projeto) {
            await prepararPastaTrabalho(conversa, app.getPath('userData'));
            await salvar();
        }
        const modelo = persistencia.dados.modelos.find((item) => item.id === conversa.modeloId);
        if (!modelo) throw new Error('Modelo não encontrado.');
        if (modelo.chatgptWeb) {
            if (conversa.modo !== 'chat') throw new Error('ChatGPT pelo site está disponível somente no Chat.');
            if (imagens.length) throw new Error('Use texto na Selene. Anexos podem ser enviados na janela do ChatGPT.');
            if (!conversa.chatgptWeb?.url && preparada.mensagens.some((mensagem) => mensagem.imagens?.length)) {
                throw new Error('Este histórico tem anexos. Abra uma conversa nova para usar o ChatGPT pelo site.');
            }
            if (mensagemId) throw new Error('Edite ou gere novamente a resposta na janela do ChatGPT.');
            tarefa = conversaChatGpt.executar(conversa, texto).catch((erro: Error) => {
                publicar({ tipo: 'erro', erro: erro.message });
            }).finally(() => {
                tarefa = null;
                publicarEstado();
            });
            publicarEstado();
            return;
        }
        if (
            modelo.assinatura &&
            (imagens.length || preparada.mensagens.some((mensagem) => mensagem.imagens?.length))
        ) {
            throw new Error('Os provedores de assinatura aceitam apenas mensagens de texto nesta versão.');
        }
        const configuracao = configuracaoParaModelo(persistencia.dados.configuracao, modelo);
        const precisaLigar =
            !modelo.openrouter &&
            !modelo.assinatura &&
            (motor.estado.fase !== 'pronto' ||
                motor.estado.modeloId !== modelo.id ||
                motor.precisaRecarregar(configuracao, modelo));
        const indiceResumo = preparada.contextoCompactado
            ? preparada.mensagens.findIndex((mensagem) => mensagem.id === preparada.contextoCompactado!.ateMensagemId)
            : -1;
        const anexosAtivos = [...imagens, ...preparada.mensagens.slice(indiceResumo + 1)
            .flatMap((mensagem) => mensagem.imagens ?? [])];
        const possuiImagens = anexosAtivos.some((anexo) => anexo.mime === 'image/jpeg');
        const possuiAudio = anexosAtivos.some((anexo) => anexo.mime === 'audio/wav');
        if (possuiAudio && !modeloAceitaAudio(modelo)) throw new Error('Este modelo não aceita áudio de entrada.');
        if (envioId) {
            if (!conversa.enviosPendentes?.some((item) => item.id === envioId)) {
                throw new Error('Esta mensagem não está mais na fila.');
            }
        }
        exigirLivre();
        tarefa = agente
            .executar(conversa, texto, configuracao, imagens, modelo, mensagemId, {
                ligandoModelo: precisaLigar,
                envioId,
                executar: async (sinal) => {
                    sinal.throwIfAborted();
                    if (modelo.openrouter) {
                        if (!openrouter.configurado) throw new Error('Configure a chave de API do OpenRouter.');
                        if (possuiImagens && !modelo.openrouter.imagens)
                            throw new Error('Este modelo OpenRouter não aceita imagens.');
                        return {
                            ...configuracao,
                            contexto: modelo.openrouter.contexto,
                            maxTokens: Math.min(configuracao.maxTokens, modelo.openrouter.maxTokens ?? 32768),
                        };
                    }
                    // Inscrições rodam no próprio harness, que gerencia o contexto; o motor local não participa.
                    if (modelo.assinatura) return { ...configuracao, contexto: contextoAssinatura };
                    if (precisaLigar || !motor.estado.contextoDisponivel) await carregarModelo(modelo.id);
                    sinal.throwIfAborted();
                    if (possuiImagens && !motor.estado.suportaImagens) {
                        throw new Error(
                            'O motor está carregado sem suporte visual ativo. ' +
                                'Para modelos importados, vincule o projetor visual compatível nas configurações de Modelos.',
                        );
                    }
                    if (possuiAudio && !motor.estado.suportaAudio) {
                        throw new Error('O motor carregado não oferece suporte a áudio. Verifique o projetor do modelo.');
                    }
                    if (!motor.estado.contextoDisponivel)
                        throw new Error('O motor não informou o contexto disponível.');
                    return {
                        ...configuracao,
                        contexto: motor.estado.contextoDisponivel,
                    };
                },
            })
            .catch((erro: Error) => {
                publicar({ tipo: 'erro', erro: `Falha ao persistir a conversa: ${erro.message}` });
            })
            .finally(async () => {
                tarefa = null;
                publicarEstado();
                const resposta = [...conversa.mensagens].reverse().find((item) => item.papel === 'assistant');
                if (resposta?.estado === 'concluida' && modelo.openrouter && openrouter.configurado)
                    void memorias.extrair(conversa);
                const proxima = conversa.enviosPendentes?.[0];
                if (encerramentoAutorizado || resposta?.estado !== 'concluida' || !proxima) return;
                try {
                    await enviarMensagem(id, proxima.texto, [], undefined, proxima.id);
                } catch (erro) {
                    publicar({ tipo: 'erro', erro: erro instanceof Error ? erro.message : 'Falha ao iniciar a fila.' });
                }
            });
        publicarEstado();
        await anexos.descartar(ids);
    }
    entregarAoPai = async (paiId, texto) => {
        const pai = conversaPorId(paiId);
        const ativa = agente.conversaId === paiId || subagentes.emExecucao().includes(paiId);
        await enviosCode.adicionar(pai, texto, ativa ? 'direcao' : 'fila', () => undefined);
        if (ativa || agente.conversaId) return;
        const envio = pai.enviosPendentes?.at(-1);
        if (envio) await enviarMensagem(paiId, envio.texto, [], undefined, envio.id);
    };
    registrar('enviar', z.tuple([uuid, z.string().trim().max(30000), z.array(uuid).max(4)]), ([id, texto, ids]) =>
        enviarMensagem(id, texto, ids),
    );
    registrar(
        'acompanharCode',
        z.tuple([uuid, z.string().trim().min(1).max(30000), z.enum(['fila', 'direcao']), uuid]),
        async ([id, texto, tipo, respostaId]) => {
            const conversa = conversaPorId(id);
            await enviosCode.adicionar(conversa, texto, tipo, () => agente.validarDirecao(id, respostaId));
            if (tipo === 'direcao') agente.reconsiderar();
        },
    );
    registrar(
        'gerenciarEnvioCode',
        z.tuple([uuid, uuid, z.enum(['remover', 'direcao', 'executar'])]),
        async ([id, envioId, acao]) => {
            const conversa = conversaPorId(id);
            if (acao === 'executar') {
                exigirLivre();
                const envio = conversa.enviosPendentes?.find((item) => item.id === envioId);
                if (!envio) throw new Error('Esta mensagem não está mais na fila.');
                return enviarMensagem(id, envio.texto, [], undefined, envioId);
            }
            await enviosCode.alterar(conversa, () => {
                const envio = conversa.enviosPendentes?.find((item) => item.id === envioId);
                if (!envio) throw new Error('Esta mensagem não está mais na fila.');
                if (acao === 'remover') {
                    conversa.enviosPendentes = conversa.enviosPendentes!.filter((item) => item.id !== envioId);
                    return;
                }
                const resposta = [...conversa.mensagens].reverse().find((item) => item.papel === 'assistant');
                agente.validarDirecao(id, resposta?.id ?? '');
                envio.tipo = 'direcao';
            });
            if (acao === 'direcao') agente.reconsiderar();
        },
    );
    registrar('editarEReenviar', z.tuple([uuid, uuid, z.string().trim().max(30000)]), ([id, mensagemId, texto]) =>
        enviarMensagem(id, texto, [], mensagemId),
    );
    registrar('regerar', z.tuple([uuid, uuid]), ([id, mensagemId]) => {
        exigirLivre();
        const pedido = obterPedidoParaRegerarChat(conversaPorId(id), mensagemId);
        return enviarMensagem(id, pedido.texto, [], pedido.id);
    });
    registrar('cancelar', vazio, () => {
        conversaChatGpt.cancelar();
        agente.cancelar();
        subagentes.cancelarTodas();
        if (['instalando', 'carregando'].includes(motor.estado.fase)) motor.parar();
    });
    registrar('aprovar', z.tuple([z.string().min(1), z.boolean()]), ([id, aprovada]) => {
        const responsavel = [...agentesFilhos].find((filho) => filho.temPendente(id)) ?? agente;
        responsavel.aprovar(id, aprovada);
    });
    registrar('exportar', z.tuple([uuid]), async ([id]) => {
        const conversa = conversaPorId(id);
        const escolha = await dialog.showSaveDialog(janela!, {
            defaultPath: `${conversa.titulo.replace(/[<>:"/\\|?*]/g, '').slice(0, 70)}.md`,
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (escolha.canceled || !escolha.filePath) return;
        await writeFile(escolha.filePath, await exportarMarkdown(conversa, (id) => anexos.ler(id)), 'utf8');
    });
    registrar('fixarMemoria', z.tuple([uuid, z.boolean()]), ([id, fixada]) => memorias.fixar(id, fixada));
    registrar('removerMemoria', z.tuple([uuid]), ([id]) => memorias.remover(id));
    ipcMain.on('selene:janela', (evento, acao) => {
        try {
            validarRemetente(evento);
        } catch {
            return;
        }
        if (acao === 'minimizar') janela?.minimize();
        if (acao === 'maximizar') janela?.isMaximized() ? janela.unmaximize() : janela?.maximize();
        if (acao === 'fechar') janela?.close();
    });
}

async function criarJanela(): Promise<void> {
    janela = new BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 840,
        minHeight: 620,
        frame: false,
        backgroundColor: '#0a0a0a',
        title: 'Selene',
        show: false,
        icon: app.isPackaged ? join(process.resourcesPath, 'selene.ico') : join(__dirname, '../public/selene.ico'),
        webPreferences: {
            preload: join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        },
    });
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    janela.webContents.on('will-navigate', (evento, url) => {
        if (url !== urlInterface) evento.preventDefault();
    });
    janela.webContents.session.setPermissionRequestHandler((conteudo, permissao, responder, detalhes) => {
        responder(permitirMicrofone(permissao, conteudo === janela?.webContents && detalhes.isMainFrame,
            detalhes.requestingUrl, urlInterface, 'mediaTypes' in detalhes ? detalhes.mediaTypes : undefined));
    });
    janela.webContents.session.setPermissionCheckHandler((conteudo, permissao, _origem, detalhes) =>
        permitirMicrofone(permissao, conteudo === janela?.webContents && detalhes.isMainFrame,
            detalhes.requestingUrl, urlInterface, detalhes.mediaType ? [detalhes.mediaType] : undefined));
    janela.once('ready-to-show', () => janela?.show());
    janela.once('closed', () => {
        janela = null;
        app.quit();
    });
    await janela.loadURL(urlInterface);
}

app.whenReady()
    .then(async () => {
        if (!instanciaPrincipal) return;
        persistencia = new Persistencia(app.getPath('userData'));
        await persistencia.abrir();
        chatgptWeb = new ChatGptWeb();
        conversaChatGpt = new ConversaChatGpt({ navegador: chatgptWeb, salvar, publicar: publicarEstado });
        if (persistencia.avisoRecuperacao) dialog.showErrorBox('Histórico recuperado', persistencia.avisoRecuperacao);
        anexos = new AnexosImagens(
            join(app.getPath('userData'), 'attachments'),
            () => persistencia.dados.conversas,
            (bytes) => {
                const imagem = nativeImage.createFromBuffer(bytes);
                if (imagem.isEmpty()) throw new Error('O arquivo não contém uma imagem válida.');
                const { width, height } = imagem.getSize();
                if (width * height > 64 * 1024 ** 2) throw new Error('A imagem excede o limite de resolução.');
                const escala = Math.min(1, 1536 / Math.max(width, height));
                const largura = Math.max(1, Math.round(width * escala));
                const altura = Math.max(1, Math.round(height * escala));
                return { bytes: imagem.resize({ width: largura, height: altura }).toJPEG(85), largura, altura };
            },
        );
        await anexos.preparar();
        motor = new MotorLocal(join(app.getPath('userData'), 'runtime'), publicarEstado);
        await motor.verificar();
        downloads = new DownloadsModelos(join(app.getPath('userData'), 'models'), publicarEstado, registrarDownload);
        await downloads.preparar(catalogoModelos);
        navegador = new Navegador((previa) => publicar({ tipo: 'navegador', previa }));
        computador = new Computador((previa) => publicar({ tipo: 'computador', previa }), urlInterface);
        openrouter = new OpenRouter(app.getPath('userData'));
        await openrouter.abrir();
        enviosCode = new EnviosCode(salvar);
        memorias = new Memorias({
            dados: () => persistencia.dados,
            salvar,
            completarExtracao: (mensagens, sinal) =>
                openrouter.completarTexto(modeloExtracaoMemoria, mensagens, sinal),
        });
        subagentes = new Subagentes({
            conversaPorId,
            conversas: () => persistencia.dados.conversas,
            assinaturaDoModelo: (id) => persistencia.dados.modelos.find((modelo) => modelo.id === id)?.assinatura,
            criarConversa: async (conversa) => {
                persistencia.dados.conversas.unshift(conversa);
                await salvar();
            },
            obterModelo: async (provedor, id) => {
                const verificacao = await verificarAssinatura(provedor);
                if (verificacao.estado !== 'pronto') throw new Error(verificacao.mensagem);
                return cadastrarModeloAssinatura(provedor, id);
            },
            executarConversa: executarConversaFilha,
            capacidades: capacidadesSubagentes,
            entregarAoPai: (paiId, texto) => entregarAoPai(paiId, texto),
            publicarEstado,
        });
        servidorMcp = new ServidorMcp((servidor, escopo) => subagentes.registrarFerramentas(servidor, escopo));
        await servidorMcp.abrir();
        contextoAgentes = {
            dados: () => persistencia.dados,
            salvar,
            publicar,
            publicarEstado,
            memorias,
            enviosCode,
            web: navegador,
            computador: process.platform === 'win32' ? computador : undefined,
            openrouter,
            servidorMcp,
            pastaAlteracoes: pastaAlteracoes(),
            rtkDisponivel: () => rtkDisponivel,
            lerImagem: (id) => anexos.ler(id),
            completarLocal: (corpo, sinal) => motor.completar(corpo, sinal),
            contextoProjetoChat: (conversa) => contextoProjetoChat(persistencia.dados, conversa),
        };
        agente = criarAgente(contextoAgentes, true);
        acessoWeb = new AcessoWeb(
            join(app.getPath('userData'), 'acessoWeb.json'),
            join(__dirname, '../dist'),
            operacoes,
            () => ({ tipo: 'estado', estado: estado() }),
        );
        registrarOperacoes();
        registrarRepositorio();
        atualizacoes = new Atualizacoes(
            electronUpdater.autoUpdater,
            app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR,
            app.getVersion(),
            publicarEstado,
            prepararEncerramento,
        );
        void localizarExecutavel('rtk')
            .then((caminho) => {
                rtkDisponivel = !!caminho;
                publicarEstado();
            })
            .catch(() => undefined);
        await criarJanela();
        await acessoWeb.abrir();
        atualizacoes.iniciar();
    })
    .catch((erro: Error) => {
        dialog.showErrorBox('Selene', erro.message);
        app.quit();
    });
app.on('window-all-closed', () => app.quit());
async function prepararEncerramento(): Promise<void> {
    await acessoWeb?.encerrar();
    atualizacoes?.encerrar();
    agente?.cancelar();
    conversaChatGpt?.cancelar();
    subagentes?.cancelarTodas();
    await servidorMcp?.fechar();
    navegador?.encerrar();
    computador?.encerrar();
    terminais.encerrar();
    motor?.parar();
    await downloads?.encerrar();
    await tarefa;
    chatgptWeb?.encerrar();
    await persistencia.salvar();
}

app.on('before-quit', (evento) => {
    if (encerramentoAutorizado || !persistencia) return;
    evento.preventDefault();
    void prepararEncerramento()
        .catch((erro: Error) => dialog.showErrorBox('Erro ao salvar dados', erro.message))
        .finally(() => {
            encerramentoAutorizado = true;
            app.quit();
        });
});
