import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { Atualizacoes } from '../electron/services/atualizacoes';
import { normalizarNotasRelease, urlRelease } from '../shared/atualizacoes';

class AtualizadorTeste extends EventEmitter {
    autoDownload = false;
    autoInstallOnAppQuit = false;
    allowPrerelease = true;
    allowDowngrade = true;
    fullChangelog = false;
    consultas = 0;
    falhar = false;
    instalacoes: [boolean | undefined, boolean | undefined][] = [];

    quitAndInstall(silenciosa?: boolean, reabrir?: boolean) {
        this.instalacoes.push([silenciosa, reabrir]);
    }

    async checkForUpdates() {
        this.consultas++;
        this.emit('checking-for-update');
        if (this.falhar) throw new Error('Sem conexão');
        return null;
    }
}

function preparar(habilitada = true, prepararReinicio = async () => {}) {
    const atualizador = new AtualizadorTeste();
    const servico = new Atualizacoes(
        atualizador as unknown as ConstructorParameters<typeof Atualizacoes>[0],
        habilitada,
        '1.0.1',
        () => {},
        prepararReinicio,
    );
    return { atualizador, servico };
}

describe('Distribuição automática', () => {
    test('reinício exige download pronto e aguarda salvar antes de instalar, sem duplicar cliques', async () => {
        let concluirSalvamento!: () => void;
        const salvamento = new Promise<void>((resolver) => {
            concluirSalvamento = resolver;
        });
        const { atualizador, servico } = preparar(true, () => salvamento);
        try {
            servico.iniciar();
            await expect(servico.reiniciar()).rejects.toThrow('ainda não está pronta');
            atualizador.emit('update-available', { version: '1.0.2' });
            await expect(servico.reiniciar()).rejects.toThrow('ainda não está pronta');
            atualizador.emit('update-downloaded', { version: '1.0.2' });
            const reinicio = servico.reiniciar();
            await servico.reiniciar();
            await servico.verificar();
            expect(servico.estado.fase).toBe('reiniciando');
            expect(atualizador.instalacoes).toEqual([]);
            concluirSalvamento();
            await reinicio;
            expect(atualizador.instalacoes).toEqual([[true, true]]);
            expect(atualizador.consultas).toBe(1);
        } finally {
            servico.encerrar();
        }
    });

    test('falha ao salvar impede instalar e permite repetir o reinício', async () => {
        let falhar = true;
        const { atualizador, servico } = preparar(true, async () => {
            if (falhar) throw new Error('Falha ao salvar');
        });
        try {
            servico.iniciar();
            atualizador.emit('update-downloaded', { version: '1.0.2' });
            await expect(servico.reiniciar()).rejects.toThrow('Falha ao salvar');
            expect(servico.estado.fase).toBe('pronta');
            expect(atualizador.instalacoes).toEqual([]);
            falhar = false;
            await servico.reiniciar();
            expect(atualizador.instalacoes).toEqual([[true, true]]);
        } finally {
            servico.encerrar();
        }
    });

    test('desenvolvimento e portátil não consultam releases', () => {
        const { atualizador, servico } = preparar(false);
        servico.iniciar();
        expect(atualizador.consultas).toBe(0);
        expect(servico.estado.fase).toBe('desativada');
    });

    test('baixa automaticamente, aguarda encerramento e evita consultas duplicadas', async () => {
        const { atualizador, servico } = preparar();
        try {
            servico.iniciar();
            servico.iniciar();
            await servico.verificar();
            expect(atualizador.consultas).toBe(1);
            expect(atualizador.autoDownload).toBe(true);
            expect(atualizador.autoInstallOnAppQuit).toBe(true);
            expect(atualizador.allowDowngrade).toBe(false);
            expect(atualizador.allowPrerelease).toBe(false);
            expect(atualizador.fullChangelog).toBe(true);
            atualizador.emit('update-available', { version: '1.0.2', releaseNotes: '## Novidades\n* Melhora o chat' });
            atualizador.emit('download-progress', { percent: 48 });
            expect(servico.estado.progresso).toBe(48);
            expect(servico.estado.versaoNova).toBe('1.0.2');
            expect(servico.estado.notas?.[0].itens).toEqual(['Melhora o chat']);
            await servico.verificar();
            atualizador.emit('update-downloaded', { version: '1.0.2' });
            await servico.verificar();
            expect(servico.estado.fase).toBe('pronta');
            expect(servico.estado.notas?.[0].itens).toEqual(['Melhora o chat']);
            expect(atualizador.consultas).toBe(1);
        } finally {
            servico.encerrar();
        }
    });

    test('mostra falha e permite buscar novamente após recuperar conexão', async () => {
        const { atualizador, servico } = preparar();
        try {
            atualizador.falhar = true;
            servico.iniciar();
            await new Promise((resolver) => setTimeout(resolver, 0));
            expect(servico.estado.erro).toBe('Sem conexão');
            atualizador.falhar = false;
            await servico.verificar();
            atualizador.emit('update-not-available');
            expect(servico.estado.fase).toBe('atualizada');
            expect(servico.estado.erro).toBeUndefined();
            expect(atualizador.consultas).toBe(2);
        } finally {
            servico.encerrar();
        }
    });
});

test('notas aceitam texto e histórico, removem HTML e limitam grupos e conteúdo', () => {
    const texto = normalizarNotasRelease(
        '<h2>Novidades</h2><ul><li>Chat &amp; Code</li><li><script>executar()</script>Arquivos</li></ul>',
        '1.0.2',
    );
    expect(texto.notas[0].itens).toEqual(['Chat & Code', 'Arquivos']);
    const historico = Array.from({ length: 9 }, (_, indice) => ({
        version: `1.0.${indice + 2}`,
        note: Array.from({ length: 11 }, () => `* ${'a'.repeat(300)}`).join('\n'),
    }));
    const resultado = normalizarNotasRelease(historico, '1.0.10');
    expect(resultado.notas).toHaveLength(6);
    expect(resultado.notas[0].versao).toBe('1.0.10');
    expect(resultado.releasesOmitidas).toBe(3);
    expect(resultado.notas[0].total).toBe(11);
    expect(resultado.notas[0].itens).toHaveLength(8);
    expect(resultado.notas[0].itens[0]).toHaveLength(220);
    expect(normalizarNotasRelease([null, { version: 'invalida', note: 'Teste' }], '1.0.2').notas).toEqual([]);
    expect(normalizarNotasRelease(undefined, '1.0.2').notas).toEqual([]);
    expect(normalizarNotasRelease('&#9999999999;', '1.0.2').notas[0].itens).toEqual(['&#9999999999;']);
});

test('links de release ficam restritos ao repositório oficial', () => {
    expect(urlRelease('1.0.22')).toBe('https://github.com/levigarciia/Selene/releases/tag/v1.0.22');
    expect(urlRelease()).toBe('https://github.com/levigarciia/Selene/releases');
    expect(() => urlRelease('../../outro')).toThrow('Versão de release inválida');
});
