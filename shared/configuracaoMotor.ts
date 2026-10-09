import type { Configuracao } from './contratos';

/** Compara apenas os parâmetros que exigem iniciar outro processo de inferência. */
export function mesmaConfiguracaoMotor(anterior: Configuracao, atual: Configuracao): boolean {
    return (
        anterior.backend === atual.backend &&
        anterior.limitesAutomaticos === atual.limitesAutomaticos &&
        (atual.limitesAutomaticos || anterior.contexto === atual.contexto) &&
        (atual.limitesAutomaticos || anterior.camadasGpu === atual.camadasGpu)
    );
}
