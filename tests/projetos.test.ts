import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConversa } from '../shared/contratos';
import { prepararPastaTrabalho } from '../electron/services/projetos';
import {
    cadastrarProjeto,
    criarProjetoGerenciado,
    migrarProjetos,
    validarUrlRepositorio,
} from '../electron/services/projetos';
import { esquemaDados } from '../shared/contratos';
import { prepararFerramenta } from '../electron/services/ferramentas';
import { Persistencia } from '../electron/services/persistencia';

const pastas: string[] = [];
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

test('conversas sem projeto isolam arquivos, exigem aprovação e retomam a mesma pasta', async () => {
    const dados = await mkdtemp(join(tmpdir(), 'selene-projetos-'));
    pastas.push(dados);
    const criar = () =>
        esquemaConversa.parse({
            id: randomUUID(),
            titulo: 'Sem projeto',
            modo: 'code',
            atualizadoEm: new Date().toISOString(),
        });
    const primeira = criar();
    const segunda = criar();
    const pasta = await prepararPastaTrabalho(primeira, dados);
    const outra = await prepararPastaTrabalho(segunda, dados);
    expect(pasta).not.toBe(outra);
    expect(primeira.projeto).toBeNull();
    const escrita = await prepararFerramenta(
        'escrever_arquivo',
        {
            caminho: 'exemplo.txt',
            conteudo: 'Persistente',
        },
        primeira,
    );
    expect(escrita.aprovacao).toBe(true);
    await escrita.executar(new AbortController().signal);
    expect(await readFile(join(pasta, 'exemplo.txt'), 'utf8')).toBe('Persistente');
    const leituraExterna = await prepararFerramenta(
        'ler_arquivo',
        {
            caminho: join(pasta, 'exemplo.txt'),
        },
        segunda,
    );
    await expect(leituraExterna.executar(new AbortController().signal)).rejects.toThrow('fora do projeto');
    const persistencia = new Persistencia(dados);
    persistencia.dados.conversas.push(primeira);
    await persistencia.salvar();
    const reaberta = new Persistencia(dados);
    await reaberta.abrir();
    expect(await prepararPastaTrabalho(reaberta.dados.conversas[0], dados)).toBe(pasta);
    const leitura = await prepararFerramenta('ler_arquivo', { caminho: 'exemplo.txt' }, primeira);
    expect(leitura.aprovacao).toBe(false);
    expect(await leitura.executar(new AbortController().signal)).toContain('Persistente');
    primeira.id = '../fora';
    await expect(prepararPastaTrabalho(primeira, dados)).rejects.toThrow();
});

test('o cadastro deduplica pastas e preserva projetos sem conversas após reiniciar', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-cadastro-'));
    pastas.push(pasta);
    const dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
    const primeiro = await cadastrarProjeto(dados, pasta);
    expect((await cadastrarProjeto(dados, pasta)).id).toBe(primeiro.id);
    expect(dados.projetos).toHaveLength(1);
    const persistencia = new Persistencia(pasta);
    persistencia.dados = dados;
    await persistencia.salvar();
    const restaurada = new Persistencia(pasta);
    await restaurada.abrir();
    expect(restaurada.dados.projetos[0].id).toBe(primeiro.id);
    primeiro.oculto = true;
    expect((await cadastrarProjeto(dados, pasta)).oculto).toBe(false);
});

test('projetos legados são cadastrados uma vez e ligados às suas conversas', () => {
    const dados = esquemaDados.parse({
        versao: 1,
        configuracao: {},
        modelos: [],
        conversas: [
            {
                id: randomUUID(),
                titulo: 'Legado',
                modo: 'code',
                projeto: 'D:\\Projetos\\Legado',
                atualizadoEm: new Date().toISOString(),
            },
        ],
    });
    migrarProjetos(dados);
    migrarProjetos(dados);
    expect(dados.projetos).toHaveLength(1);
    expect(dados.conversas[0].projetoId).toBe(dados.projetos[0].id);
});

test('criar projetos reserva pastas próprias mesmo com nomes iguais ou caracteres de caminho', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-criacao-'));
    pastas.push(pasta);
    const dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
    const entrada = { tipo: 'criar' as const, nome: '../Projeto' };
    const primeiro = await criarProjetoGerenciado(dados, pasta, entrada);
    const segundo = await criarProjetoGerenciado(dados, pasta, entrada);
    expect(primeiro.caminho).not.toBe(segundo.caminho);
    expect(primeiro.caminho.startsWith(join(pasta, 'projects'))).toBe(true);
    expect(await readFile(join(primeiro.caminho, 'README.md'), 'utf8')).toContain('../Projeto');
    expect(dados.conversas).toHaveLength(0);
});

test('a clonagem recusa caminhos locais, opções e URLs com credenciais antes de executar Git', () => {
    for (const url of [
        'file:///C:/dados',
        '--upload-pack=malicioso',
        'http://github.com/a/b',
        'https://usuario:senha@github.com/a/b',
        'https://github.com/a/b?token=segredo',
    ]) {
        expect(() => validarUrlRepositorio(url)).toThrow();
    }
    expect(validarUrlRepositorio('https://github.com/octocat/Hello-World.git')).toBe(
        'https://github.com/octocat/Hello-World.git',
    );
});
