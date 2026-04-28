export { };

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

type RespostaBuscaWebIPC = { success: boolean; data?: Record<string, unknown>; error?: string }
type ConfigWhisperLegadoIPC = Record<string, unknown>
type RespostaAtualizacaoIPC = { success: boolean; message?: string; updateInfo?: Record<string, unknown> }
type ModeloWhisperLocalIPC = {
    name: string
    displayName: string
    size: number
    description: string
    ramRequired: string
    downloaded: boolean
    downloading: boolean
    path: string
}

declare global {
    interface Window {
        electronAPI: {
            setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
            getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
            updateModalRegions: (regions: Array<{ x: number; y: number; width: number; height: number }>) => void;
            fecharAplicacao: () => void;
            onDebugToggle: (callback: (enabled: boolean) => void) => void;
            onCheckHover: (callback: (x: number, y: number) => void) => void;
            registrarAtalhoGramatical?: (atalho: string) => void;
            abrirAssistenteGramatical?: () => void;
            registrarAtalhoScreenshot?: (atalho: string) => void;
            onAtalhoGramatical?: (callback: (textoSelecionado?: string) => void) => (() => void) | void;
            colarClipboardGlobal?: () => void;
            aplicarTextoGramatical?: () => void;
            requestWindowFocus?: () => void;
            capturarScreenshot?: () => Promise<string | null>;
            onAtalhoScreenshot?: (callback: () => void) => () => void;
            registrarAtalhoScreenshotArea?: (atalho: string) => void;
            onAtalhoScreenshotArea?: (callback: () => void) => () => void;
            setAreaSelectionMode?: (enabled: boolean) => void;
            enviarScreenshotParaChat?: (dataUrl: string) => Promise<boolean>;
            onScreenshotChat?: (callback: (dataUrl: string) => void) => (() => void) | void;
            openExpandedChat?: (messages: MensagemChatIPC[]) => void;
            onHydrateChat?: (callback: (messages: MensagemChatIPC[]) => void) => (() => void) | void;
            isWindowMaximized?: () => Promise<boolean>;
            minimizeWindow?: () => void;
            toggleMaximizeWindow?: () => void;
            closeWindow?: () => void;
            startWindowDrag?: () => void;
            stopWindowDrag?: () => void;
            onWindowMaximizedChange?: (callback: (maximizada: boolean) => void) => (() => void) | void;
            onCollapseToolbar?: (callback: () => void) => (() => void) | void;
            // Auto-update API
            setAutoUpdate?: (enabled: boolean) => void;
            getAutoUpdateStatus?: () => Promise<{ enabled: boolean; currentVersion: string; isPackaged: boolean }>;
            checkForUpdates?: () => Promise<RespostaAtualizacaoIPC>;
            installUpdate?: () => void;
            getAppVersion?: () => Promise<string>;
            onUpdateStatus?: (callback: (status: StatusAtualizacaoIPC) => void) => (() => void) | void;
            // Whisper local API
            getUserDataPath?: () => Promise<string>;
            whisperBinaryExists?: (binaryPath?: string) => Promise<boolean>;
            whisperModelExists?: (modelSize: string) => Promise<boolean>;
            whisperDownloadModel?: (modelSize: string) => Promise<{ success: boolean; error?: string }>;
            whisperInitialize?: (config: ConfigWhisperLegadoIPC) => Promise<{ success: boolean; error?: string }>;
            whisperTranscribe?: (audioBuffer: Buffer, config: ConfigWhisperLegadoIPC) => Promise<{ success: boolean; text?: string; error?: string }>;
            onWhisperDownloadProgress?: (callback: (progress: { percent: number; downloaded: number; total: number }) => void) => (() => void) | void;
            // Web search
            webSearch?: (query: string, maxResults?: number) => Promise<RespostaBuscaWebIPC>;
            webFetchPage?: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>;
            // Open external URL
            openExternal?: (url: string) => Promise<{ success: boolean; error?: string }>;
            
            // Local Whisper Streaming API
            localWhisper?: {
                // Model management
                listModels: () => Promise<{ success: boolean; models?: ModeloWhisperLocalIPC[]; error?: string }>;
                getModelStatus: (modelName: string) => Promise<{ success: boolean; downloaded?: boolean; downloading?: boolean; error?: string }>;
                downloadModel: (modelName: string) => Promise<{ success: boolean; modelName?: string; path?: string; error?: string }>;
                cancelDownload: (modelName: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
                deleteModel: (modelName: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
                getStorageInfo: () => Promise<{ success: boolean; totalUsed?: number; totalUsedFormatted?: string; downloadedCount?: number; downloadedModels?: string[]; error?: string }>;
                
                // Transcription session management
                startSession: (config: { model?: string; language?: string; speakerLabel?: string; noGpu?: boolean }) => 
                    Promise<{ success: boolean; sessionId?: string; model?: string; language?: string; speakerLabel?: string | null; error?: string }>;
                sendAudio: (sessionId: string, audioData: ArrayBuffer) => Promise<{ success: boolean; error?: string }>;
                stopSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
                checkAvailability: () => Promise<{ success: boolean; binaryAvailable?: boolean; hasModels?: boolean; downloadedModels?: string[]; available?: boolean; error?: string }>;
                
                // Event listeners
                onDownloadProgress: (callback: (data: { modelName: string; downloaded: number; total: number; percent: number }) => void) => () => void;
                onDownloadComplete: (callback: (data: { modelName: string; success: boolean; path: string }) => void) => () => void;
                onDownloadError: (callback: (data: { modelName: string; error: string }) => void) => () => void;
                onTranscriptionDelta: (callback: (data: { sessionId: string; delta: string; text: string; speakerLabel?: string }) => void) => () => void;
                onTranscriptionComplete: (callback: (data: { sessionId: string; text: string; speakerLabel?: string }) => void) => () => void;
                onTranscriptionError: (callback: (data: { sessionId: string; error: string }) => void) => () => void;
            };

            // MCP (Model Context Protocol) API
            mcp?: {
                getServers: () => Promise<Array<{ config: { id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }; status: 'disconnected' | 'connecting' | 'connected' | 'error'; toolCount: number }>>;
                getConfig: () => Promise<Array<{ id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }>>;
                addServer: (config: { id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }) => Promise<{ success: boolean; error?: string }>;
                removeServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                connect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                getStatus: (serverId: string) => Promise<'disconnected' | 'connecting' | 'connected' | 'error'>;
                getTools: (serverId: string) => Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>>;
                getAllTools: () => Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown>; serverId: string; serverName: string }>>;
                callTool: (serverId: string, toolName: string, args: unknown) => Promise<{ success: boolean; result?: unknown; error?: string }>;
            };
        };
    }
}
