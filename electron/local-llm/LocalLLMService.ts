import { BrowserWindow, ipcMain } from 'electron'
import { llamaModelManager } from './LlamaModelManager.js'
import { llamaRuntimeManager } from './LlamaRuntimeManager.js'
import { localLLMHostService } from './LocalLLMHostService.js'
import { localLLMHttpService } from './LocalLLMHttpService.js'
import { obterMensagemErro } from './download.js'

type MensagemLocalLLM = { role: 'system' | 'user' | 'assistant'; content: unknown }

interface OpcoesStreamLocalLLM {
    temperature?: number
    maxTokens?: number
    reasoningAtivo?: boolean
}

export async function setupLocalLLMIPC(mainWindow: BrowserWindow): Promise<void> {
    llamaRuntimeManager.initialize()
    llamaModelManager.initialize()
    await localLLMHttpService.start()

    const controllersMap = new Map<string, AbortController>()

    ipcMain.handle('local-llm:check-availability', async () => {
        try {
            const configuracoes = localLLMHostService.carregarConfiguracoes()
            const runtime = llamaRuntimeManager.checkAvailability(configuracoes.runtimeType)
            const modelosBaixados = llamaModelManager.listDownloadedModels()
            return {
                success: true,
                ...runtime,
                hasModels: modelosBaixados.length > 0,
                downloadedModels: modelosBaixados.map((modelo) => modelo.id),
                available: runtime.runtimeAvailable && modelosBaixados.length > 0,
                http: localLLMHttpService.getConfig()
            }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:list-models', async () => {
        try {
            return { success: true, models: llamaModelManager.getAvailableModels() }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:download-runtime', async (event, runtimeType?: 'cpu' | 'vulkan') => {
        try {
            const resultado = await llamaRuntimeManager.downloadRuntime(runtimeType || 'cpu', (downloaded, total, percent) => {
                event.sender.send('local-llm:runtime-progress', { downloaded, total, percent })
            })
            return resultado
        } catch (erro) {
            const error = obterMensagemErro(erro)
            event.sender.send('local-llm:download-error', { tipo: 'runtime', error })
            return { success: false, error }
        }
    })

    ipcMain.handle('local-llm:download-model', async (event, modelId: string) => {
        try {
            const resultado = await llamaModelManager.downloadModel(modelId, (downloaded, total, percent) => {
                event.sender.send('local-llm:model-progress', { modelId, downloaded, total, percent })
            })
            return resultado
        } catch (erro) {
            const error = obterMensagemErro(erro)
            event.sender.send('local-llm:download-error', { tipo: 'model', modelId, error })
            return { success: false, error }
        }
    })

    ipcMain.handle('local-llm:cancel-download', async (_event, modelId: string) => {
        try {
            return { success: true, cancelled: llamaModelManager.cancelDownload(modelId) }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:delete-model', async (_event, modelId: string) => {
        try {
            const atual = localLLMHostService.getCurrentServer()
            if (atual?.modelId === modelId) {
                await localLLMHostService.stop()
            }
            return { success: true, deleted: llamaModelManager.deleteModel(modelId) }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:ensure-server', async (_event, modelId: string) => {
        try {
            const servidor = await localLLMHostService.ensureServer(modelId)
            return { success: true, ...servidor, http: localLLMHttpService.getConfig() }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:get-http-config', async () => {
        try {
            return { success: true, ...localLLMHttpService.getConfig() }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:rotate-http-key', async () => {
        try {
            return { success: true, ...localLLMHttpService.rotateKey() }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:get-hardware-info', async () => {
        try {
            const hardware = await localLLMHostService.detectarHardware()
            return { success: true, hardware }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:get-server-settings', async () => {
        try {
            const settings = localLLMHostService.carregarConfiguracoes()
            return { success: true, settings }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:set-server-settings', async (_event, settings) => {
        try {
            localLLMHostService.salvarConfiguracoes(settings)
            const atual = localLLMHostService.getCurrentServer()
            if (atual) {
                await localLLMHostService.stop()
            }
            return { success: true }
        } catch (erro) {
            return { success: false, error: obterMensagemErro(erro) }
        }
    })

    ipcMain.handle('local-llm:stream-chat', async (event, reqId: string, modelId: string, mensagens: MensagemLocalLLM[], opcoes: OpcoesStreamLocalLLM) => {
        try {
            const servidor = await localLLMHostService.ensureServer(modelId)
            
            const controller = new AbortController()
            controllersMap.set(reqId, controller)

            const bodyReq = {
                model: servidor.modelId || modelId,
                messages: mensagens,
                stream: true,
                ...(typeof opcoes?.temperature === 'number' ? { temperature: opcoes.temperature } : {}),
                ...(typeof opcoes?.maxTokens === 'number' ? { max_tokens: opcoes.maxTokens } : {}),
                ...(opcoes?.reasoningAtivo === false ? { 
                    reasoning: false, 
                    reasoning_budget: 0,
                    chat_template_kwargs: {
                        enable_thinking: false,
                        thinking: false,
                        reasoning: false
                    }
                } : {})
            }

            const urlCompleta = `${servidor.baseUrl}/chat/completions`
            
            const resposta = await fetch(urlCompleta, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer selene-local'
                },
                body: JSON.stringify(bodyReq),
                signal: controller.signal
            })

            if (!resposta.ok) {
                const bodyError = await resposta.text().catch(() => '')
                throw new Error(`Servidor local respondeu com status ${resposta.status}: ${bodyError}`)
            }

            const reader = resposta.body?.getReader()
            if (!reader) {
                throw new Error("Corpo de resposta HTTP não é legível.")
            }

            const decoder = new TextDecoder()
            let buffer = ''

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    
                    buffer += decoder.decode(value, { stream: true })
                    const linhas = buffer.split('\n')
                    buffer = linhas.pop() || ''

                    for (const { line } of parseSSELines(linhas)) {
                        event.sender.send('local-llm:stream-chunk', { reqId, data: line })
                    }
                }

                if (buffer.trim()) {
                    const linhasRestantes = [buffer.trim()]
                    for (const { line } of parseSSELines(linhasRestantes)) {
                        event.sender.send('local-llm:stream-chunk', { reqId, data: line })
                    }
                }

                event.sender.send('local-llm:stream-end', { reqId, success: true })
            } finally {
                reader.releaseLock()
            }

            controllersMap.delete(reqId)
            return { success: true }
        } catch (erro: unknown) {
            controllersMap.delete(reqId)
            const errorMsg = erro instanceof Error && erro.name === 'AbortError'
                ? 'Requisição cancelada pelo usuário.'
                : obterMensagemErro(erro)
            event.sender.send('local-llm:stream-end', { reqId, success: false, error: errorMsg })
            return { success: false, error: errorMsg }
        }
    })

    function* parseSSELines(lines: string[]) {
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed) {
                yield { line: trimmed }
            }
        }
    }

    ipcMain.handle('local-llm:cancel-stream-chat', async (_event, reqId: string) => {
        const controller = controllersMap.get(reqId)
        if (controller) {
            controller.abort()
            controllersMap.delete(reqId)
            return { success: true }
        }
        return { success: false, error: 'Requisicao nao encontrada.' }
    })

    mainWindow.on('closed', () => {
        void localLLMHostService.stop()
    })

    console.log('[LocalLLM:IPC] Handlers registered')
}
