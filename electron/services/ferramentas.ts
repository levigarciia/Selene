import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { executarProcesso } from './processos';
import type { Conversa } from '../../shared/contratos';
import { esquemaPlano } from '../../shared/atividade';
import { prepararPatch } from './patch';
import {
    esquemaPesquisaWeb,
    esquemaLeituraWeb,
    esquemaNavegador,
    ferramentasPesquisa,
    ferramentaNavegador,
    type ServicoWeb,
} from '../../shared/web';

const texto = z.string().min(1).max(30000);
const esquemaLer = z.object({ caminho: texto, inicio: z.number().int().min(1).default(1) });
const esquemaListar = z.object({ caminho: texto.default('.') });
const esquemaEscrever = z.object({ caminho: texto, conteudo: z.string().max(200000) });
const esquemaEditar = z.object({ caminho: texto, anterior: texto, novo: z.string().max(200000) });
const esquemaTerminal = z.object({ comando: texto, pasta: texto.default('.') });
const esquemaPatch = z.object({ patch: z.string().min(1).max(200000) });

function definir(nome: string, descricao: string, properties: object, required: string[]) {
    return {
        type: 'function',
        function: {
            name: nome,
            description: descricao,
            parameters: { type: 'object', properties, required, additionalProperties: false },
        },
    };
}

export const ferramentas = [
    definir(
        'apply_patch',
        'Edite arquivos com patch contextual. Requer aprovação. Envie patch entre *** Begin Patch e *** End Patch. ' +
            'Use *** Add File: caminho com linhas +, *** Delete File: caminho, ou *** Update File: caminho. ' +
            'Em Update, use @@ antes de cada trecho, espaço para contexto, menos para remover e + para adicionar. ' +
            'Aceita @@ contexto, *** End of File e *** Move to: destino antes dos trechos. ' +
            'Envie contexto exato e único, sem números de linha. Cada caminho pode aparecer uma vez. ' +
            'Exemplo: *** Begin Patch\n*** Update File: arquivo.txt\n@@\n-antigo\n+novo\n*** End Patch',
        { patch: { type: 'string' } },
        ['patch'],
    ),
    definir('listar_arquivos', 'Lista uma pasta do projeto.', { caminho: { type: 'string' } }, []),
    definir(
        'ler_arquivo',
        'Lê até 400 linhas de texto, com numeração.',
        {
            caminho: { type: 'string' },
            inicio: { type: 'integer', minimum: 1 },
        },
        ['caminho'],
    ),
    definir(
        'escrever_arquivo',
        'Cria ou substitui um arquivo. Requer aprovação.',
        {
            caminho: { type: 'string' },
            conteudo: { type: 'string' },
        },
        ['caminho', 'conteudo'],
    ),
    definir(
        'editar_arquivo',
        'Substitui uma ocorrência textual única e exata. Requer aprovação.',
        {
            caminho: { type: 'string' },
            anterior: { type: 'string' },
            novo: { type: 'string' },
        },
        ['caminho', 'anterior', 'novo'],
    ),
    definir(
        'executar_terminal',
        'Executa PowerShell no Windows. Limite de 60 segundos. Requer aprovação.',
        {
            comando: { type: 'string' },
            pasta: { type: 'string' },
        },
        ['comando'],
    ),
    definir(
        'atualizar_plano',
        'Registra os objetivos do trabalho e atualiza seu progresso. Envie o plano completo a cada atualização. ' +
            'Use resultados a alcançar, sem listar cada comando, leitura ou caminho de arquivo. ' +
            'Mantenha no máximo um objetivo em andamento e conclua apenas objetivos realizados.',
        {
            etapas: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        descricao: { type: 'string' },
                        estado: { type: 'string', enum: ['pendente', 'em andamento', 'concluida'] },
                    },
                    required: ['descricao', 'estado'],
                },
            },
        },
        ['etapas'],
    ),
];

/** Oferece pesquisa nos dois modos e controle do navegador somente no modo Code. */
export function obterFerramentas(modo: Conversa['modo'], webDisponivel: boolean) {
    const pesquisa = webDisponivel ? ferramentasPesquisa : [];
    return modo === 'code' ? [...ferramentas, ...pesquisa, ...(webDisponivel ? [ferramentaNavegador] : [])] : pesquisa;
}

