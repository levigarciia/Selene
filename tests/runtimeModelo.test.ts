import { expect, test } from 'bun:test';
import { backendParaModelo, exigeRuntimeLfm3 } from '../shared/runtimeModelo';

test('isola o motor LFM3 Omni sem alterar o motor de outras famílias Liquid ou Qwen', () => {
    const modelo = { id: 'teste', nome: 'Local', caminho: 'C:/models/local.gguf', tamanho: 100 };
    expect(exigeRuntimeLfm3({ ...modelo, catalogoId: 'lfm3-omni-2b-q4' })).toBe(true);
    expect(exigeRuntimeLfm3({ ...modelo, caminho: 'C:/models/LFM3-Omni-2B-Q4_K_M.gguf' })).toBe(true);
    expect(exigeRuntimeLfm3({ ...modelo, nome: 'LFM3 Omni 2B' })).toBe(true);
    expect(exigeRuntimeLfm3({ ...modelo, nome: 'LFM3 1.7B' })).toBe(false);
    expect(exigeRuntimeLfm3({ ...modelo, nome: 'Qwen3.5 9B' })).toBe(false);
});

test('LFM3 usa Vulkan nos modos de GPU e preserva a escolha explícita de CPU', () => {
    const lfm = { nome: 'LFM3 Omni 2B', caminho: 'lfm3.gguf' };
    expect(backendParaModelo(lfm, 'auto')).toBe('vulkan');
    expect(backendParaModelo(lfm, 'vulkan')).toBe('vulkan');
    expect(backendParaModelo(lfm, 'rocm')).toBe('vulkan');
    expect(backendParaModelo(lfm, 'cpu')).toBe('cpu');
    expect(backendParaModelo({ nome: 'Qwen', caminho: 'qwen.gguf' }, 'auto')).toBe('auto');
    expect(backendParaModelo({ nome: 'Qwen', caminho: 'qwen.gguf' }, 'rocm')).toBe('rocm');
});
