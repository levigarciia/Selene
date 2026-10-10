export type HardwareLocal = {
    processador: string;
    ramTotal: number;
    ramLivre: number;
    gpu?: { nome: string; memoria: number };
    aviso?: string;
};
export type CompatibilidadeModelo = { rotulo: string; detalhe: string };

/** Oferece uma triagem conservadora de memória, sem prometer desempenho ou carga bem sucedida. */
export function estimarCompatibilidade(
    tamanho: number,
    hardware: HardwareLocal | undefined,
    contexto: number,
    projetor = 0,
    somenteCpu = false,
): CompatibilidadeModelo {
    if (![tamanho, projetor].every((valor) => Number.isFinite(valor) && valor >= 0)) {
        throw new Error('Tamanho de modelo inválido para estimar memória.');
    }
    if (!Number.isSafeInteger(contexto) || contexto < 2048) throw new Error('Contexto inválido para estimar memória.');
    if (!hardware) return { rotulo: 'Memória não consultada', detalhe: 'Consulte o hardware na área Motor.' };
    const base = tamanho * 1.15 + projetor;
    const minimo = base + contexto * 64 * 1024;
    const maximo = base + contexto * 512 * 1024;
    const faixa = `${(minimo / 1024 ** 3).toFixed(1)} a ${(maximo / 1024 ** 3).toFixed(1)} GB`;
    const detalhe =
        `Estimativa: ${faixa} para ${contexto.toLocaleString('pt-BR')} tokens. ` +
        'Inclui pesos e faixa heurística de cache. ' +
        (projetor ? 'Inclui o projetor conhecido. ' : 'Projetores adicionais não estão incluídos. ') +
        'A arquitetura e a memória livre podem alterar o resultado.';
    if (!somenteCpu && hardware.gpu && maximo <= hardware.gpu.memoria * 0.85) {
        return { rotulo: 'Provável na GPU', detalhe: `${detalhe} A VRAM consultada é total, não livre.` };
    }
    const ramUtil = Math.max(0, hardware.ramLivre - 2 * 1024 ** 3);
    if (maximo <= ramUtil) return { rotulo: 'Provável com RAM', detalhe };
    if (!somenteCpu && hardware.gpu && minimo <= ramUtil + hardware.gpu.memoria * 0.85) {
        return { rotulo: 'Requer ajuste', detalhe: `${detalhe} Pode exigir carga parcial na GPU ou contexto menor.` };
    }
    return { rotulo: 'Memória limitada', detalhe: `${detalhe} Considere um modelo menor ou libere memória.` };
}
