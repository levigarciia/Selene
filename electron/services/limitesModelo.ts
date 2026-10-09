/** Valida o contexto efetivamente reservado pelo servidor antes de iniciar uma conversa. */
export function contextoDoServidor(propriedades: unknown): number {
    const contexto = (propriedades as { default_generation_settings?: { n_ctx?: number } } | null)
        ?.default_generation_settings?.n_ctx;
    if (!Number.isSafeInteger(contexto) || contexto! < 2048) {
        throw new Error('O motor não informou um tamanho de contexto válido para este modelo.');
    }
    return contexto!;
}

/** Reduz a reserva somente quando a carga falha por falta de memória. */
export function contextoAposFalha(registro: string, contextoTentado: number): number | null {
    if (!/out of memory|failed to allocate|cannot allocate|unable to allocate|not enough memory/i.test(registro)) {
        return null;
    }
    const contextoModelo = Number(registro.match(/n_ctx_train\s*=\s*(\d+)/)?.[1]);
    const anterior = contextoTentado || (contextoModelo >= 2048 ? contextoModelo : 65536);
    const menor = Math.floor(anterior / 2);
    return menor >= 2048 ? menor : null;
}
