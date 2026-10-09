import type { BackendRuntime, Configuracao } from '../../shared/contratos';

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
    const memoriaInsuficiente =
        /out of memory|failed to allocate|cannot allocate|unable to allocate|not enough memory/i.test(registro) ||
        /ErrorOutOfDeviceMemory/i.test(registro);
    if (!memoriaInsuficiente) return null;
    const contextoModelo = Number(registro.match(/n_ctx_train\s*=\s*(\d+)/)?.[1]);
    const contextoReservado = Number(registro.match(/\bn_ctx\s*=\s*(\d+)/)?.[1]);
    const contextoInicial = contextoReservado >= 2048 ? contextoReservado : contextoModelo;
    const anterior = contextoTentado || (contextoInicial >= 2048 ? contextoInicial : 65536);
    const menor = Math.floor(anterior / 2);
    return menor >= 2048 ? menor : null;
}

/** Permite ao motor ajustar a carga à memória livre, preservando limites escolhidos no modo manual. */
export function argumentosMemoriaMotor(
    configuracao: Configuracao,
    backend: BackendRuntime,
    contextoTentado = 0,
    possuiProjetor = false,
): string[] {
    if (!configuracao.limitesAutomaticos) {
        return [
            '-c',
            String(configuracao.contexto),
            '-ngl',
            backend === 'cpu' ? '0' : String(configuracao.camadasGpu),
            '--fit',
            'off',
        ];
    }
    return [
        ...(contextoTentado ? ['-c', String(contextoTentado)] : []),
        '-ngl',
        backend === 'cpu' ? '0' : 'auto',
        '--fit',
        'on',
        '--fit-ctx',
        '2048',
        '--fit-target',
        possuiProjetor && backend !== 'cpu' ? '2048' : '1024',
    ];
}
