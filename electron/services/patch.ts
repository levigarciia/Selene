import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type Trecho = { contexto: string; anterior: string[]; novo: string[]; fim: boolean };
type Operacao = { tipo: 'Add' | 'Delete' | 'Update'; caminho: string; destino?: string; linhas: string[] };

function interpretarPatch(patch: string): Operacao[] {
    const linhas = patch.trim().replace(/\r\n/g, '\n').split('\n');
    if (linhas.shift() !== '*** Begin Patch' || linhas.pop() !== '*** End Patch') {
        throw new Error('O patch deve começar com *** Begin Patch e terminar com *** End Patch.');
    }
    const operacoes: Operacao[] = [];
    let atual: Operacao | undefined;
    for (const linha of linhas) {
        const cabecalho = /^\*\*\* (Add|Delete|Update) File: (.+)$/.exec(linha);
        if (cabecalho) {
            atual = { tipo: cabecalho[1] as Operacao['tipo'], caminho: cabecalho[2]!, linhas: [] };
            operacoes.push(atual);
            continue;
        }
        if (!atual) throw new Error('Operação ausente no patch.');
        if (linha.startsWith('*** Move to: ') && atual.tipo === 'Update' && !atual.linhas.length && !atual.destino) {
            atual.destino = linha.slice(13);
            if (!atual.destino.trim()) throw new Error('Destino de renomeação vazio.');
            continue;
        }
        atual.linhas.push(linha);
    }
    if (!operacoes.length || operacoes.length > 50) throw new Error('Envie entre 1 e 50 operações por patch.');
    return operacoes;
}

function interpretarTrechos(linhas: string[]): Trecho[] {
    const trechos: Trecho[] = [];
    let atual: Trecho | undefined;
    for (const linha of linhas) {
        if (linha === '@@' || linha.startsWith('@@ ')) {
            atual = { contexto: linha.slice(3), anterior: [], novo: [], fim: false };
            trechos.push(atual);
            continue;
        }
        if (!atual || atual.fim) throw new Error('Use @@ antes de cada trecho do patch.');
        if (linha === '*** End of File') {
            atual.fim = true;
            continue;
        }
        const prefixo = linha[0];
        if (![' ', '+', '-'].includes(prefixo ?? '')) throw new Error('Linha de patch inválida.');
        if (prefixo !== '+') atual.anterior.push(linha.slice(1));
        if (prefixo !== '-') atual.novo.push(linha.slice(1));
    }
    if (!trechos.length || trechos.some((trecho) => !trecho.anterior.length && !trecho.novo.length)) {
        throw new Error('O patch de atualização não contém alterações.');
    }
    return trechos;
}

function atualizarTexto(original: string, linhasPatch: string[]): string {
    const separador = original.includes('\r\n') ? '\r\n' : '\n';
    const linhas = original.replace(/\r\n/g, '\n').split('\n');
    const terminaEmQuebra = original.endsWith('\n');
    if (terminaEmQuebra) linhas.pop();
    let inicio = 0;
    for (const trecho of interpretarTrechos(linhasPatch)) {
        if (trecho.contexto) {
            const contexto = linhas.indexOf(trecho.contexto, inicio);
            if (contexto < 0) throw new Error(`Contexto ausente: ${trecho.contexto}`);
            inicio = contexto + 1;
        }
        const candidatos: number[] = [];
        for (let indice = inicio; indice <= linhas.length - trecho.anterior.length; indice += 1) {
            if (trecho.fim && indice + trecho.anterior.length !== linhas.length) continue;
            if (trecho.anterior.every((linha, deslocamento) => linha === linhas[indice + deslocamento])) {
                candidatos.push(indice);
            }
        }
        const posicao = trecho.anterior.length ? candidatos[0] : linhas.length;
        if (posicao === undefined || (trecho.anterior.length && candidatos.length !== 1)) {
            throw new Error('Trecho ausente ou ambíguo. Leia o arquivo e forneça mais linhas de contexto.');
        }
        linhas.splice(posicao, trecho.anterior.length, ...trecho.novo);
        inicio = posicao + trecho.novo.length;
    }
    return linhas.join(separador) + (terminaEmQuebra ? separador : '');
}

async function lerOriginal(caminho: string): Promise<string | null> {
    try {
        const conteudo = await readFile(caminho);
        if (conteudo.length > 2000000 || conteudo.includes(0)) throw new Error('Use arquivos de texto de até 2 MB.');
        return conteudo.toString('utf8');
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw erro;
    }
}

/** Prepara um patch contextual com prévia e revalidação dos arquivos após a aprovação. */
export async function prepararPatch(patch: string, resolver: (caminho: string) => Promise<string>) {
    const arquivos = new Map<string, { origem: string; original: string | null; novo: string | null }>();
    const caminhos = new Set<string>();
    const registrar = async (origem: string) => {
        const caminho = await resolver(origem);
        const identidade = process.platform === 'win32' ? caminho.toLowerCase() : caminho;
        if (caminhos.has(identidade)) throw new Error('Cada caminho pode aparecer apenas uma vez no patch.');
        caminhos.add(identidade);
        const original = await lerOriginal(caminho);
        const arquivo = { origem, original, novo: original };
        arquivos.set(caminho, arquivo);
        return arquivo;
    };
    for (const operacao of interpretarPatch(patch)) {
        const arquivo = await registrar(operacao.caminho);
        if (operacao.tipo === 'Add') {
            if (arquivo.original !== null) throw new Error('O arquivo já existe. Use Update File.');
            if (operacao.linhas.some((linha) => !linha.startsWith('+'))) throw new Error('Use + no novo arquivo.');
            arquivo.novo = operacao.linhas.map((linha) => linha.slice(1)).join('\n') + '\n';
            continue;
        }
        if (arquivo.original === null) throw new Error(`Arquivo ausente: ${operacao.caminho}`);
        if (operacao.tipo === 'Delete') {
            if (operacao.linhas.length) throw new Error('Delete File não aceita trechos.');
            arquivo.novo = null;
            continue;
        }
        const novo = atualizarTexto(arquivo.original, operacao.linhas);
        if (!operacao.destino) {
            arquivo.novo = novo;
            continue;
        }
        const destino = await registrar(operacao.destino);
        if (destino.original !== null) throw new Error('O destino da renomeação já existe.');
        destino.novo = novo;
        arquivo.novo = null;
    }
    return {
        previa: patch,
        executar: async (sinal: AbortSignal) => {
            for (const [caminho, arquivo] of arquivos) {
                sinal.throwIfAborted();
                if ((await resolver(arquivo.origem)) !== caminho || (await lerOriginal(caminho)) !== arquivo.original) {
                    throw new Error('O arquivo ou destino mudou após a aprovação. Prepare um novo patch.');
                }
            }
            const gravados: string[] = [];
            try {
                for (const [caminho, arquivo] of arquivos) {
                    sinal.throwIfAborted();
                    gravados.push(caminho);
                    if (arquivo.novo === null) await unlink(caminho);
                    else {
                        await mkdir(dirname(caminho), { recursive: true });
                        await writeFile(caminho, arquivo.novo, 'utf8');
                    }
                }
            } catch (erro) {
                for (const caminho of gravados.reverse()) {
                    const arquivo = arquivos.get(caminho)!;
                    if (arquivo.original === null) await rm(caminho, { force: true });
                    else await writeFile(caminho, arquivo.original, 'utf8');
                }
                throw erro;
            }
            return `Patch aplicado:\n${[...arquivos.keys()].join('\n')}`;
        },
    };
}
