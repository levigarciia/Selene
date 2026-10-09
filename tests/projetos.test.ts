import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { esquemaDados } from '../shared/contratos';
import { criarProjetoGerenciado } from '../electron/services/projetos';
import { tmpdir } from 'node:os';

const pastas: string[] = [];

test('criar projetos reserva pastas próprias mesmo com nomes iguais ou caracteres de caminho', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-criacao-'));
    pastas.push(pasta);
    const dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
    const entrada = { tipo: 'criar' as const, nome: '../Projeto' };
    const primeiro = await criarProjetoGerenciado(dados, pasta, entrada);
    const segundo = await criarProjetoGerenciado(dados, pasta, entrada);
    expect(primeiro.caminho).not.toBe(segundo.caminho);
    // Verifica que o caminho está dentro do contêiner 'projects'
    const caminhoRelativo = relative(pasta, primeiro.caminho);
    expect(caminhoRelativo).toContain('projects');
    expect(await readFile(join(primeiro.caminho, 'README.md'), 'utf8')).toContain('../Projeto');
    expect(dados.conversas).toHaveLength(0);
});
