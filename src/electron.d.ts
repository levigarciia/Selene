export { };

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
            openExpandedChat?: (messages: any[]) => void;
            onHydrateChat?: (callback: (messages: any[]) => void) => (() => void) | void;
            minimizeWindow?: () => void;
            toggleMaximizeWindow?: () => void;
            closeWindow?: () => void;
            onCollapseToolbar?: (callback: () => void) => (() => void) | void;
            // Auto-update API
            setAutoUpdate?: (enabled: boolean) => void;
            getAutoUpdateStatus?: () => Promise<{ enabled: boolean; currentVersion: string; isPackaged: boolean }>;
            checkForUpdates?: () => Promise<{ success: boolean; message?: string; updateInfo?: any }>;
            installUpdate?: () => void;
            getAppVersion?: () => Promise<string>;
            onUpdateStatus?: (callback: (status: {
                status: string;
                version?: string;
                progress?: { percent: number; bytesPerSecond: number; transferred: number; total: number };
                error?: string;
                currentVersion?: string;
                releaseNotes?: string;
                releaseDate?: string;
            }) => void) => (() => void) | void;
        };
    }
}
