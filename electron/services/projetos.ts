import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Conversa, Dados, NovoProjeto, Projeto } from '../../shared/contratos';
import { executarProcesso } from './processos';

/** Mantém os projetos antigos disponíveis independentemente da existência das suas conversas. */
export function migrarProjetos(dados: Dados): void {
    for (const conversa of dados.conversas) {
        if (conversa.modo !== 'code' || !conversa.projeto) continue;
        let projeto = dados.projetos.find((item) => item.caminho === conversa.projeto);
        if (!projeto) {
            projeto = {
                id: randomUUID(), nome: basename(conversa.projeto), caminho: conversa.projeto,
                origem: 'pasta', criadoEm: new Date().toISOString(),
            };
            dados.projetos.push(projeto);
        }
        conversa.projetoId = projeto.id;
    }
}

/** Cadastra pastas reais uma única vez, sem criar conversas ou modificar os arquivos do usuário. */
export async function cadastrarProjeto(dados: Dados, caminho: string): Promise<Projeto> {
    const pasta = await realpath(caminho);
    if (!(await stat(pasta)).isDirectory()) throw new Error('O projeto precisa ser uma pasta.');
    const existente = dados.projetos.find((item) => item.caminho === pasta);
    if (existente) return existente;
    const projeto: Projeto = {
        id: randomUUID(), nome: basename(pasta), caminho: pasta, origem: 'pasta',
        criadoEm: new Date().toISOString(),
    };
    dados.projetos.push(projeto);
    return projeto;
}

async function git(pasta: string, argumentos: string[], limiteMs = 30000): Promise<void> {
    const resultado = await executarProcesso('git', argumentos, pasta, new AbortController().signal, {
        ...process.env, GIT_TERMINAL_PROMPT: '0',
    }, limiteMs);
    if (resultado.codigo !== 0) throw new Error(`Não foi possível concluir a operação Git. ${resultado.saida}`);
}

/** Valida endereços remotos antes de clonar, impedindo opções, caminhos locais e credenciais na URL. */
export function validarUrlRepositorio(entrada: string): string {
    const url = new URL(entrada);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
        throw new Error('Use uma URL HTTPS do repositório, sem credenciais, parâmetros ou fragmentos.');
    }
    return url.href;
}

/** Cria ou clona projetos em pastas exclusivas gerenciadas pela Selene. */
export async function criarProjetoGerenciado(
    dados: Dados, pastaDados: string, entrada: Exclude<NovoProjeto, { tipo: 'pasta' }>,
): Promise<Projeto> {
    const url = entrada.tipo === 'clonar' ? validarUrlRepositorio(entrada.url) : null;
    const nome = entrada.tipo === 'criar' ? entrada.nome : basename(new URL(url!).pathname).replace(/\.git$/, '');
    if (!nome.trim()) throw new Error('Informe o nome do projeto ou uma URL com o nome do repositório.');
    const raiz = join(pastaDados, 'projects');
    await mkdir(raiz, { recursive: true });
    const identificador = nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60) || 'projeto';
    const pasta = await mkdtemp(join(raiz, `${identificador}_`));
    try {
        if (url) {
            await git(raiz, ['clone', '--', url, pasta], 120000);
        } else {
            await git(pasta, ['init', '--initial-branch=main']);
            await writeFile(join(pasta, 'README.md'), `${nome}\n\nProjeto criado na Selene.\n`);
            await mkdir(join(pasta, 'assets'));
            await writeFile(join(pasta, '.gitignore'), 'node_modules/\ndist/\n');
            await git(pasta, ['add', '--', 'README.md', '.gitignore']);
        }
        const projeto = await cadastrarProjeto(dados, pasta);
        projeto.nome = nome;
        projeto.origem = url ? 'clonado' : 'criado';
        return projeto;
    } catch (erro) {
        await rm(pasta, { recursive: true, force: true });
        throw erro;
    }
}

/** Prepara uma pasta persistente e exclusiva para trabalhar sem vincular um projeto. */
export async function prepararPastaTrabalho(conversa: Conversa, pastaDados: string): Promise<string> {
    if (conversa.modo !== 'code') throw new Error('A pasta de trabalho exige uma conversa Code.');
    const id = z.string().uuid().parse(conversa.id);
    const pasta = join(pastaDados, 'scratch', id);
    await mkdir(pasta, { recursive: true });
    conversa.pastaTrabalho = await realpath(pasta);
    return conversa.pastaTrabalho;
}
