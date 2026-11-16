import { z } from 'zod';
import { structuredPatch, formatPatch } from 'diff';

/** Limites do PandaCode: arquivos ou turnos maiores ficam com contagem desconhecida e sem patch salvo. */
export const limiteBytesArquivo = 256 * 1024;
export const limiteBytesTurno = 2 * 1024 ** 2;
export const limiteArquivosTurno = 200;

export const esquemaArquivoAlterado = z.object({
    caminho: z.string().min(1).max(4000),
    tipo: z.enum(['criado', 'alterado', 'removido']),
    adicionadas: z.number().int().nonnegative().nullable(),
    removidas: z.number().int().nonnegative().nullable(),
});
export type ArquivoAlterado = z.infer<typeof esquemaArquivoAlterado>;

export const esquemaAlteracoesTurno = z.object({
    arquivos: z.array(esquemaArquivoAlterado).max(limiteArquivosTurno),
    parcial: z.boolean().optional(),
});
export type AlteracoesTurno = z.infer<typeof esquemaAlteracoesTurno>;

/** Conteúdo de um arquivo antes e depois do turno; `null` indica que o arquivo não existia. */
export type ParAlteracao = { antes: string | null; depois: string | null };

export type DiffArquivo = { resumo: ArquivoAlterado; patch: string | null };

/** Compara as duas versões de um arquivo; devolve `null` quando o turno terminou sem mudança líquida. */
export function compararArquivo(caminho: string, par: ParAlteracao): DiffArquivo | null {
    if (par.antes === par.depois) return null;
    const tipo = par.antes === null ? 'criado' : par.depois === null ? 'removido' : 'alterado';
    const antes = par.antes ?? '';
    const depois = par.depois ?? '';
    if (antes.length + depois.length > limiteBytesArquivo || antes.includes('\0') || depois.includes('\0')) {
        return { resumo: { caminho, tipo, adicionadas: null, removidas: null }, patch: null };
    }
    const estruturado = structuredPatch(caminho, caminho, antes, depois, undefined, undefined, { context: 3 });
    let adicionadas = 0;
    let removidas = 0;
    for (const trecho of estruturado.hunks) {
        for (const linha of trecho.lines) {
            if (linha.startsWith('+')) adicionadas++;
            else if (linha.startsWith('-')) removidas++;
        }
    }
    return { resumo: { caminho, tipo, adicionadas, removidas }, patch: formatPatch(estruturado) };
}

/**
 * Resume um turno a partir dos pares capturados. Arquivos sem mudança líquida somem; patches que estourariam o
 * orçamento do turno ficam sem conteúdo, mantendo o arquivo na lista com contagem desconhecida.
 */
export function resumirTurno(
    pares: ReadonlyMap<string, ParAlteracao>,
    parcial: boolean,
): { alteracoes: AlteracoesTurno; patches: Record<string, string> } {
    const arquivos: ArquivoAlterado[] = [];
    const patches: Record<string, string> = {};
    let bytes = 0;
    for (const [caminho, par] of pares) {
        if (arquivos.length >= limiteArquivosTurno) break;
        const diff = compararArquivo(caminho, par);
        if (!diff) continue;
        if (diff.patch !== null && bytes + diff.patch.length <= limiteBytesTurno) {
            bytes += diff.patch.length;
            patches[caminho] = diff.patch;
            arquivos.push(diff.resumo);
        } else {
            arquivos.push({ ...diff.resumo, adicionadas: null, removidas: null });
        }
    }
    arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho));
    return { alteracoes: { arquivos, ...(parcial ? { parcial } : {}) }, patches };
}
