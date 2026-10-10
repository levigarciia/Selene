import { expect, test } from 'bun:test';
import { estimarVelocidadeModelo, larguraBandaDaGpu } from '../shared/velocidadeModelo';

const gb = 1024 ** 3;
const hardware = {
    processador: 'CPU',
    ramTotal: 32 * gb,
    ramLivre: 24 * gb,
    gpu: { nome: 'AMD Radeon RX 7700 XT', memoria: 12 * gb },
};
const entrada = { tamanho: 4 * gb, contexto: 2048, hardware };

test('estima tokens por segundo por tamanho e largura de banda, com faixa explícita', () => {
    const menor = estimarVelocidadeModelo(entrada);
    const maior = estimarVelocidadeModelo({ ...entrada, tamanho: 8 * gb });
    expect(menor.rotulo).toContain('tokens/s');
    expect(menor.minimo).toBeGreaterThan(0);
    expect(menor.maximo!).toBeGreaterThan(menor.minimo!);
    expect(maior.maximo!).toBeLessThan(menor.maximo!);
    expect(menor.detalhe).toContain('não medida');
});

test('CPU e camadas manuais não herdam a previsão de execução integral na GPU', () => {
    const gpu = estimarVelocidadeModelo(entrada);
    const cpu = estimarVelocidadeModelo({ ...entrada, somenteCpu: true });
    const semCamadas = estimarVelocidadeModelo({ ...entrada, camadasGpu: 0 });
    const manual = estimarVelocidadeModelo({ ...entrada, camadasGpu: 10 });
    expect(cpu.maximo!).toBeLessThan(gpu.maximo!);
    expect(semCamadas.maximo).toBe(cpu.maximo);
    expect(manual.minimo).toBe(cpu.minimo);
    expect(manual.detalhe).toContain('Camadas manuais');
});

test('contexto e projetor que deslocam pesos para RAM reduzem a estimativa', () => {
    const gpu = estimarVelocidadeModelo(entrada);
    const projetor = estimarVelocidadeModelo({ ...entrada, projetor: 7 * gb });
    const contexto = estimarVelocidadeModelo({ ...entrada, contexto: 32768 });
    expect(projetor.maximo!).toBeLessThan(gpu.maximo!);
    expect(contexto.maximo!).toBeLessThan(gpu.maximo!);
    expect(contexto.detalhe).toContain('GPU e RAM');
});

test('não inventa desempenho para hardware desconhecido, memória insuficiente ou MoE', () => {
    const desconhecido = { ...hardware, gpu: { nome: 'Placa desconhecida', memoria: 12 * gb } };
    for (const opcoes of [
        { ...entrada, hardware: undefined },
        { ...entrada, hardware: desconhecido },
        { ...entrada, tamanho: 50 * gb },
        { ...entrada, identificacao: 'Qwen 30B-A3B MoE' },
    ]) {
        const estimativa = estimarVelocidadeModelo(opcoes);
        expect(estimativa.rotulo).toBe('Estimativa indisponível');
        expect(estimativa.maximo).toBeUndefined();
    }
    expect(larguraBandaDaGpu('NVIDIA GeForce RTX 4070 Ti SUPER')).toBe(672);
    expect(larguraBandaDaGpu('NVIDIA GeForce RTX 4090 Laptop GPU')).toBeUndefined();
    expect(larguraBandaDaGpu('AMD Radeon RX 7600 XT')).toBeUndefined();
});
