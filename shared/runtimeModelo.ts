import type { BackendMotor, Modelo } from './contratos';

export const revisaoRuntimeLfm3 = '19ff817fb25e9a1b838b1d7f9f4325f7bf9779c4';
export const pastaRuntimeLfm3 = `lfm3-${revisaoRuntimeLfm3}-cpu`;
export const pastaRuntimeLfm3Vulkan = `lfm3-${revisaoRuntimeLfm3}-vulkan`;

/** Resolve o backend efetivo de modelos cujo motor específico ainda não oferece ROCm. */
export function backendParaModelo(modelo: Pick<Modelo, 'nome' | 'caminho' | 'catalogoId'>,
    backend: BackendMotor): BackendMotor {
    if (!exigeRuntimeLfm3(modelo)) return backend;
    return backend === 'cpu' ? 'cpu' : 'vulkan';
}

/** Seleciona o motor específico também para importações identificáveis do LFM3 Omni. */
export function exigeRuntimeLfm3(modelo: Pick<Modelo, 'nome' | 'caminho' | 'catalogoId'>): boolean {
    return modelo.catalogoId === 'lfm3-omni-2b-q4' ||
        /lfm3[\s_-]*omni[\s_-]*2b/i.test(`${modelo.nome} ${modelo.caminho}`);
}
