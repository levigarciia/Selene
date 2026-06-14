import * as crypto from 'crypto'
import { BrowserWindow, WebContents, ipcMain } from 'electron'
import { ParakeetSession } from './ParakeetSession.js'
import { normalizarModeloParakeet, parakeetModelManager, type ParakeetModelName } from './ParakeetModelManager.js'

export interface LocalParakeetSessionConfig {
    model?: ParakeetModelName | 'tdt-0.6b-v3' | 'ctc-0.6b'
    language?: string
    speakerLabel?: string
}

type InformacoesSessaoParakeet = ReturnType<ParakeetSession['getInfo']>

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

export class LocalParakeetService {
    private sessions = new Map<string, ParakeetSession>()
    private mainWindow: BrowserWindow | null = null
    private sessionTargets = new Map<string, WebContents>()
    private initialized = false

    initialize(mainWindow: BrowserWindow): void {
        this.mainWindow = mainWindow
        parakeetModelManager.initialize()
        this.initialized = true
        console.log('[LocalParakeetService] Initialized')
    }

    async checkAvailability() {
        return parakeetModelManager.checkAvailability()
    }

    async startSession(config: LocalParakeetSessionConfig, targetContents?: WebContents): Promise<{
        sessionId: string
        model: ParakeetModelName
        language: string
        speakerLabel: string | null
    }> {
        if (!this.initialized) {
            throw new Error('Serviço Parakeet não inicializado')
        }

        const modelName = normalizarModeloParakeet(config.model)
        const availability = await this.checkAvailability()

        if (!availability.runtimeAvailable) {
            throw new Error('Runtime local do Parakeet não está disponível.')
        }
        if (!(await parakeetModelManager.isModelDownloaded(modelName))) {
            throw new Error(`Modelo '${modelName}' ainda não foi baixado.`)
        }

        const speakerLabel = config.speakerLabel || null
        const sessionId = crypto.randomBytes(16).toString('hex')
        const session = new ParakeetSession(sessionId, {
            modelName,
            language: config.language || 'multi',
            speakerLabel: speakerLabel || undefined
        })

        session.on('complete', (data) => {
            this.sendToRenderer('parakeet-local:transcription-complete', data, sessionId)
        })
        session.on('error', (data) => {
            this.sendToRenderer('parakeet-local:transcription-error', data, sessionId)
        })

        this.sessions.set(sessionId, session)
        if (targetContents && !targetContents.isDestroyed()) {
            this.sessionTargets.set(sessionId, targetContents)
        }

        return {
            sessionId,
            model: modelName,
            language: config.language || 'multi',
            speakerLabel
        }
    }

    processAudioChunk(sessionId: string, wavData: ArrayBuffer | Buffer): void {
        const session = this.sessions.get(sessionId)
        if (!session) {
            throw new Error(`Sessão Parakeet não encontrada: ${sessionId}`)
        }

        const buffer = Buffer.isBuffer(wavData) ? wavData : Buffer.from(wavData)
        session.appendChunk(buffer)
    }

    async stopSession(sessionId: string): Promise<InformacoesSessaoParakeet> {
        const session = this.sessions.get(sessionId)
        if (!session) {
            throw new Error(`Sessão Parakeet não encontrada: ${sessionId}`)
        }

        await session.stop()
        const info = session.getInfo()
        this.sessions.delete(sessionId)
        this.sessionTargets.delete(sessionId)
        return info
    }

    async stopAllSessions(): Promise<void> {
        const sessionIds = Array.from(this.sessions.keys())
        for (const sessionId of sessionIds) {
            try {
                await this.stopSession(sessionId)
            } catch (erro) {
                console.error('[LocalParakeetService] Falha ao encerrar sessão:', erro)
            }
        }
    }

    private sendToRenderer(channel: string, data: unknown, sessionId?: string): void {
        const enviados = new Set<number>()

        const enviar = (targetContents: WebContents | null | undefined) => {
            if (!targetContents || targetContents.isDestroyed()) {
                return
            }
            if (enviados.has(targetContents.id)) {
                return
            }
            targetContents.send(channel, data)
            enviados.add(targetContents.id)
        }

        if (sessionId) {
            enviar(this.sessionTargets.get(sessionId))
        }

        for (const janela of BrowserWindow.getAllWindows()) {
            enviar(janela.webContents)
        }

        if (enviados.size === 0 && this.mainWindow && !this.mainWindow.isDestroyed()) {
            enviar(this.mainWindow.webContents)
        }
    }
}

export const localParakeetService = new LocalParakeetService()

export function setupLocalParakeetIPC(mainWindow: BrowserWindow): void {
    parakeetModelManager.initialize()
    localParakeetService.initialize(mainWindow)

    ipcMain.handle('parakeet-local:list-models', async () => {
        try {
            const models = await parakeetModelManager.getAvailableModels()
            return { success: true, models }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error listing models:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:get-model-status', async (_event, modelName: ParakeetModelName) => {
        try {
            const status = await parakeetModelManager.getModelStatus(modelName)
            return { success: true, ...status }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error getting model status:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:download-model', async (event, modelName: ParakeetModelName) => {
        try {
            const senderWebContents = event.sender

            if (senderWebContents && !senderWebContents.isDestroyed()) {
                senderWebContents.send('parakeet-local:download-progress', {
                    modelName,
                    downloaded: 1,
                    total: 100,
                    percent: 1,
                    stage: 'preparing-runtime'
                })
            }

            const result = await parakeetModelManager.downloadModel(modelName, (downloaded, total, percent) => {
                if (senderWebContents && !senderWebContents.isDestroyed()) {
                    senderWebContents.send('parakeet-local:download-progress', {
                        modelName,
                        downloaded,
                        total,
                        percent
                    })
                }
            })

            if (senderWebContents && !senderWebContents.isDestroyed()) {
                senderWebContents.send('parakeet-local:download-complete', {
                    modelName,
                    success: true,
                    path: result.path
                })
            }

            return { success: true, modelName: result.modelName, path: result.path }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error downloading model:', error)
            const senderWebContents = event.sender
            if (senderWebContents && !senderWebContents.isDestroyed()) {
                senderWebContents.send('parakeet-local:download-error', {
                    modelName,
                    error: obterMensagemErro(error)
                })
            }
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:cancel-download', async (_event, modelName: ParakeetModelName) => {
        try {
            const cancelled = parakeetModelManager.cancelDownload(modelName)
            return { success: true, cancelled }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error cancelling download:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:delete-model', async (_event, modelName: ParakeetModelName) => {
        try {
            const deleted = await parakeetModelManager.deleteModel(modelName)
            return { success: true, deleted }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error deleting model:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:start-session', async (_event, config: LocalParakeetSessionConfig) => {
        try {
            const result = await localParakeetService.startSession(config, _event.sender)
            return { success: true, ...result }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error starting session:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:send-audio-chunk', async (_event, sessionId: string, audioData: ArrayBuffer) => {
        try {
            localParakeetService.processAudioChunk(sessionId, audioData)
            return { success: true }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error sending audio chunk:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:stop-session', async (_event, sessionId: string) => {
        try {
            const result = await localParakeetService.stopSession(sessionId)
            return { success: true, ...result }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error stopping session:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('parakeet-local:check-availability', async () => {
        try {
            const availability = await localParakeetService.checkAvailability()
            return { success: true, ...availability }
        } catch (error: unknown) {
            console.error('[LocalParakeet:IPC] Error checking availability:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    console.log('[LocalParakeet:IPC] Handlers registered')
}
