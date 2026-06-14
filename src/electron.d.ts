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

type ModeloParakeetLocalIPC = {
    name: string
    displayName: string
    size: number
    description: string
    ramRequired: string
    downloaded: boolean
    downloading: boolean
    experimental?: boolean
    recommendedForPtBr?: boolean
    path: string
}

type ModeloLLMLocalIPC = {
    id: string
    familia: 'llama' | 'qwen' | 'gemma' | 'phi' | 'deepseek'
    nome: string
    descricao: string
    repoId: string
    arquivo: string
    url: string
    tamanhoEstimado: number
    tamanhoFormatado: string
    ramRecomendada: string
    contexto: number
    capacidades: {
        reasoning?: boolean
        ferramentas?: boolean
        estruturado?: boolean
    }
    downloaded: boolean
    downloading: boolean
    path: string
}

type ConfigHttpLLMLocalIPC = {
    baseUrl: string
    key: string
    running: boolean
    error: string | null
}

type LlamaServerSettingsIPC = {
    runtimeType: 'cpu' | 'vulkan' | 'hip'
    gpuOn: boolean
    gpuLayers: number
    offloadKv: boolean
    threads: number
    noMmap: boolean
    mlock: boolean
    ctxSize: number
    flashAttn: boolean
    fitOn: boolean
    cacheRam: number
    ctxCheckpoints: number
    gpuDevice: string
    usarServidorExterno: boolean
    urlServidorExterno: string
    modeloServidorExterno: string
}

type GPUHardwareInfoIPC = {
    name: string
    vramBytes: number
}

