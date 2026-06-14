import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { ParakeetSidecarManager } from './ParakeetSidecarManager.js'

export const PARAKEET_MODELS = {
    'tdt-0.6b-v3-multilingual': {
        name: 'tdt-0.6b-v3-multilingual',
        displayName: 'Parakeet TDT 0.6B v3 Multilingual INT8',
        repoId: 's0me-0ne/parakeet-tdt-0.6b-v3-onnx',
        arquitetura: 'nemo-conformer-tdt',
        arquivosObrigatorios: [
            'config.json',
            'decoder_joint-model.int8.onnx',
            'encoder-model.int8.onnx',
            'nemo128.onnx',
            'vocab.txt'
        ],
        size: 950000000,
        description: 'Modelo Parakeet TDT v3 multilingual com auto detecção e melhor preservação de termos em inglês.',
        ramRequired: '~2 GB',
        experimental: true,
        recommendedForPtBr: true,
        idiomaPadrao: 'multi'
    }
} as const

export type ParakeetModelName = keyof typeof PARAKEET_MODELS
type NomeModeloParakeetLegado = ParakeetModelName | 'tdt-0.6b-v3' | 'ctc-0.6b' | 'tdt-0.6b-v3-ptbr'

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

export function normalizarModeloParakeet(modelName?: string): ParakeetModelName {
    if (!modelName) {
        return 'tdt-0.6b-v3-multilingual'
    }

    const aliases: Record<string, ParakeetModelName> = {
        'tdt-0.6b-v3-multilingual': 'tdt-0.6b-v3-multilingual',
        'tdt-0.6b-v3-ptbr': 'tdt-0.6b-v3-multilingual',
        'tdt-0.6b-v3': 'tdt-0.6b-v3-multilingual',
        'ctc-0.6b': 'tdt-0.6b-v3-multilingual'
    }

    const normalizado = aliases[modelName]
    if (normalizado) {
        return normalizado
    }

    throw new Error(`Modelo Parakeet desconhecido: ${modelName}`)
}

function modeloTemArquivosObrigatorios(modelName: ParakeetModelName, diretorio: string): boolean {
    if (!fs.existsSync(diretorio)) {
        return false
    }

    return PARAKEET_MODELS[modelName].arquivosObrigatorios.every((arquivo) =>
        fs.existsSync(path.join(diretorio, arquivo))
    )
}

export class ParakeetModelManager {
    private diretorioRaiz: string | null = null
    private diretorioCache: string | null = null
    private diretorioModelos: string | null = null
    private downloadsAtivos = new Set<ParakeetModelName>()
    private sidecar: ParakeetSidecarManager | null = null

    initialize(): void {
        const userDataPath = app.getPath('userData')
        this.diretorioRaiz = path.join(userDataPath, 'parakeet-models')
        this.diretorioCache = path.join(this.diretorioRaiz, 'hf-home')
        this.diretorioModelos = path.join(this.diretorioRaiz, 'models')

        fs.mkdirSync(this.diretorioCache, { recursive: true })
        fs.mkdirSync(this.diretorioModelos, { recursive: true })
    }

    getRootDir(): string {
        if (!this.diretorioRaiz) {
            this.initialize()
        }
        return this.diretorioRaiz!
    }

    getCacheDir(): string {
        if (!this.diretorioCache) {
            this.initialize()
        }
        return this.diretorioCache!
    }

    getModelsDir(): string {
        if (!this.diretorioModelos) {
            this.initialize()
        }
        return this.diretorioModelos!
    }

    getModelDir(modelName: NomeModeloParakeetLegado): string {
        return path.join(this.getModelsDir(), normalizarModeloParakeet(modelName))
    }

    async getSidecar(): Promise<ParakeetSidecarManager> {
        if (!this.sidecar) {
            this.sidecar = new ParakeetSidecarManager(this.getRootDir())
        }
        return this.sidecar
    }

