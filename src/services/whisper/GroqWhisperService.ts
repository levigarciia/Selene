/**
 * Groq Whisper API Service
 * 
 * Uses Groq's Whisper API for fast, free transcription
 * https://console.groq.com/docs/speech-text
 */

export interface GroqWhisperConfig {
    apiKey: string
    model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
    language?: string
    prompt?: string
    temperature?: number
}

export class GroqWhisperService {
    private static instance: GroqWhisperService | null = null
    private config: GroqWhisperConfig
    private ready = false

    private constructor(config: GroqWhisperConfig) {
        this.config = {
            ...config,
            model: config.model || 'whisper-large-v3-turbo' // Fastest model
        }
    }

    static getInstance(config: GroqWhisperConfig): GroqWhisperService {
        if (!GroqWhisperService.instance) {
            GroqWhisperService.instance = new GroqWhisperService(config)
        } else {
            GroqWhisperService.instance.config = {
                ...config,
                model: config.model || 'whisper-large-v3-turbo'
            }
        }
        return GroqWhisperService.instance
    }

    /**
     * Initialize (just validates API key)
     */
    async initialize(): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error('Groq API key is required. Get one free at console.groq.com')
        }

        console.log('[GroqWhisper] Initialized with model:', this.config.model)
        this.ready = true
    }

    /**
     * Transcribe audio using Groq Whisper API
     */
    async transcribe(audioBlob: Blob): Promise<string> {
        if (!this.ready) {
            throw new Error('GroqWhisper not initialized. Call initialize() first.')
        }

        console.log('[GroqWhisper] Starting transcription...')
        const startTime = performance.now()

        try {
            // Create form data
            const formData = new FormData()
            
            // Convert blob to file with proper extension
            const audioFile = new File([audioBlob], 'audio.webm', { 
                type: audioBlob.type || 'audio/webm' 
            })
            formData.append('file', audioFile)
            formData.append('model', this.config.model || 'whisper-large-v3-turbo')
            formData.append('response_format', 'json')
            
            if (this.config.language) {
                formData.append('language', this.config.language)
            }
            if (this.config.prompt) {
                formData.append('prompt', this.config.prompt)
            }
            if (this.config.temperature !== undefined) {
                formData.append('temperature', this.config.temperature.toString())
            }

            // Call Groq API
            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const errorMessage = errorData.error?.message || `HTTP ${response.status}`
                throw new Error(`Groq API error: ${errorMessage}`)
            }

            const data = await response.json()
            const text = data.text?.trim() || ''

            const endTime = performance.now()
            const duration = ((endTime - startTime) / 1000).toFixed(2)

            console.log(`[GroqWhisper] ✅ Transcription complete in ${duration}s`)
            console.log(`[GroqWhisper] Result: "${text.substring(0, 100)}..."`)

            return text
        } catch (error: any) {
            console.error('[GroqWhisper] ❌ Transcription failed:', error)
            
            if (error.message?.includes('401')) {
                throw new Error('Groq API key inválida. Verifique sua chave em console.groq.com')
            }
            if (error.message?.includes('429')) {
                throw new Error('Rate limit Groq atingido. Aguarde alguns segundos.')
            }
            
            throw new Error(`Transcrição Groq falhou: ${error.message}`)
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
    getConfig(): GroqWhisperConfig {
        return { ...this.config }
    }

    /**
     * Update config
     */
    updateConfig(config: Partial<GroqWhisperConfig>): void {
        this.config = { ...this.config, ...config }
        this.ready = false
        console.log('[GroqWhisper] Config updated, reinitialization required')
    }

    /**
     * Dispose
     */
    async dispose(): Promise<void> {
        this.ready = false
        console.log('[GroqWhisper] Disposed')
    }
}

export default GroqWhisperService
