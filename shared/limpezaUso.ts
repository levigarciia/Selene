import type { Dados } from './contratos';
import { reunirRegistrosUso } from './estatisticas';

/** Use somente numa limpeza autorizada para descartar entradas legadas sem medição individual ou de cache. */
export function descartarEntradasLegadas(dados: Dados): { registros: number; tokens: number } {
    const antigos = reunirRegistrosUso(dados).filter(
        (registro) =>
            registro.tokensEntrada !== undefined &&
            registro.tokensEntradaCache === undefined &&
            !registro.medicoesModelo?.length,
    );
    const descartadas = new Set(dados.entradasUsoDescartadas);
    for (const registro of antigos) descartadas.add(registro.mensagemId);
    dados.entradasUsoDescartadas = [...descartadas];
    for (const conversa of dados.conversas) {
        for (const mensagem of conversa.mensagens) {
            if (!descartadas.has(mensagem.id) || !mensagem.desempenho) continue;
            delete mensagem.desempenho.tokensEntrada;
            delete mensagem.desempenho.tokensEntradaCache;
        }
    }
    dados.registrosUso = reunirRegistrosUso(dados);
    return {
        registros: antigos.length,
        tokens: antigos.reduce((total, registro) => total + (registro.tokensEntrada ?? 0), 0),
    };
}
