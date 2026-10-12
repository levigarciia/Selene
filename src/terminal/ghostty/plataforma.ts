export const SELECTION_MULTI_CLICK_INTERVAL_MS = 500;

export function isMacPlatform(plataforma: string): boolean {
    return /mac|iphone|ipad|ipod/i.test(plataforma);
}

const VARIANTES_SONDA = ['normal 400', 'normal 700'] as const;
let contextoSonda: CanvasRenderingContext2D | null | undefined;

/** Confirma que a fonte desenha glifos estreitos e largos com o mesmo avanço. */
export function isMonospaceFamily(familia: string): boolean {
    if (contextoSonda === undefined) contextoSonda = document.createElement('canvas').getContext('2d');
    if (!contextoSonda) return true;
    for (const variante of VARIANTES_SONDA) {
        contextoSonda.font = `${variante} 32px ${familia}, monospace`;
        if (contextoSonda.measureText('iiii').width !== contextoSonda.measureText('MMMM').width) return false;
    }
    return true;
}
