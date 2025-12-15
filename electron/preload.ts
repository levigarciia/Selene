import { ipcRenderer, contextBridge, desktopCapturer, screen } from 'electron'

console.log('[preload] inicializado', { contextIsolation: process.contextIsolated })

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
        ipcRenderer.send('set-ignore-mouse-events', ignore, options)
    },
    getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
    updateModalRegions: (regions: Array<{ x: number; y: number; width: number; height: number }>) => {
        ipcRenderer.send('update-modal-regions', regions)
    },
    fecharAplicacao: () => {
        ipcRenderer.send('fechar-aplicacao')
    },
    registrarAtalhoGramatical: (atalho: string) => {
        ipcRenderer.send('registrar-atalho-gramatical', atalho)
    },
    abrirAssistenteGramatical: () => {
        ipcRenderer.send('abrir-assistente-gramatical')
    },
    onAtalhoGramatical: (callback: (textoSelecionado?: string) => void) => {
        const listener = (_event: unknown, textoSelecionado?: string) => callback(textoSelecionado)
        ipcRenderer.on('atalho-gramatical', listener)
        return () => ipcRenderer.removeListener('atalho-gramatical', listener)
    },
    onDebugToggle: (callback: (enabled: boolean) => void) => {
        ipcRenderer.on('debug-mode-toggle', (_event, enabled) => callback(enabled))
    },
    onCheckHover: (callback: (x: number, y: number) => void) => {
        ipcRenderer.on('check-hover', (_event, x, y) => callback(x, y))
    },
    colarClipboardGlobal: () => {
        ipcRenderer.send('colar-clipboard-global')
    },
    aplicarTextoGramatical: () => {
        ipcRenderer.send('aplicar-texto-gramatical')
    },
    requestWindowFocus: () => {
        ipcRenderer.send('request-window-focus')
    },
    registrarAtalhoScreenshot: (atalho: string) => {
        ipcRenderer.send('registrar-atalho-screenshot', atalho)
    },
    capturarScreenshot: async () => {
        return ipcRenderer.invoke('capturar-screenshot')
    },
    onAtalhoScreenshot: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on('atalho-screenshot', listener)
        return () => ipcRenderer.removeListener('atalho-screenshot', listener)
    },
    openExpandedChat: (messages: any[]) => {
        ipcRenderer.send('open-expanded-chat', messages)
    },
    onHydrateChat: (callback: (messages: any[]) => void) => {
        const listener = (_event: any, messages: any[]) => callback(messages)
        ipcRenderer.on('hydrate-chat', listener)
        return () => ipcRenderer.removeListener('hydrate-chat', listener)
    },
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    toggleMaximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    onCollapseToolbar: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on('collapse-toolbar', listener)
        return () => ipcRenderer.removeListener('collapse-toolbar', listener)
    },
    // Auto-update API
    setAutoUpdate: (enabled: boolean) => {
        ipcRenderer.send('set-auto-update', enabled)
    },
    getAutoUpdateStatus: () => ipcRenderer.invoke('get-auto-update-status'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => {
        ipcRenderer.send('install-update')
    },
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateStatus: (callback: (status: any) => void) => {
        const listener = (_event: any, status: any) => callback(status)
        ipcRenderer.on('update-status', listener)
        return () => ipcRenderer.removeListener('update-status', listener)
    }
})
