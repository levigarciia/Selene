import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { Atualizacoes } from '../electron/services/atualizacoes';

class AtualizadorTeste extends EventEmitter {
    autoDownload = false;
    autoInstallOnAppQuit = false;
    allowPrerelease = true;
    allowDowngrade = true;
    consultas = 0;
    falhar = false;

    async checkForUpdates() {
        this.consultas++;
        this.emit('checking-for-update');
        if (this.falhar) throw new Error('Sem conexão');
        return null;
    }
}

function preparar(habilitada = true) {
    const atualizador = new AtualizadorTeste();
    const servico = new Atualizacoes(
        atualizador as unknown as ConstructorParameters<typeof Atualizacoes>[0],
        habilitada,
        '1.0.1',
        () => {},
    );
    return { atualizador, servico };
}

describe('Distribuição automática', () => {
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
            atualizador.emit('update-available', { version: '1.0.2' });
            atualizador.emit('download-progress', { percent: 48 });
            expect(servico.estado.progresso).toBe(48);
            expect(servico.estado.versaoNova).toBe('1.0.2');
            await servico.verificar();
            atualizador.emit('update-downloaded', { version: '1.0.2' });
            await servico.verificar();
            expect(servico.estado.fase).toBe('pronta');
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
