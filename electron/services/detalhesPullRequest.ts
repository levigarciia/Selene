import { z } from 'zod';
import { interpretarPullRequest } from '../../shared/pullRequests';
import {
    esquemaArquivoPullRequest,
    esquemaDetalhesPullRequest,
    esquemaMetodoMesclagem,
    esquemaShaPullRequest,
    impedimentoMesclagem,
    type ArquivoPullRequest,
    type DetalhesPullRequest,
    type MetodoMesclagem,
} from '../../shared/detalhesPullRequest';
import { gh, resolverRepositorioGitHub } from './repositorio';

const autor = z.object({ login: z.string() }).nullable().optional();
const esquemaResposta = z.object({
    url: z.string(),
    title: z.string(),
    state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
    body: z.string(),
    headRefName: z.string(),
    baseRefName: z.string(),
    headRefOid: esquemaShaPullRequest,
    author: autor,
    updatedAt: z.string().datetime(),
    changedFiles: z.number(),
    additions: z.number(),
    deletions: z.number(),
    isDraft: z.boolean(),
    mergeable: z.enum(['MERGEABLE', 'CONFLICTING', 'UNKNOWN']),
    mergeStateStatus: z.string(),
    reviewDecision: z.string(),
    reviewRequests: z.array(z.object({ login: z.string().optional(), name: z.string().optional() })),
    labels: z.array(z.object({ name: z.string() })),
    statusCheckRollup: z
        .array(
            z.object({
                name: z.string().optional(),
                context: z.string().optional(),
                status: z.string().optional(),
                conclusion: z.string().nullable().optional(),
                state: z.string().optional(),
                detailsUrl: z.string().nullable().optional(),
                targetUrl: z.string().nullable().optional(),
            }),
        )
        .nullable(),
    comments: z.array(z.object({ id: z.string(), author: autor, body: z.string(), createdAt: z.string().datetime() })),
    reviews: z.array(
        z.object({
            id: z.string(),
            author: autor,
            body: z.string(),
            state: z.string(),
            submittedAt: z.string().datetime().nullable(),
        }),
    ),
    commits: z.array(
        z.object({
            oid: z.string(),
            messageHeadline: z.string(),
            committedDate: z.string().datetime(),
            authors: z.array(z.object({ login: z.string().nullable().optional() })),
        }),
    ),
});

/** Converte dados validados do GitHub para as três abas do painel de PR. */
export function converterDetalhesPullRequest(resposta: unknown, url: string): DetalhesPullRequest {
    const pr = interpretarPullRequest(url);
    const bruto = esquemaResposta.parse(resposta);
    if (!pr || bruto.url.toLowerCase() !== pr.url.toLowerCase()) throw new Error('O GitHub retornou outro PR.');
    const estados = { OPEN: 'aberto', CLOSED: 'fechado', MERGED: 'mesclado' } as const;
    const atividade: DetalhesPullRequest['atividade'] = [
        ...bruto.comments.map((item) => ({
            id: item.id,
            tipo: 'comentario' as const,
            autor: item.author?.login ?? null,
            texto: item.body,
            criadoEm: item.createdAt,
        })),
        ...bruto.reviews
            .filter((item) => item.submittedAt)
            .map((item) => ({
                id: item.id,
                tipo: 'revisao' as const,
                autor: item.author?.login ?? null,
                texto: item.body || item.state,
                criadoEm: item.submittedAt!,
            })),
        ...bruto.commits.map((item) => ({
            id: item.oid,
            tipo: 'commit' as const,
            autor: item.authors[0]?.login ?? null,
            texto: item.messageHeadline,
            criadoEm: item.committedDate,
        })),
    ].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    return esquemaDetalhesPullRequest.parse({
        pr: {
            ...pr,
            estado: estados[bruto.state],
            titulo: bruto.title,
            branch: bruto.headRefName,
            atualizadoEm: new Date().toISOString(),
        },
        descricao: bruto.body,
        autor: bruto.author?.login ?? null,
        base: bruto.baseRefName,
        sha: bruto.headRefOid,
        rascunho: bruto.isDraft,
        mesclavel: bruto.mergeable,
        situacaoMesclagem: bruto.mergeStateStatus,
        revisao: bruto.reviewDecision,
        alteradoEm: bruto.updatedAt,
        arquivosAlterados: bruto.changedFiles,
        adicoes: bruto.additions,
        remocoes: bruto.deletions,
        revisores: bruto.reviewRequests.map((item) => item.login ?? item.name ?? 'Equipe'),
        rotulos: bruto.labels.map((item) => item.name),
        verificacoes: (bruto.statusCheckRollup ?? []).map((item) => ({
            nome: item.name ?? item.context ?? 'Verificação',
            estado: item.conclusion || item.state || item.status || 'UNKNOWN',
            url: item.detailsUrl || item.targetUrl || null,
        })),
        atividade,
    });
}

