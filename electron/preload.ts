import { contextBridge, ipcRenderer } from 'electron';
import type { Evento } from '../shared/contratos';
import { criarPonte } from '../shared/ponte';

contextBridge.exposeInMainWorld(
    'selene',
    criarPonte({
        invocar: (nome, ...argumentos) => ipcRenderer.invoke(`selene:${nome}`, ...argumentos),
        janela: (acao) => ipcRenderer.send('selene:janela', acao),
        assinar: (callback) => {
            const receber = (_evento: Electron.IpcRendererEvent, evento: Evento) => callback(evento);
            ipcRenderer.on('selene:evento', receber);
            return () => ipcRenderer.removeListener('selene:evento', receber);
        },
    }),
);
