/** Restringe captura ao microfone da interface principal, recusando câmera e páginas externas. */
export function permitirMicrofone(
    permissao: string,
    interfacePrincipal: boolean,
    urlSolicitante: string | undefined,
    urlInterface: string,
    tipos: readonly string[] | undefined,
): boolean {
    if (permissao !== 'media' || !interfacePrincipal || tipos?.length !== 1 || tipos[0] !== 'audio' ||
        !urlSolicitante) return false;
    try {
        return new URL(urlSolicitante).href === new URL(urlInterface).href;
    } catch {
        return false;
    }
}
