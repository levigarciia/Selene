import { expect, test } from 'bun:test';
import { converterDetalhesPullRequest } from '../electron/services/detalhesPullRequest';
import { impedimentoMesclagem } from '../shared/detalhesPullRequest';
import { instrucaoItemGitHub, esquemaItemGitHubNoChat } from '../shared/abrirItemGitHub';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaDados } from '../shared/contratos';
import { Persistencia } from '../electron/services/persistencia';
import { prepararFerramenta } from '../electron/services/ferramentas';

const url = 'https://github.com/dono/projeto/pull/7';
const resposta = {
    url,
    title: 'Correção',
    state: 'OPEN',
    body: 'Descrição',
    headRefName: 'correcao',
    baseRefName: 'main',
    headRefOid: 'a'.repeat(40),
    author: { login: 'dono' },
    updatedAt: '2026-10-12T12:00:00Z',
    changedFiles: 1,
    additions: 3,
    deletions: 1,
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: '',
    reviewRequests: [{ name: 'Equipe' }],
    labels: [{ name: 'bug' }],
    statusCheckRollup: [{ name: 'Testes', conclusion: 'SUCCESS', detailsUrl: null }],
    comments: [{ id: 'comentario', author: null, body: 'Revisado', createdAt: '2026-10-12T11:00:00Z' }],
    reviews: [
        {
            id: 'revisao',
            author: { login: 'revisor' },
            body: '',
            state: 'APPROVED',
            submittedAt: '2026-10-12T11:30:00Z',
        },
    ],
    commits: [
        {
            oid: 'a'.repeat(40),
            messageHeadline: 'Correção',
            committedDate: '2026-10-12T10:00:00Z',
            authors: [{ login: 'dono' }],
        },
    ],
};

test('valida o PR consultado e ordena eventos de fontes reais', () => {
    const detalhes = converterDetalhesPullRequest(resposta, url);
    expect(detalhes.pr.numero).toBe(7);
    expect(detalhes.verificacoes[0]).toEqual({ nome: 'Testes', estado: 'SUCCESS', url: null });
    expect(detalhes.atividade.map((item) => item.tipo)).toEqual(['commit', 'comentario', 'revisao']);
    expect(detalhes.revisores).toEqual(['Equipe']);
    expect(() => converterDetalhesPullRequest({ ...resposta, url: `${url}0` }, url)).toThrow('outro PR');
    expect(() => converterDetalhesPullRequest({ ...resposta, headRefOid: 'invalido' }, url)).toThrow();
});

test('mesclagem respeita rascunhos, conflitos e bloqueios sem presumir que o GitHub autorizará a escrita', () => {
    const detalhes = converterDetalhesPullRequest(resposta, url);
    expect(impedimentoMesclagem(detalhes)).toBeNull();
    expect(impedimentoMesclagem({ ...detalhes, rascunho: true })).toContain('rascunho');
    expect(impedimentoMesclagem({ ...detalhes, mesclavel: 'CONFLICTING' })).toContain('conflitos');
    expect(impedimentoMesclagem({ ...detalhes, situacaoMesclagem: 'BLOCKED' })).toContain('regras');
    expect(impedimentoMesclagem({ ...detalhes, pr: { ...detalhes.pr, estado: 'mesclado' } })).toContain(
        'não está aberto',
    );
});

test('novas conversas incluem a referência e a pasta exatas sem instruir mesclagem automática', () => {
    const pasta = 'D:/Dome Studios/DomeCode/DomeLauncher';
    const pr = instrucaoItemGitHub({ titulo: 'Correção', url }, 'pr', pasta);
    expect(pr).toContain('seguro para merge');
    expect(pr).toContain('antes de qualquer mesclagem');
    expect(pr).toContain(pasta);
    expect(pr).toContain(url);
    const issue = instrucaoItemGitHub(
        { titulo: 'Falha', url: 'https://github.com/dono/projeto/issues/22' },
        'issue',
        pasta,
    );
    expect(issue).toContain('Investigue essa issue');
    expect(esquemaItemGitHubNoChat.safeParse({ url: 'https://evil.test/a/b/pull/1' }).success).toBe(false);
});

test('o repositório interno mantém o projeto agregador ao reabrir e delimita as ferramentas', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-pr-pasta-'));
    try {
        const grupo = join(pasta, 'Grupo');
        const repositorio = join(grupo, 'Repositorio');
        await mkdir(repositorio, { recursive: true });
        await writeFile(join(repositorio, 'arquivo.txt'), 'Conteúdo');
        await writeFile(join(grupo, 'fora.txt'), 'Outro repositório');
        const projetoId = randomUUID();
        const dados = esquemaDados.parse({
            versao: 1,
            configuracao: {},
            modelos: [],
            projetos: [{ id: projetoId, nome: 'Grupo', caminho: grupo, criadoEm: new Date().toISOString() }],
            conversas: [
                {
                    id: randomUUID(),
                    titulo: 'Investigar issue',
                    modo: 'code',
                    projetoId,
                    projeto: grupo,
                    pastaRepositorio: repositorio,
                    atualizadoEm: new Date().toISOString(),
                },
            ],
        });
        await writeFile(join(pasta, 'selene.json'), JSON.stringify(dados));
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        expect(persistencia.dados.projetos).toHaveLength(1);
        const conversa = persistencia.dados.conversas[0];
        expect(conversa.projetoId).toBe(projetoId);
        expect(conversa.pastaRepositorio).toBe(repositorio);
        const leitura = await prepararFerramenta('ler_arquivo', { caminho: 'arquivo.txt' }, conversa);
        expect(await leitura.executar(new AbortController().signal)).toContain('Conteúdo');
        const externa = await prepararFerramenta('ler_arquivo', { caminho: '../fora.txt' }, conversa);
        await expect(externa.executar(new AbortController().signal)).rejects.toThrow('fora');
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});