type HardwareInfoIPC = {
    cpuName: string
    cpuArch: string
    totalRamBytes: number
    gpus: GPUHardwareInfoIPC[]
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
            localParakeet?: {
                listModels: () => Promise<{ success: boolean; models?: ModeloParakeetLocalIPC[]; error?: string }>;
                getModelStatus: (modelName: string) => Promise<{ success: boolean; downloaded?: boolean; downloading?: boolean; error?: string }>;
                downloadModel: (modelName: string) => Promise<{ success: boolean; modelName?: string; path?: string; error?: string }>;
                cancelDownload: (modelName: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
                deleteModel: (modelName: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
                startSession: (config: { model?: string; language?: string; speakerLabel?: string }) =>
                    Promise<{ success: boolean; sessionId?: string; model?: string; language?: string; speakerLabel?: string | null; error?: string }>;
                sendAudioChunk: (sessionId: string, audioData: ArrayBuffer) => Promise<{ success: boolean; error?: string }>;
                stopSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
                checkAvailability: () => Promise<{ success: boolean; runtimeAvailable?: boolean; hasModels?: boolean; cacheDir?: string; downloadedModels?: string[]; available?: boolean; error?: string }>;
                onDownloadProgress: (callback: (data: { modelName: string; downloaded: number; total: number; percent: number }) => void) => () => void;
                onDownloadComplete: (callback: (data: { modelName: string; success: boolean; path: string }) => void) => () => void;
                onDownloadError: (callback: (data: { modelName: string; error: string }) => void) => () => void;
                onTranscriptionComplete: (callback: (data: { sessionId: string; text: string; chunkIndex?: number; speakerLabel?: string }) => void) => () => void;
                onTranscriptionError: (callback: (data: { sessionId: string; error: string; chunkIndex?: number; speakerLabel?: string }) => void) => () => void;
            };
            localLLM?: {
                checkAvailability: () => Promise<{
                    success: boolean;
                    runtimeAvailable?: boolean;
                    runtimePath?: string | null;
                    platformSupported?: boolean;
                    runtimeDir?: string;
                    downloading?: boolean;
                    hasModels?: boolean;
                    downloadedModels?: string[];
                    available?: boolean;
                    http?: ConfigHttpLLMLocalIPC;
                    error?: string;
                }>;
                listModels: () => Promise<{ success: boolean; models?: ModeloLLMLocalIPC[]; error?: string }>;
                downloadRuntime: (runtimeType: 'cpu' | 'vulkan') => Promise<{ success: boolean; path?: string; error?: string }>;
                downloadModel: (modelId: string) => Promise<{ success: boolean; modelId?: string; path?: string; error?: string }>;
                cancelDownload: (modelId: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
                deleteModel: (modelId: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
                ensureServer: (modelId: string) => Promise<{
                    success: boolean;
                    modelId?: string;
                    baseUrl?: string;
                    port?: number;
                    http?: ConfigHttpLLMLocalIPC;
                    error?: string;
                }>;
                getHttpConfig: () => Promise<({ success: boolean; error?: string } & Partial<ConfigHttpLLMLocalIPC>)>;
                rotateHttpKey: () => Promise<({ success: boolean; error?: string } & Partial<ConfigHttpLLMLocalIPC>)>;
                getServerSettings: () => Promise<{ success: boolean; settings?: LlamaServerSettingsIPC; error?: string }>;
                setServerSettings: (settings: LlamaServerSettingsIPC) => Promise<{ success: boolean; error?: string }>;
                getHardwareInfo: () => Promise<{ success: boolean; hardware?: HardwareInfoIPC; error?: string }>;
                onRuntimeProgress: (callback: (data: { downloaded: number; total: number; percent: number }) => void) => () => void;
                onModelProgress: (callback: (data: { modelId: string; downloaded: number; total: number; percent: number }) => void) => () => void;
                onDownloadError: (callback: (data: { tipo: 'runtime' | 'model'; modelId?: string; error: string }) => void) => () => void;
                streamChat: (reqId: string, modelId: string, mensagens: unknown[], opcoes: unknown) => Promise<{ success: boolean; error?: string }>;
                cancelStreamChat: (reqId: string) => Promise<{ success: boolean; error?: string }>;
                onStreamChunk: (callback: (data: { reqId: string; data: string }) => void) => () => void;
                onStreamEnd: (callback: (data: { reqId: string; success: boolean; error?: string }) => void) => () => void;
            };

            // MCP (Model Context Protocol) API
            mcp?: {
                getServers: () => Promise<Array<{ config: { id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }; status: 'disconnected' | 'connecting' | 'connected' | 'error'; toolCount: number }>>;
                getConfig: () => Promise<Array<{ id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }>>;
                getServers: () => Promise<Array<{ config: { id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }; status: 'disconnected' | 'connecting' | 'connected' | 'error'; toolCount: number }>>;
                getConfig: () => Promise<Array<{ id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }>>;
                addServer: (config: { id: string; name: string; command?: string; args?: string[]; env?: Record<string, string>; headers?: Record<string, string>; transport?: 'stdio' | 'streamable-http'; url?: string; enabled: boolean; autoConnect?: boolean; icon?: string }) => Promise<{ success: boolean; error?: string }>;
                removeServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                connect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
                getStatus: (serverId: string) => Promise<'disconnected' | 'connecting' | 'connected' | 'error'>;
                getTools: (serverId: string) => Promise<Array<{
                    name: string;
                    description: string;
                    inputSchema: Record<string, unknown>;
                    annotations?: {
                        readOnlyHint?: boolean;
                        destructiveHint?: boolean;
                        idempotentHint?: boolean;
                        openWorldHint?: boolean;
                    };
                }>>;
                getAllTools: () => Promise<Array<{
                    name: string;
                    description: string;
                    inputSchema: Record<string, unknown>;
                    serverId: string;
                    serverName: string;
                    annotations?: {
                        readOnlyHint?: boolean;
                        destructiveHint?: boolean;
                        idempotentHint?: boolean;
                        openWorldHint?: boolean;
                    };
                }>>;
                callTool: (serverId: string, toolName: string, args: unknown) => Promise<{ success: boolean; result?: unknown; error?: string }>;
            };
            filesystem?: {
                execCommand: (comando: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>;
                writeFile: (caminhoAbsoluto: string, conteudo: string) => Promise<{ success: boolean; error?: string }>;
                readFile: (caminhoAbsoluto: string, linhaInicio?: number, linhaFim?: number) => Promise<{ success: boolean; content?: string; contentBuffer?: Uint8Array; isBinary?: boolean; isDirectory?: boolean; files?: string[]; error?: string }>;
                replaceText: (caminhoAbsoluto: string, textoAntigo: string, textoNovo: string) => Promise<{ success: boolean; error?: string }>;
                presentFile: (caminhoAbsoluto: string) => Promise<{ success: boolean; error?: string }>;
                deleteFile: (caminhoAbsoluto: string) => Promise<{ success: boolean; error?: string }>;
            };
        };
    }
}
