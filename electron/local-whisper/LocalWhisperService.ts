/**
 * LocalWhisperService
 * Orchestrates local Whisper transcription sessions
 * Runs in Electron main process
 */

import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'
import { app, BrowserWindow, WebContents, ipcMain } from 'electron'
import { WhisperSession } from './WhisperSession.js'
import { whisperModelManager, WhisperModelName } from './WhisperModelManager.js'

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface LocalWhisperSessionConfig {
    model?: WhisperModelName
    language?: string
    speakerLabel?: string
    noGpu?: boolean
}

type InformacoesSessaoWhisper = ReturnType<WhisperSession['getInfo']>

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

export class LocalWhisperService {
    private sessions = new Map<string, WhisperSession>()
    private mainWindow: BrowserWindow | null = null
    private sessionTargets = new Map<string, WebContents>()
    private isInitialized = false

    /**
     * Initialize the service
     */
    initialize(mainWindow: BrowserWindow): void {
        this.mainWindow = mainWindow
        whisperModelManager.initialize()
        this.isInitialized = true
        console.log('[LocalWhisperService] Initialized')
    }

    /**
     * Get the path to the whisper binary for current platform
     */
    getWhisperBinaryPath(): string | null {
        const platform = process.platform
        const arch = process.arch
        const binaryName = platform === 'win32' ? 'whisper.exe' : 'whisper-cli'

        // Possible locations for the binary
        const possiblePaths: string[] = []

        // In packaged app
        if (app.isPackaged) {
            possiblePaths.push(
                path.join(process.resourcesPath, 'whisper-bin', binaryName),
                path.join(process.resourcesPath, 'whisper-bin', `${platform}-${arch}`, binaryName),
                path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'whisper', 'bin', `${platform}-${arch}`, binaryName)
            )
        }

        // In development - check various locations
        const electronDir = path.join(__dirname, '..')
        possiblePaths.push(
            path.join(electronDir, 'native', 'whisper', 'bin', `${platform}-${arch}`, binaryName),
            path.join(electronDir, '..', 'native', 'whisper', 'bin', `${platform}-${arch}`, binaryName),
            // For whisper-node if compiled
            path.join(electronDir, '..', 'node_modules', 'whisper-node', 'lib', 'whisper.cpp', 'main'),
            path.join(electronDir, '..', 'node_modules', 'whisper-node', 'lib', 'whisper.cpp', 'main.exe')
        )

        // Check each path
        for (const binaryPath of possiblePaths) {
            if (fs.existsSync(binaryPath)) {
                console.log(`[LocalWhisperService] Found whisper binary at: ${binaryPath}`)
                return binaryPath
            }
        }