async function resolverExistente(caminho: string): Promise<string> {
    try {
        return await realpath(caminho);
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
        const pai = dirname(caminho);
        if (pai === caminho) throw erro;
        return join(await resolverExistente(pai), relative(pai, caminho));
    }
}

/** Valida os caminhos reais para impedir escapes por caminhos relativos, absolutos ou links simbólicos. */
export async function resolverCaminho(caminho: string, projeto: string, acessoCompleto: boolean): Promise<string> {
    const raiz = await realpath(projeto);
    const absoluto = resolve(raiz, caminho);
    const existente = await lstat(absoluto).catch((erro: NodeJS.ErrnoException) => {
        if (erro.code !== 'ENOENT') throw erro;
        return null;
    });
    if (existente?.isSymbolicLink()) await realpath(absoluto);
    const destino = await resolverExistente(absoluto);
    const caminhoRelativo = relative(raiz, destino);
    if (
        !acessoCompleto &&
        (isAbsolute(caminhoRelativo) || caminhoRelativo === '..' || caminhoRelativo.startsWith(`..${sep}`))
    ) {
        throw new Error('O caminho está fora do projeto. Ative acesso completo para acessar outras pastas.');
    }
    return destino;
}

async function lerTexto(caminho: string): Promise<string> {
    const metadados = await stat(caminho);
    if (!metadados.isFile() || metadados.size > 2000000) throw new Error('Selecione um arquivo de texto de até 2 MB.');
    const conteudo = await readFile(caminho, 'utf8');
    if (conteudo.includes('\0')) throw new Error('O arquivo contém dados binários.');
    return conteudo;
}

export type FerramentaPreparada = {
    argumentos: Record<string, unknown>;
    aprovacao: boolean;
    previa: string;
    executar: (sinal: AbortSignal) => Promise<string>;
};

