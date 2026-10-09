import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModeloCatalogo } from '../../shared/catalogo';
import type { DownloadModelo } from '../../shared/contratos';

type Transferir = (url: string, opcoes: { signal: AbortSignal }) => Promise<Response>;
type PublicarProgresso = (fase: 'baixando' | 'verificando', recebido: number) => void;

function validarItem(item: ModeloCatalogo): void {
    if (
        !/^[a-z0-9.-]+$/.test(item.id) ||
        !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(item.repositorio) ||
        !/^[a-zA-Z0-9_.-]+\.gguf$/.test(item.arquivo) ||
        !/^[a-f0-9]{40}$/.test(item.revisao) ||
        !/^[a-f0-9]{64}$/.test(item.sha256) ||
        !Number.isSafeInteger(item.tamanho) ||
        item.tamanho < 4
    ) {
        throw new Error('Dados inválidos no catálogo de modelos.');
    }
}

async function verificarExistente(caminho: string, item: ModeloCatalogo, sinal: AbortSignal): Promise<boolean> {
    const metadados = await stat(caminho).catch((erro: NodeJS.ErrnoException) => {
        if (erro.code === 'ENOENT') return null;
        throw erro;
    });
    if (!metadados || metadados.size !== item.tamanho) return false;
    const hash = createHash('sha256');
    for await (const trecho of createReadStream(caminho, { signal: sinal })) hash.update(trecho);
    sinal.throwIfAborted();
    return hash.digest('hex') === item.sha256;
}

/** Baixa uma edição fixa do catálogo e publica o GGUF somente após conferir tamanho e SHA 256. */
export async function baixarGguf(
    raiz: string,
    item: ModeloCatalogo,
    sinal: AbortSignal,
    progresso: PublicarProgresso,
    transferir: Transferir = fetch,
): Promise<string> {
    validarItem(item);
    await mkdir(raiz, { recursive: true });
    const destino = join(raiz, `${item.id}.gguf`);
    const parcial = `${destino}.part`;
    progresso('verificando', 0);
    if (await verificarExistente(destino, item, sinal)) return destino;
    sinal.throwIfAborted();
    const espaco = await statfs(raiz);
    if (espaco.bavail * espaco.bsize < item.tamanho + 64 * 1024 ** 2) {
        throw new Error('Espaço insuficiente no disco para baixar este modelo.');
    }
    const inatividade = new AbortController();
    const sinalDownload = AbortSignal.any([sinal, inatividade.signal]);
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const renovarPrazo = () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(
            () => inatividade.abort(new Error('O download ficou sem resposta. Tente novamente.')),
            60000,
        );
    };
    let resposta: Response | undefined;
    try {
        progresso('baixando', 0);
        renovarPrazo();
        const url = `https://huggingface.co/${item.repositorio}/resolve/${item.revisao}/${item.arquivo}`;
        resposta = await transferir(url, { signal: sinalDownload });
        if (!resposta.ok || !resposta.body) {
            throw new Error(`Não foi possível baixar o modelo: HTTP ${resposta.status}. Tente novamente.`);
        }
        const arquivo = await open(parcial, 'w');
        const hash = createHash('sha256');
        const assinatura = Buffer.alloc(4);
        let recebido = 0;
        try {
            for await (const trecho of resposta.body) {
                sinalDownload.throwIfAborted();
                renovarPrazo();
                if (recebido < 4) {
                    Buffer.from(trecho).copy(assinatura, recebido, 0, Math.min(4 - recebido, trecho.length));
                }
                recebido += trecho.length;
                if (recebido > item.tamanho) throw new Error('O arquivo excedeu o tamanho registrado no catálogo.');
                if (recebido >= 4 && assinatura.toString() !== 'GGUF') {
                    throw new Error('O servidor não retornou um arquivo GGUF válido.');
                }
                hash.update(trecho);
                await arquivo.writeFile(trecho);
                progresso('baixando', recebido);
            }
            clearTimeout(temporizador);
            sinal.throwIfAborted();
            progresso('verificando', recebido);
            if (recebido !== item.tamanho || hash.digest('hex') !== item.sha256) {
                throw new Error('O download não corresponde ao tamanho e SHA 256 do catálogo. Tente novamente.');
            }
            await arquivo.sync();
        } finally {
            await arquivo.close();
        }
        sinal.throwIfAborted();
        await rename(parcial, destino);
        return destino;
    } finally {
        clearTimeout(temporizador);
        if (resposta?.body && !resposta.body.locked) await resposta.body.cancel().catch(() => {});
        await rm(parcial, { force: true });
    }
}

/** Gerencia um download por vez e mantém progresso, cancelamento e erros acessíveis pela interface. */
export class DownloadsModelos {
    private estados = new Map<string, DownloadModelo>();
    private operacao: { id: string; controle: AbortController; tarefa: Promise<void> } | null = null;

    constructor(
        private readonly raiz: string,
        private readonly publicar: () => void,
        private readonly registrar: (item: ModeloCatalogo, caminho: string) => Promise<void>,
        private readonly transferir: Transferir = fetch,
    ) {}

    get estadosAtuais(): DownloadModelo[] {
        return [...this.estados.values()];
    }

    async preparar(itens: ModeloCatalogo[]): Promise<void> {
        await mkdir(this.raiz, { recursive: true });
        for (const item of itens) {
            validarItem(item);
            await rm(join(this.raiz, `${item.id}.gguf.part`), { force: true });
        }
    }

    iniciar(item: ModeloCatalogo): void {
        if (this.operacao) throw new Error('Aguarde o download atual ou cancele para baixar outro modelo.');
        const controle = new AbortController();
        const operacao = { id: item.id, controle, tarefa: Promise.resolve() };
        this.operacao = operacao;
        let ultimaPublicacao = 0;
        let ultimaFase = '';
        this.atualizar(item, 'baixando', 0);
        operacao.tarefa = baixarGguf(
            this.raiz,
            item,
            controle.signal,
            (fase, recebido) => {
                if (fase === ultimaFase && Date.now() - ultimaPublicacao < 200 && recebido !== item.tamanho) return;
                ultimaPublicacao = Date.now();
                ultimaFase = fase;
                this.atualizar(item, fase, recebido);
            },
            this.transferir,
        )
            .then(async (caminho) => {
                await this.registrar(item, caminho);
                this.atualizar(item, 'concluido', item.tamanho);
            })
            .catch((erro: unknown) => {
                const cancelado = controle.signal.aborted;
                const recebido = this.estados.get(item.id)?.recebido ?? 0;
                this.atualizar(
                    item,
                    cancelado ? 'cancelado' : 'erro',
                    recebido,
                    cancelado ? undefined : erro instanceof Error ? erro.message : 'Não foi possível baixar o modelo.',
                );
            })
            .finally(() => {
                this.operacao = null;
                this.publicar();
            });
    }

    cancelar(id: string): void {
        if (this.operacao?.id === id) this.operacao.controle.abort();
    }

    async encerrar(): Promise<void> {
        this.operacao?.controle.abort();
        await this.operacao?.tarefa;
    }

    private atualizar(item: ModeloCatalogo, fase: DownloadModelo['fase'], recebido: number, erro?: string): void {
        this.estados.set(item.id, { catalogoId: item.id, fase, recebido, total: item.tamanho, erro });
        this.publicar();
    }
}