/** Lê descrição, revisões, verificações e atividade sem alterar o PR ou a pasta local. */
export async function lerDetalhesPullRequest(pasta: string, url: string): Promise<DetalhesPullRequest> {
    const pr = interpretarPullRequest(url);
    if (!pr) throw new Error('Endereço de pull request inválido.');
    const campos = Object.keys(esquemaResposta.shape).join(',');
    const resposta = await gh(
        pasta,
        ['pr', 'view', String(pr.numero), '--repo', pr.repositorio, '--json', campos],
        true,
    );
    const bruto = JSON.parse(resposta);
    const repositorio = bruto.url?.toLowerCase() === pr.url.toLowerCase() ? pr.repositorio
        : await resolverRepositorioGitHub(pasta, pr.repositorio);
    return converterDetalhesPullRequest(bruto, `https://github.com/${repositorio}/pull/${pr.numero}`);
}

/** Obtém os patches paginados do PR, preservando arquivos binários sem um diff textual. */
export async function lerArquivosPullRequest(pasta: string, url: string): Promise<ArquivoPullRequest[]> {
    const pr = interpretarPullRequest(url);
    if (!pr) throw new Error('Endereço de pull request inválido.');
    const saida = await gh(
        pasta,
        ['api', `repos/${pr.repositorio}/pulls/${pr.numero}/files?per_page=100`, '--paginate', '--slurp'],
        true,
    );
    const arquivoBruto = z.object({
        filename: z.string(),
        status: z.string(),
        additions: z.number(),
        deletions: z.number(),
        patch: z.string().optional(),
    });
    const paginas = z.array(z.array(arquivoBruto)).parse(JSON.parse(saida));
    return paginas.flat().map((item) =>
        esquemaArquivoPullRequest.parse({
            caminho: item.filename,
            estado: item.status,
            adicoes: item.additions,
            remocoes: item.deletions,
            patch: item.patch ?? null,
        }),
    );
}

/** Mescla exclusivamente a revisão confirmada pelo usuário, sem remover branches ou ignorar regras do GitHub. */
export async function mesclarPullRequest(
    pasta: string,
    url: string,
    sha: string,
    metodo: MetodoMesclagem,
): Promise<DetalhesPullRequest> {
    esquemaShaPullRequest.parse(sha);
    esquemaMetodoMesclagem.parse(metodo);
    const detalhes = await lerDetalhesPullRequest(pasta, url);
    if (detalhes.sha !== sha) throw new Error('O PR recebeu novos commits. Atualize e confira antes de mesclar.');
    const impedimento = impedimentoMesclagem(detalhes);
    if (impedimento) throw new Error(impedimento);
    await gh(pasta, [
        'pr',
        'merge',
        String(detalhes.pr.numero),
        '--repo',
        detalhes.pr.repositorio,
        `--${metodo}`,
        '--match-head-commit',
        sha,
    ]);
    return lerDetalhesPullRequest(pasta, url);
}
