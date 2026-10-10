import { expect, test } from 'bun:test';
import { argumentosMemoriaMotor, contextoAposFalha, contextoDoServidor } from '../electron/services/limitesModelo';
import { esquemaConfiguracao } from '../shared/contratos';
import { esquemaConversa } from '../shared/contratos';
import { randomUUID } from 'node:crypto';
import { Agente } from '../electron/services/agente';
import { estimarTokens, type MensagemModelo } from '../electron/services/contexto';

test('usa o contexto informado pelo motor sem o teto antigo e migra configurações antigas', () => {
    expect(contextoDoServidor({ default_generation_settings: { n_ctx: 262144 } })).toBe(262144);
    expect(esquemaConfiguracao.parse({ contexto: 4096, maxTokens: 512 }).limitesAutomaticos).toBe(true);
    for (const valor of [null, {}, { default_generation_settings: { n_ctx: 0 } }]) {
        expect(() => contextoDoServidor(valor)).toThrow('contexto válido');
    }
});

test('reduz contexto apenas em falhas de memória e encerra as tentativas no limite mínimo', () => {
    expect(contextoAposFalha('n_ctx_train = 262144\nfailed to allocate buffer', 0)).toBe(131072);
    expect(contextoAposFalha('out of memory', 16384)).toBe(8192);
    expect(contextoAposFalha('out of memory', 2048)).toBeNull();
    expect(contextoAposFalha('modelo inválido', 8192)).toBeNull();
    expect(contextoAposFalha('n_ctx_train = 262144\nn_ctx = 8192\nErrorOutOfDeviceMemory', 0)).toBe(4096);
    expect(contextoAposFalha('n_ctx = 2048\nfailed to allocate Vulkan0 buffer', 0)).toBeNull();
});

test('libera contexto e camadas para ajustar o modelo à VRAM disponível', () => {
    const configuracao = esquemaConfiguracao.parse({ camadasGpu: 99 });
    for (const backend of ['vulkan', 'rocm'] as const) {
        const argumentos = argumentosMemoriaMotor(configuracao, backend);
        expect(argumentos).not.toContain('-c');
        expect(argumentos[argumentos.indexOf('-ngl') + 1]).toBe('auto');
        expect(argumentos[argumentos.indexOf('--fit') + 1]).toBe('on');
        expect(argumentos[argumentos.indexOf('--fit-ctx') + 1]).toBe('2048');
        expect(argumentos[argumentos.indexOf('--fit-target') + 1]).toBe('1024');
    }
    const visual = argumentosMemoriaMotor(configuracao, 'vulkan', 4096, true);
    expect(visual[visual.indexOf('--fit-target') + 1]).toBe('2048');
    expect(visual[visual.indexOf('-c') + 1]).toBe('4096');
    expect(visual[visual.indexOf('-ngl') + 1]).toBe('auto');
    const cpu = argumentosMemoriaMotor(configuracao, 'cpu');
    expect(cpu[cpu.indexOf('-ngl') + 1]).toBe('0');
});

test('preserva contexto e camadas explícitos no modo manual sem ajuste de memória', () => {
    const configuracao = esquemaConfiguracao.parse({ limitesAutomaticos: false, contexto: 8192, camadasGpu: 20 });
    expect(argumentosMemoriaMotor(configuracao, 'vulkan')).toEqual(['-c', '8192', '-ngl', '20', '--fit', 'off']);
    expect(argumentosMemoriaMotor(configuracao, 'cpu')).toEqual(['-c', '8192', '-ngl', '0', '--fit', 'off']);
});

test('resposta automática limita a saída sem reduzir o contexto carregado', async () => {
    const conversa = esquemaConversa.parse({
        id: randomUUID(),
        titulo: 'Limites',
        modo: 'chat',
        atualizadoEm: new Date().toISOString(),
    });
    const agente = new Agente({
        salvar: async () => {},
        publicar: () => {},
        completar: async (corpo) => {
            const pedido = corpo as { messages: MensagemModelo[]; max_tokens: number };
            expect(pedido.max_tokens).toBe(8192);
            expect(pedido.max_tokens + estimarTokens(pedido.messages)).toBeLessThan(262144);
            return new Response(
                'data: {"choices":[{"delta":{"content":"Pronto"},' + '"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
            );
        },
    });
    await agente.executar(conversa, 'Olá', esquemaConfiguracao.parse({ contexto: 262144, maxTokens: 64 }));
    expect(conversa.mensagens.at(-1)?.estado).toBe('concluida');
    expect(conversa.mensagens.at(-1)?.usoContexto?.limite).toBe(262144);
});
