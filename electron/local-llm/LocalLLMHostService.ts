import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { app } from 'electron'
import { llamaModelManager } from './LlamaModelManager.js'
import { llamaRuntimeManager } from './LlamaRuntimeManager.js'

export interface LlamaServerSettings {
    runtimeType: 'cpu' | 'vulkan' | 'hip'
    gpuOn: boolean
    gpuLayers: number
    offloadKv: boolean
    threads: number
    noMmap: boolean
    mlock: boolean
    ctxSize: number
    flashAttn: boolean
    fitOn: boolean
    cacheRam: number
    ctxCheckpoints: number
    gpuDevice: string
    usarServidorExterno: boolean
    urlServidorExterno: string
    modeloServidorExterno: string
}


export interface ServidorLocalLLM {
    modelId: string
    baseUrl: string
    port: number
}

interface RegistroGpuWindows {
    DriverDesc?: string
    Name?: string
    AdapterRAM?: number
    'HardwareInformation.qwMemorySize'?: number
    'HardwareInformation.MemorySize'?: number
}

function aguardar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function portaLivre(porta: number): Promise<boolean> {
    return new Promise((resolve) => {
        const servidor = http.createServer()
        servidor.once('error', () => resolve(false))
        servidor.once('listening', () => {
            servidor.close(() => resolve(true))
        })
        servidor.listen(porta, '127.0.0.1')
    })
}

async function obterPortaLivre(inicio: number): Promise<number> {
    for (let porta = inicio; porta < inicio + 100; porta++) {
        if (await portaLivre(porta)) {
            return porta
        }
    }
    throw new Error('Nenhuma porta livre encontrada para o llama-server.')
}

export class LocalLLMHostService {
    private processo: ChildProcessWithoutNullStreams | null = null
    private servidorAtual: ServidorLocalLLM | null = null
    private inicializacaoAtual: Promise<ServidorLocalLLM> | null = null

    async detectarHardware(): Promise<{
        cpuName: string
        cpuArch: string
        totalRamBytes: number
        gpus: Array<{ name: string; vramBytes: number }>
    }> {
        const cpuName = os.cpus()[0]?.model || 'Desconhecido'
        const cpuArch = os.arch()
        const totalRamBytes = os.totalmem()
        const gpus: Array<{ name: string; vramBytes: number }> = []

        if (process.platform === 'win32') {
            try {
                // Obter nomes das GPUs e memória do registro usando PowerShell
                const cmd = [
                    '-NoProfile',
                    '-ExecutionPolicy',
                    'Bypass',
                    '-Command',
                    `Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\00*' | Select-Object DriverDesc, 'HardwareInformation.qwMemorySize', 'HardwareInformation.MemorySize' | ConvertTo-Json -Compress`
                ]
                
                const resultado = await new Promise<string>((resolve, reject) => {
                    const proc = spawn('powershell.exe', cmd, { windowsHide: true })
                    let stdout = ''
                    proc.stdout.on('data', (data) => stdout += String(data))
                    proc.on('close', (code) => {
                        if (code === 0) resolve(stdout)
                        else reject(new Error(`PowerShell retornou código ${code}`))
                    })
                    proc.on('error', reject)
                })

                if (resultado.trim()) {
                    let parsed = JSON.parse(resultado.trim()) as RegistroGpuWindows | RegistroGpuWindows[]
                    if (!Array.isArray(parsed)) {
                        parsed = [parsed]
                    }

                    for (const item of parsed) {
                        const name = item.DriverDesc
                        if (name) {
                            const qwMem = item['HardwareInformation.qwMemorySize']
                            const mem = item['HardwareInformation.MemorySize']
                            const vramBytes = typeof qwMem === 'number' ? qwMem : (typeof mem === 'number' ? mem : 0)
                            gpus.push({ name, vramBytes })
                        }
                    }
                }
            } catch (erro) {
                console.warn('[LocalLLMHostService] Falha ao detectar GPUs via PowerShell:', erro)
                try {
                    const basicCmd = [
                        '-NoProfile',
                        '-ExecutionPolicy',
                        'Bypass',
                        '-Command',
                        `Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress`
                    ]
                    const basicRes = await new Promise<string>((resolve, reject) => {
                        const proc = spawn('powershell.exe', basicCmd, { windowsHide: true })
                        let stdout = ''
                        proc.stdout.on('data', (data) => stdout += String(data))
                        proc.on('close', (code) => {
                            if (code === 0) resolve(stdout)
                            else reject(new Error(`PowerShell básico retornou código ${code}`))
                        })
                        proc.on('error', reject)
                    })
                    if (basicRes.trim()) {
                        let parsed = JSON.parse(basicRes.trim()) as RegistroGpuWindows | RegistroGpuWindows[]
                        if (!Array.isArray(parsed)) {
                            parsed = [parsed]
                        }
                        for (const item of parsed) {
                            if (item.Name) {
                                gpus.push({ name: item.Name, vramBytes: item.AdapterRAM || 0 })
                            }
                        }
                    }
                } catch (fallbackErro) {
                    console.error('[LocalLLMHostService] Falha no fallback de detecção de GPU:', fallbackErro)
                }
            }
        }

        return {
            cpuName,
            cpuArch,
            totalRamBytes,
            gpus
        }
    }

