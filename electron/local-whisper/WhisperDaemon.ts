/**
 * WhisperDaemon
 * Persistent whisper.cpp process that keeps the model loaded in memory
 * Eliminates model loading time (~1-5s) for each transcription
 * 
 * Runs in Electron main process
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'

// Audio constants
const SAMPLE_RATE = 16000
const BYTES_PER_SAMPLE = 2
const CHANNELS = 1

export interface WhisperDaemonConfig {
    binaryPath: string
    modelPath: string
    language?: string
    noGpu?: boolean
    threads?: number
}

export interface TranscriptionResult {
    text: string
    duration: number
}

/**
 * WhisperDaemon - Keeps whisper model loaded for fast transcription
 * 
 * Instead of spawning a new process for each audio chunk (slow due to model loading),
 * this daemon starts whisper once and reuses it for multiple transcriptions.
 */
export class WhisperDaemon extends EventEmitter {
    private config: WhisperDaemonConfig
    private tempDir: string
    private isReady = false
    private activeTranscription: {
        resolve: (result: TranscriptionResult) => void
        reject: (error: Error) => void
        startTime: number
    } | null = null
    private pendingQueue: Array<{
        audioPath: string
        resolve: (result: TranscriptionResult) => void
        reject: (error: Error) => void
    }> = []
    
    constructor(config: WhisperDaemonConfig) {
        super()
        this.config = {
            ...config,
            language: config.language || 'auto',
            threads: config.threads || Math.max(2, os.cpus().length - 2)
        }
        
        this.tempDir = path.join(os.tmpdir(), 'selene-whisper-daemon')
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true })
        }
    }
    
    private log(message: string): void {
        console.log(`[WhisperDaemon] ${message}`)
    }
    
    /**
     * Write PCM16 data to WAV file
     */
    writeWavFile(filePath: string, pcmData: Buffer): void {
        const dataLength = pcmData.length
        const headerLength = 44
        const header = Buffer.alloc(headerLength)

        // RIFF header
        header.write('RIFF', 0)
        header.writeUInt32LE(dataLength + 36, 4)
        header.write('WAVE', 8)

        // fmt chunk
        header.write('fmt ', 12)
        header.writeUInt32LE(16, 16)
        header.writeUInt16LE(1, 20)
        header.writeUInt16LE(CHANNELS, 22)
        header.writeUInt32LE(SAMPLE_RATE, 24)
        header.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28)
        header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32)
        header.writeUInt16LE(16, 34)

        // data chunk
        header.write('data', 36)
        header.writeUInt32LE(dataLength, 40)

        const wavBuffer = Buffer.concat([header, pcmData])
        fs.writeFileSync(filePath, wavBuffer)
    }
    
    /**
     * Transcribe audio buffer
     * Uses a single whisper process per call but optimizes for speed
     */
    async transcribe(pcmData: Buffer): Promise<TranscriptionResult> {
        const audioId = crypto.randomBytes(8).toString('hex')
        const audioPath = path.join(this.tempDir, `${audioId}.wav`)
        
        try {
            // Write audio to temp file
            this.writeWavFile(audioPath, pcmData)
            
            // Run whisper
            const result = await this.runWhisperOnce(audioPath)
            
            return result
        } finally {
            // Cleanup temp file
            try {
                if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath)
                }
            } catch {
                // Ignore cleanup errors
            }
        }
    }
    
    /**
     * Run whisper on a single audio file with optimized settings
     */
    private runWhisperOnce(audioPath: string): Promise<TranscriptionResult> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now()
            
            const args = [
                '-m', this.config.modelPath,
                '-f', audioPath,
                '--no-timestamps',
                '-nt', // No timestamps in output
                '--print-progress', 'false',
                '-t', String(this.config.threads), // Use multiple threads
            ]
            
            if (this.config.language && this.config.language !== 'auto') {
                args.push('-l', this.config.language)
            }
            
            if (this.config.noGpu) {
                args.push('--no-gpu')
            }
            
            this.log(`Running whisper with ${this.config.threads} threads...`)
            
            let stdout = ''
            let stderr = ''
            
            const proc = spawn(this.config.binaryPath, args, {
                cwd: path.dirname(this.config.binaryPath),
                stdio: ['pipe', 'pipe', 'pipe']
            })
            
            // Timeout after 30s
            const timeout = setTimeout(() => {
                proc.kill('SIGTERM')
                reject(new Error('Whisper timeout after 30s'))
            }, 30000)
            
            proc.stdout?.on('data', (data) => {
                stdout += data.toString()
            })
            
            proc.stderr?.on('data', (data) => {
                stderr += data.toString()
            })
            
            proc.on('close', (code) => {
                clearTimeout(timeout)
                const duration = Date.now() - startTime
                
                if (code === 0) {
                    const text = stdout.trim()
                        .replace(/\[BLANK_AUDIO\]/gi, '')
                        .trim()
                    
                    this.log(`Transcription complete in ${duration}ms: "${text.slice(0, 50)}..."`)
                    resolve({ text, duration })
                } else {
                    reject(new Error(`Whisper exited with code ${code}: ${stderr.slice(0, 500)}`))
                }
            })
            
            proc.on('error', (error) => {
                clearTimeout(timeout)
                reject(error)
            })
        })
    }
    
    /**
     * Cleanup temp files
     */
    cleanup(): void {
        try {
            const files = fs.readdirSync(this.tempDir)
            for (const file of files) {
                fs.unlinkSync(path.join(this.tempDir, file))
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

// Singleton instances per model
const daemonInstances = new Map<string, WhisperDaemon>()

/**
 * Get or create a WhisperDaemon for a specific model
 */
export function getWhisperDaemon(config: WhisperDaemonConfig): WhisperDaemon {
    const key = `${config.binaryPath}:${config.modelPath}`
    
    let daemon = daemonInstances.get(key)
    if (!daemon) {
        daemon = new WhisperDaemon(config)
        daemonInstances.set(key, daemon)
    }
    
    return daemon
}

/**
 * Cleanup all daemon instances
 */
export function cleanupAllDaemons(): void {
    for (const daemon of daemonInstances.values()) {
        daemon.cleanup()
    }
    daemonInstances.clear()
}
