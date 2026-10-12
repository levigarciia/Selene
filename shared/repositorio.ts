import { z } from 'zod';

export interface ArquivoAlterado {
    caminho: string;
    adicoes: number;
    remocoes: number;
}

/** Retrato do repositório Git de um projeto Code, lido sob demanda pelo processo principal. */
export type StatusRepositorio =
    | { repositorio: false }
    | {
          repositorio: true;
          branch: string | null;
          branches: string[];
          alterados: ArquivoAlterado[];
          adicoes: number;
          remocoes: number;
          aFrente: number;
          atras: number;
          upstream: boolean;
          github: string | null;
      };

export const esquemaAcaoGit = z.enum(['commit', 'push', 'commit_push', 'commit_push_pr']);
export type AcaoGit = z.infer<typeof esquemaAcaoGit>;

export const esquemaEditor = z.enum(['vscode', 'cursor', 'explorador']);
export type Editor = z.infer<typeof esquemaEditor>;

export const esquemaScriptProjeto = z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(60),
    comando: z.string().trim().min(1).max(2000),
});
export type ScriptProjeto = z.infer<typeof esquemaScriptProjeto>;

export const esquemaTipoItemGitHub = z.enum(['pr', 'issue']);
export type TipoItemGitHub = z.infer<typeof esquemaTipoItemGitHub>;

export const esquemaEstadoItemGitHub = z.enum(['open', 'closed', 'merged', 'all']);
export type EstadoFiltroGitHub = z.infer<typeof esquemaEstadoItemGitHub>;

export const esquemaEnvolvimentoGitHub = z.enum(['todos', 'autor', 'atribuido', 'revisao']);
export type EnvolvimentoGitHub = z.infer<typeof esquemaEnvolvimentoGitHub>;

export const esquemaConsultaGitHub = z.object({
    tipo: esquemaTipoItemGitHub,
    estado: esquemaEstadoItemGitHub,
    envolvimento: esquemaEnvolvimentoGitHub,
    busca: z.string().max(200),
});
export type ConsultaGitHub = z.infer<typeof esquemaConsultaGitHub>;

export interface ItemGitHub {
    repositorio: string;
    numero: number;
    titulo: string;
    url: string;
    autor: string | null;
    estado: 'aberto' | 'rascunho' | 'fechado' | 'mesclado';
    criadoEm: string;
    atualizadoEm: string;
    rotulos: { nome: string; cor: string }[];
    branch?: string;
    adicoes?: number;
    remocoes?: number;
}

export interface ListaGitHub {
    repositorios: string[];
    itens: ItemGitHub[];
    avisos: string[];
}

export const esquemaDimensoesTerminal = z.object({
    colunas: z.number().int().min(2).max(1000),
    linhas: z.number().int().min(2).max(500),
});
export type DimensoesTerminal = z.infer<typeof esquemaDimensoesTerminal>;

export type EventoTerminal =
    | { tipo: 'terminalDados'; id: string; dados: string }
    | { tipo: 'terminalFim'; id: string; codigo: number };

const qualificadoresEnvolvimento: Record<EnvolvimentoGitHub, string> = {
    todos: '',
    autor: 'author:@me',
    atribuido: 'assignee:@me',
    revisao: 'review-requested:@me',
};

/**
 * Monta a busca do GitHub a partir da consulta. Revisão solicitada só existe em pull requests,
 * e issues não têm estado mesclado, então essas combinações caem para o filtro mais próximo.
 */
export function buscaGitHub(consulta: ConsultaGitHub): { estado: EstadoFiltroGitHub; busca: string } {
    const envolvimento =
        consulta.tipo === 'issue' && consulta.envolvimento === 'revisao' ? 'todos' : consulta.envolvimento;
    const estado = consulta.tipo === 'issue' && consulta.estado === 'merged' ? 'closed' : consulta.estado;
    const busca = [qualificadoresEnvolvimento[envolvimento], consulta.busca.trim()].filter(Boolean).join(' ');
    return { estado, busca };
}

/** Extrai `dono/repositorio` de remotos HTTPS ou SSH do github.com. */
export function repositorioGitHub(remoto: string): string | null {
    const encontrado = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(remoto.trim());
    return encontrado ? `${encontrado[1]}/${encontrado[2]}` : null;
}

/** Interpreta `git diff --numstat`, tratando arquivos binários como alterações sem linhas. */
export function lerNumstat(saida: string): ArquivoAlterado[] {
    return saida
        .split('\n')
        .map((linha) => linha.split('\t'))
        .filter((partes) => partes.length >= 3)
        .map(([adicoes, remocoes, ...caminho]) => ({
            caminho: caminho.join('\t'),
            adicoes: Number(adicoes) || 0,
            remocoes: Number(remocoes) || 0,
        }));
}
