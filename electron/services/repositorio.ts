import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
    buscaGitHub,
    lerNumstat,
    repositorioGitHub,
    type AcaoGit,
    type ArquivoAlterado,
    type ConsultaGitHub,
    type ItemGitHub,
    type ListaGitHub,
    type StatusRepositorio,
} from '../../shared/repositorio';
import { encerrarProcesso } from './processos';
import { descobrirPastasRepositorios } from './descobertaRepositorios';

const LIMITE_ARQUIVO_NOVO = 2 * 1024 * 1024;
const LIMITE_SAIDA = 8 * 1024 * 1024;

const ambientes = {
    git: { GIT_TERMINAL_PROMPT: '0' },
    gh: { GH_PROMPT_DISABLED: '1', NO_COLOR: '1', GH_NO_UPDATE_NOTIFIER: '1' },
};

const ausentes = {
    git: 'Git não encontrado no PATH.',
    gh: 'GitHub CLI não encontrado. Instale o gh e entre com `gh auth login`.',
};

interface ResultadoComando {
    codigo: number | null;
    saida: string;
    erro: string;
}

/** Executa git ou gh separando stdout de stderr, para que avisos não corrompam a saída estruturada. */
function executar(
    executavel: 'git' | 'gh',
    pasta: string,
    argumentos: string[],
    limiteMs = 60000,
): Promise<ResultadoComando> {
    return new Promise((resolver, rejeitar) => {
        const processo = spawn(executavel, argumentos, {
            cwd: pasta,
            windowsHide: true,
            env: { ...process.env, ...ambientes[executavel] },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const saida: Buffer[] = [];
        let tamanho = 0;
        let erro = '';
        const temporizador = setTimeout(() => encerrarProcesso(processo), limiteMs);
        processo.stdout.on('data', (trecho: Buffer) => {
            tamanho += trecho.length;
            if (tamanho > LIMITE_SAIDA) encerrarProcesso(processo);
            else saida.push(trecho);
        });
        processo.stderr.on('data', (trecho: Buffer) => (erro = (erro + trecho.toString()).slice(-4000)));
        processo.once('error', (falha: NodeJS.ErrnoException) => {
            clearTimeout(temporizador);
            rejeitar(falha.code === 'ENOENT' ? new Error(ausentes[executavel]) : falha);
        });
        processo.once('close', (codigo) => {
            clearTimeout(temporizador);
            resolver({ codigo, saida: Buffer.concat(saida).toString(), erro });
        });
    });
}

async function git(pasta: string, argumentos: string[], limiteMs?: number): Promise<string> {
    const resultado = await executar('git', pasta, argumentos, limiteMs);
    if (resultado.codigo !== 0) {
        throw new Error(resultado.erro.trim() || resultado.saida.trim() || 'O Git não concluiu a operação.');
    }
    return resultado.saida;
}

const FALHA_TEMPORARIA = /HTTP 50[234]/;

/** Executa o GitHub CLI. Somente leituras devem pedir `repetir`, pois escritas não são idempotentes. */
async function gh(pasta: string, argumentos: string[], repetir = false): Promise<string> {
    let resultado = await executar('gh', pasta, argumentos);
    if (repetir && resultado.codigo !== 0 && FALHA_TEMPORARIA.test(resultado.erro)) {
        await new Promise((resolver) => setTimeout(resolver, 1000));
        resultado = await executar('gh', pasta, argumentos);
    }
    if (resultado.codigo === 0) return resultado.saida;
    if (/auth login|not logged/i.test(resultado.erro)) {
        throw new Error('GitHub CLI sem login. Execute `gh auth login` no terminal.');
    }
    throw new Error(resultado.erro.trim() || 'O GitHub CLI não concluiu a operação.');
}

async function tentar(pasta: string, argumentos: string[]): Promise<string | null> {
    const resultado = await executar('git', pasta, argumentos);
    return resultado.codigo === 0 ? resultado.saida.trim() : null;
}

async function contarLinhasNovas(pasta: string, caminho: string): Promise<number> {
    const arquivo = join(pasta, caminho);
    if ((await stat(arquivo)).size > LIMITE_ARQUIVO_NOVO) return 0;
    const conteudo = await readFile(arquivo);
    if (conteudo.includes(0)) return 0;
    const texto = conteudo.toString();
    return texto ? texto.split('\n').length - (texto.endsWith('\n') ? 1 : 0) : 0;
}

async function arquivosAlterados(pasta: string, temCommit: boolean): Promise<ArquivoAlterado[]> {
    const diferenca = ['-c', 'core.quotepath=off', 'diff', 'HEAD', '--numstat', '--no-renames'];
    const rastreados = temCommit ? lerNumstat(await git(pasta, diferenca)) : [];
    const novos = (await git(pasta, ['ls-files', '--others', '--exclude-standard', '-z']))
        .split('\0')
        .filter(Boolean)
        .slice(0, 500);
    const contados = await Promise.all(
        novos.map(async (caminho) => ({
            caminho,
            adicoes: await contarLinhasNovas(pasta, caminho).catch(() => 0),
            remocoes: 0,
        })),
    );
    return [...rastreados, ...contados].sort((a, b) => a.caminho.localeCompare(b.caminho));
}

/** Lê branch, alterações e sincronização do projeto sem modificar o repositório. */
export async function lerStatus(pasta: string): Promise<StatusRepositorio> {
    if ((await tentar(pasta, ['rev-parse', '--is-inside-work-tree'])) !== 'true') return { repositorio: false };
    const temCommit = (await tentar(pasta, ['rev-parse', '--verify', 'HEAD'])) !== null;
    const branch = await tentar(pasta, ['symbolic-ref', '--short', 'HEAD']);
    const branches = (await git(pasta, ['branch', '--format=%(refname:short)'])).split('\n').filter(Boolean);
    const contagem = await tentar(pasta, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    const [aFrente, atras] = contagem ? contagem.split(/\s+/).map(Number) : [0, 0];
    const alterados = await arquivosAlterados(pasta, temCommit);
    const remoto = await tentar(pasta, ['remote', 'get-url', 'origin']);
    return {
        repositorio: true,
        branch,
        branches,
        alterados,
        adicoes: alterados.reduce((total, item) => total + item.adicoes, 0),
        remocoes: alterados.reduce((total, item) => total + item.remocoes, 0),
        aFrente: aFrente || 0,
        atras: atras || 0,
        upstream: contagem !== null,
        github: remoto ? repositorioGitHub(remoto) : null,
    };
}

/** Identifica o GitHub do projeto, preferindo `origin` e aceitando outros nomes de remoto. */
export async function repositorioDoProjeto(pasta: string): Promise<string | null> {
    const nomes = (await git(pasta, ['remote'])).trim().split('\n').filter(Boolean);
    const ordenados = ['origin', ...nomes.filter((nome) => nome !== 'origin')];
    for (const nome of ordenados) {
        if (!nomes.includes(nome)) continue;
        const remoto = await git(pasta, ['remote', 'get-url', nome]);
        const repositorio = repositorioGitHub(remoto);
        if (repositorio) return repositorio;
    }
    return null;
}

/** Descobre repositórios GitHub em uma pasta agregadora e mantém os diagnósticos de cada pasta. */
export async function repositoriosDoProjeto(pasta: string): Promise<{
    repositorios: { pasta: string; github: string }[];
    avisos: string[];
}> {
    const raizGit = await tentar(pasta, ['rev-parse', '--show-toplevel']);
    const descoberta = raizGit ? { pastas: [pasta], avisos: [] } : await descobrirPastasRepositorios(pasta);
    const repositorios: { pasta: string; github: string }[] = [];
    const avisos = [...descoberta.avisos];
    const encontrados = new Set<string>();
    for (const caminho of descoberta.pastas) {
        const nome = relative(pasta, caminho) || 'Projeto';
        try {
            const github = await repositorioDoProjeto(caminho);
            if (!github) {
                avisos.push(`${nome}: nenhum remoto no GitHub.`);
                continue;
            }
            if (encontrados.has(github.toLowerCase())) continue;
            encontrados.add(github.toLowerCase());
            repositorios.push({ pasta: caminho, github });
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : 'Falha ao ler o repositório.';
            avisos.push(/dubious ownership/i.test(mensagem)
                ? `${nome}: o Git recusou o acesso por divergência de proprietário. Verifique a pasta no terminal.`
                : `${nome}: ${mensagem}`);
        }
    }
    return { repositorios, avisos };
}

/** Lista itens de todos os repositórios detectados, preservando resultados em caso de falha parcial. */
export async function listarGitHubDoProjeto(pasta: string, consulta: ConsultaGitHub): Promise<ListaGitHub> {
    const descoberta = await repositoriosDoProjeto(pasta);
    if (!descoberta.repositorios.length) {
        throw new Error(descoberta.avisos.join('\n') || 'Nenhum repositório com remoto no GitHub encontrado nesta pasta.');
    }
    const resultado: ListaGitHub = { repositorios: [], itens: [], avisos: [...descoberta.avisos] };
    for (const repositorio of descoberta.repositorios) {
        try {
            const itens = await listarItensGitHub(repositorio.pasta, repositorio.github, consulta);
            resultado.repositorios.push(repositorio.github);
            resultado.itens.push(...itens);
        } catch (erro) {
            resultado.avisos.push(`${repositorio.github}: ${erro instanceof Error ? erro.message : 'Falha na consulta.'}`);
        }
    }
    if (!resultado.repositorios.length) throw new Error(resultado.avisos.join('\n'));
    return resultado;
}

/** Troca para uma branch local existente; o Git recusa a troca quando ela sobrescreveria alterações. */
export async function trocarBranch(pasta: string, branch: string): Promise<void> {
    const existentes = (await git(pasta, ['branch', '--format=%(refname:short)'])).split('\n');
    if (!existentes.includes(branch)) throw new Error('Branch não encontrada.');
    await git(pasta, ['switch', '--', branch]);
}

/** Cria uma branch a partir do HEAD atual e passa a usá-la. */
export async function criarBranch(pasta: string, branch: string): Promise<void> {
    await git(pasta, ['check-ref-format', '--branch', branch]);
    await git(pasta, ['switch', '-c', branch]);
}

async function publicarBranch(pasta: string): Promise<void> {
    const upstream = await tentar(pasta, ['rev-parse', '--abbrev-ref', '@{upstream}']);
    if (upstream) {
        await git(pasta, ['push'], 120000);
        return;
    }
    await git(pasta, ['push', '-u', 'origin', 'HEAD'], 120000);
}

/**
 * Executa as ações encadeadas de Git do projeto. Retorna a URL do pull request quando ele é criado.
 */
export async function executarAcaoGit(pasta: string, acao: AcaoGit, mensagem: string): Promise<string | null> {
    if (acao !== 'push') {
        if (!mensagem.trim()) throw new Error('Informe a mensagem do commit.');
        await git(pasta, ['add', '--all']);
        await git(pasta, ['commit', '-m', mensagem.trim()]);
    }
    if (acao === 'commit') return null;
    await publicarBranch(pasta);
    if (acao !== 'commit_push_pr') return null;
    const saida = await gh(pasta, ['pr', 'create', '--fill']);
    return /https:\/\/\S+/.exec(saida)?.[0] ?? null;
}

interface ItemBrutoGitHub {
    number: number;
    title: string;
    url: string;
    author?: { login?: string } | null;
    state: string;
    isDraft?: boolean;
    createdAt: string;
    updatedAt: string;
    labels?: { name: string; color: string }[];
    headRefName?: string;
    additions?: number;
    deletions?: number;
}

function estadoItem(item: ItemBrutoGitHub): ItemGitHub['estado'] {
    if (item.state === 'MERGED') return 'mesclado';
    if (item.state === 'CLOSED') return 'fechado';
    return item.isDraft ? 'rascunho' : 'aberto';
}

/** Converte a saída JSON do `gh` para o contrato neutro da interface. */
export function converterItensGitHub(json: string, repositorio: string): ItemGitHub[] {
    const itens = JSON.parse(json) as ItemBrutoGitHub[];
    if (!Array.isArray(itens)) throw new Error('Resposta inesperada do GitHub CLI.');
    return itens.map((item) => ({
        repositorio,
        numero: item.number,
        titulo: item.title,
        url: item.url,
        autor: item.author?.login ?? null,
        estado: estadoItem(item),
        criadoEm: item.createdAt,
        atualizadoEm: item.updatedAt,
        rotulos: (item.labels ?? []).map((rotulo) => ({ nome: rotulo.name, cor: rotulo.color })),
        branch: item.headRefName,
        adicoes: item.additions,
        remocoes: item.deletions,
    }));
}

/** Lista pull requests ou issues do repositório GitHub do projeto pelo GitHub CLI. */
export async function listarItensGitHub(
    pasta: string,
    repositorio: string,
    consulta: ConsultaGitHub,
): Promise<ItemGitHub[]> {
    const { tipo } = consulta;
    const { estado, busca } = buscaGitHub(consulta);
    const comuns = 'number,title,url,author,state,createdAt,updatedAt,labels';
    const campos = tipo === 'pr' ? `${comuns},isDraft,headRefName,additions,deletions` : comuns;
    const argumentos = [
        tipo,
        'list',
        '--repo',
        repositorio,
        '--state',
        estado,
        '--limit',
        '60',
        '--json',
        campos,
    ];
    if (busca) argumentos.push('--search', busca);
    return converterItensGitHub(await gh(pasta, argumentos, true), repositorio);
}
