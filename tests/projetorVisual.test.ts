import { afterEach, expect, test } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararProjetorVisual } from '../electron/services/projetorVisual';
import { catalogoModelos, type ModeloCatalogo } from '../shared/catalogo';

const pastas: string[] = [];
const bytes = Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(64, 12)]);
const item: ModeloCatalogo = {
    ...catalogoModelos[2],
    projetorVisual: {
        arquivo: 'mmproj-F16.gguf',
        tamanho: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    },
};
const modelo = {
    id: randomUUID(),
    nome: item.nome,
    caminho: `C:/modelos/${item.arquivo}`,
    tamanho: item.tamanho,
};

afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});

test('prepara visão de importação reconhecida e cadastro antigo, reutilizando o arquivo íntegro', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-visao-'));
    pastas.push(pasta);
    let transferencias = 0;
    const transferir = async (url: string) => {
        expect(url).toBe(`https://huggingface.co/${item.repositorio}/resolve/${item.revisao}/mmproj-F16.gguf`);
        transferencias++;
        return new Response(bytes);
    };
    const caminho = await prepararProjetorVisual(pasta, modelo, new AbortController().signal, () => {}, transferir, [
        item,
    ]);
    expect(await readFile(caminho!)).toEqual(bytes);
    expect(
        await prepararProjetorVisual(
            pasta,
            { ...modelo, catalogoId: item.id },
            new AbortController().signal,
            () => {},
            transferir,
            [item],
        ),
    ).toBe(caminho);
    expect(transferencias).toBe(1);
});

test('preserva projetor manual e não atribui visão pelo nome de um modelo desconhecido', async () => {
    const transferir = async () => {
        throw new Error('Download inesperado');
    };
    expect(
        await prepararProjetorVisual(
            '',
            { ...modelo, projetorVisual: 'C:/manual.gguf' },
            new AbortController().signal,
            () => {},
            transferir,
            [item],
        ),
    ).toBe('C:/manual.gguf');
    expect(
        await prepararProjetorVisual(
            '',
            { ...modelo, caminho: 'C:/outro.gguf' },
            new AbortController().signal,
            () => {},
            transferir,
            [item],
        ),
    ).toBeUndefined();
});

test('cancelamento do suporte visual remove o parcial e permite uma nova tentativa', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-visao-'));
    pastas.push(pasta);
    const controle = new AbortController();
    await expect(
        prepararProjetorVisual(
            pasta,
            modelo,
            controle.signal,
            (fase, recebido) => {
                if (fase === 'baixando' && recebido) controle.abort();
            },
            async () => new Response(bytes),
            [item],
        ),
    ).rejects.toThrow();
    expect(await readdir(pasta)).toEqual([]);
    expect(
        await prepararProjetorVisual(
            pasta,
            modelo,
            new AbortController().signal,
            () => {},
            async () => new Response(bytes),
            [item],
        ),
    ).toBe(join(pasta, `${item.id}.mmproj.gguf`));
});
