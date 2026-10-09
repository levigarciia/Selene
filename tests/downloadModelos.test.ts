import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { baixarGguf, DownloadsModelos } from '../electron/services/downloadModelos';
import { catalogoModelos, encontrarModeloLocal, type ModeloCatalogo } from '../shared/catalogo';
import { esquemaDados, type DownloadModelo } from '../shared/contratos';
import { Persistencia } from '../electron/services/persistencia';

const pastas: string[] = [];
const conteudo = Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(4096, 37)]);
const item: ModeloCatalogo = {
    ...catalogoModelos[0],
    id: 'modelo-teste',
    tamanho: conteudo.length,
    sha256: createHash('sha256').update(conteudo).digest('hex'),
};
async function criarPasta(): Promise<string> {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-download-'));
    pastas.push(pasta);
    return pasta;
}
afterEach(async () => {
    for (const pasta of pastas.splice(0)) await rm(pasta, { recursive: true, force: true });
});
async function aguardarFase(gerenciador: DownloadsModelos, fase: DownloadModelo['fase']): Promise<void> {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        if (gerenciador.estadosAtuais[0]?.fase === fase) {
            await esperar(0);
            return;
        }
        await esperar(10);
    }
    throw new Error(`O download não chegou à fase ${fase}.`);
}

describe('Download gerenciado de modelos', () => {
    test('aceita assinatura fragmentada e publica somente o arquivo íntegro de uma revisão fixa', async () => {
        const pasta = await criarPasta();
        const recebidos: number[] = [];
        let origem = '';
        const destino = await baixarGguf(
            pasta,
            item,
            new AbortController().signal,
            (_fase, recebido) => {
                recebidos.push(recebido);
            },
            async (url) => {
                origem = url;
                return new Response(
                    new ReadableStream({
                        start(controlador) {
                            controlador.enqueue(conteudo.subarray(0, 1));
                            controlador.enqueue(conteudo.subarray(1, 3));
                            controlador.enqueue(conteudo.subarray(3));
                            controlador.close();
                        },
                    }),
                );
            },
        );
        expect(origem).toContain(`/resolve/${item.revisao}/`);
        expect(await readFile(destino)).toEqual(conteudo);
        expect(await readdir(pasta)).toEqual(['modelo-teste.gguf']);
        expect(recebidos.at(-1)).toBe(item.tamanho);
    });

    test('recusa truncamento, conteúdo corrompido, arquivo excessivo, HTML e erro HTTP', async () => {
        const pasta = await criarPasta();
        const corrompido = Buffer.from(conteudo);
        corrompido[20] = 1;
        const respostas = [
            new Response(conteudo.subarray(0, 50)),
            new Response(corrompido),
            new Response(Buffer.concat([conteudo, Buffer.from('extra')])),
            new Response('<html>Falha do provedor</html>'),
            new Response('Indisponível', { status: 503 }),
        ];
        for (const resposta of respostas) {
            await expect(
                baixarGguf(
                    pasta,
                    item,
                    new AbortController().signal,
                    () => {},
                    async () => resposta,
                ),
            ).rejects.toThrow();
            expect(await readdir(pasta)).toEqual([]);
        }
    });

    test('cancelar remove o parcial sem registrar um modelo disponível', async () => {
        const pasta = await criarPasta();
        const controle = new AbortController();
        const promessa = baixarGguf(
            pasta,
            item,
            controle.signal,
            (fase, recebido) => {
                if (fase === 'baixando' && recebido > 0) controle.abort();
            },
            async (_url, { signal }) =>
                new Response(
                    new ReadableStream({
                        start(controlador) {
                            signal.addEventListener('abort', () => controlador.error(signal.reason), { once: true });
                            controlador.enqueue(conteudo.subarray(0, 100));
                        },
                    }),
                ),
        );
        await expect(promessa).rejects.toThrow();
        expect(await readdir(pasta)).toEqual([]);
    });

    test('limpa um parcial de sessão anterior e reaproveita download íntegro após falha ao salvar', async () => {
        const pasta = await criarPasta();
        await writeFile(join(pasta, 'modelo-teste.gguf.part'), 'parcial');
        let transferencias = 0;
        let registros = 0;
        const gerenciador = new DownloadsModelos(
            pasta,
            () => {},
            async () => {
                registros++;
                if (registros === 1) throw new Error('Falha de persistência');
            },
            async () => {
                transferencias++;
                return new Response(conteudo);
            },
        );
        await gerenciador.preparar([item]);
        expect(await readdir(pasta)).toEqual([]);
        gerenciador.iniciar(item);
        await aguardarFase(gerenciador, 'erro');
        expect(gerenciador.estadosAtuais[0].erro).toContain('Falha de persistência');
        gerenciador.iniciar(item);
        await aguardarFase(gerenciador, 'concluido');
        expect(transferencias).toBe(1);
        expect(registros).toBe(2);
    });

    test('impede downloads concorrentes e encerra a transferência ao sair do aplicativo', async () => {
        const pasta = await criarPasta();
        let registrou = false;
        const gerenciador = new DownloadsModelos(
            pasta,
            () => {},
            async () => {
                registrou = true;
            },
            async (_url, { signal }) => {
                signal.throwIfAborted();
                return new Response(
                    new ReadableStream({
                        start(controlador) {
                            signal.addEventListener('abort', () => controlador.error(signal.reason), { once: true });
                            controlador.enqueue(conteudo.subarray(0, 100));
                        },
                    }),
                );
            },
        );
        gerenciador.iniciar(item);
        expect(() => gerenciador.iniciar(item)).toThrow('download atual');
        await esperar(20);
        await gerenciador.encerrar();
        expect(gerenciador.estadosAtuais[0].fase).toBe('cancelado');
        expect(registrou).toBe(false);
        expect(await readdir(pasta)).toEqual([]);
    });

    test('rejeita nomes que escapam da pasta de modelos antes de acessar a rede', async () => {
        const pasta = await criarPasta();
        await expect(
            baixarGguf(pasta, { ...item, id: '../fora' }, new AbortController().signal, () => {}),
        ).rejects.toThrow('Dados inválidos');
        expect(await readdir(pasta)).toEqual([]);
    });

    test('dados antigos continuam válidos e favoritos sobrevivem ao reinício', async () => {
        const pasta = await criarPasta();
        const dados = esquemaDados.parse({ versao: 1, configuracao: {}, modelos: [], conversas: [] });
        expect(dados.favoritosCatalogo).toEqual([]);
        const persistencia = new Persistencia(pasta);
        await persistencia.abrir();
        persistencia.dados.favoritosCatalogo = [catalogoModelos[0].id];
        await persistencia.salvar();
        const reiniciada = new Persistencia(pasta);
        await reiniciada.abrir();
        expect(reiniciada.dados.favoritosCatalogo).toEqual([catalogoModelos[0].id]);
        const modelo = {
            id: crypto.randomUUID(),
            nome: item.nome,
            caminho: `C:/modelos/${item.arquivo}`,
            tamanho: item.tamanho,
        };
        expect(encontrarModeloLocal(item, [modelo])).toEqual(modelo);
        expect(encontrarModeloLocal(item, [{ ...modelo, tamanho: 1 }])).toBeUndefined();
    });
});
