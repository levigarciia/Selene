import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compararArquivo, limiteBytesArquivo, resumirTurno } from '../shared/alteracoesTurno';
import { lerPatchTurno, RegistroAlteracoes } from '../electron/services/alteracoesTurno';

const pastas: string[] = [];
async function pastaTemporaria() {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-alteracoes-'));
    pastas.push(pasta);
    return pasta;
}
afterEach(async () => {
    await Promise.all(pastas.splice(0).map((pasta) => rm(pasta, { recursive: true, force: true })));
});

const conversaId = '11111111-1111-4111-8111-111111111111';
const mensagemId = '22222222-2222-4222-8222-222222222222';

describe('comparação de arquivos', () => {
    test('conta linhas e classifica o tipo', () => {
        expect(compararArquivo('a.ts', { antes: 'um\ndois\n', depois: 'um\n2\ntres\n' })?.resumo).toEqual({
            caminho: 'a.ts',
            tipo: 'alterado',
            adicionadas: 2,
            removidas: 1,
        });
        expect(compararArquivo('b.ts', { antes: null, depois: 'x\n' })?.resumo.tipo).toBe('criado');
        expect(compararArquivo('c.ts', { antes: 'x\n', depois: null })?.resumo.tipo).toBe('removido');
        expect(compararArquivo('d.ts', { antes: 'x', depois: 'x' })).toBeNull();
    });

    test('arquivos grandes ou binários ficam sem contagem nem patch', () => {
        const grande = 'a'.repeat(limiteBytesArquivo);
        expect(compararArquivo('g', { antes: grande, depois: `${grande}b` })).toMatchObject({
            patch: null,
            resumo: { adicionadas: null },
        });
        expect(compararArquivo('b', { antes: '\0binario:1:1', depois: '\0binario:2:2' })?.patch).toBeNull();
    });

    test('mudança desfeita no mesmo turno some do resumo', () => {
        const { alteracoes } = resumirTurno(new Map([['a', { antes: 'x', depois: 'x' }]]), false);
        expect(alteracoes.arquivos).toEqual([]);
    });
});

describe('registro do turno', () => {
    test('mantém o conteúdo original e o mais recente entre várias escritas', async () => {
        const pasta = await pastaTemporaria();
        const registro = new RegistroAlteracoes(pasta, () => undefined);
        registro.registrar(join(pasta, 'src', 'a.ts'), 'v1\n', 'v2\n');
        registro.registrar(join(pasta, 'src', 'a.ts'), 'v2\n', 'v3\n');
        const alteracoes = await registro.salvar(join(pasta, 'base'), conversaId, mensagemId);
        expect(alteracoes?.arquivos).toEqual([{ caminho: 'src/a.ts', tipo: 'alterado', adicionadas: 1, removidas: 1 }]);
        const patch = await lerPatchTurno(join(pasta, 'base'), conversaId, mensagemId, 'src/a.ts');
        expect(patch).toContain('-v1');
        expect(patch).toContain('+v3');
    });

    test('fotografa arquivos do harness antes e depois', async () => {
        const pasta = await pastaTemporaria();
        const arquivo = join(pasta, 'b.txt');
        await writeFile(arquivo, 'antes\n');
        const registro = new RegistroAlteracoes(pasta, () => undefined);
        await registro.observarAntes(arquivo);
        await writeFile(arquivo, 'depois\n');
        await registro.observarDepois(arquivo);
        const alteracoes = await registro.salvar(join(pasta, 'base'), conversaId, mensagemId);
        expect(alteracoes?.arquivos[0]).toMatchObject({ caminho: 'b.txt', adicionadas: 1, removidas: 1 });
        expect(await readFile(arquivo, 'utf8')).toBe('depois\n');
    });

    test('escrita sem fotografia anterior torna o registro parcial', async () => {
        const pasta = await pastaTemporaria();
        const registro = new RegistroAlteracoes(pasta, () => undefined);
        registro.registrar('c.txt', null, 'novo\n');
        await registro.observarDepois(join(pasta, 'sem-antes.txt'));
        const alteracoes = await registro.salvar(join(pasta, 'base'), conversaId, mensagemId);
        expect(alteracoes?.parcial).toBe(true);
    });

    test('ids inválidos não montam caminhos', async () => {
        await expect(lerPatchTurno(tmpdir(), '../x', mensagemId, 'a')).rejects.toThrow();
    });
});
