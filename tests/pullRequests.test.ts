import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { esquemaConversa, esquemaDados, type Acao } from '../shared/contratos';
import {
    interpretarPullRequest,
    recuperarPullRequests,
    vincularPullRequest,
    desvincularPullRequest,
} from '../shared/pullRequests';
import { Persistencia } from '../electron/services/persistencia';
import { LinkPullRequest } from '../src/components/PullRequestsConversa';
import { obterFerramentas, prepararFerramenta } from '../electron/services/ferramentas';

const url = 'https://github.com/levigarciia/Selene/pull/1';
const criarConversa = (acoes: Acao[] = []) =>
    esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'PR de teste',
        modo: 'code',
        atualizadoEm: new Date().toISOString(),
        mensagens: [
            {
                id: randomUUID(),
                papel: 'assistant',
                texto: `Criei ${url}`,
                estado: 'concluida',
                criadoEm: new Date().toISOString(),
                acoes,
            },
        ],
    });
const criarAcao = (parcial: Partial<Acao> = {}): Acao => ({
    id: randomUUID(),
    nome: 'executar_terminal',
    estado: 'concluida',
    argumentos: { comando: 'gh pr create --title Teste --body Teste' },
    resultado: `Código de saída: 0\n${url}\n`,
    ...parcial,
});

describe('vínculo de PR por conversa', () => {
    test('as ferramentas explícitas listam e removem vínculos sem restaurá los pela recuperação', async () => {
        const conversa = criarConversa([criarAcao()]);
        vincularPullRequest(conversa, url);
        const listar = await prepararFerramenta('listar_pull_requests', {}, conversa);
        expect(JSON.parse(await listar.executar(new AbortController().signal)).pullRequests[0].url).toBe(url);
        const remover = await prepararFerramenta('desvincular_pull_request', { url }, conversa);
        await remover.executar(new AbortController().signal);
        expect(conversa.pullRequests).toEqual([]);
        expect(recuperarPullRequests(conversa)).toBe(false);
        desvincularPullRequest(conversa, url);
        expect(conversa.pullRequests).toEqual([]);
    });

    test('aceita apenas links exatos de PR e normaliza a barra final', () => {
        expect(interpretarPullRequest(`${url}/`)?.url).toBe(url);
        for (const invalida of [
            'https://github.com.evil.test/a/b/pull/1',
            'https://evilgithub.com/a/b/pull/1',
            'https://github.com/a/b/issues/1',
            `${url}/files`,
            'https://github.com/a/b/pull/new/teste',
            'https://github.com/a/b/pull/0',
            'https://github.com/a/b/pull/999999999999999999999',
        ])
            expect(interpretarPullRequest(invalida)).toBeNull();
    });

    test('recupera ações reais, sem duplicar nem depender do texto final do assistente', () => {
        const conversa = criarConversa([criarAcao(), criarAcao()]);
        conversa.mensagens[0].texto = '';
        expect(recuperarPullRequests(conversa)).toBe(true);
        expect(recuperarPullRequests(conversa)).toBe(false);
        expect(conversa.pullRequests).toHaveLength(1);
        expect(conversa.pullRequests?.[0].url).toBe(url);
        expect(vincularPullRequest(conversa, url.toLowerCase())).toBe(false);
    });

    test('não vincula comandos recusados, falhas, listagens, arquivos ou afirmações do assistente', () => {
        const conversa = criarConversa([
            criarAcao({ estado: 'recusada' }),
            criarAcao({ estado: 'erro' }),
            criarAcao({ resultado: `Código de saída: 1\n${url}` }),
            criarAcao({ argumentos: { comando: 'gh pr list' } }),
            criarAcao({ nome: 'ler_arquivo' }),
            criarAcao({ resultado: `${url}/files` }),
        ]);
        expect(recuperarPullRequests(conversa)).toBe(false);
        expect(conversa.pullRequests).toBeUndefined();
        conversa.modo = 'chat';
        expect(() => vincularPullRequest(conversa, url)).toThrow('Code');
        expect(recuperarPullRequests(conversa)).toBe(false);
    });

    test('recupera a saída estruturada de ferramentas de criação externas', () => {
        const conversa = criarConversa([
            criarAcao({
                nome: 'mcp__github__create_pull_request',
                argumentos: {},
                resultado: JSON.stringify({ html_url: url }),
            }),
        ]);
        expect(recuperarPullRequests(conversa)).toBe(true);
    });

    test('migra o histórico antigo e mantém o vínculo e o estado após reabrir os dados', async () => {
        const pasta = await mkdtemp(join(tmpdir(), 'selene-prs-'));
        try {
            const conversa = criarConversa([criarAcao()]);
            const dados = esquemaDados.parse({
                versao: 1,
                configuracao: {},
                modelos: [],
                conversas: [conversa],
            });
            await writeFile(join(pasta, 'selene.json'), JSON.stringify(dados));
            const persistencia = new Persistencia(pasta);
            await persistencia.abrir();
            const pr = persistencia.dados.conversas[0].pullRequests?.[0];
            expect(pr?.url).toBe(url);
            pr!.estado = 'mesclado';
            await persistencia.salvar();
            const reaberta = new Persistencia(pasta);
            await reaberta.abrir();
            expect(reaberta.dados.conversas[0].pullRequests?.[0].estado).toBe('mesclado');
            expect(reaberta.dados.conversas[0].mensagens).toEqual(conversa.mensagens);
        } finally {
            await rm(pasta, { recursive: true, force: true });
        }
    });

    test('o agente oferece vínculo somente em Code e recusa URLs de outros hosts antes da consulta', async () => {
        expect(obterFerramentas('code', false).some((item) => item.function.name === 'vincular_pull_request')).toBe(
            true,
        );
        expect(obterFerramentas('chat', false).some((item) => item.function.name === 'vincular_pull_request')).toBe(
            false,
        );
        await expect(
            prepararFerramenta('vincular_pull_request', { url: 'https://evil.test/a/b/pull/1' }, criarConversa()),
        ).rejects.toThrow();
    });

    test('o link identifica o repositório e distingue estado desconhecido de estado consultado', () => {
        const pr = interpretarPullRequest(url)!;
        const desconhecido = renderToStaticMarkup(createElement(LinkPullRequest, { pr }));
        expect(desconhecido).toContain('Estado ainda não consultado');
        expect(desconhecido).toContain('Pull request levigarciia/Selene #1');
        expect(desconhecido).toContain(`href="${url}"`);
        const mesclado = renderToStaticMarkup(createElement(LinkPullRequest, { pr: { ...pr, estado: 'mesclado' } }));
        expect(mesclado).toContain('Mesclado');
        expect(mesclado).toContain('text-[#b5a2dc]');
    });
});
