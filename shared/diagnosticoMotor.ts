export type DiagnosticoMotor = { causa: string; sugestao: string };

/** Traduz falhas conhecidas para orientar uma nova tentativa sem executar correções arbitrárias. */
export function diagnosticarMotor(saida: string): DiagnosticoMotor {
    if (/out of memory|failed to allocate|cannot allocate|not enough memory|ErrorOutOfDeviceMemory/i.test(saida)) {
        return { causa: 'Memória insuficiente', sugestao: 'Use limites automáticos ou escolha um modelo menor.' };
    }
    if (/ENOENT|no such file|not found|não encontrado/i.test(saida)) {
        return {
            causa: 'Arquivo ou motor indisponível',
            sugestao: 'Confira o modelo importado e a instalação do motor.',
        };
    }
    if (/Nenhuma GPU|Vulkan|ROCm|HIP|driver/i.test(saida)) {
        return { causa: 'Falha no processamento pela GPU', sugestao: 'Experimente o processamento automático ou CPU.' };
    }
    if (/GGUF|magic|tensor|architecture/i.test(saida) && !/Tempo limite/i.test(saida)) {
        return {
            causa: 'Falha ao abrir o modelo',
            sugestao: 'Confira o arquivo GGUF e o projetor visual correspondente.',
        };
    }
    if (/Tempo limite|timeout/i.test(saida)) {
        return {
            causa: 'O modelo não ficou pronto a tempo',
            sugestao: 'Verifique a memória e tente carregar novamente.',
        };
    }
    return { causa: 'O motor não concluiu a operação', sugestao: 'Consulte os detalhes antes de tentar novamente.' };
}
