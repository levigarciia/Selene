/**
 * useVoiceInput Hook
 * 
 * Enhanced audio hook that supports both cloud-based (OpenAI Whisper API)
 * and local (Whisper.cpp streaming) transcription.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioService } from '../services/AudioService'
import type { AIService } from '../services/AIService'
import type { WhisperModelSize } from '../services/whisper'

export type TranscriptionProvider = 'cloud' | 'local'

export interface VoiceInputConfig {
    provider: TranscriptionProvider
    whisperModel?: WhisperModelSize
    language?: string
    whisperBinaryPath?: string
    microfoneId?: string
}

export interface UseVoiceInputReturn {
    isRecording: boolean
    isTranscribing: boolean
    transcription: string
    setTranscription: (text: string) => void
    toggleRecording: () => Promise<void>
    
    // Provider management
    provider: TranscriptionProvider
    setProvider: (provider: TranscriptionProvider) => void
    
    // Local Whisper config
    whisperConfig: {
        modelSize: WhisperModelSize
        language?: string
        binaryPath?: string
    }
    setWhisperModel: (model: WhisperModelSize) => void
    whisperBinaryPath: string
    setWhisperBinaryPath: (path: string) => void
    isWhisperReady: boolean
    initializeWhisper: () => Promise<void>
    microfoneId: string
    setMicrofoneId: (microfoneId: string) => void
    nivelAudio: number
    barrasAudio: number[]
    
    // Errors
    error: string | null
    clearError: () => void
}

const STORAGE_KEY = 'selene_voice_input_config'
const QTD_BARRAS_AUDIO = 24

export function useVoiceInput(aiService: AIService | null): UseVoiceInputReturn {
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcription, setTranscription] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isWhisperReady, setIsWhisperReady] = useState(false)
    const [nivelAudio, setNivelAudio] = useState(0)
    const [barrasAudio, setBarrasAudio] = useState<number[]>(
        () => new Array(QTD_BARRAS_AUDIO).fill(0)
    )
    
    // Load config from storage
    const [config, setConfig] = useState<VoiceInputConfig>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                return JSON.parse(stored) as VoiceInputConfig
            }
        } catch (e) {
            console.warn('[useVoiceInput] Failed to load config:', e)
        }
        return {
            provider: 'cloud',
            whisperModel: 'base',
            language: 'pt',
            whisperBinaryPath: '',
            microfoneId: ''
        }
    })
    
    // Refs
    const serviceRef = useRef<AIService | null>(aiService)
    const audioServiceRef = useRef<AudioService | null>(null)
    const chunksRef = useRef<Blob[]>([])
    
    // Local Whisper streaming refs
    const sessionIdRef = useRef<string | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const freqDataRef = useRef<Uint8Array | null>(null)
    const timeDataRef = useRef<Uint8Array | null>(null)
    const rafAudioRef = useRef<number | null>(null)
    const cleanupListenersRef = useRef<(() => void)[]>([])
    const accumulatedTextRef = useRef<string>('') // Keeps confirmed transcriptions
    const nivelSuavizadoRef = useRef(0)
    const barrasSuavizadasRef = useRef<number[]>([])
    
    // Update AI service ref
    useEffect(() => {
        serviceRef.current = aiService
    }, [aiService])
    
    // Persist config
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    }, [config])
    
    // Check local whisper availability on mount
    useEffect(() => {
        checkLocalWhisperAvailability()
    }, [])
    
    // Setup streaming transcription listeners
    useEffect(() => {
        const api = window.electronAPI?.localWhisper
        if (!api) return
        
        // Listen for transcription deltas (real-time updates)
        // data.text contains the accumulated transcript from current utterance
        const unsubDelta = api.onTranscriptionDelta((data) => {
            if (data.sessionId === sessionIdRef.current) {
                // Show confirmed text + current utterance in progress
                const fullText = accumulatedTextRef.current 
                    ? `${accumulatedTextRef.current} ${data.text}`
                    : data.text
                setTranscription(fullText)
            }
        })
        cleanupListenersRef.current.push(unsubDelta)
        
        // Listen for transcription completion (utterance finished)
        // When utterance completes, add it to the accumulated confirmed text
        const unsubComplete = api.onTranscriptionComplete((data) => {
            if (data.sessionId === sessionIdRef.current && data.text) {
                // Add completed utterance to accumulated text
                accumulatedTextRef.current = accumulatedTextRef.current 
                    ? `${accumulatedTextRef.current} ${data.text}`
                    : data.text
                setTranscription(accumulatedTextRef.current)
                console.log('[useVoiceInput] Transcription complete, accumulated:', accumulatedTextRef.current)
            }
        })
        cleanupListenersRef.current.push(unsubComplete)
        
        // Listen for errors
        const unsubError = api.onTranscriptionError((data) => {
            if (data.sessionId === sessionIdRef.current) {
                console.error('[useVoiceInput] Streaming error:', data.error)
                setError(data.error)
            }
        })
        cleanupListenersRef.current.push(unsubError)
        
        return () => {
            cleanupListenersRef.current.forEach(unsub => unsub())
            cleanupListenersRef.current = []
        }
    }, [])
    
    const checkLocalWhisperAvailability = async () => {
        try {
            const result = await window.electronAPI?.localWhisper?.checkAvailability()
            if (result?.success && result.available) {
                setIsWhisperReady(true)
            }
        } catch (err) {
            console.error('[useVoiceInput] Failed to check local whisper:', err)
        }
    }
    
    // Initialize (check availability)
    const initializeWhisper = useCallback(async () => {
        try {
            setError(null)
            console.log('[useVoiceInput] Checking local whisper availability...')
            
            const result = await window.electronAPI?.localWhisper?.checkAvailability()
            
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to check availability')
            }
            
            if (!result.binaryAvailable) {
                throw new Error('Binário do Whisper não encontrado. Compile whisper.cpp ou copie para native/whisper/bin/')
            }
            
            if (!result.hasModels) {
                throw new Error('Nenhum modelo baixado. Baixe pelo menos um modelo.')
            }
            
            setIsWhisperReady(true)
            console.log('[useVoiceInput] Local whisper is ready')
            
        } catch (e: any) {
            console.error('[useVoiceInput] Whisper init failed:', e)
            setError(e.message || 'Falha ao inicializar Whisper')
            setIsWhisperReady(false)
        }
    }, [])
    
    // Handle cloud transcription
    const handleCloudTranscription = useCallback(async (audioBlob: Blob) => {
        setIsTranscribing(true)
        setError(null)
        
        try {
            if (!serviceRef.current) {
                throw new Error('Serviço de IA não disponível')
            }
            
            const text = await serviceRef.current.transcribe(audioBlob)
            
            if (text) {
                setTranscription(prev => prev ? `${prev} ${text}` : text)
            }
        } catch (e: any) {
            console.error('[useVoiceInput] Cloud transcription error:', e)
            setError(e.message || 'Falha na transcrição')
        } finally {
            setIsTranscribing(false)
        }
    }, [])
    
    // Initialize audio service for cloud mode
    useEffect(() => {
        if (config.provider === 'cloud') {
            audioServiceRef.current = new AudioService((blob: Blob) => {
                chunksRef.current.push(blob)
                void handleCloudTranscription(blob)
            }, (nivel) => setNivelAudio(nivel), (barras) => setBarrasAudio(barras))
        }
    }, [config.provider, handleCloudTranscription])

    const calcularBarrasFrequencia = useCallback((dados: Uint8Array, qtd: number): number[] => {
        const barras = new Array(qtd).fill(0)
        const tamanho = dados.length
        if (!tamanho) return barras
        const passo = Math.max(1, Math.floor(tamanho / qtd))
        for (let i = 0; i < qtd; i++) {
            const inicio = i * passo
            const fim = Math.min(inicio + passo, tamanho)
            let soma = 0
            for (let j = inicio; j < fim; j++) {
                soma += dados[j]
            }
            const media = soma / Math.max(1, fim - inicio)
            barras[i] = Math.min(1, media / 255)
        }
        return barras
    }, [])

    const suavizarBarras = useCallback((barras: number[]): number[] => {
        if (!barrasSuavizadasRef.current.length) {
            barrasSuavizadasRef.current = barras.slice()
            return barrasSuavizadasRef.current
        }
        barrasSuavizadasRef.current = barrasSuavizadasRef.current.map((valor, index) =>
            valor * 0.7 + (barras[index] || 0) * 0.3
        )
        barrasSuavizadasRef.current = barrasSuavizadasRef.current.map((valor, index, lista) => {
            const anterior = lista[index - 1] ?? valor
            const proximo = lista[index + 1] ?? valor
            return (anterior + valor + proximo) / 3
        })
        return barrasSuavizadasRef.current
    }, [])

    const limparBarrasAudio = useCallback(() => {
        barrasSuavizadasRef.current = []
        setBarrasAudio(new Array(QTD_BARRAS_AUDIO).fill(0))
    }, [])
    
    // Start local streaming recording
    const startLocalStreaming = useCallback(async () => {
        try {
            setError(null)
            accumulatedTextRef.current = '' // Reset accumulated text for new session
            
            // Check availability
            const availability = await window.electronAPI?.localWhisper?.checkAvailability()
            if (!availability?.available) {
                throw new Error('Whisper local não está disponível. Baixe um modelo primeiro.')
            }
            
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    ...(config.microfoneId ? { deviceId: { exact: config.microfoneId } } : {})
                }
            })
            mediaStreamRef.current = stream
            
            // Start transcription session
            console.log('[useVoiceInput] Starting session with model:', config.whisperModel)
            const sessionResult = await window.electronAPI?.localWhisper?.startSession({
                model: config.whisperModel || 'base',
                language: config.language || 'pt'
            })
            
            if (!sessionResult?.success || !sessionResult.sessionId) {
                throw new Error(sessionResult?.error || 'Falha ao iniciar sessão')
            }
            
            sessionIdRef.current = sessionResult.sessionId
            
            // Create audio context
            audioContextRef.current = new AudioContext({ sampleRate: 16000 })
            const source = audioContextRef.current.createMediaStreamSource(stream)
            const analyser = audioContextRef.current.createAnalyser()
            analyser.fftSize = 256
            analyserRef.current = analyser
            freqDataRef.current = new Uint8Array(analyser.frequencyBinCount)
            timeDataRef.current = new Uint8Array(analyser.fftSize)

            // Create processor to capture audio data
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor

            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume()
            }
            
            processor.onaudioprocess = (e) => {
                if (!sessionIdRef.current) return
                
                const inputData = e.inputBuffer.getChannelData(0)
                
                // Convert Float32 to Int16 PCM
                const pcmData = new Int16Array(inputData.length)
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]))
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
                }
                
                // Send audio to main process
                window.electronAPI?.localWhisper?.sendAudio(
                    sessionIdRef.current,
                    pcmData.buffer
                ).catch(err => {
                    console.error('[useVoiceInput] Failed to send audio:', err)
                })
            }
            
            source.connect(analyser)
            analyser.connect(processor)
            processor.connect(audioContextRef.current.destination)

            const atualizarVisual = () => {
                if (!analyserRef.current || !freqDataRef.current || !timeDataRef.current) return

                analyserRef.current.getByteTimeDomainData(timeDataRef.current)
                let soma = 0
                for (let i = 0; i < timeDataRef.current.length; i++) {
                    const valor = (timeDataRef.current[i] - 128) / 128
                    soma += valor * valor
                }
                const rms = Math.sqrt(soma / timeDataRef.current.length)
                nivelSuavizadoRef.current = nivelSuavizadoRef.current * 0.75 + rms * 0.25
                setNivelAudio(Math.min(1, Math.max(0, nivelSuavizadoRef.current)))

                analyserRef.current.getByteFrequencyData(freqDataRef.current)
                const barras = calcularBarrasFrequencia(freqDataRef.current, QTD_BARRAS_AUDIO)
                setBarrasAudio(suavizarBarras(barras))

                rafAudioRef.current = requestAnimationFrame(atualizarVisual)
            }

            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
            }
            rafAudioRef.current = requestAnimationFrame(atualizarVisual)
            
            setIsRecording(true)
            console.log('[useVoiceInput] Local streaming started, session:', sessionResult.sessionId)
            
        } catch (e: any) {
            console.error('[useVoiceInput] Failed to start local streaming:', e)
            setError(e.message || 'Falha ao iniciar gravação')
            
            // Cleanup on error
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
            }
            setNivelAudio(0)
            limparBarrasAudio()
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }
            throw e
        }
    }, [config.whisperModel, config.language, config.microfoneId, calcularBarrasFrequencia, suavizarBarras, limparBarrasAudio])
    
    // Stop local streaming recording
    const stopLocalStreaming = useCallback(async () => {
        try {
            // Stop audio processing
            if (processorRef.current) {
                processorRef.current.disconnect()
                processorRef.current = null
            }
            
            if (audioContextRef.current) {
                await audioContextRef.current.close()
                audioContextRef.current = null
            }
            analyserRef.current = null
            freqDataRef.current = null
            timeDataRef.current = null
            
            // Stop media stream
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
            }
            
            // Stop transcription session
            if (sessionIdRef.current) {
                await window.electronAPI?.localWhisper?.stopSession(sessionIdRef.current)
            }
            
            sessionIdRef.current = null
            setIsRecording(false)
            setNivelAudio(0)
            limparBarrasAudio()
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }
            
            console.log('[useVoiceInput] Local streaming stopped')
            
        } catch (e: any) {
            console.error('[useVoiceInput] Failed to stop local streaming:', e)
            setError(e.message || 'Falha ao parar gravação')
            setIsRecording(false)
            setNivelAudio(0)
            limparBarrasAudio()
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }
        }
    }, [limparBarrasAudio])
    
    // Toggle recording
    const toggleRecording = useCallback(async () => {
        if (!isRecording) {
            // Clear previous state
            setTranscription('')
            chunksRef.current = []
            setError(null)
            
            if (config.provider === 'local') {
                // Use local streaming
                await startLocalStreaming()
            } else {
                // Use cloud mode
                try {
                    await audioServiceRef.current?.start(config.microfoneId)
                    setIsRecording(true)
                } catch (e: any) {
                    console.error('[useVoiceInput] Failed to start recording:', e)
                    setError('Permissão de microfone negada ou erro ao iniciar.')
                    throw e
                }
            }
        } else {
            if (config.provider === 'local') {
                await stopLocalStreaming()
            } else {
                audioServiceRef.current?.stop()
                setIsRecording(false)
                setNivelAudio(0)
                limparBarrasAudio()
            }
        }
    }, [isRecording, config.provider, config.microfoneId, startLocalStreaming, stopLocalStreaming, limparBarrasAudio])
    
    // Set provider
    const setProvider = useCallback((provider: TranscriptionProvider) => {
        setConfig(prev => ({ ...prev, provider }))
        setIsRecording(false)
        setNivelAudio(0)
        limparBarrasAudio()
    }, [limparBarrasAudio])
    
    // Set Whisper model
    const setWhisperModel = useCallback((model: WhisperModelSize) => {
        setConfig(prev => ({ ...prev, whisperModel: model }))
    }, [])
    
    // Set binary path
    const setWhisperBinaryPath = useCallback((path: string) => {
        setConfig(prev => ({ ...prev, whisperBinaryPath: path }))
    }, [])

    const setMicrofoneId = useCallback((microfoneId: string) => {
        setConfig(prev => ({ ...prev, microfoneId }))
    }, [])
    
    // Clear error
    const clearError = useCallback(() => {
        setError(null)
    }, [])
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionIdRef.current) {
                window.electronAPI?.localWhisper?.stopSession(sessionIdRef.current)
                    .catch(err => console.error('[useVoiceInput] Cleanup error:', err))
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
            }
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!isRecording) return
        const intervalo = window.setInterval(() => {
            if (config.provider === 'cloud') {
                void audioServiceRef.current?.resumeIfNeeded?.()
                return
            }
            if (audioContextRef.current?.state === 'suspended') {
                void audioContextRef.current.resume()
            }
        }, 1200)
        return () => window.clearInterval(intervalo)
    }, [isRecording, config.provider])
    
    return {
        isRecording,
        isTranscribing,
        transcription,
        setTranscription,
        toggleRecording,
        provider: config.provider,
        setProvider,
        whisperConfig: {
            modelSize: config.whisperModel || 'base',
            language: config.language,
            binaryPath: config.whisperBinaryPath
        },
        setWhisperModel,
        whisperBinaryPath: config.whisperBinaryPath || '',
        setWhisperBinaryPath,
        isWhisperReady,
        initializeWhisper,
        microfoneId: config.microfoneId || '',
        setMicrofoneId,
        nivelAudio,
        barrasAudio,
        error,
        clearError
    }
}