        console.warn('[LocalWhisperService] Whisper binary not found in any location')
        console.warn('[LocalWhisperService] Checked paths:', possiblePaths)
        return null
    }

    /**
     * Check if local whisper is available
     */
    checkAvailability(): {
        binaryAvailable: boolean
        binaryPath: string | null
        hasModels: boolean
        downloadedModels: WhisperModelName[]
        available: boolean
    } {
        const binaryPath = this.getWhisperBinaryPath()
        const downloadedModels = whisperModelManager.listDownloadedModels()

        return {
            binaryAvailable: !!binaryPath,
            binaryPath: binaryPath,
            hasModels: downloadedModels.length > 0,
            downloadedModels: downloadedModels,
            available: !!binaryPath && downloadedModels.length > 0
        }
    }

    /**
     * Start a new transcription session
     */
    async startSession(config: LocalWhisperSessionConfig, targetContents?: WebContents): Promise<{
        sessionId: string
        model: WhisperModelName
        language: string
        speakerLabel: string | null
    }> {
        if (!this.isInitialized) {
            throw new Error('Service not initialized')
        }

        // Validate binary
        const binaryPath = this.getWhisperBinaryPath()
        if (!binaryPath) {
            throw new Error('Whisper binary not found. Please reinstall the application.')
        }

        // Validate model
        const modelName = config.model || 'base'
        if (!whisperModelManager.isModelDownloaded(modelName)) {
            throw new Error(`Model '${modelName}' is not downloaded. Please download it first.`)
        }

        const modelPath = whisperModelManager.getModelPath(modelName)
        const speakerLabel = config.speakerLabel || null

        // Ensure we don't run multiple concurrent sessions for the same speaker
        if (speakerLabel) {
            const existingSessionIds = Array.from(this.sessions.entries())
                .filter(([, session]) => session.speakerLabel === speakerLabel)
                .map(([sessionId]) => sessionId)

            for (const existingSessionId of existingSessionIds) {
                try {
                    console.log(
                        `[LocalWhisperService] Found existing session ${existingSessionId} for speakerLabel "${speakerLabel}" - stopping it`
                    )
                    await this.stopSession(existingSessionId, { suppressComplete: true })
                } catch (error) {
                    console.error(
                        `[LocalWhisperService] Error stopping existing session ${existingSessionId}:`,
                        error
                    )
                }
            }
        }

        // Generate session ID
        const sessionId = crypto.randomBytes(16).toString('hex')

        // Create session
        const session = new WhisperSession(sessionId, {
            modelPath,
            binaryPath,
            language: config.language || 'auto',
            speakerLabel: speakerLabel || undefined,
            noGpu: config.noGpu || false
        })

        // Set up event handlers
        session.on('delta', (data) => {
            this.sendToRenderer('whisper-local:transcription-delta', data, sessionId)
        })

        session.on('complete', (data) => {
            this.sendToRenderer('whisper-local:transcription-complete', data, sessionId)
        })

        session.on('error', (data) => {
            this.sendToRenderer('whisper-local:transcription-error', data, sessionId)
        })

        // Store session
        this.sessions.set(sessionId, session)
        if (targetContents && !targetContents.isDestroyed()) {
            this.sessionTargets.set(sessionId, targetContents)
            console.log(
                `[LocalWhisperService] Session ${sessionId} bound to webContents ${targetContents.id}`
            )
        }

        console.log(`[LocalWhisperService] Started session ${sessionId} with model ${modelName}`)

        return {
            sessionId,
            model: modelName,
            language: config.language || 'auto',
            speakerLabel: speakerLabel
        }
    }

    /**
     * Send audio data to a session
     */
    processAudio(sessionId: string, audioData: ArrayBuffer | Buffer): void {
        const session = this.sessions.get(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        // Convert ArrayBuffer to Buffer if needed
        const buffer = Buffer.isBuffer(audioData)
            ? audioData
            : Buffer.from(audioData)

        session.appendAudio(buffer)
    }

    /**
     * Stop a transcription session
     */
    async stopSession(sessionId: string, options: { suppressComplete?: boolean } = {}): Promise<InformacoesSessaoWhisper> {
        const session = this.sessions.get(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        await session.stop(options)
        const info = session.getInfo()
        this.sessions.delete(sessionId)
        this.sessionTargets.delete(sessionId)
        
        console.log(`[LocalWhisperService] Stopped session ${sessionId}`)
        return info
    }

    /**
     * Get info about a session
     */
    getSessionInfo(sessionId: string): InformacoesSessaoWhisper | null {
        const session = this.sessions.get(sessionId)
        if (!session) {
            return null
        }
        return session.getInfo()
    }

    /**
     * Get list of active sessions
     */
    getActiveSessions(): string[] {
        return Array.from(this.sessions.keys())
    }

    /**
     * Stop all active sessions
     */
    async stopAllSessions(): Promise<void> {
        const sessionIds = Array.from(this.sessions.keys())
        for (const sessionId of sessionIds) {
            try {
                await this.stopSession(sessionId)
            } catch (error) {
                console.error(`[LocalWhisperService] Error stopping session ${sessionId}:`, error)
            }
        }
    }

    /**
     * Send event to renderer process
     */
    private sendToRenderer(channel: string, data: unknown, sessionId?: string): void {
        const conteudosEnviados = new Set<number>()

        const enviarParaConteudo = (targetContents: WebContents | null | undefined, origem: string) => {
            if (!targetContents || targetContents.isDestroyed()) {
                return
            }

            if (conteudosEnviados.has(targetContents.id)) {
                return
            }

            console.log(
                `[LocalWhisperService] Sending ${channel}${sessionId ? ` for session ${sessionId}` : ''} to webContents ${targetContents.id} (${origem})`
            )
            targetContents.send(channel, data)
            conteudosEnviados.add(targetContents.id)
        }

        if (sessionId) {
            const targetContents = this.sessionTargets.get(sessionId)
            enviarParaConteudo(targetContents, 'session-target')
        }

        for (const janela of BrowserWindow.getAllWindows()) {
            enviarParaConteudo(janela.webContents, 'broadcast')
        }

        if (conteudosEnviados.size > 0) {
            return
        }

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            enviarParaConteudo(this.mainWindow.webContents, 'main-window-fallback')
        }
    }
}