    private getSettingsPath(): string {
        return path.join(app.getPath('userData'), 'local-llm', 'server-settings.json')
    }

    carregarConfiguracoes(): LlamaServerSettings {
        const caminho = this.getSettingsPath()
        const padrao: LlamaServerSettings = {
            runtimeType: 'cpu',
            gpuOn: false,
            gpuLayers: 0,
            offloadKv: true,
            threads: 0,
            noMmap: false,
            mlock: false,
            ctxSize: 0,
            flashAttn: true,
            fitOn: false,
            cacheRam: 2048,
            ctxCheckpoints: 0,
            gpuDevice: 'Vulkan0',
            usarServidorExterno: false,
            urlServidorExterno: 'http://127.0.0.1:11434/v1',
            modeloServidorExterno: ''
        }

        if (fs.existsSync(caminho)) {
            try {
                const conteudo = fs.readFileSync(caminho, 'utf8')
                const configs = JSON.parse(conteudo)
                if (configs && configs.cacheRam === 0) {
                    configs.cacheRam = 2048
                }
                return { ...padrao, ...configs }
            } catch (erro) {
                console.warn('[LocalLLMHostService] Falha ao ler configurações do servidor:', erro)
            }
        }

        return padrao
    }

    salvarConfiguracoes(config: LlamaServerSettings): void {
        const caminho = this.getSettingsPath()
        fs.mkdirSync(path.dirname(caminho), { recursive: true })
        fs.writeFileSync(caminho, JSON.stringify(config, null, 2), 'utf8')
    }

    async ensureServer(modelId: string): Promise<ServidorLocalLLM> {
        const configuracoes = this.carregarConfiguracoes()
        if (configuracoes.usarServidorExterno) {
            const baseUrl = configuracoes.urlServidorExterno?.trim() || 'http://127.0.0.1:11434/v1'
            let port = 11434
            try {
                const url = new URL(baseUrl)
                port = url.port ? parseInt(url.port, 10) : 80
            } catch {
                console.warn('[LocalLLMHostService] URL externa inválida, usando porta padrão.')
            }
            return {
                modelId: configuracoes.modeloServidorExterno?.trim() || modelId,
                baseUrl,
                port
            }
        }

        if (this.servidorAtual?.modelId === modelId && await this.healthCheck(this.servidorAtual.baseUrl)) {
            return this.servidorAtual
        }

        if (this.inicializacaoAtual) {
            const atual = await this.inicializacaoAtual
            if (atual.modelId === modelId) {
                return atual
            }
        }

        this.inicializacaoAtual = this.iniciarServidor(modelId)
        try {
            return await this.inicializacaoAtual
        } finally {
            this.inicializacaoAtual = null
        }
    }

