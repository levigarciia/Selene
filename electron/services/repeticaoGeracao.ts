/** Detecta ciclos extensos no final da resposta sem confundir refrões curtos com falhas. */
export function temRepeticaoDegenerada(texto: string): boolean {
    const fim = texto.slice(-4096);
    for (let tamanho = 48; tamanho <= Math.min(1024, Math.floor(fim.length / 3)); tamanho++) {
        const trecho = fim.slice(-tamanho);
        const repeticoes = Math.max(3, Math.ceil(240 / tamanho));
        if (fim.endsWith(trecho.repeat(repeticoes))) return true;
    }
    return false;
}

/** Detecta parágrafos quase idênticos mesmo com mudanças de números ou pequenas variações de palavras. */
export function temParagrafosRepetidos(texto: string): boolean {
    const paragrafos = texto
        .slice(-8192)
        .replace(/```[\s\S]*?(?:```|$)/g, '')
        .split(/\n\s*\n/)
        .filter((paragrafo) => paragrafo.length >= 120)
        .slice(-12);
    if (paragrafos.length < 3) return false;
    const conjuntos = paragrafos.map(trigramas);
    for (let indice = conjuntos.length - 1; indice >= 2; indice--) {
        const atual = conjuntos[indice];
        if (atual.size < 18) continue;
        let semelhantes = 0;
        for (const anterior of conjuntos.slice(0, indice)) {
            const comuns = [...atual].filter((trecho) => anterior.has(trecho)).length;
            const tamanhoUniao = atual.size + anterior.size - comuns;
            if (comuns / tamanhoUniao >= 0.65 && ++semelhantes >= 2) return true;
        }
    }
    return false;
}

function trigramas(texto: string): Set<string> {
    const palavras = texto.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    return new Set(
        palavras.slice(2).map((palavra, indice) => `${palavras[indice]} ${palavras[indice + 1]} ${palavra}`),
    );
}

/** Sinaliza uma geração descartável antes da execução de ferramentas. */
export class ErroRepeticaoGeracao extends Error {
    constructor() {
        super('O modelo entrou em repetição. A geração foi interrompida para evitar um ciclo.');
    }
}
