import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { resumirTurno, type AlteracoesTurno, type ParAlteracao } from '../../shared/alteracoesTurno';

/** Arquivos maiores que isto não são lidos; entram na lista sem contagem nem patch. */
const limiteLeitura = 2 * 1024 ** 2;
const limiteCapturaTurno = 32 * 1024 ** 2;
const uuid = z.string().uuid();

/** Conteúdo atual de um arquivo para comparação; arquivos grandes ou binários viram uma marca sem texto útil. */
async function lerParaComparar(caminho: string): Promise<string | null> {
    try {
        const metadados = await stat(caminho);
        if (!metadados.isFile()) return null;
        if (metadados.size > limiteLeitura) return `\0grande:${metadados.size}:${metadados.mtimeMs}`;
        const conteudo = await readFile(caminho);
        if (conteudo.includes(0)) return `\0binario:${metadados.size}:${metadados.mtimeMs}`;
        return conteudo.toString('utf8');
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw erro;
    }
}

function arquivoTurno(pastaBase: string, conversaId: string, mensagemId: string): string {
    return join(pastaBase, uuid.parse(conversaId), `${uuid.parse(mensagemId)}.json`);
}

/**
 * Registra as escritas feitas pelas ferramentas durante uma resposta. Guarda o conteúdo anterior na primeira
 * escrita de cada arquivo e o mais recente nas seguintes, então o card mostra a mudança líquida do turno.
 * Nunca consulta o Git: escritas fora das ferramentas, como as do terminal, tornam o registro parcial.
 */
export class RegistroAlteracoes {
    private readonly pares = new Map<string, ParAlteracao>();
    private readonly pendentesAntes = new Map<string, Promise<void>>();
    private parcial = false;
    private bytes = 0;

    constructor(
        private readonly pasta: string,
        private readonly aoAtualizar: (alteracoes: AlteracoesTurno) => void,
    ) {}

    /** Caminho exibido: relativo à pasta de trabalho quando dentro dela, absoluto quando fora. */
    rotulo(caminho: string): string {
        const absoluto = resolve(this.pasta, caminho);
        const relativo = relative(this.pasta, absoluto);
        const fora = !relativo || isAbsolute(relativo) || relativo === '..' || relativo.startsWith(`..${sep}`);
        return (fora ? absoluto : relativo).split(sep).join('/');
    }

    /** Registra uma escrita cujo conteúdo anterior e posterior a ferramenta já conhece. */
    registrar(caminho: string, antes: string | null, depois: string | null): void {
        const chave = this.rotulo(caminho);
        const existente = this.pares.get(chave);
        if (existente) existente.depois = depois;
        else if (this.reservar(antes, depois)) this.pares.set(chave, { antes, depois });
        this.publicar();
    }

    /** Fotografa o arquivo antes de uma ferramenta do harness escrever nele. */
    observarAntes(caminho: string): Promise<void> {
        const chave = this.rotulo(caminho);
        if (this.pares.has(chave)) return Promise.resolve();
        const pendente =
            this.pendentesAntes.get(chave) ??
            lerParaComparar(resolve(this.pasta, caminho))
                .then((antes) => {
                    if (!this.pares.has(chave) && this.reservar(antes, null)) {
                        this.pares.set(chave, { antes, depois: antes });
                    }
                })
                .catch(() => this.marcarParcial());
        this.pendentesAntes.set(chave, pendente);
        return pendente;
    }

    /** Lê o arquivo depois da escrita do harness; sem fotografia anterior, a captura fica parcial. */
    async observarDepois(caminho: string): Promise<void> {
        const chave = this.rotulo(caminho);
        await this.pendentesAntes.get(chave);
        const par = this.pares.get(chave);
        if (!par) return this.marcarParcial();
        try {
            par.depois = await lerParaComparar(resolve(this.pasta, caminho));
        } catch {
            this.parcial = true;
        }
        this.publicar();
    }

    marcarParcial(): void {
        if (this.parcial) return;
        this.parcial = true;
        if (this.pares.size) this.publicar();
    }

    get vazio(): boolean {
        return this.pares.size === 0;
    }

    /** Grava os patches do turno para leitura sob demanda, fora do histórico da conversa. */
    async salvar(pastaBase: string, conversaId: string, mensagemId: string): Promise<AlteracoesTurno | null> {
        await Promise.allSettled(this.pendentesAntes.values());
        const { alteracoes, patches } = resumirTurno(this.pares, this.parcial);
        if (!alteracoes.arquivos.length) return null;
        const destino = arquivoTurno(pastaBase, conversaId, mensagemId);
        await mkdir(join(destino, '..'), { recursive: true });
        await writeFile(destino, JSON.stringify(patches), 'utf8');
        return alteracoes;
    }

    private reservar(antes: string | null, depois: string | null): boolean {
        const tamanho = (antes?.length ?? 0) + (depois?.length ?? 0);
        if (this.bytes + tamanho > limiteCapturaTurno) {
            this.parcial = true;
            return false;
        }
        this.bytes += tamanho;
        return true;
    }

    private publicar(): void {
        this.aoAtualizar(resumirTurno(this.pares, this.parcial).alteracoes);
    }
}

/** Lê o patch salvo de um arquivo de um turno; `null` quando não foi guardado por exceder os limites. */
export async function lerPatchTurno(
    pastaBase: string,
    conversaId: string,
    mensagemId: string,
    caminho: string,
): Promise<string | null> {
    let conteudo: string;
    try {
        conteudo = await readFile(arquivoTurno(pastaBase, conversaId, mensagemId), 'utf8');
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw erro;
    }
    const patches = z.record(z.string(), z.string()).parse(JSON.parse(conteudo));
    return Object.hasOwn(patches, caminho) ? patches[caminho]! : null;
}

/** Remove os patches de uma conversa excluída. */
export async function excluirAlteracoesConversa(pastaBase: string, conversaId: string): Promise<void> {
    await rm(join(pastaBase, uuid.parse(conversaId)), { recursive: true, force: true });
    await rm(join(pastaBase, 'checkpoints', uuid.parse(conversaId)), { recursive: true, force: true });
}
