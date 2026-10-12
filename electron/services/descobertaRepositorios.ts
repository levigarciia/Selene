import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const PASTAS_IGNORADAS = new Set([
    'node_modules', 'vendor', 'target', 'dist', 'dist-electron', 'build', 'output',
    '.git', '.next', '.cache', '.venv', 'venv', '.gradle', '.kotlin',
]);
const PROFUNDIDADE_MAXIMA = 6;
const LIMITE_PASTAS = 2000;

/** Descobre raízes Git internas sem atravessar links, dependências ou a árvore de um repositório encontrado. */
export async function descobrirPastasRepositorios(pasta: string): Promise<{
    pastas: string[];
    avisos: string[];
}> {
    const pastas: string[] = [];
    const avisos: string[] = [];
    const pendentes = [{ caminho: pasta, profundidade: 0 }];
    let visitadas = 0;
    while (pendentes.length) {
        if (visitadas >= LIMITE_PASTAS) {
            avisos.push('A busca atingiu o limite de pastas. Abra uma pasta mais específica para encontrar as demais.');
            break;
        }
        const atual = pendentes.shift()!;
        visitadas += 1;
        const entradas = await readdir(atual.caminho, { withFileTypes: true }).catch((erro: NodeJS.ErrnoException) => {
            if (atual.profundidade === 0) throw erro;
            avisos.push(`${relative(pasta, atual.caminho)}: não foi possível examinar a pasta (${erro.code}).`);
            return [];
        });
        if (entradas.some((entrada) => entrada.name === '.git' && !entrada.isSymbolicLink())) {
            pastas.push(atual.caminho);
            continue;
        }
        const filhas = entradas.filter((entrada) => entrada.isDirectory()
            && !entrada.isSymbolicLink() && !PASTAS_IGNORADAS.has(entrada.name.toLowerCase()));
        if (atual.profundidade >= PROFUNDIDADE_MAXIMA) {
            if (filhas.length) avisos.push(`${relative(pasta, atual.caminho)}: limite de profundidade da busca atingido.`);
            continue;
        }
        filhas.sort((a, b) => a.name.localeCompare(b.name));
        for (const filha of filhas) {
            pendentes.push({ caminho: join(atual.caminho, filha.name), profundidade: atual.profundidade + 1 });
        }
    }
    return { pastas, avisos };
}
