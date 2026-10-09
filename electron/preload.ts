import { contextBridge, ipcRenderer } from 'electron';
import type { Evento, PonteSelene } from '../shared/contratos';

const ponte: PonteSelene = {
    adicionarProjeto: (entrada) => ipcRenderer.invoke('selene:adicionarProjeto', entrada),
    alterarProjeto: (id, nome) => ipcRenderer.invoke('selene:alterarProjeto', id, nome),
    removerProjeto: (id) => ipcRenderer.invoke('selene:removerProjeto', id),
    promoverRascunho: (entrada) => ipcRenderer.invoke('selene:promoverRascunho', entrada),
    verificarAtualizacao: () => ipcRenderer.invoke('selene:verificarAtualizacao'),
    estado: () => ipcRenderer.invoke('selene:estado'),
    novaConversa: (modo, origemId) => ipcRenderer.invoke('selene:nova', modo, origemId),
    alterarConversa: (id, alteracao) => ipcRenderer.invoke('selene:alterar', id, alteracao),
    excluirConversa: (id) => ipcRenderer.invoke('selene:excluir', id),
    excluirConcluidas: () => ipcRenderer.invoke('selene:excluirConcluidas'),
    escolherProjeto: (id, caminho) => ipcRenderer.invoke('selene:projeto', id, caminho),
    importarModelo: () => ipcRenderer.invoke('selene:importar'),
    importarProjetor: (id) => ipcRenderer.invoke('selene:importarProjetor', id),
    anexarImagens: (imagens) => ipcRenderer.invoke('selene:anexarImagens', imagens),
    lerImagem: (id) => ipcRenderer.invoke('selene:lerImagem', id),
    descartarImagens: (ids) => ipcRenderer.invoke('selene:descartarImagens', ids),
    baixarModelo: (id) => ipcRenderer.invoke('selene:baixarModelo', id),
    cancelarDownload: (id) => ipcRenderer.invoke('selene:cancelarDownload', id),
    favoritarModelo: (id, favorito) => ipcRenderer.invoke('selene:favoritarModelo', id, favorito),
    removerModelo: (id) => ipcRenderer.invoke('selene:removerModelo', id),
    instalarMotor: (backend) => ipcRenderer.invoke('selene:instalar', backend),
    carregarModelo: (id) => ipcRenderer.invoke('selene:carregar', id),
    pararMotor: () => ipcRenderer.invoke('selene:pararMotor'),
    configurar: (configuracao) => ipcRenderer.invoke('selene:configurar', configuracao),
    enviar: (id, texto, imagens = []) => ipcRenderer.invoke('selene:enviar', id, texto, imagens),
    cancelar: () => ipcRenderer.invoke('selene:cancelar'),
    aprovar: (id, aprovada) => ipcRenderer.invoke('selene:aprovar', id, aprovada),
    exportarConversa: (id) => ipcRenderer.invoke('selene:exportar', id),
    janela: (acao) => ipcRenderer.send('selene:janela', acao),
    aoEvento: (callback) => {
        const receber = (_evento: Electron.IpcRendererEvent, evento: Evento) => callback(evento);
        ipcRenderer.on('selene:evento', receber);
        return () => ipcRenderer.removeListener('selene:evento', receber);
    },
};
contextBridge.exposeInMainWorld('selene', ponte);
