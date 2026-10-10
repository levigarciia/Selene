import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esquemaConfiguracao, esquemaModelo, esquemaPerfilModelo } from '../shared/contratos';
import { configuracaoParaModelo, mesmaConfiguracaoMotor } from '../shared/configuracaoMotor';
import { estimarCompatibilidade } from '../shared/compatibilidadeModelo';
import { diagnosticarMotor } from '../shared/diagnosticoMotor';
import { Persistencia } from '../electron/services/persistencia';
import { consultarHardware } from '../electron/services/hardwareLocal';

const modelo = () => esquemaModelo.parse({ id: randomUUID(), nome: 'Modelo', caminho: 'modelo.gguf', tamanho: 1024 });

test('perfil altera execução sem modificar a geração geral e limita a resposta ao contexto manual', () => {
    const geral = esquemaConfiguracao.parse({ temperatura: 0.4, instrucao: 'Instrução geral' });
    const item = modelo();
    expect(configuracaoParaModelo(geral, item)).toBe(geral);
    item.perfil = esquemaPerfilModelo.parse({ backend: 'cpu', limitesAutomaticos: false, contexto: 2048 });
    const efetiva = configuracaoParaModelo(geral, item);
    expect(efetiva.backend).toBe('cpu');
    expect(efetiva.contexto).toBe(2048);
    expect(efetiva.maxTokens).toBe(1024);
    expect(efetiva.temperatura).toBe(0.4);
    expect(efetiva.instrucao).toBe(geral.instrucao);
    expect(geral.backend).toBe('auto');
    expect(mesmaConfiguracaoMotor(geral, efetiva)).toBe(false);
    delete item.perfil;
    expect(configuracaoParaModelo(geral, item)).toBe(geral);
});

test('perfil sobrevive à gravação e reabertura sem quebrar modelos antigos', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-perfis-'));
    try {
        const persistencia = new Persistencia(pasta);
        const item = modelo();
        persistencia.dados.modelos.push(item);
        await persistencia.salvar();
        expect(esquemaModelo.parse(item).perfil).toBeUndefined();
        item.perfil = esquemaPerfilModelo.parse({ backend: 'vulkan', limitesAutomaticos: false, contexto: 4096 });
        await persistencia.salvar();
        const reaberta = new Persistencia(pasta);
        await reaberta.abrir();
        expect(reaberta.dados.modelos[0].perfil).toEqual(item.perfil);
        delete reaberta.dados.modelos[0].perfil;
        await reaberta.salvar();
        expect(JSON.parse(await readFile(join(pasta, 'selene.json'), 'utf8')).modelos[0].perfil).toBeUndefined();
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});

test('IPC de perfil rejeita limites inválidos e campos de execução arbitrários', () => {
    for (const entrada of [{ contexto: 0 }, { camadasGpu: -1 }, { backend: 'docker' }, { comando: 'livre' }]) {
        expect(esquemaPerfilModelo.safeParse(entrada).success).toBe(false);
    }
});

test('estimativa considera contexto e projetor sem misturar VRAM total com RAM livre', () => {
    const gb = 1024 ** 3;
    const hardware = {
        processador: 'CPU',
        ramTotal: 32 * gb,
        ramLivre: 24 * gb,
        gpu: { nome: 'GPU', memoria: 16 * gb },
    };
    expect(estimarCompatibilidade(4 * gb, hardware, 2048).rotulo).toBe('Provável na GPU');
    expect(estimarCompatibilidade(4 * gb, hardware, 2048, 0, true).rotulo).toBe('Provável com RAM');
    expect(estimarCompatibilidade(4 * gb, hardware, 32768).rotulo).toBe('Provável com RAM');
    expect(estimarCompatibilidade(4 * gb, hardware, 2048, 12 * gb).rotulo).toBe('Provável com RAM');
    expect(estimarCompatibilidade(40 * gb, hardware, 2048).rotulo).toBe('Memória limitada');
    expect(estimarCompatibilidade(gb, undefined, 2048).rotulo).toBe('Memória não consultada');
    expect(() => estimarCompatibilidade(NaN, hardware, 2048)).toThrow();
});

test('consulta hardware sem runtime não instala arquivos e devolve RAM real com aviso', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'selene-hardware-'));
    try {
        await mkdir(join(pasta, 'runtime'));
        const hardware = await consultarHardware(join(pasta, 'runtime'), 'cpu');
        expect(hardware.ramTotal).toBeGreaterThan(0);
        expect(hardware.ramLivre).toBeGreaterThan(0);
        expect(hardware.gpu).toBeUndefined();
        expect(hardware.aviso).toContain('apenas a RAM');
    } finally {
        await rm(pasta, { recursive: true, force: true });
    }
});

test('diagnóstico distingue memória, arquivo ausente e espera sem executar comandos', () => {
    expect(diagnosticarMotor('failed to allocate Vulkan buffer').causa).toBe('Memória insuficiente');
    expect(diagnosticarMotor('ENOENT modelo.gguf').causa).toBe('Arquivo ou motor indisponível');
    expect(diagnosticarMotor('Tempo limite ao carregar o GGUF').causa).toBe('O modelo não ficou pronto a tempo');
});