// Export singleton
export const localWhisperService = new LocalWhisperService()

/**
 * Register all local whisper IPC handlers
 */
export function setupLocalWhisperIPC(mainWindow: BrowserWindow): void {
    // Initialize services
    whisperModelManager.initialize()
    localWhisperService.initialize(mainWindow)

    // ============================================
    // MODEL MANAGEMENT HANDLERS
    // ============================================

    /**
     * Get list of all available models with their status
     */
    ipcMain.handle('whisper-local:list-models', async () => {
        try {
            const models = whisperModelManager.getAvailableModels()
            return { success: true, models }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error listing models:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Get status of a specific model
     */
    ipcMain.handle('whisper-local:get-model-status', async (_event, modelName: WhisperModelName) => {
        try {
            const status = whisperModelManager.getModelStatus(modelName)
            return { success: true, ...status }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error getting model status:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Download a model with progress reporting
     */
    ipcMain.handle('whisper-local:download-model', async (event, modelName: WhisperModelName) => {
        try {
            console.log(`[LocalWhisper:IPC] Starting download of model: ${modelName}`)

            const senderWebContents = event.sender

            const result = await whisperModelManager.downloadModel(modelName, (downloaded, total, percent) => {
                if (senderWebContents && !senderWebContents.isDestroyed()) {
                    senderWebContents.send('whisper-local:download-progress', {
                        modelName,
                        downloaded,
                        total,
                        percent
                    })
                }
            })

            if (senderWebContents && !senderWebContents.isDestroyed()) {
                senderWebContents.send('whisper-local:download-complete', {
                    modelName,
                    success: true,
                    path: result.path
                })
            }

            return { success: true, modelName: result.modelName, path: result.path }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error downloading model:', error)

            const senderWebContents = event.sender
            if (senderWebContents && !senderWebContents.isDestroyed()) {
                senderWebContents.send('whisper-local:download-error', {
                    modelName,
                    error: obterMensagemErro(error)
                })
            }

            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Cancel an active model download
     */
    ipcMain.handle('whisper-local:cancel-download', async (_event, modelName: WhisperModelName) => {
        try {
            const cancelled = whisperModelManager.cancelDownload(modelName)
            return { success: true, cancelled }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error cancelling download:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Delete a downloaded model
     */
    ipcMain.handle('whisper-local:delete-model', async (_event, modelName: WhisperModelName) => {
        try {
            const deleted = whisperModelManager.deleteModel(modelName)
            return { success: true, deleted }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error deleting model:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Get total storage used by downloaded models
     */
    ipcMain.handle('whisper-local:get-storage-info', async () => {
        try {
            const totalUsed = whisperModelManager.getTotalStorageUsed()
            const downloadedModels = whisperModelManager.listDownloadedModels()
            return {
                success: true,
                totalUsed,
                totalUsedFormatted: whisperModelManager.constructor.prototype.formatBytes?.(totalUsed) || `${Math.round(totalUsed / 1024 / 1024)} MB`,
                downloadedCount: downloadedModels.length,
                downloadedModels
            }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error getting storage info:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // ============================================
    // TRANSCRIPTION SESSION HANDLERS
    // ============================================

    /**
     * Start a new transcription session
     */
    ipcMain.handle('whisper-local:start-session', async (_event, config: LocalWhisperSessionConfig) => {
        try {
            console.log('[LocalWhisper:IPC] Starting session with config:', config, 'sender:', _event.sender.id)
            const result = await localWhisperService.startSession(config, _event.sender)
            return { success: true, ...result }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error starting session:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Send audio data to active session
     */
    ipcMain.handle('whisper-local:send-audio', async (_event, sessionId: string, audioData: ArrayBuffer) => {
        try {
            localWhisperService.processAudio(sessionId, audioData)
            return { success: true }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error sending audio:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Stop a transcription session
     */
    ipcMain.handle('whisper-local:stop-session', async (_event, sessionId: string) => {
        try {
            const result = await localWhisperService.stopSession(sessionId)
            return { success: true, ...result }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error stopping session:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    /**
     * Check if local whisper is available (binary + model)
     */
    ipcMain.handle('whisper-local:check-availability', async () => {
        try {
            const availability = localWhisperService.checkAvailability()
            return {
                success: true,
                ...availability
            }
        } catch (error: unknown) {
            console.error('[LocalWhisper:IPC] Error checking availability:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    console.log('[LocalWhisper:IPC] Handlers registered')
}
