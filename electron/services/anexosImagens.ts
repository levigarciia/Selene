import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validarAudio } from '../../shared/audio';
import {
    esquemaEntradaImagem,
    esquemaImagem,
    type Conversa,
    type EntradaImagem,
    type ImagemAnexada,
    type ImagemRascunho,
} from '../../shared/contratos';

type ImagemNormalizada = { bytes: Buffer; largura: number; altura: number };

/** Guarda cópias dos anexos e aceita apenas identificadores gerados pelo aplicativo. */
export class AnexosImagens {
    private readonly pendentes = new Map<string, ImagemAnexada>();

    constructor(
        private readonly pasta: string,
        private readonly conversas: () => Conversa[],
        private readonly normalizar: (bytes: Buffer) => ImagemNormalizada,
    ) {}

    /** Limpa rascunhos de sessões encerradas, mantendo todas as referências persistidas. */
    async preparar(): Promise<void> {
        await mkdir(this.pasta, { recursive: true });
        for (const arquivo of await readdir(this.pasta, { withFileTypes: true })) {
            if (!arquivo.isFile() || !/\.(jpg|wav)$/.test(arquivo.name)) continue;
            const id = arquivo.name.slice(0, -4);
            if (!esquemaImagem.shape.id.safeParse(id).success) continue;
            await this.excluirSemReferencia([id]);
        }
    }

    /** Importa imagens do compositor sem permitir caminhos fornecidos pelo renderer. */
    async importar(entradas: EntradaImagem[]): Promise<ImagemRascunho[]> {
        if (!entradas.length) throw new Error('Escolha ao menos um anexo.');
        const preparadas = entradas.map((entrada) => {
            const validada = esquemaEntradaImagem.parse(entrada);
            const bytes = Buffer.from(validada.dados.split(',')[1], 'base64');
            if (!bytes.length || bytes.length > 10 * 1024 ** 2) throw new Error('A imagem deve ter até 10 MB.');
            const audio = validada.dados.startsWith('data:audio/wav;');
            if (audio) validarAudio(bytes);
            const normalizada = audio ? { bytes, largura: undefined, altura: undefined } : this.normalizar(bytes);
            const imagem = esquemaImagem.parse({
                id: randomUUID(),
                nome: validada.nome,
                mime: audio ? 'audio/wav' : 'image/jpeg',
                tamanho: normalizada.bytes.length,
                largura: normalizada.largura,
                altura: normalizada.altura,
            });
            return { imagem, bytes: normalizada.bytes };
        });
        await mkdir(this.pasta, { recursive: true });
        const gravadas: string[] = [];
        try {
            for (const { imagem, bytes } of preparadas) {
                const extensao = imagem.mime === 'audio/wav' ? 'wav' : 'jpg';
                await writeFile(join(this.pasta, `${imagem.id}.${extensao}`), bytes, { flag: 'wx' });
                gravadas.push(imagem.id);
            }
        } catch (erro) {
            for (const id of gravadas) await this.excluirArquivos(id);
            throw erro;
        }
        return preparadas.map(({ imagem, bytes }) => {
            this.pendentes.set(imagem.id, imagem);
            return { ...imagem, previa: `data:${imagem.mime};base64,${bytes.toString('base64')}` };
        });
    }

    /** Resolve exclusivamente anexos importados neste processo ou referenciados no histórico. */
    obter(ids: string[]): ImagemAnexada[] {
        if (new Set(ids).size !== ids.length) throw new Error('Lista de imagens inválida.');
        return ids.map((id) => {
            const imagem =
                this.pendentes.get(id) ??
                this.conversas()
                    .flatMap((conversa) => conversa.mensagens.flatMap((mensagem) => mensagem.imagens ?? []))
                    .find((imagem) => imagem.id === id);
            if (!imagem) throw new Error('Imagem não encontrada. Anexe o arquivo novamente.');
            return esquemaImagem.parse(imagem);
        });
    }

    /** Lê uma cópia gerenciada para prévia ou inferência, inclusive depois de reiniciar. */
    async ler(id: string): Promise<string> {
        const [imagem] = this.obter([id]);
        const extensao = imagem.mime === 'audio/wav' ? 'wav' : 'jpg';
        const bytes = await readFile(join(this.pasta, `${imagem.id}.${extensao}`));
        if (bytes.length !== imagem.tamanho) throw new Error('O anexo foi alterado ou está incompleto.');
        if (imagem.mime === 'audio/wav') validarAudio(bytes);
        return `data:${imagem.mime};base64,${bytes.toString('base64')}`;
    }

    /** Remove rascunhos descartados, preservando qualquer imagem usada em uma conversa. */
    async descartar(ids: string[]): Promise<void> {
        for (const id of ids) {
            if (!this.pendentes.has(id)) continue;
            const usada = this.conversas().some((conversa) =>
                conversa.mensagens.some((mensagem) => mensagem.imagens?.some((imagem) => imagem.id === id)),
            );
            if (!usada) await this.excluirArquivos(id);
            this.pendentes.delete(id);
        }
    }

    /** Exclui cópias sem uso após remover uma conversa, preservando anexos compartilhados e rascunhos. */
    async excluirSemReferencia(ids: string[]): Promise<void> {
        for (const entrada of ids) {
            const id = esquemaImagem.shape.id.parse(entrada);
            if (this.pendentes.has(id)) continue;
            const usada = this.conversas().some((conversa) =>
                conversa.mensagens.some((mensagem) => mensagem.imagens?.some((imagem) => imagem.id === id)),
            );
            if (!usada) await this.excluirArquivos(id);
        }
    }

    private async excluirArquivos(id: string): Promise<void> {
        await Promise.all(['jpg', 'wav'].map((extensao) =>
            rm(join(this.pasta, `${id}.${extensao}`), { force: true })));
    }
}
