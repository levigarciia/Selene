/**
 * useVoiceInput Hook
 *
 * Centraliza captura e transcrição de voz para:
 * - `local`: streaming em tempo real via Whisper local
 * - `cloud`: envio progressivo por chunks para a API configurada
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioService, type OpcoesChunkVoz } from '../services/AudioService'
import type { AIService } from '../services/AIService'
import type { WhisperModelSize } from '../services/whisper'
import { MODELO_PARAKEET_PADRAO, type ParakeetModelName } from '../services/parakeet'

export type TranscriptionProvider = 'cloud' | 'local'
export type MotorTranscricaoLocal = 'whisper' | 'parakeet'
export type StatusCapturaVoz =
    | 'ocioso'
    | 'gravando_local'
    | 'transcrevendo_local'
    | 'gravando_cloud'
    | 'transcrevendo_cloud'
export type ModoTranscricaoVoz = 'local_realtime' | 'local_chunked' | 'cloud_chunked'

export interface VoiceInputConfig {
    provider: TranscriptionProvider
    motorLocal: MotorTranscricaoLocal
    whisperModel?: WhisperModelSize
    parakeetModel?: ParakeetModelName
    language?: string
    whisperBinaryPath?: string
    microfoneId?: string
}

export interface UseVoiceInputReturn {
    isRecording: boolean
    isTranscribing: boolean
    transcription: string
    transcriptionConfirmada: string
    transcriptionParcial: string
    ultimaAtualizacaoTranscricaoEm: number
    ultimaParadaGravacaoEm: number | null
    setTranscription: (text: string) => void
    toggleRecording: () => Promise<void>
    statusCaptura: StatusCapturaVoz
    modoTranscricao: ModoTranscricaoVoz

    // Provider management
    provider: TranscriptionProvider
    setProvider: (provider: TranscriptionProvider) => void
    motorLocal: MotorTranscricaoLocal
    setMotorLocal: (motor: MotorTranscricaoLocal) => void

    // Local Whisper config
    whisperConfig: {
        modelSize: WhisperModelSize
        language?: string
        binaryPath?: string
    }
    setWhisperModel: (model: WhisperModelSize) => void
    parakeetModel: ParakeetModelName
    setParakeetModel: (model: ParakeetModelName) => void
    whisperBinaryPath: string
    setWhisperBinaryPath: (path: string) => void
    isWhisperReady: boolean
    initializeWhisper: () => Promise<void>
    isParakeetReady: boolean
    initializeParakeet: () => Promise<void>
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
const MODELOS_PARAKEET_VALIDOS = new Set<ParakeetModelName>(['tdt-0.6b-v3-multilingual'])
const OPCOES_CHUNK_CLOUD: OpcoesChunkVoz = {
    estrategia: 'vad',
    limiteMinimoChunkMs: 1600,
    limiteMaximoChunkMs: null,
    limiteSilencioMs: 1400,
    duracaoGracaSilencioMs: 700,
    limiteRmsAtivacao: 0.018,
    limiteRmsManutencao: 0.012,
    preRollMs: 360,
    multiplicadorRuidoAtivacao: 3.8,
    multiplicadorRuidoManutencao: 2.6
}
const OPCOES_CHUNK_PARAKEET: OpcoesChunkVoz = {
    estrategia: 'vad',
    limiteMinimoChunkMs: 1400,
    limiteMaximoChunkMs: null,
    limiteSilencioMs: 1200,
    duracaoGracaSilencioMs: 650,
    limiteRmsAtivacao: 0.018,
    limiteRmsManutencao: 0.012,
    preRollMs: 320,
    multiplicadorRuidoAtivacao: 3.6,
    multiplicadorRuidoManutencao: 2.5
}

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return fallback
}

function normalizarModeloParakeet(modelo?: string): ParakeetModelName {
    if (modelo && MODELOS_PARAKEET_VALIDOS.has(modelo as ParakeetModelName)) {
        return modelo as ParakeetModelName
    }
    return MODELO_PARAKEET_PADRAO
}

function juntarTrechos(...trechos: string[]): string {
    return trechos
        .map((trecho) => trecho.trim())
        .filter(Boolean)
        .join(' ')
        .trim()
}

export function useVoiceInput(aiService: AIService | null): UseVoiceInputReturn {
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcription, setTranscriptionState] = useState('')
    const [statusCaptura, setStatusCaptura] = useState<StatusCapturaVoz>('ocioso')
    const [error, setError] = useState<string | null>(null)
    const [isWhisperReady, setIsWhisperReady] = useState(false)
    const [isParakeetReady, setIsParakeetReady] = useState(false)
    const [transcriptionConfirmada, setTranscriptionConfirmada] = useState('')
    const [transcriptionParcial, setTranscriptionParcial] = useState('')
    const [ultimaAtualizacaoTranscricaoEm, setUltimaAtualizacaoTranscricaoEm] = useState(0)
    const [ultimaParadaGravacaoEm, setUltimaParadaGravacaoEm] = useState<number | null>(null)
    const [nivelAudio, setNivelAudio] = useState(0)
    const [barrasAudio, setBarrasAudio] = useState<number[]>(
        () => new Array(QTD_BARRAS_AUDIO).fill(0)
    )

    // Load config from storage
    const [config, setConfig] = useState<VoiceInputConfig>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const configArmazenada = JSON.parse(stored) as VoiceInputConfig
                return {
                    ...configArmazenada,
                    provider: configArmazenada.provider || 'cloud',
                    motorLocal: configArmazenada.motorLocal || 'whisper',
                    whisperModel: configArmazenada.whisperModel || 'base',
                    parakeetModel: normalizarModeloParakeet(configArmazenada.parakeetModel),
                    language: configArmazenada.language || 'pt',
                    whisperBinaryPath: configArmazenada.whisperBinaryPath || '',
                    microfoneId: configArmazenada.microfoneId || ''
                }
            }
        } catch (e) {
            console.warn('[useVoiceInput] Failed to load config:', e)
        }
        return {
            provider: 'cloud',
            motorLocal: 'whisper',
            whisperModel: 'base',
            parakeetModel: MODELO_PARAKEET_PADRAO,
            language: 'pt',
            whisperBinaryPath: '',
            microfoneId: ''
        }
    })

    // Refs
    const serviceRef = useRef<AIService | null>(aiService)
    const audioServiceRef = useRef<AudioService | null>(null)
    const configRef = useRef(config)
    const isRecordingRef = useRef(isRecording)
    const handleCloudTranscriptionRef = useRef<(audioBlob: Blob, sessaoId: number) => Promise<void>>(
        async () => undefined
    )
    const handleParakeetTranscriptionRef = useRef<(audioBlob: Blob, sessionId: string) => Promise<void>>(
        async () => undefined
    )

    // Refs de transcrição
    const transcricaoConfirmadaRef = useRef('')
    const transcricaoParcialRef = useRef('')

    // Refs do modo cloud
    const sessaoCloudAtualRef = useRef(0)
    const gravandoCloudRef = useRef(false)
    const pendenciasCloudPorSessaoRef = useRef(new Map<number, number>())

    // Local Whisper streaming refs
    const sessionIdRef = useRef<string | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const rafAudioRef = useRef<number | null>(null)
    const cleanupListenersRef = useRef<(() => void)[]>([])
    const nivelSuavizadoRef = useRef(0)
    const barrasSuavizadasRef = useRef<number[]>([])
    const sessoesLocaisValidasRef = useRef<Set<string>>(new Set())
    const timeoutLimpezaSessaoLocalRef = useRef<number | null>(null)
    const pendenciasParakeetRef = useRef(0)
    const enviosParakeetPendentesRef = useRef(new Set<Promise<void>>())

    // Update AI service ref
    useEffect(() => {
        serviceRef.current = aiService
    }, [aiService])

    useEffect(() => {
        configRef.current = config
    }, [config])

    useEffect(() => {
        isRecordingRef.current = isRecording
    }, [isRecording])

    // Persist config
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    }, [config])

    const atualizarTranscricaoExibida = useCallback(() => {
        setTranscriptionState(juntarTrechos(
            transcricaoConfirmadaRef.current,
            transcricaoParcialRef.current
        ))
    }, [])

    const resetarEstadoTranscricao = useCallback(() => {
        transcricaoConfirmadaRef.current = ''
        transcricaoParcialRef.current = ''
        setTranscriptionState('')
        setTranscriptionConfirmada('')
        setTranscriptionParcial('')
        setUltimaAtualizacaoTranscricaoEm(Date.now())
    }, [])

    const setTranscription = useCallback((text: string) => {
        const normalizado = text.trim()
        transcricaoConfirmadaRef.current = normalizado
        transcricaoParcialRef.current = ''
        setTranscriptionState(normalizado)
        setTranscriptionConfirmada(normalizado)
        setTranscriptionParcial('')
        setUltimaAtualizacaoTranscricaoEm(Date.now())
    }, [])

    const confirmarTrechoTranscricao = useCallback((text: string) => {
        const normalizado = text.trim()
        if (!normalizado) return

        transcricaoConfirmadaRef.current = juntarTrechos(
            transcricaoConfirmadaRef.current,
            normalizado
        )
        transcricaoParcialRef.current = ''
        atualizarTranscricaoExibida()
        setTranscriptionConfirmada(transcricaoConfirmadaRef.current)
        setTranscriptionParcial('')
        setUltimaAtualizacaoTranscricaoEm(Date.now())
    }, [atualizarTranscricaoExibida])

    const atualizarTrechoParcial = useCallback((text: string) => {
        transcricaoParcialRef.current = text.trim()
        atualizarTranscricaoExibida()
        setTranscriptionParcial(transcricaoParcialRef.current)
        setUltimaAtualizacaoTranscricaoEm(Date.now())
    }, [atualizarTranscricaoExibida])

    const atualizarStatusCloud = useCallback((sessaoId: number) => {
        if (sessaoId !== sessaoCloudAtualRef.current) return

        const pendencias = pendenciasCloudPorSessaoRef.current.get(sessaoId) || 0
        const transcrevendo = pendencias > 0

        setIsRecording(gravandoCloudRef.current)
        setIsTranscribing(transcrevendo)

        if (gravandoCloudRef.current) {
            setStatusCaptura('gravando_cloud')
            return
        }

        if (transcrevendo) {
            setStatusCaptura('transcrevendo_cloud')
            return
        }

        setStatusCaptura('ocioso')
    }, [])

    const ajustarPendenciasCloud = useCallback((sessaoId: number, delta: number) => {
        const mapa = pendenciasCloudPorSessaoRef.current
        const atual = mapa.get(sessaoId) || 0
        const proximo = Math.max(0, atual + delta)

        if (proximo === 0) {
            mapa.delete(sessaoId)
        } else {
            mapa.set(sessaoId, proximo)
        }

        atualizarStatusCloud(sessaoId)
    }, [atualizarStatusCloud])

    const invalidarSessaoCloudAtual = useCallback(() => {
        pendenciasCloudPorSessaoRef.current.clear()
        sessaoCloudAtualRef.current += 1
        gravandoCloudRef.current = false
        setIsRecording(false)
        setIsTranscribing(false)
        setStatusCaptura('ocioso')
    }, [])

    const sessaoLocalEhValida = useCallback((sessionId: string) => {
        return sessoesLocaisValidasRef.current.has(sessionId)
    }, [])

    const registrarSessaoLocal = useCallback((sessionId: string) => {
        if (timeoutLimpezaSessaoLocalRef.current) {
            window.clearTimeout(timeoutLimpezaSessaoLocalRef.current)
            timeoutLimpezaSessaoLocalRef.current = null
        }
        sessoesLocaisValidasRef.current.add(sessionId)
    }, [])

    const agendarLimpezaSessaoLocal = useCallback((sessionId: string) => {
        if (timeoutLimpezaSessaoLocalRef.current) {
            window.clearTimeout(timeoutLimpezaSessaoLocalRef.current)
        }
        timeoutLimpezaSessaoLocalRef.current = window.setTimeout(() => {
            sessoesLocaisValidasRef.current.delete(sessionId)
            if (sessionIdRef.current === sessionId) {
                sessionIdRef.current = null
            }
            timeoutLimpezaSessaoLocalRef.current = null
        }, 2000)
    }, [])

    const atualizarPendenciasParakeet = useCallback((delta: number) => {
        pendenciasParakeetRef.current = Math.max(0, pendenciasParakeetRef.current + delta)

        if (configRef.current.provider !== 'local' || configRef.current.motorLocal !== 'parakeet') {
            return
        }

        const transcrevendo = pendenciasParakeetRef.current > 0
        setIsTranscribing(transcrevendo)

        if (isRecordingRef.current) {
            setStatusCaptura('gravando_local')
            return
        }

        setStatusCaptura(transcrevendo ? 'transcrevendo_local' : 'ocioso')
    }, [])

    const checkLocalWhisperAvailability = useCallback(async () => {
        try {
            const result = await window.electronAPI?.localWhisper?.checkAvailability()
            setIsWhisperReady(Boolean(result?.success && result.available))
        } catch (err) {
            console.error('[useVoiceInput] Failed to check local whisper:', err)
            setIsWhisperReady(false)
        }
    }, [])

    const checkLocalParakeetAvailability = useCallback(async () => {
        try {
            const result = await window.electronAPI?.localParakeet?.checkAvailability()
            setIsParakeetReady(Boolean(result?.success && result.available))
        } catch (err) {
            console.error('[useVoiceInput] Failed to check local parakeet:', err)
            setIsParakeetReady(false)
        }
    }, [])

    useEffect(() => {
        void checkLocalWhisperAvailability()
        void checkLocalParakeetAvailability()
    }, [checkLocalParakeetAvailability, checkLocalWhisperAvailability])

    useEffect(() => {
        const apiWhisper = window.electronAPI?.localWhisper
        const apiParakeet = window.electronAPI?.localParakeet
        if (!apiWhisper && !apiParakeet) return

        if (apiWhisper) {
            const unsubDelta = apiWhisper.onTranscriptionDelta((data) => {
                if (!sessaoLocalEhValida(data.sessionId)) return
                console.log('[useVoiceInput] Delta local recebido:', data.sessionId, data.text)
                atualizarTrechoParcial(data.text)
            })
            cleanupListenersRef.current.push(unsubDelta)

            const unsubComplete = apiWhisper.onTranscriptionComplete((data) => {
                if (!sessaoLocalEhValida(data.sessionId) || !data.text) return
                confirmarTrechoTranscricao(data.text)
                console.log('[useVoiceInput] Transcription complete:', data.text)
            })
            cleanupListenersRef.current.push(unsubComplete)

            const unsubError = apiWhisper.onTranscriptionError((data) => {
                if (!sessaoLocalEhValida(data.sessionId)) return
                console.error('[useVoiceInput] Streaming error:', data.error)
                setError(data.error)
            })
            cleanupListenersRef.current.push(unsubError)
        }

        if (apiParakeet) {
            const unsubCompleteParakeet = apiParakeet.onTranscriptionComplete((data) => {
                if (!sessaoLocalEhValida(data.sessionId)) return
                if (data.text?.trim()) {
                    confirmarTrechoTranscricao(data.text)
                }
                atualizarPendenciasParakeet(-1)
            })
            cleanupListenersRef.current.push(unsubCompleteParakeet)

            const unsubErrorParakeet = apiParakeet.onTranscriptionError((data) => {
                if (!sessaoLocalEhValida(data.sessionId)) return
                setError(data.error)
                atualizarPendenciasParakeet(-1)
            })
            cleanupListenersRef.current.push(unsubErrorParakeet)
        }

        return () => {
            cleanupListenersRef.current.forEach(unsub => unsub())
            cleanupListenersRef.current = []
        }
    }, [
        atualizarPendenciasParakeet,
        atualizarTrechoParcial,
        confirmarTrechoTranscricao,
        sessaoLocalEhValida
    ])

    // Initialize (check availability)
    const initializeWhisper = useCallback(async () => {
        try {
            setError(null)
            console.log('[useVoiceInput] Checking local whisper availability...')

            const result = await window.electronAPI?.localWhisper?.checkAvailability()

            if (!result?.success) {
                throw new Error(result?.error || 'Falha ao verificar disponibilidade do Whisper local')
            }

            if (!result.binaryAvailable) {
                throw new Error('Binário do Whisper não encontrado. Compile whisper.cpp ou copie para native/whisper/bin/.')
            }

            if (!result.hasModels) {
                throw new Error('Nenhum modelo baixado. Baixe pelo menos um modelo do Whisper local.')
            }

            setIsWhisperReady(true)
            console.log('[useVoiceInput] Local whisper is ready')
        } catch (e: unknown) {
            console.error('[useVoiceInput] Whisper init failed:', e)
            setError(obterMensagemErro(e, 'Falha ao inicializar Whisper'))
            setIsWhisperReady(false)
        }
    }, [])

    const initializeParakeet = useCallback(async () => {
        try {
            setError(null)

            const result = await window.electronAPI?.localParakeet?.checkAvailability()
            if (!result?.success) {
                throw new Error(result?.error || 'Falha ao verificar disponibilidade do Parakeet local')
            }
            if (!result.runtimeAvailable) {
                throw new Error('Runtime local do Parakeet não está disponível.')
            }
            if (!result.hasModels) {
                throw new Error('Nenhum modelo do Parakeet foi baixado ainda.')
            }

            setIsParakeetReady(true)
        } catch (e: unknown) {
            console.error('[useVoiceInput] Parakeet init failed:', e)
            setError(obterMensagemErro(e, 'Falha ao inicializar Parakeet'))
            setIsParakeetReady(false)
        }
    }, [])

    // Handle cloud transcription
    const handleCloudTranscription = useCallback(async (audioBlob: Blob, sessaoId: number) => {
        ajustarPendenciasCloud(sessaoId, 1)
        setError(null)

        try {
            if (!serviceRef.current) {
                throw new Error('Serviço de IA não disponível')
            }

            const text = await serviceRef.current.transcribe(audioBlob)

            if (sessaoId !== sessaoCloudAtualRef.current) {
                return
            }

            if (text?.trim()) {
                confirmarTrechoTranscricao(text)
            }
        } catch (e: unknown) {
            console.error('[useVoiceInput] Cloud transcription error:', e)
            if (sessaoId === sessaoCloudAtualRef.current) {
                setError(obterMensagemErro(e, 'Falha na transcrição'))
            }
        } finally {
            ajustarPendenciasCloud(sessaoId, -1)
        }
    }, [ajustarPendenciasCloud, confirmarTrechoTranscricao])

    const handleParakeetTranscription = useCallback(async (audioBlob: Blob, sessionId: string) => {
        atualizarPendenciasParakeet(1)
        setError(null)

        try {
            const arrayBuffer = await audioBlob.arrayBuffer()
            const result = await window.electronAPI?.localParakeet?.sendAudioChunk(sessionId, arrayBuffer)
            if (!result?.success) {
                throw new Error(result?.error || 'Falha ao enviar chunk para o Parakeet')
            }
        } catch (e: unknown) {
            console.error('[useVoiceInput] Parakeet chunk error:', e)
            setError(obterMensagemErro(e, 'Falha na transcrição local'))
            atualizarPendenciasParakeet(-1)
            throw e
        }
    }, [atualizarPendenciasParakeet])

    useEffect(() => {
        handleCloudTranscriptionRef.current = handleCloudTranscription
    }, [handleCloudTranscription])

    useEffect(() => {
        handleParakeetTranscriptionRef.current = handleParakeetTranscription
    }, [handleParakeetTranscription])

    useEffect(() => {
        audioServiceRef.current?.stop()
        audioServiceRef.current = null

        if (config.provider === 'cloud') {
            audioServiceRef.current = new AudioService(
                (blob: Blob) => {
                    const sessaoId = sessaoCloudAtualRef.current
                    void handleCloudTranscriptionRef.current(blob, sessaoId)
                },
                (nivel) => setNivelAudio(nivel),
                (barras) => setBarrasAudio(barras),
                OPCOES_CHUNK_CLOUD
            )
            return
        }

        if (config.provider !== 'local' || config.motorLocal !== 'parakeet') {
            return
        }

        audioServiceRef.current = new AudioService(
            (blob: Blob) => {
                const sessionId = sessionIdRef.current
                if (!sessionId) {
                    return
                }

                const promessa = handleParakeetTranscriptionRef.current(blob, sessionId)
                    .catch(() => undefined)
                    .finally(() => {
                        enviosParakeetPendentesRef.current.delete(promessa)
                    })

                enviosParakeetPendentesRef.current.add(promessa)
            },
            (nivel) => setNivelAudio(nivel),
            (barras) => setBarrasAudio(barras),
            OPCOES_CHUNK_PARAKEET
        )
    }, [config.motorLocal, config.provider])

    const calcularBarrasFrequencia = useCallback((dados: Uint8Array<ArrayBuffer>, qtd: number): number[] => {
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

    const startLocalParakeet = useCallback(async () => {
        try {
            setError(null)
            setIsTranscribing(false)
            pendenciasParakeetRef.current = 0
            enviosParakeetPendentesRef.current.clear()
            resetarEstadoTranscricao()

            const availability = await window.electronAPI?.localParakeet?.checkAvailability()
            if (!availability?.success) {
                throw new Error(availability?.error || 'Falha ao verificar Parakeet local')
            }
            if (!availability.runtimeAvailable) {
                throw new Error('Runtime local do Parakeet não está disponível.')
            }
            if (!availability.hasModels) {
                throw new Error('Nenhum modelo do Parakeet foi baixado. Baixe um modelo para usar a transcrição local.')
            }
            if (!availability.available) {
                throw new Error('Parakeet local não está disponível no momento.')
            }

            const sessionResult = await window.electronAPI?.localParakeet?.startSession({
                model: normalizarModeloParakeet(config.parakeetModel),
                language: 'multi'
            })

            if (!sessionResult?.success || !sessionResult.sessionId) {
                throw new Error(sessionResult?.error || 'Falha ao iniciar sessão do Parakeet')
            }

            sessionIdRef.current = sessionResult.sessionId
            registrarSessaoLocal(sessionResult.sessionId)
            await audioServiceRef.current?.start(config.microfoneId)

            setIsRecording(true)
            setStatusCaptura('gravando_local')
        } catch (e: unknown) {
            console.error('[useVoiceInput] Failed to start local parakeet:', e)
            setError(obterMensagemErro(e, 'Falha ao iniciar gravação local'))
            setIsRecording(false)
            setStatusCaptura('ocioso')
            setNivelAudio(0)
            limparBarrasAudio()
            audioServiceRef.current?.stop()
            sessionIdRef.current = null
            throw e
        }
    }, [
        config.microfoneId,
        config.parakeetModel,
        limparBarrasAudio,
        registrarSessaoLocal,
        resetarEstadoTranscricao
    ])

    // Start local streaming recording
    const startLocalStreaming = useCallback(async () => {
        try {
            setError(null)
            setIsTranscribing(false)
            resetarEstadoTranscricao()

            const availability = await window.electronAPI?.localWhisper?.checkAvailability()
            if (!availability?.success) {
                throw new Error(availability?.error || 'Falha ao verificar Whisper local')
            }
            if (!availability.binaryAvailable) {
                throw new Error('Binário do Whisper local não encontrado. Confira a pasta native/whisper/bin/.')
            }
            if (!availability.hasModels) {
                throw new Error('Nenhum modelo local baixado. Baixe um modelo para usar transcrição em tempo real.')
            }
            if (!availability.available) {
                throw new Error('Whisper local não está disponível no momento.')
            }

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

            console.log('[useVoiceInput] Starting session with model:', config.whisperModel)
            const sessionResult = await window.electronAPI?.localWhisper?.startSession({
                model: config.whisperModel || 'base',
                language: config.language || 'pt'
            })

            if (!sessionResult?.success || !sessionResult.sessionId) {
                throw new Error(sessionResult?.error || 'Falha ao iniciar sessão')
            }

            sessionIdRef.current = sessionResult.sessionId
            registrarSessaoLocal(sessionResult.sessionId)

            audioContextRef.current = new AudioContext({ sampleRate: 16000 })
            const source = audioContextRef.current.createMediaStreamSource(stream)
            const analyser = audioContextRef.current.createAnalyser()
            analyser.fftSize = 256
            analyserRef.current = analyser
            freqDataRef.current = new Uint8Array(analyser.frequencyBinCount)
            timeDataRef.current = new Uint8Array(analyser.fftSize)

            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor

            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume()
            }

            processor.onaudioprocess = (e) => {
                if (!sessionIdRef.current) return

                const inputData = e.inputBuffer.getChannelData(0)
                const pcmData = new Int16Array(inputData.length)
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]))
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
                }

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
            setStatusCaptura('gravando_local')
            console.log('[useVoiceInput] Local streaming started, session:', sessionResult.sessionId)
        } catch (e: unknown) {
            console.error('[useVoiceInput] Failed to start local streaming:', e)
            setError(obterMensagemErro(e, 'Falha ao iniciar gravação'))
            setIsRecording(false)
            setStatusCaptura('ocioso')

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
    }, [config.whisperModel, config.language, config.microfoneId, calcularBarrasFrequencia, suavizarBarras, limparBarrasAudio, resetarEstadoTranscricao, registrarSessaoLocal])

    const stopLocalParakeet = useCallback(async () => {
        try {
            const sessionIdEncerrando = sessionIdRef.current

            audioServiceRef.current?.stop()

            const promessasPendentes = Array.from(enviosParakeetPendentesRef.current)
            if (promessasPendentes.length > 0) {
                setIsTranscribing(true)
                setStatusCaptura('transcrevendo_local')
                await Promise.allSettled(promessasPendentes)
            }

            if (sessionIdEncerrando) {
                await window.electronAPI?.localParakeet?.stopSession(sessionIdEncerrando)
                agendarLimpezaSessaoLocal(sessionIdEncerrando)
            }

            setIsRecording(false)
            setIsTranscribing(false)
            setStatusCaptura('ocioso')
            setUltimaParadaGravacaoEm(Date.now())
            setNivelAudio(0)
            limparBarrasAudio()
        } catch (e: unknown) {
            console.error('[useVoiceInput] Failed to stop local parakeet:', e)
            setError(obterMensagemErro(e, 'Falha ao parar gravação local'))
            setIsRecording(false)
            setStatusCaptura('ocioso')
            setUltimaParadaGravacaoEm(Date.now())
            setNivelAudio(0)
            limparBarrasAudio()
        }
    }, [agendarLimpezaSessaoLocal, limparBarrasAudio])

    // Stop local streaming recording
    const stopLocalStreaming = useCallback(async () => {
        try {
            const sessionIdEncerrando = sessionIdRef.current

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

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
            }

            if (sessionIdEncerrando) {
                await window.electronAPI?.localWhisper?.stopSession(sessionIdEncerrando)
                agendarLimpezaSessaoLocal(sessionIdEncerrando)
            }
            setIsRecording(false)
            setStatusCaptura('ocioso')
            setUltimaParadaGravacaoEm(Date.now())
            setNivelAudio(0)
            limparBarrasAudio()
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }

            console.log('[useVoiceInput] Local streaming stopped')
        } catch (e: unknown) {
            console.error('[useVoiceInput] Failed to stop local streaming:', e)
            setError(obterMensagemErro(e, 'Falha ao parar gravação'))
            setIsRecording(false)
            setStatusCaptura('ocioso')
            setUltimaParadaGravacaoEm(Date.now())
            setNivelAudio(0)
            limparBarrasAudio()
            if (rafAudioRef.current) {
                cancelAnimationFrame(rafAudioRef.current)
                rafAudioRef.current = null
            }
        }
    }, [agendarLimpezaSessaoLocal, limparBarrasAudio])

    // Toggle recording
    const toggleRecording = useCallback(async () => {
        if (!isRecording) {
            resetarEstadoTranscricao()
            setError(null)

            if (config.provider === 'local') {
                invalidarSessaoCloudAtual()
                if (config.motorLocal === 'parakeet') {
                    await startLocalParakeet()
                    return
                }
                await startLocalStreaming()
                return
            }

            try {
                const novaSessaoCloud = sessaoCloudAtualRef.current + 1
                sessaoCloudAtualRef.current = novaSessaoCloud
                pendenciasCloudPorSessaoRef.current.set(novaSessaoCloud, 0)
                gravandoCloudRef.current = true
                setIsTranscribing(false)
                setStatusCaptura('gravando_cloud')
                await audioServiceRef.current?.start(config.microfoneId)
                setIsRecording(true)
            } catch (e: unknown) {
                console.error('[useVoiceInput] Failed to start recording:', e)
                gravandoCloudRef.current = false
                setIsRecording(false)
                setStatusCaptura('ocioso')
                setError('Permissão de microfone negada ou erro ao iniciar.')
                throw e
            }
            return
        }

        if (config.provider === 'local') {
            if (config.motorLocal === 'parakeet') {
                await stopLocalParakeet()
                return
            }
            await stopLocalStreaming()
            return
        }

        gravandoCloudRef.current = false
        audioServiceRef.current?.stop()
        setNivelAudio(0)
        limparBarrasAudio()
        atualizarStatusCloud(sessaoCloudAtualRef.current)
        setUltimaParadaGravacaoEm(Date.now())
    }, [
        isRecording,
        config.motorLocal,
        config.provider,
        config.microfoneId,
        startLocalParakeet,
        startLocalStreaming,
        stopLocalParakeet,
        stopLocalStreaming,
        limparBarrasAudio,
        resetarEstadoTranscricao,
        invalidarSessaoCloudAtual,
        atualizarStatusCloud
    ])

    // Set provider
    const setProvider = useCallback((provider: TranscriptionProvider) => {
        audioServiceRef.current?.stop()
        invalidarSessaoCloudAtual()
        sessionIdRef.current = null
        pendenciasParakeetRef.current = 0
        enviosParakeetPendentesRef.current.clear()
        setConfig(prev => ({ ...prev, provider }))
        resetarEstadoTranscricao()
        setError(null)
        setIsTranscribing(false)
        setNivelAudio(0)
        limparBarrasAudio()
    }, [invalidarSessaoCloudAtual, limparBarrasAudio, resetarEstadoTranscricao])

    const setMotorLocal = useCallback((motor: MotorTranscricaoLocal) => {
        audioServiceRef.current?.stop()
        sessionIdRef.current = null
        pendenciasParakeetRef.current = 0
        enviosParakeetPendentesRef.current.clear()
        setConfig(prev => ({ ...prev, motorLocal: motor }))
        resetarEstadoTranscricao()
        setError(null)
        setIsTranscribing(false)
        setNivelAudio(0)
        limparBarrasAudio()
    }, [limparBarrasAudio, resetarEstadoTranscricao])

    // Set Whisper model
    const setWhisperModel = useCallback((model: WhisperModelSize) => {
        setConfig(prev => ({ ...prev, whisperModel: model }))
    }, [])

    const setParakeetModel = useCallback((model: ParakeetModelName) => {
        setConfig(prev => ({ ...prev, parakeetModel: normalizarModeloParakeet(model) }))
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
            audioServiceRef.current?.stop()
            invalidarSessaoCloudAtual()

            if (sessionIdRef.current) {
                window.electronAPI?.localWhisper?.stopSession(sessionIdRef.current)
                    .catch(err => console.error('[useVoiceInput] Cleanup error:', err))
                window.electronAPI?.localParakeet?.stopSession(sessionIdRef.current)
                    .catch(err => console.error('[useVoiceInput] Cleanup parakeet error:', err))
            }
            if (timeoutLimpezaSessaoLocalRef.current) {
                window.clearTimeout(timeoutLimpezaSessaoLocalRef.current)
                timeoutLimpezaSessaoLocalRef.current = null
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
    }, [invalidarSessaoCloudAtual])

    useEffect(() => {
        if (!isRecording) return
        const intervalo = window.setInterval(() => {
            if (config.provider === 'cloud') {
                void audioServiceRef.current?.resumeIfNeeded?.()
                return
            }
            if (config.motorLocal === 'parakeet') {
                void audioServiceRef.current?.resumeIfNeeded?.()
                return
            }
            if (audioContextRef.current?.state === 'suspended') {
                void audioContextRef.current.resume()
            }
        }, 1200)
        return () => window.clearInterval(intervalo)
    }, [isRecording, config.motorLocal, config.provider])

    return {
        isRecording,
        isTranscribing,
        transcription,
        transcriptionConfirmada,
        transcriptionParcial,
        ultimaAtualizacaoTranscricaoEm,
        ultimaParadaGravacaoEm,
        setTranscription,
        toggleRecording,
        statusCaptura,
        modoTranscricao: config.provider === 'local'
            ? config.motorLocal === 'parakeet'
                ? 'local_chunked'
                : 'local_realtime'
            : 'cloud_chunked',
        provider: config.provider,
        setProvider,
        motorLocal: config.motorLocal,
        setMotorLocal,
        whisperConfig: {
            modelSize: config.whisperModel || 'base',
            language: config.language,
            binaryPath: config.whisperBinaryPath
        },
        setWhisperModel,
        parakeetModel: normalizarModeloParakeet(config.parakeetModel),
        setParakeetModel,
        whisperBinaryPath: config.whisperBinaryPath || '',
        setWhisperBinaryPath,
        isWhisperReady,
        initializeWhisper,
        isParakeetReady,
        initializeParakeet,
        microfoneId: config.microfoneId || '',
        setMicrofoneId,
        nivelAudio,
        barrasAudio,
        error,
        clearError
    }
}
