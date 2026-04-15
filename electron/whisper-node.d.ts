// Type definitions for whisper-node (Electron main process)
declare module 'whisper-node' {
    interface WhisperOptions {
        modelPath: string
        audioPath: string
        language?: string
        task?: 'transcribe' | 'translate'
    }

    interface WhisperResult {
        speech?: string
        text?: string
    }

    function whisperNode(options: WhisperOptions): Promise<WhisperResult | WhisperResult[]>

    export default whisperNode
}

// Módulos internos usados para debug/chamada direta
declare module 'whisper-node/dist/whisper.js' {
    export function createCppCommand(config: {
        filePath: string
        modelName?: string | null
        modelPath?: string | null
        options?: Record<string, unknown>
    }): string
}

declare module 'whisper-node/dist/shell.js' {
    type ShellOptions = {
        cwd?: string
        silent?: boolean
        shell?: string
    }
    const fn: (command: string, options?: ShellOptions) => Promise<string>
    export default fn
}

declare module 'whisper-node/dist/tsToArray.js' {
    const fn: (transcript: string) => Array<{ start?: number; end?: number; speech?: string; text?: string }>
    export default fn
}
