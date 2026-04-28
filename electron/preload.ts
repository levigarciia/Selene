import { ipcRenderer, contextBridge } from 'electron'

console.log('[preload] inicializado', { contextIsolation: process.contextIsolated })

type MensagemChatIPC = {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    images?: string[]
    imagensContexto?: Array<{
        src: string
        resumo?: string
        statusResumo?: 'pendente' | 'gerando' | 'concluido' | 'falhou'
    }>
    raciocinio?: string
}

type StatusAtualizacaoIPC = {
    status: string
    version?: string
    progress?: { percent: number; bytesPerSecond: number; transferred: number; total: number }
    error?: string
    currentVersion?: string
    releaseNotes?: string
    releaseDate?: string
}

type ConfigWhisperLegado = Record<string, unknown>

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
    setAreaSelectionMode: (enabled: boolean) => {
        ipcRenderer.send('set-area-selection-mode', enabled)
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
    registrarAtalhoScreenshotArea: (atalho: string) => {
        ipcRenderer.send('registrar-atalho-screenshot-area', atalho)
    },
    onAtalhoScreenshotArea: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on('atalho-screenshot-area', listener)
        return () => ipcRenderer.removeListener('atalho-screenshot-area', listener)
    },
    enviarScreenshotParaChat: (dataUrl: string) => ipcRenderer.invoke('enviar-screenshot-chat', dataUrl),
    onScreenshotChat: (callback: (dataUrl: string) => void) => {
        const listener = (_event: unknown, dataUrl: string) => callback(dataUrl)
        ipcRenderer.on('chat-receber-screenshot', listener)
        return () => ipcRenderer.removeListener('chat-receber-screenshot', listener)
    },
    openExpandedChat: (messages: MensagemChatIPC[]) => {
        ipcRenderer.send('open-expanded-chat', messages)
    },
    onHydrateChat: (callback: (messages: MensagemChatIPC[]) => void) => {
        const listener = (_event: unknown, messages: MensagemChatIPC[]) => callback(messages)
        ipcRenderer.on('hydrate-chat', listener)
        return () => ipcRenderer.removeListener('hydrate-chat', listener)
    },
    isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    toggleMaximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    startWindowDrag: () => ipcRenderer.send('window-start-drag'),
    stopWindowDrag: () => ipcRenderer.send('window-stop-drag'),
    onWindowMaximizedChange: (callback: (maximizada: boolean) => void) => {
        const listener = (_event: unknown, maximizada: boolean) => callback(maximizada)
        ipcRenderer.on('window-maximized-change', listener)
        return () => ipcRenderer.removeListener('window-maximized-change', listener)
    },
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
    onUpdateStatus: (callback: (status: StatusAtualizacaoIPC) => void) => {
        const listener = (_event: unknown, status: StatusAtualizacaoIPC) => callback(status)
        ipcRenderer.on('update-status', listener)
        return () => ipcRenderer.removeListener('update-status', listener)
    },
    // User data path for Whisper models
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    // Whisper local transcription (legacy)
    whisperBinaryExists: (binaryPath?: string) => ipcRenderer.invoke('whisper-binary-exists', binaryPath),
    whisperModelExists: (modelSize: string) => ipcRenderer.invoke('whisper-model-exists', modelSize),
    whisperDownloadModel: (modelSize: string) => ipcRenderer.invoke('whisper-download-model', modelSize),
    whisperInitialize: (config: ConfigWhisperLegado) => ipcRenderer.invoke('whisper-initialize', config),
    whisperTranscribe: (audioBuffer: Buffer, config: ConfigWhisperLegado) => ipcRenderer.invoke('whisper-transcribe', audioBuffer, config),
    onWhisperDownloadProgress: (callback: (progress: { percent: number; downloaded: number; total: number }) => void) => {
        const listener = (_event: unknown, progress: { percent: number; downloaded: number; total: number }) => callback(progress)
        ipcRenderer.on('whisper-download-progress', listener)
        return () => ipcRenderer.removeListener('whisper-download-progress', listener)
    },
    // Web search
    webSearch: (query: string, maxResults?: number) => ipcRenderer.invoke('web-search', query, maxResults),
    // Conteudo de pagina via main
    webFetchPage: (url: string) => ipcRenderer.invoke('web-fetch-page', url),
    // Open URL in external browser
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    
    // ==========================================
    // Local Whisper Streaming API (new)
    // ==========================================
    localWhisper: {
        // Model management
        listModels: () => ipcRenderer.invoke('whisper-local:list-models'),
        getModelStatus: (modelName: string) => ipcRenderer.invoke('whisper-local:get-model-status', modelName),
        downloadModel: (modelName: string) => ipcRenderer.invoke('whisper-local:download-model', modelName),
        cancelDownload: (modelName: string) => ipcRenderer.invoke('whisper-local:cancel-download', modelName),
        deleteModel: (modelName: string) => ipcRenderer.invoke('whisper-local:delete-model', modelName),
        getStorageInfo: () => ipcRenderer.invoke('whisper-local:get-storage-info'),

        // Transcription session management
        startSession: (config: { model?: string; language?: string; speakerLabel?: string; noGpu?: boolean }) => 
            ipcRenderer.invoke('whisper-local:start-session', config),
        sendAudio: (sessionId: string, audioData: ArrayBuffer) => 
            ipcRenderer.invoke('whisper-local:send-audio', sessionId, audioData),
        stopSession: (sessionId: string) => ipcRenderer.invoke('whisper-local:stop-session', sessionId),
        checkAvailability: () => ipcRenderer.invoke('whisper-local:check-availability'),

        // Event listeners for download progress
        onDownloadProgress: (callback: (data: { modelName: string; downloaded: number; total: number; percent: number }) => void) => {
            const handler = (_event: unknown, data: { modelName: string; downloaded: number; total: number; percent: number }) => callback(data)
            ipcRenderer.on('whisper-local:download-progress', handler)
            return () => ipcRenderer.removeListener('whisper-local:download-progress', handler)
        },
        onDownloadComplete: (callback: (data: { modelName: string; success: boolean; path: string }) => void) => {
            const handler = (_event: unknown, data: { modelName: string; success: boolean; path: string }) => callback(data)
            ipcRenderer.on('whisper-local:download-complete', handler)
            return () => ipcRenderer.removeListener('whisper-local:download-complete', handler)
        },
        onDownloadError: (callback: (data: { modelName: string; error: string }) => void) => {
            const handler = (_event: unknown, data: { modelName: string; error: string }) => callback(data)
            ipcRenderer.on('whisper-local:download-error', handler)
            return () => ipcRenderer.removeListener('whisper-local:download-error', handler)
        },
        
        // Event listeners for transcription results
        onTranscriptionDelta: (callback: (data: { sessionId: string; delta: string; text: string; speakerLabel?: string }) => void) => {
            const handler = (_event: unknown, data: { sessionId: string; delta: string; text: string; speakerLabel?: string }) => {
                console.log('[preload] whisper-local:transcription-delta', data.sessionId, data.text)
                callback(data)
            }
            ipcRenderer.on('whisper-local:transcription-delta', handler)
            return () => ipcRenderer.removeListener('whisper-local:transcription-delta', handler)
        },
        onTranscriptionComplete: (callback: (data: { sessionId: string; text: string; speakerLabel?: string }) => void) => {
            const handler = (_event: unknown, data: { sessionId: string; text: string; speakerLabel?: string }) => {
                console.log('[preload] whisper-local:transcription-complete', data.sessionId, data.text)
                callback(data)
            }
            ipcRenderer.on('whisper-local:transcription-complete', handler)
            return () => ipcRenderer.removeListener('whisper-local:transcription-complete', handler)
        },
        onTranscriptionError: (callback: (data: { sessionId: string; error: string }) => void) => {
            const handler = (_event: unknown, data: { sessionId: string; error: string }) => {
                console.log('[preload] whisper-local:transcription-error', data.sessionId, data.error)
                callback(data)
            }
            ipcRenderer.on('whisper-local:transcription-error', handler)
            return () => ipcRenderer.removeListener('whisper-local:transcription-error', handler)
        }
    },

    // ==========================================
    // MCP (Model Context Protocol) API
    // ==========================================
    mcp: {
        // Server management
        getServers: () => ipcRenderer.invoke('mcp:get-servers'),
        getConfig: () => ipcRenderer.invoke('mcp:get-config'),
        addServer: (config: { id: string; name: string; command: string; args: string[]; env?: Record<string, string>; enabled: boolean; autoConnect?: boolean }) => 
            ipcRenderer.invoke('mcp:add-server', config),
        removeServer: (serverId: string) => ipcRenderer.invoke('mcp:remove-server', serverId),
        
        // Connection management
        connect: (serverId: string) => ipcRenderer.invoke('mcp:connect', serverId),
        disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
        getStatus: (serverId: string) => ipcRenderer.invoke('mcp:get-status', serverId),
        
        // Tools
        getTools: (serverId: string) => ipcRenderer.invoke('mcp:get-tools', serverId),
        getAllTools: () => ipcRenderer.invoke('mcp:get-all-tools'),
        callTool: (serverId: string, toolName: string, args: unknown) => 
            ipcRenderer.invoke('mcp:call-tool', serverId, toolName, args)
    }
})
