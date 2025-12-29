/**
 * WhisperModelManager
 * Manages Whisper model downloads, verification, and storage
 * Runs in Electron main process
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as https from 'https'
import { app } from 'electron'

// Model configurations from HuggingFace ggerganov/whisper.cpp
export const WHISPER_MODELS = {
    tiny: {
        name: 'tiny',
        displayName: 'Tiny',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        size: 77704715, // ~75 MB
        sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
        description: 'Fastest, lowest accuracy. Good for testing.',
        ramRequired: '~390 MB'
    },
    base: {
        name: 'base',
        displayName: 'Base',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        size: 147951465, // ~142 MB
        sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
        description: 'Good balance of speed and accuracy. Recommended.',
        ramRequired: '~500 MB'
    },
    small: {
        name: 'small',
        displayName: 'Small',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        size: 488242353, // ~466 MB
        sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
        description: 'Higher accuracy, moderate speed.',
        ramRequired: '~1 GB'
    },
    medium: {
        name: 'medium',
        displayName: 'Medium',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        size: 1533774781, // ~1.5 GB
        sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
        description: 'High accuracy, slower. Requires more RAM.',
        ramRequired: '~2.6 GB'
    }
} as const

export type WhisperModelName = keyof typeof WHISPER_MODELS

export class WhisperModelManager {
    private modelsPath: string | null = null
    private activeDownloads = new Map<string, { abort: () => void }>()

    /**
     * Initialize the model manager
     */
    initialize(): void {
        const userDataPath = app.getPath('userData')
        this.modelsPath = path.join(userDataPath, 'whisper-models')

        if (!fs.existsSync(this.modelsPath)) {
            fs.mkdirSync(this.modelsPath, { recursive: true })
            console.log('[WhisperModelManager] Created models directory:', this.modelsPath)
        }

        console.log('[WhisperModelManager] Initialized with models path:', this.modelsPath)
    }

    /**
     * Get the path to a model file
     */
    getModelPath(modelName: WhisperModelName): string {
        if (!WHISPER_MODELS[modelName]) {
            throw new Error(`Unknown model: ${modelName}`)
        }
        if (!this.modelsPath) {
            this.initialize()
        }
        return path.join(this.modelsPath!, `ggml-${modelName}.bin`)
    }

    /**
     * Get all available models with their status
     */
    getAvailableModels() {
        return Object.values(WHISPER_MODELS).map(model => ({
            ...model,
            downloaded: this.isModelDownloaded(model.name as WhisperModelName),
            path: this.getModelPath(model.name as WhisperModelName),
            downloading: this.activeDownloads.has(model.name)
        }))
    }

    /**
     * Check if a model is downloaded
     */
    isModelDownloaded(modelName: WhisperModelName): boolean {
        const modelPath = this.getModelPath(modelName)
        return fs.existsSync(modelPath)
    }

    /**
     * Get model info with download status
     */
    getModelStatus(modelName: WhisperModelName) {
        if (!WHISPER_MODELS[modelName]) {
            throw new Error(`Unknown model: ${modelName}`)
        }

        const model = WHISPER_MODELS[modelName]
        const modelPath = this.getModelPath(modelName)
        const downloaded = fs.existsSync(modelPath)
        let actualSize = 0

        if (downloaded) {
            const stats = fs.statSync(modelPath)
            actualSize = stats.size
        }

        return {
            ...model,
            downloaded,
            downloading: this.activeDownloads.has(modelName),
            path: modelPath,
            actualSize,
            verified: downloaded && actualSize === model.size
        }
    }

    /**
     * List all downloaded models
     */
    listDownloadedModels(): WhisperModelName[] {
        return (Object.keys(WHISPER_MODELS) as WhisperModelName[]).filter(name => this.isModelDownloaded(name))
    }

    /**
     * Download a model with progress reporting
     */
    downloadModel(
        modelName: WhisperModelName, 
        onProgress: (downloaded: number, total: number, percent: number) => void = () => {}
    ): Promise<{ success: boolean; modelName: string; path: string }> {
        return new Promise((resolve, reject) => {
            if (!WHISPER_MODELS[modelName]) {
                reject(new Error(`Unknown model: ${modelName}`))
                return
            }

            if (this.activeDownloads.has(modelName)) {
                reject(new Error(`Model ${modelName} is already being downloaded`))
                return
            }

            const model = WHISPER_MODELS[modelName]
            const modelPath = this.getModelPath(modelName)
            const tempPath = `${modelPath}.downloading`

            console.log(`[WhisperModelManager] Starting download of ${modelName} model`)
            console.log(`[WhisperModelManager] URL: ${model.url}`)
            console.log(`[WhisperModelManager] Destination: ${modelPath}`)

            const fileStream = fs.createWriteStream(tempPath)
            let downloadedBytes = 0
            let aborted = false

            const abortController = { abort: () => { aborted = true } }
            this.activeDownloads.set(modelName, abortController)

            const makeRequest = (url: string) => {
                const request = https.get(url, {
                    headers: { 'User-Agent': 'Selene-Desktop-App' }
                }, (response) => {
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        console.log(`[WhisperModelManager] Following redirect to: ${response.headers.location}`)
                        makeRequest(response.headers.location!)
                        return
                    }

                    if (response.statusCode !== 200) {
                        this.activeDownloads.delete(modelName)
                        fileStream.close()
                        fs.unlinkSync(tempPath)
                        reject(new Error(`Download failed with status ${response.statusCode}`))
                        return
                    }

                    const totalBytes = parseInt(response.headers['content-length'] || '0', 10) || model.size

                    response.on('data', (chunk) => {
                        if (aborted) {
                            response.destroy()
                            return
                        }
                        downloadedBytes += chunk.length
                        const percent = Math.round((downloadedBytes / totalBytes) * 100)
                        onProgress(downloadedBytes, totalBytes, percent)
                    })

                    response.pipe(fileStream)

                    fileStream.on('finish', () => {
                        fileStream.close()
                        this.activeDownloads.delete(modelName)

                        if (aborted) {
                            fs.unlinkSync(tempPath)
                            reject(new Error('Download cancelled'))
                            return
                        }

                        // Rename temp file to final path
                        fs.renameSync(tempPath, modelPath)
                        console.log(`[WhisperModelManager] Download complete: ${modelName}`)

                        resolve({ success: true, modelName, path: modelPath })
                    })
                })

                request.on('error', (err) => {
                    this.activeDownloads.delete(modelName)
                    fileStream.close()
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath)
                    }
                    reject(err)
                })
            }

            makeRequest(model.url)
        })
    }

    /**
     * Cancel an active download
     */
    cancelDownload(modelName: WhisperModelName): boolean {
        const controller = this.activeDownloads.get(modelName)
        if (controller) {
            controller.abort()
            this.activeDownloads.delete(modelName)
            console.log(`[WhisperModelManager] Cancelled download of ${modelName}`)
            return true
        }
        return false
    }

    /**
     * Delete a downloaded model
     */
    deleteModel(modelName: WhisperModelName): boolean {
        const modelPath = this.getModelPath(modelName)

        if (fs.existsSync(modelPath)) {
            fs.unlinkSync(modelPath)
            console.log(`[WhisperModelManager] Deleted model: ${modelName}`)
            return true
        }

        return false
    }

    /**
     * Get total disk space used by downloaded models
     */
    getTotalStorageUsed(): number {
        return this.listDownloadedModels().reduce((total, modelName) => {
            const modelPath = this.getModelPath(modelName)
            const stats = fs.statSync(modelPath)
            return total + stats.size
        }, 0)
    }

    /**
     * Format bytes to human readable string
     */
    static formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
}

// Export singleton
export const whisperModelManager = new WhisperModelManager()