/** Prepara uma ação validada e sua prévia antes de qualquer efeito no computador. */
export async function prepararFerramenta(
    nome: string,
    entrada: unknown,
    conversa: Conversa,
    web?: ServicoWeb,
): Promise<FerramentaPreparada> {
    if (nome === 'pesquisar_web' || nome === 'ler_pagina_web') {
        if (!web) throw new Error('Pesquisa na web indisponível.');
        if (nome === 'pesquisar_web') {
            const argumentos = esquemaPesquisaWeb.parse(entrada);
            return {
                argumentos,
                aprovacao: false,
                previa: argumentos.consulta,
                executar: (sinal) => web.pesquisar(argumentos.consulta, sinal, conversa.id),
            };
        }
        const argumentos = esquemaLeituraWeb.parse(entrada);
        return {
            argumentos,
            aprovacao: false,
            previa: argumentos.url,
            executar: (sinal) => web.ler(argumentos.url, sinal, conversa.id),
        };
    }
    if (conversa.modo !== 'code') throw new Error('Esta ferramenta está disponível somente no modo Code.');
    if (nome === 'controlar_navegador') {
        if (!web) throw new Error('Navegador indisponível.');
        const argumentos = esquemaNavegador.parse(entrada);
        return {
            argumentos,
            aprovacao: argumentos.acao !== 'observar',
            ...web.preparar(conversa.id, argumentos),
        };
    }
    if (nome === 'atualizar_plano') {
        const argumentos = esquemaPlano.parse(entrada);
        return {
            argumentos,
            aprovacao: false,
            previa: '',
            executar: async () => argumentos.etapas.map((etapa) => `${etapa.estado}: ${etapa.descricao}`).join('\n'),
        };
    }
    const pasta = conversa.projeto ?? conversa.pastaTrabalho;
    if (!pasta) throw new Error('A pasta de trabalho da conversa ainda não foi preparada.');
    const caminhoValidado = (caminho: string) => resolverCaminho(caminho, pasta, conversa.acessoCompleto);
    if (nome === 'apply_patch') {
        const argumentos = esquemaPatch.parse(entrada);
        return {
            argumentos,
            aprovacao: true,
            ...(await prepararPatch(argumentos.patch, caminhoValidado)),
        };
    }
    if (nome === 'listar_arquivos') {
        const argumentos = esquemaListar.parse(entrada);
        return {
            argumentos,
            aprovacao: false,
            previa: '',
            executar: async (sinal) => {
                sinal.throwIfAborted();
                const entradas = await readdir(await caminhoValidado(argumentos.caminho), { withFileTypes: true });
                return (
                    entradas
                        .slice(0, 500)
                        .map((entrada) => `${entrada.isDirectory() ? 'pasta' : 'arquivo'}: ${entrada.name}`)
                        .join('\n') || 'Pasta vazia.'
                );
            },
        };
    }
    if (nome === 'ler_arquivo') {
        const argumentos = esquemaLer.parse(entrada);
        return {
            argumentos,
            aprovacao: false,
            previa: '',
            executar: async (sinal) => {
                sinal.throwIfAborted();
                const conteudo = await lerTexto(await caminhoValidado(argumentos.caminho));
                return conteudo
                    .split('\n')
                    .slice(argumentos.inicio - 1, argumentos.inicio + 399)
                    .map((linha, indice) => `${argumentos.inicio + indice}: ${linha}`)
                    .join('\n')
                    .slice(0, 30000);
            },
        };
    }
    if (nome === 'executar_terminal') {
        const argumentos = esquemaTerminal.parse(entrada);
        await caminhoValidado(argumentos.pasta);
        return {
            argumentos,
            aprovacao: true,
            previa: argumentos.comando,
            executar: async (sinal) => {
                const pasta = await caminhoValidado(argumentos.pasta);
                const executavel = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
                const parametros =
                    process.platform === 'win32'
                        ? ['-NoProfile', '-NonInteractive', '-Command', argumentos.comando]
                        : ['-c', argumentos.comando];
                const resultado = await executarProcesso(executavel, parametros, pasta, sinal);
                return `Código de saída: ${resultado.codigo}\n${resultado.saida}`;
            },
        };
    }
    if (nome !== 'escrever_arquivo' && nome !== 'editar_arquivo') throw new Error(`Ferramenta desconhecida: ${nome}.`);
    const argumentos = nome === 'escrever_arquivo' ? esquemaEscrever.parse(entrada) : esquemaEditar.parse(entrada);
    const caminho = await caminhoValidado(argumentos.caminho);
    const original = await lerTexto(caminho).catch((erro: NodeJS.ErrnoException) => {
        if (erro.code === 'ENOENT' && nome === 'escrever_arquivo') return null;
        throw erro;
    });
    const conteudo =
        'conteudo' in argumentos
            ? argumentos.conteudo
            : (() => {
                  if (original === null || original.split(argumentos.anterior).length !== 2) {
                      throw new Error('O trecho anterior deve existir exatamente uma vez no arquivo.');
                  }
                  return original.replace(argumentos.anterior, () => argumentos.novo);
              })();
    const previa =
        'anterior' in argumentos
            ? `Arquivo: ${caminho}\n\nTrecho atual:\n${argumentos.anterior}\n\nNovo trecho:\n${argumentos.novo}`
            : `Arquivo: ${caminho}\n\n${original === null ? 'Novo arquivo' : 'Substituição integral'}:\n${conteudo}`;
    return {
        argumentos,
        aprovacao: true,
        previa,
        executar: async (sinal) => {
            sinal.throwIfAborted();
            const destino = await caminhoValidado(argumentos.caminho);
            if (destino !== caminho) throw new Error('O destino mudou após a aprovação. Solicite uma nova ação.');
            const atual = await lerTexto(destino).catch((erro: NodeJS.ErrnoException) => {
                if (erro.code === 'ENOENT') return null;
                throw erro;
            });
            if (atual !== original) throw new Error('O arquivo mudou após a aprovação. Leia o conteúdo novamente.');
            await mkdir(dirname(destino), { recursive: true });
            sinal.throwIfAborted();
            await writeFile(destino, conteudo, 'utf8');
            return `Arquivo salvo: ${destino}`;
        },
    };
}

/** Carrega as instruções da raiz do projeto como contexto, sem alterar permissões da conversa. */
export async function lerInstrucoes(projeto: string): Promise<string> {
    const partes: string[] = [];
    for (const arquivo of ['AGENTS.md', 'docs/AGENTS.md']) {
        try {
            const caminho = await resolverCaminho(arquivo, projeto, false);
            const texto = await lerTexto(caminho);
            partes.push(`${arquivo}:\n${texto.slice(0, 12000)}`);
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
        }
    }
    return partes.join('\n\n');
}