    async encerrar(): Promise<void> {
        if (!this.sidecar) {
            return
        }
        await this.sidecar.encerrar()
        this.sidecar = null
    }

    async isModelDownloaded(modelName: NomeModeloParakeetLegado): Promise<boolean> {
        const nomeNormalizado = normalizarModeloParakeet(modelName)
        return modeloTemArquivosObrigatorios(nomeNormalizado, this.getModelDir(nomeNormalizado))
    }

    async getModelStatus(modelName: NomeModeloParakeetLegado) {
        const nomeNormalizado = normalizarModeloParakeet(modelName)
        const model = PARAKEET_MODELS[nomeNormalizado]
        const downloaded = await this.isModelDownloaded(nomeNormalizado)
        return {
            ...model,
            downloaded,
            downloading: this.downloadsAtivos.has(nomeNormalizado),
            path: this.getModelDir(nomeNormalizado)
        }
    }

    async getAvailableModels() {
        const modelos = await Promise.all(
            (Object.keys(PARAKEET_MODELS) as ParakeetModelName[]).map(async (modelName) => {
                const status = await this.getModelStatus(modelName)
                return status
            })
        )
        return modelos
    }

    async listDownloadedModels(): Promise<ParakeetModelName[]> {
        const modelos = Object.keys(PARAKEET_MODELS) as ParakeetModelName[]
        const resultados = await Promise.all(modelos.map((modelo) => this.isModelDownloaded(modelo)))
        return modelos.filter((_, indice) => resultados[indice])
    }

    async downloadModel(
        modelName: NomeModeloParakeetLegado,
        onProgress: (downloaded: number, total: number, percent: number) => void = () => {}
    ): Promise<{ success: boolean; modelName: string; path: string }> {
        const nomeNormalizado = normalizarModeloParakeet(modelName)
        if (this.downloadsAtivos.has(nomeNormalizado)) {
            throw new Error(`Modelo ${nomeNormalizado} já está em download`)
        }

        const sidecar = await this.getSidecar()
        this.downloadsAtivos.add(nomeNormalizado)

        const removerOuvinte = sidecar.onEvento((evento) => {
            if (evento.tipo !== 'download-progress') {
                return
            }
            if (evento.dados.modelName !== nomeNormalizado) {
                return
            }
            onProgress(
                Number(evento.dados.downloaded || 0),
                Number(evento.dados.total || 0),
                Number(evento.dados.percent || 0)
            )
        })

        try {
            await sidecar.prepararModelo(nomeNormalizado)
            return {
                success: true,
                modelName: nomeNormalizado,
                path: this.getModelDir(nomeNormalizado)
            }
        } catch (erro) {
            throw new Error(obterMensagemErro(erro))
        } finally {
            removerOuvinte()
            this.downloadsAtivos.delete(nomeNormalizado)
        }
    }

    cancelDownload(modelName: NomeModeloParakeetLegado): boolean {
        void modelName
        return false
    }

    async deleteModel(modelName: NomeModeloParakeetLegado): Promise<boolean> {
        const diretorioModelo = this.getModelDir(modelName)
        if (!fs.existsSync(diretorioModelo)) {
            return true
        }
        fs.rmSync(diretorioModelo, { recursive: true, force: true })
        return true
    }

    async checkAvailability(): Promise<{
        runtimeAvailable: boolean
        cacheDir: string
        hasModels: boolean
        downloadedModels: ParakeetModelName[]
        available: boolean
        pythonPath: string | null
    }> {
        const sidecar = await this.getSidecar()
        const runtime = await sidecar.verificarRuntimeDisponivel()
        const downloadedModels = await this.listDownloadedModels()
        return {
            runtimeAvailable: runtime.ok,
            cacheDir: this.getCacheDir(),
            hasModels: downloadedModels.length > 0,
            downloadedModels,
            available: runtime.ok && downloadedModels.length > 0,
            pythonPath: runtime.pythonPath
        }
    }
}

export const parakeetModelManager = new ParakeetModelManager()
