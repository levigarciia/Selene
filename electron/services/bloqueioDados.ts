import { open, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

/** Serializa gravações entre processos e recupera apenas bloqueios cujo processo já terminou. */
export async function comBloqueioDados<T>(caminho: string, executar: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        let arquivo;
        try {
            arquivo = await open(caminho, 'wx', 0o600);
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'EEXIST') throw erro;
            try {
                const bloqueio = JSON.parse(await readFile(caminho, 'utf8'));
                if (Number.isSafeInteger(bloqueio.pid) && bloqueio.pid > 0) {
                    try {
                        process.kill(bloqueio.pid, 0);
                    } catch (falha) {
                        if ((falha as NodeJS.ErrnoException).code === 'ESRCH') await unlink(caminho);
                    }
                }
            } catch (falha) {
                if ((falha as NodeJS.ErrnoException).code !== 'ENOENT' && !(falha instanceof SyntaxError)) throw falha;
            }
            await setTimeout(25);
            continue;
        }
        try {
            await arquivo.writeFile(JSON.stringify({ pid: process.pid, token }));
            await arquivo.sync();
        } catch (erro) {
            await arquivo.close();
            await unlink(caminho);
            throw erro;
        }
        await arquivo.close();
        try {
            return await executar();
        } finally {
            const atual = JSON.parse(await readFile(caminho, 'utf8'));
            if (atual.token === token) await unlink(caminho);
        }
    }
    throw new Error('Os dados estão em uso por outra instância da Selene.');
}
