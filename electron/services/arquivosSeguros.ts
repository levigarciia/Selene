import { open, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

/** Grava dados com sincronização antes de substituir o destino, preservando o arquivo anterior em falhas. */
export async function gravarAtomico(caminho: string, conteudo: string | Buffer): Promise<void> {
    const temporario = `${caminho}.${randomUUID()}.tmp`;
    try {
        const modo = await stat(caminho)
            .then((dados) => dados.mode & 0o777)
            .catch((erro: NodeJS.ErrnoException) => {
                if (erro.code !== 'ENOENT') throw erro;
                return 0o600;
            });
        const arquivo = await open(temporario, 'wx', modo);
        try {
            await arquivo.writeFile(conteudo);
            await arquivo.sync();
        } finally {
            await arquivo.close();
        }
        await rename(temporario, caminho);
        if (process.platform !== 'win32') {
            const pasta = await open(dirname(caminho), 'r');
            try {
                await pasta.sync();
            } finally {
                await pasta.close();
            }
        }
    } finally {
        await rm(temporario, { force: true });
    }
}
