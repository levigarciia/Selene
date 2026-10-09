import { catalogoModelos, encontrarModeloLocal, type ModeloCatalogo } from '../../shared/catalogo';
import type { Modelo } from '../../shared/contratos';
import { baixarGguf } from './downloadModelos';

/** Prepara a visão de modelos reconhecidos no catálogo, preservando projetores importados pelo usuário. */
export async function prepararProjetorVisual(
    raiz: string,
    modelo: Modelo,
    sinal: AbortSignal,
    progresso: (fase: 'baixando' | 'verificando', recebido: number, total: number) => void,
    transferir: (url: string, opcoes: { signal: AbortSignal }) => Promise<Response> = fetch,
    itens: ModeloCatalogo[] = catalogoModelos,
): Promise<string | undefined> {
    sinal.throwIfAborted();
    if (modelo.projetorVisual) return modelo.projetorVisual;
    const item = itens.find((item) => encontrarModeloLocal(item, [modelo]));
    if (!item?.projetorVisual) return undefined;
    const projetor = { ...item, ...item.projetorVisual, id: `${item.id}.mmproj` };
    return baixarGguf(
        raiz,
        projetor,
        sinal,
        (fase, recebido) => progresso(fase, recebido, projetor.tamanho),
        transferir,
    );
}
