import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buscaGitHub, lerNumstat, repositorioGitHub, type ItemGitHub } from '../shared/repositorio';
import { converterItensGitHub, repositoriosDoProjeto } from '../electron/services/repositorio';
import { descobrirPastasRepositorios } from '../electron/services/descobertaRepositorios';
import {
    agruparItensGitHub,
    ordenarItensGitHub,
    tempoRelativo,
    unirItensGitHub,
} from '../src/components/listaGitHub';

describe('repositorioGitHub', () => {
    test('reconhece remotos HTTPS e SSH', () => {
        expect(repositorioGitHub('https://github.com/levigarciia/Selene.git')).toBe('levigarciia/Selene');
        expect(repositorioGitHub('git@github.com:pingdotgg/t3code.git')).toBe('pingdotgg/t3code');
        expect(repositorioGitHub('https://github.com/dono/repo.js')).toBe('dono/repo.js');
    });

    test('ignora outros hosts', () => {
        expect(repositorioGitHub('https://gitlab.com/dono/repo.git')).toBeNull();
    });
});

describe('descoberta de repositórios do projeto', () => {
    test('encontra repositórios internos, ignora dependências e deduplica remotos', async () => {
        const pasta = await mkdtemp(join(tmpdir(), 'selene-repositorios-'));
        const criar = async (nome: string, remoto: string | null, nomeRemoto = 'origin') => {
            const caminho = join(pasta, nome);
            await mkdir(caminho, { recursive: true });
            execFileSync('git', ['init', '-q', caminho]);
            if (remoto) execFileSync('git', ['-C', caminho, 'remote', 'add', nomeRemoto, remoto]);
            return caminho;
        };
        try {
            const api = await criar('API', 'https://github.com/dono/api.git');
            await criar('plugins/Plugin', 'git@github.com:dono/plugin.git', 'upstream');
            await criar('Copia', 'https://github.com/dono/api.git');
            await criar('SemRemoto', null);
            await criar('node_modules/Dependencia', 'https://github.com/dono/ignorado.git');
            await criar('output/Gerado', 'https://github.com/dono/ignorado.git');
            await symlink(pasta, join(pasta, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
            const resultado = await repositoriosDoProjeto(pasta);
            expect(resultado.repositorios.map((item) => item.github).sort()).toEqual(['dono/api', 'dono/plugin']);
            expect(resultado.avisos).toEqual(['SemRemoto: nenhum remoto no GitHub.']);
            await mkdir(join(api, 'src'));
            expect((await repositoriosDoProjeto(join(api, 'src'))).repositorios[0].github).toBe('dono/api');
        } finally {
            await rm(pasta, { recursive: true, force: true });
        }
    });

    test('reconhece o arquivo .git de um worktree', async () => {
        const pasta = await mkdtemp(join(tmpdir(), 'selene-worktree-'));
        try {
            const principal = join(pasta, 'Principal');
            const worktree = join(pasta, 'Worktree');
            execFileSync('git', ['init', '-q', principal]);
            execFileSync('git', ['-C', principal, '-c', 'user.name=Teste', '-c', 'user.email=teste@example.com',
                'commit', '--allow-empty', '-qm', 'Inicial']);
            execFileSync('git', ['-C', principal, 'remote', 'add', 'origin', 'https://github.com/dono/projeto.git']);
            execFileSync('git', ['-C', principal, 'worktree', 'add', '-qb', 'teste', worktree]);
            expect((await descobrirPastasRepositorios(pasta)).pastas).toContain(worktree);
            expect((await repositoriosDoProjeto(worktree)).repositorios[0].github).toBe('dono/projeto');
        } finally {
            await rm(pasta, { recursive: true, force: true });
        }
    });
});

describe('lerNumstat', () => {
    test('soma linhas e trata binários como zero', () => {
        expect(lerNumstat('3\t1\tsrc/a.ts\n-\t-\timagem.png\n')).toEqual([
            { caminho: 'src/a.ts', adicoes: 3, remocoes: 1 },
            { caminho: 'imagem.png', adicoes: 0, remocoes: 0 },
        ]);
    });
});

describe('converterItensGitHub', () => {
    test('normaliza estados e rótulos de pull requests', () => {
        const itens = converterItensGitHub(
            JSON.stringify([
                {
                    number: 7,
                    title: 'Rascunho',
                    url: 'https://github.com/a/b/pull/7',
                    author: { login: 'levi' },
                    state: 'OPEN',
                    isDraft: true,
                    createdAt: '2026-10-01T00:00:00Z',
                    updatedAt: '2026-10-12T00:00:00Z',
                    labels: [{ name: 'bug', color: 'd73a4a' }],
                },
                {
                    number: 8,
                    title: 'Mesclado',
                    url: 'https://github.com/a/b/pull/8',
                    author: null,
                    state: 'MERGED',
                    createdAt: '2026-10-01T00:00:00Z',
                    updatedAt: '2026-10-12T00:00:00Z',
                },
            ]),
            'a/b',
        );
        expect(itens.map((item) => item.estado)).toEqual(['rascunho', 'mesclado']);
        expect(itens[0].repositorio).toBe('a/b');
        expect(itens[0].rotulos).toEqual([{ nome: 'bug', cor: 'd73a4a' }]);
        expect(itens[1].autor).toBeNull();
    });

    test('recusa respostas que não são listas', () => {
        expect(() => converterItensGitHub('{}', 'a/b')).toThrow();
    });
});

describe('buscaGitHub', () => {
    test('traduz envolvimento em qualificadores da busca', () => {
        expect(buscaGitHub({ tipo: 'pr', estado: 'open', envolvimento: 'revisao', busca: ' label:bug ' })).toEqual({
            estado: 'open',
            busca: 'review-requested:@me label:bug',
        });
    });

    test('issues não têm revisão nem estado mesclado', () => {
        expect(buscaGitHub({ tipo: 'issue', estado: 'merged', envolvimento: 'revisao', busca: '' })).toEqual({
            estado: 'closed',
            busca: '',
        });
    });
});

function item(numero: number, parcial: Partial<ItemGitHub> = {}): ItemGitHub {
    return {
        repositorio: 'a/b',
        numero,
        titulo: `Item ${numero}`,
        url: `https://github.com/a/b/pull/${numero}`,
        autor: null,
        estado: 'aberto',
        criadoEm: '2026-10-01T00:00:00Z',
        atualizadoEm: '2026-10-01T00:00:00Z',
        rotulos: [],
        ...parcial,
    };
}

describe('lista do GitHub', () => {
    test('une projetos do mesmo repositório sem repetir itens', () => {
        expect(unirItensGitHub([[item(1), item(2)], [item(2)]]).map((atual) => atual.numero)).toEqual([1, 2]);
    });

    test('ordena e agrupa por repositório', () => {
        const itens = [
            item(1, { atualizadoEm: '2026-10-02T00:00:00Z' }),
            item(2, { repositorio: 'c/d', atualizadoEm: '2026-10-03T00:00:00Z' }),
            item(3, { atualizadoEm: '2026-10-04T00:00:00Z', adicoes: 10, remocoes: 5 }),
        ];
        const grupos = agruparItensGitHub(ordenarItensGitHub(itens, 'atualizado'));
        expect(grupos.map((grupo) => [grupo.repositorio, grupo.itens.map((atual) => atual.numero)])).toEqual([
            ['a/b', [3, 1]],
            ['c/d', [2]],
        ]);
        expect(ordenarItensGitHub(itens, 'maior')[0].numero).toBe(3);
    });

    test('formata tempo relativo curto', () => {
        const agora = Date.parse('2026-10-12T12:00:00Z');
        expect(tempoRelativo('2026-10-12T11:30:00Z', agora)).toBe('30 min');
        expect(tempoRelativo('2026-10-10T12:00:00Z', agora)).toBe('2 d');
    });
});