    async stop(): Promise<void> {
        if (!this.processo) {
            this.servidorAtual = null
            return
        }

        const processo = this.processo
        this.processo = null
        this.servidorAtual = null

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                processo.kill('SIGKILL')
                resolve()
            }, 3000)

            processo.once('close', () => {
                clearTimeout(timeout)
                resolve()
            })
            processo.kill()
        })
    }

    getCurrentServer(): ServidorLocalLLM | null {
        return this.servidorAtual
    }

    private async iniciarServidor(modelId: string): Promise<ServidorLocalLLM> {
        await this.stop()

        const configuracoes = this.carregarConfiguracoes()
        const runtimePath = llamaRuntimeManager.getServerPath(configuracoes.runtimeType)
        if (!runtimePath) {
            throw new Error(`Runtime llama.cpp (${configuracoes.runtimeType.toUpperCase()}) não está instalado.`)
        }

        if (!llamaModelManager.isModelDownloaded(modelId)) {
            throw new Error(`Modelo local '${modelId}' ainda não foi baixado.`)
        }

        const modelo = llamaModelManager.obterModelo(modelId)
        const caminhoModelo = llamaModelManager.getModelPath(modelId)
        const porta = await obterPortaLivre(11436)
        const baseUrl = `http://127.0.0.1:${porta}/v1`
        
        const args = [
            '--model',
            caminhoModelo,
            '--host',
            '127.0.0.1',
            '--port',
            String(porta),
            '--ctx-size',
            String(configuracoes.ctxSize > 0 ? configuracoes.ctxSize : Math.min(modelo.contexto, 32768)),
            '--parallel',
            '1',
            '--no-warmup'
        ]

        if (configuracoes.runtimeType === 'vulkan' && configuracoes.gpuOn) {
            const layers = configuracoes.gpuLayers > 0 ? configuracoes.gpuLayers : 99
            args.push('--n-gpu-layers', String(layers))
            const device = this.obterNomeDispositivo(configuracoes.gpuDevice, 'vulkan')
            args.push('--device', device)
            if (!configuracoes.offloadKv) {
                args.push('--no-kv-offload')
            }
        } else if (configuracoes.runtimeType === 'hip' && configuracoes.gpuOn) {
            const layers = configuracoes.gpuLayers > 0 ? configuracoes.gpuLayers : 99
            args.push('--n-gpu-layers', String(layers))
            const device = this.obterNomeDispositivo(configuracoes.gpuDevice, 'hip')
            args.push('--device', device)
            if (!configuracoes.offloadKv) {
                args.push('--no-kv-offload')
            }
        }

        if (configuracoes.threads > 0) {
            args.push('--threads', String(configuracoes.threads))
        }

        if (configuracoes.flashAttn) {
            args.push('--flash-attn', 'on')
        } else {
            args.push('--flash-attn', 'off')
        }

        if (!configuracoes.fitOn) {
            args.push('-fit', 'off')
        }

        if (configuracoes.noMmap) {
            args.push('--no-mmap')
        }

        if (configuracoes.mlock) {
            args.push('--mlock')
        }

        // Configurações de cache de prompt e checkpoints de contexto
        const cacheRamVal = configuracoes.cacheRam !== undefined ? configuracoes.cacheRam : 0
        args.push('--cache-ram', String(cacheRamVal))

        const ctxCheckpointsVal = configuracoes.ctxCheckpoints !== undefined ? configuracoes.ctxCheckpoints : 0
        args.push('--ctx-checkpoints', String(ctxCheckpointsVal))

        console.log('[LocalLLMHostService] Iniciando llama-server:', runtimePath, args.join(' '))
        this.processo = spawn(runtimePath, args, {
            windowsHide: true,
            stdio: 'pipe'
        })

        this.processo.stdout.on('data', (chunk) => {
            console.log('[llama-server]', String(chunk).trim())
        })
        this.processo.stderr.on('data', (chunk) => {
            console.warn('[llama-server]', String(chunk).trim())
        })
        this.processo.once('exit', (code) => {
            console.warn('[LocalLLMHostService] llama-server encerrado:', code)
            this.processo = null
            this.servidorAtual = null
        })

        for (let tentativa = 0; tentativa < 60; tentativa++) {
            if (await this.healthCheck(baseUrl)) {
                this.servidorAtual = { modelId, baseUrl, port: porta }
                return this.servidorAtual
            }
            await aguardar(500)
        }

        await this.stop()
        throw new Error('Timeout ao iniciar llama-server.')
    }

    private obterNomeDispositivo(deviceConfig: string | undefined | null, runtimeType: 'cpu' | 'vulkan' | 'hip'): string {
        let index = 0
        if (deviceConfig) {
            const match = deviceConfig.match(/\d+/)
            if (match) {
                index = parseInt(match[0], 10)
            }
        }
        
        if (runtimeType === 'hip') {
            return `ROCm${index}`
        }
        return `Vulkan${index}`
    }

    private async healthCheck(baseUrl: string): Promise<boolean> {
        try {
            const resposta = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(1500) })
            return resposta.ok
        } catch {
            return false
        }
    }
}

export const localLLMHostService = new LocalLLMHostService()
