/**
 * WhisperSession
 * Manages a single local transcription session with sliding window audio processing
 * Uses double buffering to avoid losing audio during transcription
 * Runs in Electron main process
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'

// Audio constants
const SAMPLE_RATE = 16000 // Whisper expects 16kHz
const BYTES_PER_SAMPLE = 2 // 16-bit PCM
const CHANNELS = 1 // Mono

// Timing constants (in samples)
const WINDOW_DURATION_SEC = 1.0 // Process 1 second at a time for faster feedback
const OVERLAP_DURATION_SEC = 0.15 // 0.15 second overlap between windows
const MIN_AUDIO_DURATION_SEC = 0.3 // Minimum audio to process
const VAD_SILENCE_THRESHOLD = 100 // RMS threshold for silence detection
const VAD_SILENCE_DURATION_MS = 400 // Wait for silence before completing utterance (reduced from 600)
const CONTINUOUS_PROCESSING_INTERVAL_MS = 1200 // Process every 1.2s even while speaking

const WINDOW_SAMPLES = WINDOW_DURATION_SEC * SAMPLE_RATE
const OVERLAP_SAMPLES = OVERLAP_DURATION_SEC * SAMPLE_RATE
const MIN_SAMPLES = MIN_AUDIO_DURATION_SEC * SAMPLE_RATE

// Guardrails
const MAX_AUDIO_BUFFER_SEC = 20
const MAX_AUDIO_BUFFER_BYTES = Math.floor(MAX_AUDIO_BUFFER_SEC * SAMPLE_RATE * BYTES_PER_SAMPLE)
const WHISPER_TIMEOUT_MIN_MS = 60000 // 60 seconds to allow model loading on first run
const WHISPER_TIMEOUT_PER_SEC_MULTIPLIER_MS = 15000

export interface WhisperSessionConfig {
    modelPath: string
    binaryPath: string
    language?: string
    speakerLabel?: string
    noGpu?: boolean
}

export interface WhisperSessionEvents {
    'delta': (data: { sessionId: string; delta: string; text: string; speakerLabel?: string }) => void
    'complete': (data: { sessionId: string; text: string; speakerLabel?: string }) => void
    'error': (data: { sessionId: string; error: string }) => void
}

export class WhisperSession extends EventEmitter {
    public readonly sessionId: string
    public readonly speakerLabel: string | null
    
    private modelPath: string
    private binaryPath: string
    private language: string
    private noGpu: boolean
    private modelSizeBytes: number
    
    // Audio buffers (double buffering to avoid losing audio during processing)
    private bufferA: Buffer = Buffer.alloc(0)
    private bufferB: Buffer = Buffer.alloc(0)
    private activeBuffer: 'A' | 'B' = 'A'
    private totalSamplesReceived = 0
    
    // VAD state
    private lastSpeechTime = Date.now()
    private isSpeaking = false
    private silenceStartTime: number | null = null
    private hadSpeechSinceLastProcess = false
    private lastProcessTime = Date.now() // Track last processing for continuous mode
    
    // Processing state
    private isProcessing = false
    private activeProcess: ChildProcess | null = null
    private isActive = true
    private isStopping = false
    
    // Transcription state
    private fullTranscript = ''
    private transcriptChunks: string[] = []
    private lastCompletedText = ''
    private pendingUtteranceComplete = false
    
    // Temp directory
    private tempDir: string

    constructor(sessionId: string, config: WhisperSessionConfig) {
        super()
        
        this.sessionId = sessionId
        this.modelPath = config.modelPath
        this.binaryPath = config.binaryPath
        this.language = config.language || 'auto'
        this.speakerLabel = config.speakerLabel || null
        this.noGpu = config.noGpu || false
        this.modelSizeBytes = this.obterTamanhoModelo()
        
        this.tempDir = path.join(os.tmpdir(), 'selene-whisper')
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true })
        }
        
        this.log('Session created')
    }

    private log(message: string): void {
        const prefix = this.speakerLabel
            ? `[WhisperSession:${this.speakerLabel}:${this.sessionId.slice(0, 8)}]`
            : `[WhisperSession:${this.sessionId.slice(0, 8)}]`
        console.log(`${prefix} ${message}`)
    }

    private obterTamanhoModelo(): number {
        try {
            const stats = fs.statSync(this.modelPath)
            return stats.size
        } catch {
            return 0
        }
    }

    /**
     * Get the currently active audio buffer
     */
    private get audioBuffer(): Buffer {
        return this.activeBuffer === 'A' ? this.bufferA : this.bufferB
    }

    /**
     * Set the currently active audio buffer
     */
    private set audioBuffer(value: Buffer) {
        if (this.activeBuffer === 'A') {
            this.bufferA = value
        } else {
            this.bufferB = value
        }
    }

    /**
     * Swap buffers - call before processing to avoid losing incoming audio
     * Returns the buffer that should be processed
     */
    private swapBuffers(): Buffer {
        const bufferToProcess = this.audioBuffer
        this.activeBuffer = this.activeBuffer === 'A' ? 'B' : 'A'
        // Reset the new active buffer
        if (this.activeBuffer === 'A') {
            this.bufferA = Buffer.alloc(0)
        } else {
            this.bufferB = Buffer.alloc(0)
        }
        return bufferToProcess
    }

    /**
     * Append audio data to the buffer
     */
    appendAudio(pcm16Data: Buffer): void {
        if (!this.isActive || this.isStopping) {
            return
        }

        // Append with hard cap to avoid unbounded growth
        if (this.audioBuffer.length + pcm16Data.length <= MAX_AUDIO_BUFFER_BYTES) {
            this.audioBuffer = Buffer.concat([this.audioBuffer, pcm16Data])
        } else {
            const nextTotal = this.audioBuffer.length + pcm16Data.length
            const dropBytes = Math.max(0, nextTotal - MAX_AUDIO_BUFFER_BYTES)
            
            if (dropBytes >= this.audioBuffer.length) {
                const keepFromNew = pcm16Data.slice(Math.max(0, pcm16Data.length - MAX_AUDIO_BUFFER_BYTES))
                this.audioBuffer = Buffer.from(keepFromNew)
            } else {
                const keptExisting = this.audioBuffer.slice(dropBytes)
                this.audioBuffer = Buffer.concat([keptExisting, pcm16Data])
            }
        }
        this.totalSamplesReceived += pcm16Data.length / BYTES_PER_SAMPLE

        // Calculate RMS for VAD
        const rms = this.calculateRMS(pcm16Data)
        const now = Date.now()
        
        // Log RMS periodically for debugging
        if (this.totalSamplesReceived % (SAMPLE_RATE * 2) < pcm16Data.length / BYTES_PER_SAMPLE) {
            this.log(`Audio received: buffer=${Math.round(this.audioBuffer.length / 1024)}KB, RMS=${Math.round(rms)}, isSpeaking=${this.isSpeaking}`)
        }

        if (rms > VAD_SILENCE_THRESHOLD) {
            // Speech detected
            this.isSpeaking = true
            this.lastSpeechTime = now
            this.silenceStartTime = null
            this.hadSpeechSinceLastProcess = true
        } else {
            // Potential silence
            if (this.isSpeaking && !this.silenceStartTime) {
                this.silenceStartTime = now
            }

            // Check if silence duration exceeded
            if (this.silenceStartTime && (now - this.silenceStartTime) >= VAD_SILENCE_DURATION_MS) {
                this.isSpeaking = false

                if (this.hadSpeechSinceLastProcess) {
                    if (!this.pendingUtteranceComplete) {
                        this.pendingUtteranceComplete = true
                    }

                    if (!this.isProcessing) {
                        this.processAudioWindow({ force: true })
                    }
                } else {
                    this.emitComplete('silence')
                }
            }
        }

        // Check if we should process
        const bufferSamples = this.audioBuffer.length / BYTES_PER_SAMPLE
        const hasEnoughAudio = bufferSamples >= WINDOW_SAMPLES
        const timeSinceLastProcess = now - this.lastProcessTime
        
        // Process conditions:
        // 1. Buffer full + stopped speaking (original behavior)
        // 2. Buffer full + speaking for too long (continuous processing during speech)
        // 3. Buffer overflowing (safety)
        const shouldProcessNormal = hasEnoughAudio && this.hadSpeechSinceLastProcess && !this.isSpeaking
        const shouldProcessContinuous = hasEnoughAudio && this.isSpeaking && timeSinceLastProcess >= CONTINUOUS_PROCESSING_INTERVAL_MS
        const shouldProcessOverflow = bufferSamples >= WINDOW_SAMPLES * 2
        
        const shouldProcess = shouldProcessNormal || shouldProcessContinuous || shouldProcessOverflow

        if (shouldProcess && !this.isProcessing) {
            const reason = shouldProcessNormal ? 'silence' : shouldProcessContinuous ? 'continuous' : 'overflow'
            this.log(`Starting processing (${reason}): samples=${bufferSamples}, speaking=${this.isSpeaking}, timeSinceProcess=${timeSinceLastProcess}ms`)
            this.lastProcessTime = now
            this.processAudioWindow()
        }
    }

    private emitComplete(reason: string | null = null): boolean {
        if (!this.fullTranscript || !this.fullTranscript.trim()) {
            return false
        }

        if (this.fullTranscript === this.lastCompletedText) {
            return false
        }

        const trimmed = this.fullTranscript.trim()
        this.log(`Utterance complete${reason ? ` (${reason})` : ''}: "${trimmed.slice(0, 50)}..."`)
        
        this.emit('complete', {
            sessionId: this.sessionId,
            text: trimmed,
            speakerLabel: this.speakerLabel || undefined
        })

        this.lastCompletedText = this.fullTranscript
        this.transcriptChunks = []
        this.fullTranscript = ''
        return true
    }

    private calculateRMS(buffer: Buffer): number {
        let sum = 0
        const samples = buffer.length / BYTES_PER_SAMPLE

        for (let i = 0; i < buffer.length; i += BYTES_PER_SAMPLE) {
            const sample = buffer.readInt16LE(i)
            sum += sample * sample
        }

        return Math.sqrt(sum / samples)
    }

    private async processAudioWindow(options: { force?: boolean; allowInactive?: boolean } = {}): Promise<void> {
        const { force = false, allowInactive = false } = options
        if (this.isProcessing || (!this.isActive && !allowInactive)) {
            return
        }

        const bufferSamples = this.audioBuffer.length / BYTES_PER_SAMPLE
        if (bufferSamples < MIN_SAMPLES && !force) {
            return
        }

        this.isProcessing = true

        try {
            // Determine how much audio to process
            let samplesToProcess = Math.min(bufferSamples, WINDOW_SAMPLES)
            let bytesToProcess = samplesToProcess * BYTES_PER_SAMPLE

            // Extract audio chunk
            let audioChunk = this.audioBuffer.slice(0, bytesToProcess)

            if (force && bufferSamples < MIN_SAMPLES) {
                const padSamples = Math.max(0, MIN_SAMPLES - bufferSamples)
                if (padSamples > 0) {
                    audioChunk = Buffer.concat([audioChunk, Buffer.alloc(padSamples * BYTES_PER_SAMPLE)])
                    samplesToProcess = MIN_SAMPLES
                }
                this.audioBuffer = Buffer.alloc(0)
            } else if (force && bufferSamples < WINDOW_SAMPLES) {
                this.audioBuffer = Buffer.alloc(0)
            } else {
                // Keep overlap for next window
                const keepBytes = Math.max(0, bytesToProcess - (OVERLAP_SAMPLES * BYTES_PER_SAMPLE))
                this.audioBuffer = this.audioBuffer.slice(keepBytes)
            }

            // Skip silence-only windows
            const chunkRms = this.calculateRMS(audioChunk)
            if (!force && chunkRms <= VAD_SILENCE_THRESHOLD) {
                this.hadSpeechSinceLastProcess = false
                return
            }

            // Write to temp WAV file
            const tempFile = path.join(this.tempDir, `${this.sessionId}_${Date.now()}.wav`)
            this.writeWavFile(tempFile, audioChunk)

            // Run whisper
            const audioDurationMs = Math.round((samplesToProcess / SAMPLE_RATE) * 1000)
            const result = await this.runWhisper(tempFile, audioDurationMs)

            // Clean up temp file
            try {
                fs.unlinkSync(tempFile)
            } catch (e) {
                // Ignore cleanup errors
            }

            // Process result
            if (result && result.text) {
                const newText = result.text.trim()
                if (!newText || newText.toUpperCase() === '[BLANK_AUDIO]') {
                    this.hadSpeechSinceLastProcess = false
                    return
                }

                // Avoid duplicates from overlapping windows
                const isDuplicate = this.transcriptChunks.length > 0 &&
                    this.transcriptChunks[this.transcriptChunks.length - 1] === newText

                if (!isDuplicate) {
                    this.transcriptChunks.push(newText)
                    this.fullTranscript = this.transcriptChunks.join(' ')

                    this.emit('delta', {
                        sessionId: this.sessionId,
                        delta: newText,
                        text: this.fullTranscript,
                        speakerLabel: this.speakerLabel || undefined
                    })
                }
            }

            // Reset speech flag based on remaining buffer
            if (this.audioBuffer.length > 0) {
                const remainingRms = this.calculateRMS(this.audioBuffer)
                this.hadSpeechSinceLastProcess = remainingRms > VAD_SILENCE_THRESHOLD
            } else {
                this.hadSpeechSinceLastProcess = false
            }
        } catch (error: any) {
            this.log(`Processing error: ${error.message}`)
            this.emit('error', {
                sessionId: this.sessionId,
                error: error.message
            })
        } finally {
            this.isProcessing = false

            // Check if there's more audio to process
            const remainingSamples = this.audioBuffer.length / BYTES_PER_SAMPLE
            if (remainingSamples >= WINDOW_SAMPLES && this.isActive && this.hadSpeechSinceLastProcess) {
                setImmediate(() => this.processAudioWindow())
            }

            if (this.pendingUtteranceComplete && !this.isProcessing && !this.isSpeaking) {
                this.pendingUtteranceComplete = false
                this.emitComplete('silence')
            }
        }
    }

    private writeWavFile(filePath: string, pcmData: Buffer): void {
        const dataLength = pcmData.length
        const headerLength = 44
        const header = Buffer.alloc(headerLength)

        // RIFF header
        header.write('RIFF', 0)
        header.writeUInt32LE(dataLength + 36, 4)
        header.write('WAVE', 8)

        // fmt chunk
        header.write('fmt ', 12)
        header.writeUInt32LE(16, 16) // chunk size
        header.writeUInt16LE(1, 20) // PCM format
        header.writeUInt16LE(CHANNELS, 22) // channels
        header.writeUInt32LE(SAMPLE_RATE, 24) // sample rate
        header.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28) // byte rate
        header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32) // block align
        header.writeUInt16LE(16, 34) // bits per sample

        // data chunk
        header.write('data', 36)
        header.writeUInt32LE(dataLength, 40)

        const wavBuffer = Buffer.concat([header, pcmData])
        fs.writeFileSync(filePath, wavBuffer)
    }

    private runWhisper(audioFile: string, audioDurationMs: number): Promise<{ text: string; duration: number }> {
        return new Promise((resolve, reject) => {
            if (!this.isActive) {
                reject(new Error('Session is not active'))
                return
            }

            const numThreads = Math.max(2, os.cpus().length - 2) // Use most CPUs
            const args = [
                '-m', this.modelPath,
                '-f', audioFile,
                '--no-timestamps',
                '-nt',
                '--print-progress', 'false',
                '-t', String(numThreads) // Use multiple threads for faster processing
            ]

            if (this.language && this.language !== 'auto') {
                args.push('-l', this.language)
            }

            if (this.noGpu) {
                args.push('--no-gpu')
            }

            const timeoutPorModeloMs = this.modelSizeBytes > 0
                ? Math.min(300000, Math.round((this.modelSizeBytes / (1024 * 1024)) * 250))
                : 0
            const timeoutMs = Math.max(
                WHISPER_TIMEOUT_MIN_MS,
                Math.round((audioDurationMs / 1000) * WHISPER_TIMEOUT_PER_SEC_MULTIPLIER_MS),
                timeoutPorModeloMs
            )

            this.log(`Running whisper, audio=${audioDurationMs}ms, timeout=${timeoutMs}ms`)

            const startTime = Date.now()
            let stdout = ''
            let stderr = ''
            let didTimeout = false

            this.activeProcess = spawn(this.binaryPath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.dirname(this.binaryPath) // DLLs are in same directory
            })

            const timeoutId = setTimeout(() => {
                didTimeout = true
                this.log(`Whisper timed out after ${timeoutMs}ms - terminating...`)
                try {
                    this.activeProcess?.kill('SIGTERM')
                } catch (e) {
                    // ignore
                }
            }, timeoutMs)

            this.activeProcess.stdout?.on('data', (data) => {
                stdout += data.toString()
            })

            this.activeProcess.stderr?.on('data', (data) => {
                stderr += data.toString()
            })

            this.activeProcess.on('close', (code) => {
                clearTimeout(timeoutId)
                const duration = Date.now() - startTime
                this.activeProcess = null

                if (code === 0 && !didTimeout) {
                    const text = stdout.trim()
                        .replace(/\[BLANK_AUDIO\]/gi, '')
                        .trim()
                    this.log(`Whisper completed in ${duration}ms: "${text.slice(0, 50)}..."`)
                    resolve({ text, duration })
                    return
                }

                const reason = didTimeout
                    ? `timed out after ${timeoutMs}ms`
                    : `exited with code ${code}`
                reject(new Error(`Whisper ${reason}: ${stderr.slice(0, 500)}`))
            })

            this.activeProcess.on('error', (error) => {
                clearTimeout(timeoutId)
                this.activeProcess = null
                this.log(`Whisper process error: ${error.message}`)
                reject(error)
            })
        })
    }

    /**
     * Force process any remaining audio
     */
    async flush(): Promise<void> {
        if (this.audioBuffer.length > 0) {
            this.log('Flushing remaining audio')
            await this.processAudioWindow({ force: true, allowInactive: true })
        }
    }

    /**
     * Stop the session and clean up
     */
    async stop(options: { suppressComplete?: boolean } = {}): Promise<void> {
        const { suppressComplete = false } = options
        this.log('Stopping session')
        this.isStopping = true

        // Kill active process
        if (this.activeProcess) {
            this.activeProcess.kill('SIGTERM')
            this.activeProcess = null
        }

        // Flush remaining audio
        if (!suppressComplete) {
            await this.flush()

            // Emit complete event
            this.emit('complete', {
                sessionId: this.sessionId,
                text: this.fullTranscript,
                speakerLabel: this.speakerLabel || undefined
            })
        }

        this.isActive = false
        this.isStopping = false

        // Reset transcription state
        this.transcriptChunks = []
        this.fullTranscript = ''

        // Clean up temp files
        try {
            const files = fs.readdirSync(this.tempDir)
            for (const file of files) {
                if (file.startsWith(this.sessionId)) {
                    fs.unlinkSync(path.join(this.tempDir, file))
                }
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        this.log('Session stopped')
    }

    /**
     * Get session info
     */
    getInfo() {
        return {
            sessionId: this.sessionId,
            isActive: this.isActive,
            isProcessing: this.isProcessing,
            bufferSize: this.audioBuffer.length,
            totalSamplesReceived: this.totalSamplesReceived,
            transcriptLength: this.fullTranscript.length
        }
    }
}
