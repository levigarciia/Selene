const palavrasVazias = new Set(
    (
        'que com para por uma uns umas dos das nos nas num numa ele ela eles elas voce isso isto esse essa este ' +
        'esta aqui ali mais menos muito pouco como quando onde qual quais porque pois mas sem sobre entre ate ' +
        'tem ter sou era foi ser estar esta estou meu minha meus minhas seu sua seus suas usuario the and you'
    ).split(' '),
);

/** Remove acentos e caixa para comparar textos digitados de formas diferentes. */
export function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

/** Palavras significativas de um texto, sem acentos, sem palavras vazias e com ao menos três letras. */
export function tokenizar(texto: string): string[] {
    return (normalizar(texto).match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (palavra) => palavra.length >= 3 && !palavrasVazias.has(palavra),
    );
}

/**
 * Pontua documentos já tokenizados contra uma consulta por BM25, com presença binária dos termos.
 * Use para ordenar textos curtos por relevância sem depender de embeddings.
 */
export function pontuarBm25(consulta: readonly string[], documentos: readonly string[][]): number[] {
    const total = documentos.length;
    const mediaTamanho = Math.max(1, documentos.reduce((soma, item) => soma + item.length, 0) / Math.max(1, total));
    const frequencia = new Map<string, number>();
    for (const documento of documentos) {
        for (const palavra of new Set(documento)) frequencia.set(palavra, (frequencia.get(palavra) ?? 0) + 1);
    }
    const [k1, b] = [1.5, 0.75];
    const termos = [...new Set(consulta)];
    return documentos.map((documento) => {
        const palavras = new Set(documento);
        return termos.reduce((soma, termo) => {
            if (!palavras.has(termo)) return soma;
            const df = frequencia.get(termo) ?? 0;
            const idf = Math.log((total - df + 0.5) / (df + 0.5) + 1);
            return soma + (idf * (k1 + 1)) / (1 + k1 * (1 - b + (b * documento.length) / mediaTamanho));
        }, 0);
    });
}
