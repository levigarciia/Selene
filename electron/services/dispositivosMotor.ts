import { dirname } from 'node:path';
import { z } from 'zod';
import type { BackendRuntime } from '../../shared/contratos';
import { executarProcesso } from './processos';

export type DispositivoMotor = { id: string; nome: string; memoriaMiB: number };

/** Identifica dispositivos enumerados pelo próprio motor, sem reutilizar índices entre backends. */
export function interpretarDispositivos(saida: string): DispositivoMotor[] {
    return [...saida.matchAll(/^\s*((?:Vulkan|ROCm)\d+):\s+(.+?)\s+\((\d+) MiB,/gm)].map((item) => ({
        id: item[1],
        nome: item[2],
        memoriaMiB: Number(item[3]),
    }));
}

/** Prioriza a GPU dedicada e mantém índices e nomes pertencentes ao backend solicitado. */
export function escolherDispositivo(dispositivos: DispositivoMotor[], backend: BackendRuntime): DispositivoMotor {
    const prefixo = backend === 'rocm' ? 'ROCm' : 'Vulkan';
    const disponiveis = dispositivos.filter((item) => item.id.startsWith(prefixo));
    const dedicada = disponiveis.find(
        (item) => !/Radeon(?:\(TM\))? Graphics|Radeon \d{3,4}M\b|Intel.*(?:UHD|Iris|HD Graphics)/i.test(item.nome),
    );
    const selecionada = dedicada ?? disponiveis[0];
    if (!selecionada) throw new Error(`Nenhuma GPU reconhecida pelo motor ${backend === 'rocm' ? 'ROCm' : 'Vulkan'}.`);
    return selecionada;
}

/** Usa ROCm nas Radeon RDNA 2 e 3; os demais dispositivos mantêm o backend Vulkan. */
export function backendParaGpus(nomes: string[]): BackendRuntime {
    if (nomes.some((nome) => /Radeon\s+RX\s+[67]\d{3}\b/i.test(nome))) return 'rocm';
    if (nomes.some((nome) => /Radeon|NVIDIA|Intel.*(?:Graphics|Arc)/i.test(nome))) return 'vulkan';
    return 'cpu';
}

/** Detecta o processamento automático sem instalar drivers nem consultar dados de conversas. */
export async function detectarBackend(sinal: AbortSignal): Promise<BackendRuntime> {
    if (process.platform !== 'win32') return 'vulkan';
    const resultado = await executarProcesso(
        'powershell.exe',
        [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) | ConvertTo-Json -Compress',
        ],
        process.cwd(),
        sinal,
        undefined,
        10000,
    );
    sinal.throwIfAborted();
    if (resultado.codigo !== 0) return 'vulkan';
    if (!resultado.saida.trim()) return 'cpu';
    const nomes = z.union([z.string(), z.array(z.string()), z.null()]).parse(JSON.parse(resultado.saida));
    return backendParaGpus(nomes === null ? [] : typeof nomes === 'string' ? [nomes] : nomes);
}

/** Confere as GPUs disponíveis depois de instalar o pacote oficial do backend. */
export async function detectarDispositivo(
    executavel: string,
    backend: BackendRuntime,
    sinal: AbortSignal,
): Promise<DispositivoMotor> {
    const resultado = await executarProcesso(executavel, ['--list-devices'], dirname(executavel), sinal);
    if (resultado.codigo !== 0) throw new Error(`Falha ao detectar GPU com ${backend}: ${resultado.saida}`);
    return escolherDispositivo(interpretarDispositivos(resultado.saida), backend);
}
