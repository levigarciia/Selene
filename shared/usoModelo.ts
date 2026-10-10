import type { Desempenho, MedicaoModelo, Mensagem } from './contratos';

/** Registra cada inferência para auditar reenvios de contexto e preservar o consumo após excluir conversas. */
export function registrarMedicaoModelo(mensagem: Mensagem, medicao: MedicaoModelo): void {
    mensagem.medicoesModelo ??= [];
    mensagem.medicoesModelo.push(medicao);
    mensagem.desempenho = acumularDesempenho(mensagem.desempenho, medicao);
}

function acumularDesempenho(anterior: Desempenho | undefined, atual: Desempenho): Desempenho {
    const tokensGerados = (anterior?.tokensGerados ?? 0) + atual.tokensGerados;
    const tempoGeracaoMs = (anterior?.tempoGeracaoMs ?? 0) + atual.tempoGeracaoMs;
    return {
        tokensGerados,
        tempoGeracaoMs,
        tokensPorSegundo: tempoGeracaoMs > 0 ? tokensGerados / (tempoGeracaoMs / 1000) : 0,
        ...(anterior?.tokensEntrada !== undefined || atual.tokensEntrada !== undefined
            ? { tokensEntrada: (anterior?.tokensEntrada ?? 0) + (atual.tokensEntrada ?? 0) }
            : {}),
        ...(atual.tokensEntradaCache !== undefined && (!anterior || anterior.tokensEntradaCache !== undefined)
            ? { tokensEntradaCache: (anterior?.tokensEntradaCache ?? 0) + atual.tokensEntradaCache }
            : {}),
    };
}
