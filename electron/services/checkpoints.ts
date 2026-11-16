import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { gravarAtomico } from './arquivosSeguros';
import { resolverCaminho } from './ferramentas';

const arquivos = z.record(z.string(), z.string());
const esquema = z.object({
    pasta: z.string(),
    antes: arquivos,
    depois: arquivos.nullable(),
    restaurado: z.boolean().default(false),
});
type Fotografia = Record<string, string>;
const limiteBytes = 128 * 1024 ** 2;

function listarGit(pasta: string): Promise<string[]> {
    return new Promise((resolver, rejeitar) => {
        const processo = spawn('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
            cwd: pasta,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const partes: Buffer[] = [];
        let tamanho = 0;
        const prazo = setTimeout(() => processo.kill(), 15000);
        processo.stdout.on('data', (parte: Buffer) => {
            tamanho += parte.length;
            if (tamanho > 8 * 1024 ** 2) processo.kill();
            else partes.push(parte);
        });
        processo.on('error', rejeitar);
        processo.on('close', (codigo) => {
            clearTimeout(prazo);
            if (codigo !== 0) return rejeitar(new Error('Checkpoint exige um repositório Git acessível.'));
            const caminhos = [...new Set(Buffer.concat(partes).toString('utf8').split('\0').filter(Boolean))];
            if (caminhos.length > 20000) return rejeitar(new Error('Checkpoint excede o limite de 20000 arquivos.'));
            resolver(caminhos);
        });
    });
}

async function fotografar(pasta: string): Promise<Fotografia> {
    const fotografia: Fotografia = {};
    let tamanho = 0;
    for (const caminho of await listarGit(pasta)) {
        const destino = await resolverCaminho(caminho, pasta, false);
        const dados = await stat(destino).catch((erro: NodeJS.ErrnoException) => {
            if (erro.code !== 'ENOENT') throw erro;
            return null;
        });
        if (!dados) continue;
        if (!dados.isFile()) throw new Error('Checkpoint não admite links, submódulos ou diretórios indexados.');
        tamanho += dados.size;
        if (tamanho > limiteBytes) throw new Error('Checkpoint excede o limite de 128 MB.');
        fotografia[caminho] = (await readFile(destino)).toString('base64');
    }
    return fotografia;
}

function diferencas(antes: Fotografia, depois: Fotografia): string[] {
    return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
        .filter((caminho) => antes[caminho] !== depois[caminho])
        .sort();
}

/** Guarda arquivos versionados e novos não ignorados para restaurar um turno após revisão explícita. */
export class Checkpoints {
    constructor(private readonly base: string) {}

    private caminho(conversaId: string, mensagemId: string): string {
        return join(this.base, z.uuid().parse(conversaId), `${z.uuid().parse(mensagemId)}.json`);
    }

    async capturar(conversaId: string, mensagemId: string, pasta: string): Promise<void> {
        const destino = this.caminho(conversaId, mensagemId);
        const raiz = await realpath(pasta);
        const antes = await fotografar(raiz);
        await mkdir(dirname(destino), { recursive: true });
        await gravarAtomico(destino, JSON.stringify({ pasta: raiz, antes, depois: null }));
        const anteriores = (await readdir(dirname(destino)))
            .filter((nome) => /^[a-f0-9-]{36}\.json$/.test(nome))
            .filter((nome) => nome !== `${mensagemId}.json`);
        const ordenados = await Promise.all(
            anteriores.map(async (nome) => ({
                nome,
                data: (await stat(join(dirname(destino), nome))).mtimeMs,
            })),
        );
        ordenados.sort((a, b) => b.data - a.data);
        for (const antigo of ordenados.slice(19)) {
            await unlink(join(dirname(destino), antigo.nome));
            await unlink(join(dirname(destino), `${antigo.nome}.antesRestauracao`)).catch(
                (erro: NodeJS.ErrnoException) => {
                    if (erro.code !== 'ENOENT') throw erro;
                },
            );
        }
    }

    async concluir(conversaId: string, mensagemId: string): Promise<void> {
        const destino = this.caminho(conversaId, mensagemId);
        const checkpoint = esquema.parse(JSON.parse(await readFile(destino, 'utf8')));
        checkpoint.depois = await fotografar(checkpoint.pasta);
        await gravarAtomico(destino, JSON.stringify(checkpoint));
    }

    async preparar(conversaId: string, mensagemId: string) {
        const checkpoint = esquema.parse(JSON.parse(await readFile(this.caminho(conversaId, mensagemId), 'utf8')));
        if (checkpoint.restaurado) throw new Error('Este turno já foi restaurado.');
        const atual = await fotografar(checkpoint.pasta);
        const caminhos = diferencas(checkpoint.antes, checkpoint.depois ?? atual);
        for (const caminho of caminhos) {
            if (checkpoint.depois && atual[caminho] !== checkpoint.depois[caminho]) {
                throw new Error(`Alteração posterior em ${caminho}. A restauração foi bloqueada.`);
            }
        }
        return {
            arquivos: caminhos,
            token: createHash('sha256').update(JSON.stringify(atual)).digest('hex'),
            interrompido: checkpoint.depois === null,
        };
    }

    async restaurar(conversaId: string, mensagemId: string, token: string): Promise<void> {
        const previa = await this.preparar(conversaId, mensagemId);
        if (previa.token !== token)
            throw new Error('Os arquivos mudaram após a prévia. Revise a restauração novamente.');
        const destino = this.caminho(conversaId, mensagemId);
        const checkpoint = esquema.parse(JSON.parse(await readFile(destino, 'utf8')));
        const atuais = await fotografar(checkpoint.pasta);
        await gravarAtomico(`${destino}.antesRestauracao`, JSON.stringify(atuais));
        const gravados: string[] = [];
        try {
            for (const caminho of previa.arquivos) {
                const absoluto = await resolverCaminho(caminho, checkpoint.pasta, false);
                const atual = await readFile(absoluto).catch((erro: NodeJS.ErrnoException) => {
                    if (erro.code !== 'ENOENT') throw erro;
                    return null;
                });
                if (atual?.toString('base64') !== atuais[caminho]) {
                    throw new Error(`O arquivo ${caminho} mudou durante a restauração.`);
                }
                gravados.push(caminho);
                if (checkpoint.antes[caminho] === undefined) await unlink(absoluto);
                else {
                    await mkdir(dirname(absoluto), { recursive: true });
                    await gravarAtomico(absoluto, Buffer.from(checkpoint.antes[caminho], 'base64'));
                }
            }
            checkpoint.restaurado = true;
            await gravarAtomico(destino, JSON.stringify(checkpoint));
        } catch (erro) {
            const conflitos: string[] = [];
            for (const caminho of gravados.reverse()) {
                try {
                    const absoluto = await resolverCaminho(caminho, checkpoint.pasta, false);
                    const encontrado = await readFile(absoluto).then((dados) => dados.toString('base64'))
                        .catch((falha: NodeJS.ErrnoException) => {
                            if (falha.code !== 'ENOENT') throw falha;
                            return undefined;
                        });
                    if (encontrado === atuais[caminho]) continue;
                    if (encontrado !== checkpoint.antes[caminho]) {
                        conflitos.push(caminho);
                        continue;
                    }
                    if (atuais[caminho] === undefined) await unlink(absoluto);
                    else await gravarAtomico(absoluto, Buffer.from(atuais[caminho], 'base64'));
                } catch {
                    conflitos.push(caminho);
                }
            }
            if (conflitos.length) {
                throw new Error('A restauração foi interrompida e alterações concorrentes foram preservadas. '
                    + 'A cópia anterior está em ' + `${destino}.antesRestauracao`, { cause: erro });
            }
            throw erro;
        }
    }
}
