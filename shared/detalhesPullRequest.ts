import { z } from 'zod';
import { esquemaPullRequest } from './pullRequests';

export const esquemaMetodoMesclagem = z.enum(['merge', 'squash', 'rebase']);
export type MetodoMesclagem = z.infer<typeof esquemaMetodoMesclagem>;
export const esquemaShaPullRequest = z.string().regex(/^[a-f0-9]{40}$/i);

export const esquemaDetalhesPullRequest = z.object({
    pr: esquemaPullRequest,
    descricao: z.string(),
    autor: z.string().nullable(),
    base: z.string(),
    sha: esquemaShaPullRequest,
    rascunho: z.boolean(),
    mesclavel: z.enum(['MERGEABLE', 'CONFLICTING', 'UNKNOWN']),
    situacaoMesclagem: z.string(),
    revisao: z.string(),
    alteradoEm: z.string().datetime(),
    arquivosAlterados: z.number().int().nonnegative(),
    adicoes: z.number().int().nonnegative(),
    remocoes: z.number().int().nonnegative(),
    revisores: z.array(z.string()),
    rotulos: z.array(z.string()),
    verificacoes: z.array(
        z.object({
            nome: z.string(),
            estado: z.string(),
            url: z.string().nullable(),
        }),
    ),
    atividade: z.array(
        z.object({
            id: z.string(),
            tipo: z.enum(['comentario', 'revisao', 'commit']),
            autor: z.string().nullable(),
            texto: z.string(),
            criadoEm: z.string().datetime(),
        }),
    ),
});
export type DetalhesPullRequest = z.infer<typeof esquemaDetalhesPullRequest>;

export const esquemaArquivoPullRequest = z.object({
    caminho: z.string(),
    estado: z.string(),
    adicoes: z.number().int().nonnegative(),
    remocoes: z.number().int().nonnegative(),
    patch: z.string().nullable(),
});
export type ArquivoPullRequest = z.infer<typeof esquemaArquivoPullRequest>;

/** Explica o estado que impede uma mesclagem imediata antes de exibir a confirmação. */
export function impedimentoMesclagem(detalhes: DetalhesPullRequest): string | null {
    if (detalhes.pr.estado !== 'aberto') return 'Este PR não está aberto.';
    if (detalhes.rascunho) return 'O PR ainda é um rascunho.';
    if (detalhes.mesclavel === 'CONFLICTING') return 'Resolva os conflitos antes de mesclar.';
    if (detalhes.mesclavel === 'UNKNOWN') return 'O GitHub ainda está verificando a mesclagem.';
    if (detalhes.situacaoMesclagem === 'BLOCKED') return 'A mesclagem está bloqueada pelas regras do repositório.';
    if (detalhes.situacaoMesclagem === 'BEHIND') return 'Atualize a branch antes de mesclar.';
    return null;
}
