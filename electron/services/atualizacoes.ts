import type { AppUpdater } from 'electron-updater';
import type { EstadoAtualizacao } from '../../shared/atualizacoes';

const intervaloVerificacao = 4 * 60 * 60 * 1000;
type Atualizador = Pick<
    AppUpdater,
    'autoDownload' | 'autoInstallOnAppQuit' | 'allowPrerelease' | 'allowDowngrade' | 'on' | 'checkForUpdates'
>;

/** Use após criar a janela para baixar releases oficiais e instalar somente ao encerrar o aplicativo. */
export class Atualizacoes {
    estado: EstadoAtualizacao = {
        versaoAtual: '',
        fase: 'desativada',
    };
    private intervalo?: ReturnType<typeof setInterval>;
    private iniciada = false;

    constructor(
        private readonly atualizador: Atualizador,
        private readonly habilitada: boolean,
        private readonly versaoAtual: string,
        private readonly publicar: () => void,
    ) {
        this.estado.versaoAtual = versaoAtual;
    }

    /** Inicia uma única assinatura de eventos quando a instalação permite atualização. */
    iniciar(): void {
        if (this.iniciada || !this.habilitada) return;
        this.iniciada = true;
        const autoUpdater = this.atualizador;
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.allowPrerelease = false;
        autoUpdater.allowDowngrade = false;
        autoUpdater.on('checking-for-update', () => this.alterar({ fase: 'verificando' }));
        autoUpdater.on('update-not-available', () => this.alterar({ fase: 'atualizada' }));
        autoUpdater.on('update-available', ({ version }) => {
            this.alterar({ fase: 'baixando', versaoNova: version, progresso: 0 });
        });
        autoUpdater.on('download-progress', ({ percent }) => {
            this.alterar({ fase: 'baixando', versaoNova: this.estado.versaoNova, progresso: percent });
        });
        autoUpdater.on('update-downloaded', ({ version }) => {
            this.alterar({ fase: 'pronta', versaoNova: version, progresso: 100 });
        });
        autoUpdater.on('error', (erro) => this.alterar({ fase: 'erro', erro: erro.message }));
        this.alterar({ fase: 'aguardando' });
        this.intervalo = setInterval(() => void this.verificar(), intervaloVerificacao);
        this.intervalo.unref();
        void this.verificar();
    }

    /** Permite repetir uma consulta após falha sem duplicar downloads ou descartar uma atualização pronta. */
    async verificar(): Promise<void> {
        if (!this.iniciada || ['verificando', 'baixando', 'pronta'].includes(this.estado.fase)) return;
        try {
            await this.atualizador.checkForUpdates();
        } catch (erro) {
            this.alterar({ fase: 'erro', erro: erro instanceof Error ? erro.message : 'Falha na atualização.' });
        }
    }

    /** Interrompe consultas periódicas durante o encerramento e a persistência dos dados. */
    encerrar(): void {
        if (this.intervalo) clearInterval(this.intervalo);
    }

    private alterar(estado: Omit<EstadoAtualizacao, 'versaoAtual'>): void {
        this.estado = { versaoAtual: this.versaoAtual, ...estado };
        this.publicar();
    }
}
