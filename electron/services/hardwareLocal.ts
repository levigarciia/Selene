import { cpus, freemem, totalmem } from 'node:os';
import { dirname } from 'node:path';
import type { BackendMotor } from '../../shared/contratos';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { escolherDispositivo, interpretarDispositivos } from './dispositivosMotor';
import { localizarServidor, pastaRuntime } from './instalador';
import { executarProcesso } from './processos';

/** Consulta memória do sistema e GPUs de motores instalados, sem instalar ou iniciar modelos. */
export async function consultarHardware(raiz: string, backend: BackendMotor): Promise<HardwareLocal> {
    const hardware: HardwareLocal = {
        processador: cpus()[0]?.model.trim() || 'CPU',
        ramTotal: totalmem(),
        ramLivre: freemem(),
    };
    const candidatos = backend === 'cpu' ? [] : backend === 'auto' ? (['rocm', 'vulkan'] as const) : [backend];
    for (const candidato of candidatos) {
        const executavel = await localizarServidor(pastaRuntime(raiz, candidato));
        if (!executavel) continue;
        try {
            const resultado = await executarProcesso(
                executavel,
                ['--list-devices'],
                dirname(executavel),
                AbortSignal.timeout(5000),
                undefined,
                5000,
            );
            if (resultado.codigo !== 0) continue;
            const gpu = escolherDispositivo(interpretarDispositivos(resultado.saida), candidato);
            hardware.gpu = { nome: gpu.nome, memoria: gpu.memoriaMiB * 1024 ** 2 };
            return hardware;
        } catch {
            continue;
        }
    }
    hardware.aviso =
        backend === 'cpu'
            ? 'Estimativa considerando apenas a RAM.'
            : 'VRAM não medida. Instale um motor GPU e consulte novamente. A estimativa considera a RAM.';
    return hardware;
}
