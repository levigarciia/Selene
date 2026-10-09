import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executarProcesso } from './processos';
import type { BackendRuntime } from '../../shared/contratos';

const PACOTES = {
    cpu: {
        versao: 'b11521',
        arquivo: 'llama-b11521-bin-win-cpu-x64.zip',
        tamanho: 19518401,
        hash: '585e50796567090fbd84fc27f89a81c5138bf94be7218c385c31482a4fe945fb',
    },
    vulkan: {
        versao: 'b11521',
        arquivo: 'llama-b11521-bin-win-vulkan-x64.zip',
        tamanho: 33480922,
        hash: '1d3cdbea97f94d7aa1d2660aa6186f0121e2886ed59023348c68c51e3b0b9bbb',
    },
    rocm: {
        versao: 'b10327',
        arquivo: 'llama-b10327-bin-win-hip-radeon-x64.zip',
        tamanho: 324623983,
        hash: '79b8cf1c368cfd87222df5b1c18b81128b08d64a57b9d4e4ef21db7434eae1de',
    },
};

/** Encontra o executável dentro do pacote oficial extraído. */
export async function localizarServidor(pasta: string): Promise<string | null> {
    const entradas = await readdir(pasta, { withFileTypes: true }).catch(() => []);
    for (const entrada of entradas) {
        const caminho = join(pasta, entrada.name);
        if (entrada.isFile() && entrada.name === 'llama-server.exe') return caminho;
        if (entrada.isDirectory()) {
            const encontrado = await localizarServidor(caminho);
            if (encontrado) return encontrado;
        }
    }
    return null;
}

/** Instala uma distribuição oficial fixa, validando tamanho e SHA 256 antes de extrair. */
export async function instalarRuntime(
    raiz: string,
    backend: BackendRuntime,
    sinal: AbortSignal,
    progresso: (valor: number) => void,
): Promise<string> {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
        throw new Error('A instalação automática do MVP está disponível para Windows x64.');
    }
    const destino = pastaRuntime(raiz, backend);
    const existente = await localizarServidor(destino);
    if (existente) return existente;
    await mkdir(raiz, { recursive: true });
    const temporario = await mkdtemp(join(raiz, 'instalacao-'));
    const arquivoZip = join(temporario, 'pacote.zip');
    const pacote = PACOTES[backend];
    const url = `https://github.com/ggml-org/llama.cpp/releases/download/${pacote.versao}/${pacote.arquivo}`;
    try {
        const resposta = await fetch(url, { signal: AbortSignal.any([sinal, AbortSignal.timeout(300000)]) });
        if (!resposta.ok || !resposta.body) throw new Error(`Falha no download: HTTP ${resposta.status}.`);
        const arquivo = await open(arquivoZip, 'w');
        const hash = createHash('sha256');
        let recebido = 0;
        let ultimoProgresso = -1;
        try {
            for await (const trecho of resposta.body) {
                sinal.throwIfAborted();
                recebido += trecho.length;
                if (recebido > pacote.tamanho) throw new Error('Pacote maior que o tamanho oficial.');
                hash.update(trecho);
                await arquivo.writeFile(trecho);
                const atual = Math.round((recebido / pacote.tamanho) * 90);
                if (atual !== ultimoProgresso) {
                    ultimoProgresso = atual;
                    progresso(atual);
                }
            }
        } finally {
            await arquivo.close();
        }
        if (recebido !== pacote.tamanho || hash.digest('hex') !== pacote.hash) {
            throw new Error('O pacote não corresponde ao tamanho e checksum oficiais.');
        }
        const extraido = join(temporario, 'extraido');
        const extracao = await executarProcesso(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                'Expand-Archive -LiteralPath $env:SELENE_ZIP -DestinationPath $env:SELENE_DESTINO',
            ],
            temporario,
            sinal,
            { ...process.env, SELENE_ZIP: arquivoZip, SELENE_DESTINO: extraido },
        );
        if (extracao.codigo !== 0) throw new Error(`Falha na extração: ${extracao.saida}`);
        if (!(await localizarServidor(extraido))) throw new Error('O pacote não contém llama-server.exe.');
        await writeFile(join(extraido, 'origem.json'), JSON.stringify({ backend, url, ...pacote }));
        sinal.throwIfAborted();
        await rename(extraido, destino);
        progresso(100);
        const servidor = await localizarServidor(destino);
        if (!servidor) throw new Error('Motor instalado não encontrado.');
        return servidor;
    } finally {
        await rm(temporario, { recursive: true, force: true });
    }
}

/** Resolve o pacote versionado usado pela Selene, sem procurar componentes de outros aplicativos. */
export function pastaRuntime(raiz: string, backend: BackendRuntime): string {
    return join(raiz, `${PACOTES[backend].versao}-${backend}`);
}
