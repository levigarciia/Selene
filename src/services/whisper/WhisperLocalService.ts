/**
 * WhisperLocalService (Renderer Process)
 * 
 * Client for Whisper functionality via IPC with main process
 */

import { Buffer } from 'buffer'

export type WhisperModelSize = 'tiny' | 'base' | 'base-q5' | 'turbo' | 'small' | 'small-q5' | 'medium' | 'medium-q5' | 'large'

export interface WhisperConfig {
    modelSize: WhisperModelSize
    language?: string
    task?: 'transcribe' | 'translate'
    binaryPath?: string
}

// Informacoes do modelo para UI
const MODEL_INFO: Record<WhisperModelSize, { size: string; desc: string }> = {
    tiny: { size: '~75 MB', desc: 'Fastest, lower accuracy' },
    base: { size: '~145 MB', desc: 'Good balance' },
    'base-q5': { size: '~57 MB', desc: '⚡ 2x faster than Base' },
    turbo: { size: '~550 MB', desc: 'High accuracy, faster inference' },
    small: { size: '~480 MB', desc: 'Better accuracy' },
    'small-q5': { size: '~182 MB', desc: '⚡ 2x faster than Small' },
    medium: { size: '~1.5 GB', desc: 'High accuracy' },
    'medium-q5': { size: '~514 MB', desc: '⚡ 2x faster than Medium' },
    large: { size: '~3 GB', desc: 'Best accuracy, slowest' }
}

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return fallback
}

export class WhisperLocalService {
    private static instance: WhisperLocalService | null = null
    private config: WhisperConfig
    private ready = false
    private initializing = false

    private constructor(config: WhisperConfig) {
        this.config = config
    }

    static getInstance(config: WhisperConfig): WhisperLocalService {
        if (!WhisperLocalService.instance) {
            WhisperLocalService.instance = new WhisperLocalService(config)
        } else {
            WhisperLocalService.instance.config = config
        }
        return WhisperLocalService.instance
    }

    /**
     * Initialize Whisper
     * Downloads model if needed, then initializes whisper-node
     */
    async initialize(): Promise<void> {
        if (this.ready) {
            console.log('[WhisperLocal] Already initialized')
            return
        }

        if (this.initializing) {
            console.log('[WhisperLocal] Already initializing, waiting...')
            while (this.initializing) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
            return
        }

        this.initializing = true
        const modelInfo = MODEL_INFO[this.config.modelSize]

        console.log(`[WhisperLocal] Initializing ${this.config.modelSize} model...`)
        console.log(`[WhisperLocal] Size: ${modelInfo.size} - ${modelInfo.desc}`)

        try {
            const binaryPath = this.config.binaryPath?.trim()
            const binarioExiste = await window.electronAPI?.whisperBinaryExists?.(binaryPath || undefined)
            if (binarioExiste === false) {
                throw new Error('whisper-node não está compilado. Rode "make" em node_modules/whisper-node/lib/whisper.cpp (gera main/main.exe) ou selecione transcrição em nuvem.')
            }
            // Check if model exists
            const exists = await window.electronAPI?.whisperModelExists?.(this.config.modelSize)
            
            if (!exists) {
                console.log('[WhisperLocal] Model not found, downloading...')
                console.log(`[WhisperLocal] This will download ${modelInfo.size}`)
                
                // Download model with progress
                const result = await window.electronAPI?.whisperDownloadModel?.(this.config.modelSize)
                
                if (!result?.success) {
                    throw new Error(result?.error || 'Download failed')
                }
                
                console.log('[WhisperLocal] ✅ Model downloaded!')
            } else {
                console.log('[WhisperLocal] Model found locally')
            }

            // Initialize whisper-node in main process
            const initResult = await window.electronAPI?.whisperInitialize?.({ ...this.config })
            
            if (!initResult?.success) {
                throw new Error(initResult?.error || 'Initialization failed')
            }

            this.ready = true
            console.log('[WhisperLocal] ✅ Whisper initialized and ready!')
        } catch (error: unknown) {
            console.error('[WhisperLocal] 🛑 Failed to initialize:', error)
            this.ready = false
            
            const msg = obterMensagemErro(error, 'Motivo desconhecido')
            let errorMsg = 'Falha ao inicializar o Whisper'
            if (msg.includes('download') || msg.includes('fetch')) {
                errorMsg += ': problema de rede ao baixar modelo.'
            } else if (msg.includes('whisper-node')) {
                errorMsg += `: falha ao carregar whisper-node. ${msg} Use transcrição na nuvem ou compile o binário.`
            } else if (msg.includes('compilado') || msg.includes('make')) {
                errorMsg += `: ${msg}`
            } else {
                errorMsg += `: ${msg}`
            }
            
            throw new Error(errorMsg)
        } finally {
            this.initializing = false
        }
    }

    /**
     * Transcribe audio blob
     */
    async transcribe(audioBlob: Blob): Promise<string> {
        if (!this.ready) {
            throw new Error('Whisper not initialized. Call initialize() first.')
        }

        console.log('[WhisperLocal] Starting transcription...')
        const startTime = performance.now()

        try {
            // Convert blob to buffer
            const arrayBuffer = await audioBlob.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Call main process to transcribe
            const result = await window.electronAPI?.whisperTranscribe?.(buffer, { ...this.config })

            if (!result?.success) {
                throw new Error(result?.error || 'Transcription failed')
            }

            const endTime = performance.now()
            const duration = ((endTime - startTime) / 1000).toFixed(2)

            console.log(`[WhisperLocal] ✅ Transcription complete in ${duration}s`)
            console.log(`[WhisperLocal] Result: "${result.text}"`)

            return result.text || ''
        } catch (error: unknown) {
            console.error('[WhisperLocal] ❌ Transcription failed:', error)
            throw new Error(`Transcription failed: ${obterMensagemErro(error, 'Falha desconhecida')}`)
        }
    }

    /**
     * Check if ready
     */
    isReady(): boolean {
        return this.ready
    }

    /**
     * Get configuration
     */
    getConfig(): WhisperConfig {
        return { ...this.config }
    }

    /**
     * Dispose
     */
    async dispose(): Promise<void> {
        this.ready = false
        console.log('[WhisperLocal] Disposed')
    }

    /**
     * Update config (requires reinit)
     */
    updateConfig(config: Partial<WhisperConfig>): void {
        this.config = { ...this.config, ...config }
        this.ready = false
        console.log('[WhisperLocal] Config updated, reinitialization required')
    }
}

export default WhisperLocalService
