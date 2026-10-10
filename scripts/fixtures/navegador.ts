import { app, BrowserWindow, ipcMain } from 'electron';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { esquemaDados } from '../../shared/contratos';
import { Navegador } from '../../electron/services/navegador';

void app.whenReady().then(async () => {
    let janela: BrowserWindow;
    const navegador = new Navegador((previa) => {
        if (process.env.SELENE_TESTE_INLINE && janela && !janela.isDestroyed()) {
            janela.webContents.send('selene:evento', { tipo: 'navegador', previa });
        }
    });
    Object.assign(globalThis, { navegadorValidacao: navegador });
    janela = new BrowserWindow({
        show: !!process.env.SELENE_TESTE_INLINE,
        width: 1200,
        height: 900,
        webPreferences: {
            sandbox: true,
            preload: resolve('dist-electron/preload.cjs'),
        },
    });
    if (process.env.SELENE_TESTE_INLINE) {
        const dados = esquemaDados.parse(JSON.parse(await readFile(process.env.SELENE_TESTE_INLINE, 'utf8')));
        ipcMain.handle('selene:estado', () => ({
            ok: true,
            valor: {
                ...dados,
                motor: {
                    fase: 'desligado',
                    detalhe: 'Teste visual',
                    instalado: { cpu: false, vulkan: false, rocm: false },
                },
                conversaEmExecucao: dados.conversas.find((conversa) =>
                    conversa.mensagens.some((mensagem) => mensagem.estado === 'gerando'),
                )?.id ?? null,
                downloads: [],
            },
        }));
        ipcMain.handle('selene:previasNavegador', () => ({ ok: true, valor: navegador.listarPrevias() }));
        ipcMain.handle('selene:atualizarNavegador', async (_evento, id: string) => ({
            ok: true,
            valor: await navegador.atualizarConversa(id),
        }));
        await janela.loadFile(resolve('dist/index.html'));
    } else {
        await janela.loadURL('about:blank');
    }
    app.on('before-quit', () => navegador.encerrar());
});
