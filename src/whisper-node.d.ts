// Type definitions for whisper-node
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
