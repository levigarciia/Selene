/**
 * useLocalWhisperStream
 * React hook for real-time local Whisper transcription with streaming audio
 * 
 * Uses the new localWhisper API with session-based streaming for:
 * - Real-time transcription deltas while speaking
 * - VAD (Voice Activity Detection) for utterance completion
 * - Efficient audio processing with sliding windows
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export type LocalWhisperModel = 'tiny' | 'base' | 'small' | 'medium'

export interface LocalWhisperStreamConfig {
    model?: LocalWhisperModel
    language?: string
    speakerLabel?: string
    noGpu?: boolean
}

export interface TranscriptionResult {
    text: string
    isFinal: boolean
    speakerLabel?: string
}

export interface LocalWhisperStreamState {
    isAvailable: boolean
    isSessionActive: boolean
    isRecording: boolean
    currentTranscript: string
    finalTranscript: string
    error: string | null
    sessionId: string | null
}

export function useLocalWhisperStream(config: LocalWhisperStreamConfig = {}) {
    const [state, setState] = useState<LocalWhisperStreamState>({
        isAvailable: false,
        isSessionActive: false,
        isRecording: false,
        currentTranscript: '',
        finalTranscript: '',
        error: null,
        sessionId: null
    })

    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const sessionIdRef = useRef<string | null>(null)
    const cleanupListenersRef = useRef<(() => void)[]>([])

    // Check availability on mount
    useEffect(() => {
        const checkAvailability = async () => {
            try {
                const result = await window.electronAPI?.localWhisper?.checkAvailability()
                if (result?.success) {
                    setState(prev => ({
                        ...prev,
                        isAvailable: result.available || false
                    }))
                }
            } catch (error) {
                console.error('[useLocalWhisperStream] Failed to check availability:', error)
            }
        }

        checkAvailability()
    }, [])

    // Setup event listeners
    useEffect(() => {
        const api = window.electronAPI?.localWhisper
        if (!api) return

        // Listen for transcription deltas (real-time updates)
        const unsubDelta = api.onTranscriptionDelta((data) => {
            if (data.sessionId === sessionIdRef.current) {
                setState(prev => ({
                    ...prev,
                    currentTranscript: data.text
                }))
            }
        })
        cleanupListenersRef.current.push(unsubDelta)

        // Listen for transcription completion (utterance finished)
        const unsubComplete = api.onTranscriptionComplete((data) => {
            if (data.sessionId === sessionIdRef.current) {
                setState(prev => ({
                    ...prev,
                    finalTranscript: prev.finalTranscript + (prev.finalTranscript ? ' ' : '') + data.text,
                    currentTranscript: ''
                }))
            }
        })
        cleanupListenersRef.current.push(unsubComplete)

        // Listen for errors
        const unsubError = api.onTranscriptionError((data) => {
            if (data.sessionId === sessionIdRef.current) {
                console.error('[useLocalWhisperStream] Transcription error:', data.error)
                setState(prev => ({
                    ...prev,
                    error: data.error
                }))
            }
        })
        cleanupListenersRef.current.push(unsubError)

        return () => {
            cleanupListenersRef.current.forEach(unsub => unsub())
            cleanupListenersRef.current = []
        }
    }, [])

    // Start recording and streaming
    const startRecording = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, error: null }))

            // Check if local whisper is available
            const availability = await window.electronAPI?.localWhisper?.checkAvailability()
            if (!availability?.available) {
                throw new Error('Local Whisper is not available. Please download a model first.')
            }

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            })
            mediaStreamRef.current = stream

            // Start transcription session
            const sessionResult = await window.electronAPI?.localWhisper?.startSession({
                model: config.model || 'base',
                language: config.language || 'auto',
                speakerLabel: config.speakerLabel,
                noGpu: config.noGpu
            })

            if (!sessionResult?.success || !sessionResult.sessionId) {
                throw new Error(sessionResult?.error || 'Failed to start transcription session')
            }

            sessionIdRef.current = sessionResult.sessionId

            // Create audio context
            audioContextRef.current = new AudioContext({ sampleRate: 16000 })
            const source = audioContextRef.current.createMediaStreamSource(stream)

            // Create processor to capture audio data
            // Using ScriptProcessorNode (deprecated but widely supported)
            // TODO: Migrate to AudioWorkletNode in the future
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor

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
                    console.error('[useLocalWhisperStream] Failed to send audio:', err)
                })
            }

            source.connect(processor)
            processor.connect(audioContextRef.current.destination)

            setState(prev => ({
                ...prev,
                isSessionActive: true,
                isRecording: true,
                sessionId: sessionResult.sessionId,
                currentTranscript: '',
                error: null
            }))

            console.log('[useLocalWhisperStream] Recording started, session:', sessionResult.sessionId)

        } catch (error: any) {
            console.error('[useLocalWhisperStream] Failed to start recording:', error)
            setState(prev => ({
                ...prev,
                error: error.message || 'Failed to start recording',
                isRecording: false
            }))
            
            // Cleanup on error
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
            }
        }
    }, [config.model, config.language, config.speakerLabel, config.noGpu])

    // Stop recording
    const stopRecording = useCallback(async () => {
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

            // Stop media stream
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
            }

            // Stop transcription session
            if (sessionIdRef.current) {
                const result = await window.electronAPI?.localWhisper?.stopSession(sessionIdRef.current)
                console.log('[useLocalWhisperStream] Session stopped:', result)
            }

            sessionIdRef.current = null

            setState(prev => ({
                ...prev,
                isSessionActive: false,
                isRecording: false,
                sessionId: null
            }))

            console.log('[useLocalWhisperStream] Recording stopped')

        } catch (error: any) {
            console.error('[useLocalWhisperStream] Failed to stop recording:', error)
            setState(prev => ({
                ...prev,
                error: error.message || 'Failed to stop recording',
                isRecording: false,
                isSessionActive: false
            }))
        }
    }, [])

    // Clear transcript
    const clearTranscript = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentTranscript: '',
            finalTranscript: ''
        }))
    }, [])

    // Get full transcript (final + current)
    const getFullTranscript = useCallback(() => {
        const { finalTranscript, currentTranscript } = state
        if (!finalTranscript && !currentTranscript) return ''
        if (!currentTranscript) return finalTranscript
        if (!finalTranscript) return currentTranscript
        return `${finalTranscript} ${currentTranscript}`
    }, [state.finalTranscript, state.currentTranscript])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionIdRef.current) {
                window.electronAPI?.localWhisper?.stopSession(sessionIdRef.current)
                    .catch(err => console.error('[useLocalWhisperStream] Cleanup error:', err))
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
            }
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
        }
    }, [])

    return {
        ...state,
        startRecording,
        stopRecording,
        clearTranscript,
        getFullTranscript,
        
        // Computed
        fullTranscript: getFullTranscript()
    }
}

export default useLocalWhisperStream
