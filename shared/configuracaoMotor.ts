import type { Configuracao, Modelo } from './contratos';

/** Resolve os parâmetros do modelo sem alterar as preferências gerais de geração. */
export function configuracaoParaModelo(configuracao: Configuracao, modelo?: Modelo): Configuracao {
    if (!modelo?.perfil) return configuracao;
    const efetiva = { ...configuracao, ...modelo.perfil };
    return {
        ...efetiva,
        maxTokens: efetiva.limitesAutomaticos
            ? efetiva.maxTokens
            : Math.min(efetiva.maxTokens, Math.floor(efetiva.contexto / 2)),
    };
}

/** Compara apenas os parâmetros que exigem iniciar outro processo de inferência. */
export function mesmaConfiguracaoMotor(anterior: Configuracao, atual: Configuracao): boolean {
    return (
        anterior.backend === atual.backend &&
        anterior.limitesAutomaticos === atual.limitesAutomaticos &&
        (atual.limitesAutomaticos || anterior.contexto === atual.contexto) &&
        (atual.limitesAutomaticos || anterior.camadasGpu === atual.camadasGpu)
    );
}
