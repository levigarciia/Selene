import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { app } from 'electron'
import { baixarArquivo, type ProgressoDownload } from './download.js'

type AssetGithub = {
    name: string
    browser_download_url: string
    size?: number
}

type ReleaseGithub = {
    tag_name: string
    assets: AssetGithub[]
}

export class LlamaRuntimeManager {
    private diretorioRuntime: string | null = null
    private downloadAtivo: { cancelar: () => void } | null = null

    initialize(): void {
        this.diretorioRuntime = path.join(app.getPath('userData'), 'llama-runtime')
        fs.mkdirSync(this.diretorioRuntime, { recursive: true })
    }

    getRuntimeDir(): string {
        if (!this.diretorioRuntime) {
            this.initialize()
        }
        return this.diretorioRuntime!
    }

    getServerPath(runtimeType: 'cpu' | 'vulkan' | 'hip' = 'cpu'): string | null {
        const diretorio = path.join(this.getRuntimeDir(), runtimeType)
        if (fs.existsSync(diretorio)) {
            const candidatos = [
                path.join(diretorio, 'llama-server.exe'),
                path.join(diretorio, 'llama-server'),
                ...this.listarArquivosRecursivo(diretorio)
                    .filter((arquivo) => ['llama-server.exe', 'llama-server'].includes(path.basename(arquivo)))
            ]
            const caminhoEncontrado = candidatos.find((caminho) => fs.existsSync(caminho))
            if (caminhoEncontrado) return caminhoEncontrado
        }

        // Fallback para comportamento antigo (direto no diretório runtime) se o runtimeType for cpu
        if (runtimeType === 'cpu') {
            const diretorioRaiz = this.getRuntimeDir()
            const candidatosRaiz = [
                path.join(diretorioRaiz, 'llama-server.exe'),
                path.join(diretorioRaiz, 'llama-server'),
                ...this.listarArquivosRecursivo(diretorioRaiz)
                    .filter((arquivo) => {
                        const rel = path.relative(diretorioRaiz, arquivo)
                        if (rel.startsWith('vulkan') || rel.startsWith('cpu')) return false
                        return ['llama-server.exe', 'llama-server'].includes(path.basename(arquivo))
                    })
            ]
            const caminhoRaiz = candidatosRaiz.find((caminho) => fs.existsSync(caminho))
            if (caminhoRaiz) return caminhoRaiz
        }

        return null
    }

    checkAvailability(runtimeType: 'cpu' | 'vulkan' | 'hip' = 'cpu'): {
        runtimeAvailable: boolean
        runtimePath: string | null
        platformSupported: boolean
        runtimeDir: string
        downloading: boolean
    } {
        const platformSupported = process.platform === 'win32' && process.arch === 'x64'
        const runtimePath = this.getServerPath(runtimeType)
        return {
            runtimeAvailable: !!runtimePath,
            runtimePath,
            platformSupported,
            runtimeDir: this.getRuntimeDir(),
            downloading: !!this.downloadAtivo
        }
    }

    async downloadRuntime(
        runtimeType: 'cpu' | 'vulkan' | 'hip' = 'cpu',
        onProgress: ProgressoDownload = () => {}
    ): Promise<{ success: boolean; path: string }> {
        if (process.platform !== 'win32' || process.arch !== 'x64') {
            throw new Error('Runtime local de LLM ainda só está disponível para Windows x64.')
        }

        const existente = this.getServerPath(runtimeType)
        if (existente) {
            return { success: true, path: existente }
        }

        if (this.downloadAtivo) {
            throw new Error('Runtime llama.cpp já está em download')
        }

        const asset = await this.obterAssetWindows(runtimeType)
        const pastaDestino = path.join(this.getRuntimeDir(), runtimeType)
        fs.mkdirSync(pastaDestino, { recursive: true })
        const destinoZip = path.join(pastaDestino, asset.name)
        const temporario = `${destinoZip}.downloading`
        fs.rmSync(temporario, { force: true })

        const download = baixarArquivo(asset.browser_download_url, temporario, onProgress)
        this.downloadAtivo = { cancelar: download.cancelar }

        try {
            await download.promise
            fs.renameSync(temporario, destinoZip)
            await this.extrairZip(destinoZip, pastaDestino)
            fs.rmSync(destinoZip, { force: true })
            const serverPath = this.getServerPath(runtimeType)
            if (!serverPath) {
                throw new Error('Download concluído, mas llama-server não foi encontrado no pacote.')
            }
            return { success: true, path: serverPath }
        } finally {
            this.downloadAtivo = null
        }
    }

    cancelDownload(): boolean {
        if (!this.downloadAtivo) return false
        this.downloadAtivo.cancelar()
        this.downloadAtivo = null
        return true
    }

    private async obterAssetWindows(runtimeType: 'cpu' | 'vulkan' | 'hip'): Promise<AssetGithub> {
        const resposta = await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', {
            headers: {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Selene-Desktop-App'
            }
        })

        if (!resposta.ok) {
            throw new Error(`Falha ao consultar release do llama.cpp: ${resposta.status}`)
        }

        const release = await resposta.json() as ReleaseGithub
        const asset = release.assets.find((item) => {
            const nome = item.name.toLowerCase()
            const matchExt = nome.endsWith('.zip') && nome.includes('win') && nome.includes('x64')
            if (!matchExt) return false

            if (runtimeType === 'vulkan') {
                return nome.includes('vulkan')
            } else if (runtimeType === 'hip') {
                return nome.includes('hip')
            } else {
                return (nome.includes('cpu') || nome.includes('avx'))
                    && !nome.includes('cuda')
                    && !nome.includes('vulkan')
                    && !nome.includes('hip')
                    && !nome.includes('sycl')
            }
        })

        if (!asset) {
            throw new Error(`Nenhum asset Windows x64 ${runtimeType.toUpperCase()} do llama.cpp foi encontrado na release mais recente.`)
        }

        return asset
    }

    private extrairZip(zipPath: string, destino: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const comando = [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                `Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(destino)} -Force`
            ]

            const processo = spawn('powershell.exe', comando, { windowsHide: true })
            let stderr = ''
            processo.stderr.on('data', (chunk) => {
                stderr += String(chunk)
            })
            processo.on('error', reject)
            processo.on('close', (code) => {
                if (code === 0) {
                    resolve()
                    return
                }
                reject(new Error(stderr.trim() || `Expand-Archive saiu com código ${code}`))
            })
        })
    }

    private listarArquivosRecursivo(diretorio: string): string[] {
        if (!fs.existsSync(diretorio)) return []
        const arquivos: string[] = []
        for (const item of fs.readdirSync(diretorio, { withFileTypes: true })) {
            const caminho = path.join(diretorio, item.name)
            if (item.isDirectory()) {
                arquivos.push(...this.listarArquivosRecursivo(caminho))
                continue
            }
            arquivos.push(caminho)
        }
        return arquivos
    }
}

export const llamaRuntimeManager = new LlamaRuntimeManager()
