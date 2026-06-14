import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { baixarArquivo, formatarBytes, type ProgressoDownload } from './download.js'

export type FamiliaModeloLocal = 'llama' | 'qwen' | 'gemma' | 'phi' | 'deepseek'

export interface ModeloLocalCatalogo {
    id: string
    familia: FamiliaModeloLocal
    nome: string
    descricao: string
    repoId: string
    arquivo: string
    url: string
    tamanhoEstimado: number
    ramRecomendada: string
    contexto: number
    capacidades: {
        reasoning?: boolean
        ferramentas?: boolean
        estruturado?: boolean
    }
}

export type ModeloLocalDisponivel = ModeloLocalCatalogo & {
    downloaded: boolean
    downloading: boolean
    path: string
    tamanhoFormatado: string
}

export const MODELOS_LOCAIS: Record<string, ModeloLocalCatalogo> = {
    // ── Llama (Meta) ──────────────────────────────────────────
    'llama-3.2-1b-instruct-q4': {
        id: 'llama-3.2-1b-instruct-q4',
        familia: 'llama',
        nome: 'Llama 3.2 1B Instruct',
        descricao: 'Modelo ultra-leve para chat rápido em hardware limitado.',
        repoId: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
        arquivo: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        tamanhoEstimado: 810000000,
        ramRecomendada: '2 GB',
        contexto: 131072,
        capacidades: {
            ferramentas: true,
        }
    },
    'llama-3.2-3b-instruct-q4': {
        id: 'llama-3.2-3b-instruct-q4',
        familia: 'llama',
        nome: 'Llama 3.2 3B Instruct',
        descricao: 'Modelo compacto para chat rápido e tarefas gerais.',
        repoId: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
        arquivo: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        tamanhoEstimado: 2020000000,
        ramRecomendada: '4 GB',
        contexto: 131072,
        capacidades: {
            ferramentas: true,
            estruturado: true
        }
    },
    'llama-3.1-8b-instruct-q4': {
        id: 'llama-3.1-8b-instruct-q4',
        familia: 'llama',
        nome: 'Llama 3.1 8B Instruct',
        descricao: 'Modelo equilibrado para instrução e raciocínio.',
        repoId: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
        arquivo: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        tamanhoEstimado: 4900000000,
        ramRecomendada: '10 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },

    // ── Qwen (Alibaba) ───────────────────────────────────────
    'qwen3.5-2b-q4': {
        id: 'qwen3.5-2b-q4',
        familia: 'qwen',
        nome: 'Qwen3.5 2B',
        descricao: 'Modelo ultra-leve com reasoning para hardware limitado.',
        repoId: 'unsloth/Qwen3.5-2B-GGUF',
        arquivo: 'Qwen3.5-2B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
        tamanhoEstimado: 1500000000,
        ramRecomendada: '3 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
        }
    },
    'qwen3.5-4b-q4': {
        id: 'qwen3.5-4b-q4',
        familia: 'qwen',
        nome: 'Qwen3.5 4B',
        descricao: 'Bom equilíbrio para português, código e raciocínio leve.',
        repoId: 'unsloth/Qwen3.5-4B-GGUF',
        arquivo: 'Qwen3.5-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf',
        tamanhoEstimado: 2700000000,
        ramRecomendada: '5 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },
    'qwen3.5-9b-q4': {
        id: 'qwen3.5-9b-q4',
        familia: 'qwen',
        nome: 'Qwen3.5 9B',
        descricao: 'Mais qualidade para raciocínio, escrita e programação.',
        repoId: 'unsloth/Qwen3.5-9B-GGUF',
        arquivo: 'Qwen3.5-9B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf',
        tamanhoEstimado: 5600000000,
        ramRecomendada: '8 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },
    'qwen3-14b-q4': {
        id: 'qwen3-14b-q4',
        familia: 'qwen',
        nome: 'Qwen3 14B',
        descricao: 'Alta qualidade para tarefas complexas. Requer mais RAM.',
        repoId: 'unsloth/Qwen3-14B-GGUF',
        arquivo: 'Qwen3-14B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf',
        tamanhoEstimado: 8400000000,
        ramRecomendada: '12 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },

    // ── Gemma (Google) ────────────────────────────────────────
    'gemma-3-1b-it-q4': {
        id: 'gemma-3-1b-it-q4',
        familia: 'gemma',
        nome: 'Gemma 3 1B IT',
        descricao: 'Modelo ultra-compacto do Google para respostas rápidas.',
        repoId: 'bartowski/gemma-3-1b-it-GGUF',
        arquivo: 'gemma-3-1b-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
        tamanhoEstimado: 810000000,
        ramRecomendada: '2 GB',
        contexto: 32768,
        capacidades: {}
    },
    'gemma-3-4b-it-q4': {
        id: 'gemma-3-4b-it-q4',
        familia: 'gemma',
        nome: 'Gemma 3 4B IT',
        descricao: 'Modelo leve para respostas objetivas e tarefas de texto.',
        repoId: 'bartowski/gemma-3-4b-it-GGUF',
        arquivo: 'gemma-3-4b-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf',
        tamanhoEstimado: 2490000000,
        ramRecomendada: '5 GB',
        contexto: 32768,
        capacidades: {
            estruturado: true
        }
    },
    'gemma-3-12b-it-q4': {
        id: 'gemma-3-12b-it-q4',
        familia: 'gemma',
        nome: 'Gemma 3 12B IT',
        descricao: 'Modelo Google robusto para raciocínio e instrução.',
        repoId: 'bartowski/gemma-3-12b-it-GGUF',
        arquivo: 'gemma-3-12b-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/gemma-3-12b-it-GGUF/resolve/main/gemma-3-12b-it-Q4_K_M.gguf',
        tamanhoEstimado: 7300000000,
        ramRecomendada: '10 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },

    // ── Phi (Microsoft) ───────────────────────────────────────
    'phi-4-mini-q4': {
        id: 'phi-4-mini-q4',
        familia: 'phi',
        nome: 'Phi-4 Mini',
        descricao: 'Modelo Microsoft compacto com tool calling nativo e 128K de contexto.',
        repoId: 'bartowski/phi-4-mini-instruct-GGUF',
        arquivo: 'phi-4-mini-instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/phi-4-mini-instruct-GGUF/resolve/main/phi-4-mini-instruct-Q4_K_M.gguf',
        tamanhoEstimado: 2500000000,
        ramRecomendada: '4 GB',
        contexto: 131072,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },
    'phi-4-reasoning-q4': {
        id: 'phi-4-reasoning-q4',
        familia: 'phi',
        nome: 'Phi-4 Reasoning',
        descricao: 'Raciocínio avançado com Chain-of-Thought nativo.',
        repoId: 'bartowski/Phi-4-reasoning-GGUF',
        arquivo: 'Phi-4-reasoning-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Phi-4-reasoning-GGUF/resolve/main/Phi-4-reasoning-Q4_K_M.gguf',
        tamanhoEstimado: 9000000000,
        ramRecomendada: '12 GB',
        contexto: 32768,
        capacidades: {
            reasoning: true,
            ferramentas: true,
            estruturado: true
        }
    },

    // ── DeepSeek ──────────────────────────────────────────────
    'deepseek-r1-1.5b-q4': {
        id: 'deepseek-r1-1.5b-q4',
        familia: 'deepseek',
        nome: 'DeepSeek R1 1.5B',
        descricao: 'Modelo de raciocínio ultra-leve baseado no Qwen.',
        repoId: 'unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
        arquivo: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
        tamanhoEstimado: 1100000000,
        ramRecomendada: '3 GB',
        contexto: 131072,
        capacidades: {
            reasoning: true,
        }
    },
    'deepseek-r1-7b-q4': {
        id: 'deepseek-r1-7b-q4',
        familia: 'deepseek',
        nome: 'DeepSeek R1 7B',
        descricao: 'Modelo de raciocínio destilado do Qwen 7B.',
        repoId: 'bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF',
        arquivo: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
        tamanhoEstimado: 4680000000,
        ramRecomendada: '6 GB',
        contexto: 131072,
        capacidades: {
            reasoning: true,
        }
    },
    'deepseek-r1-14b-q4': {
        id: 'deepseek-r1-14b-q4',
        familia: 'deepseek',
        nome: 'DeepSeek R1 14B',
        descricao: 'Raciocínio avançado destilado do Qwen 14B.',
        repoId: 'bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF',
        arquivo: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
        tamanhoEstimado: 9000000000,
        ramRecomendada: '12 GB',
        contexto: 131072,
        capacidades: {
            reasoning: true,
        }
    },
}

export type ModeloLocalId = keyof typeof MODELOS_LOCAIS

export class LlamaModelManager {
    private diretorioModelos: string | null = null
    private downloadsAtivos = new Map<string, { cancelar: () => void }>()

    initialize(): void {
        this.diretorioModelos = path.join(app.getPath('userData'), 'llama-models')
        fs.mkdirSync(this.diretorioModelos, { recursive: true })
    }

    getModelsDir(): string {
        if (!this.diretorioModelos) {
            this.initialize()
        }
        return this.diretorioModelos!
    }

    getModelPath(modelId: string): string {
        const modelo = this.obterModelo(modelId)
        return path.join(this.getModelsDir(), modelo.arquivo)
    }

    obterModelo(modelId: string): ModeloLocalCatalogo {
        const modelo = MODELOS_LOCAIS[modelId]
        if (!modelo) {
            throw new Error(`Modelo local desconhecido: ${modelId}`)
        }
        return modelo
    }

    isModelDownloaded(modelId: string): boolean {
        const modelo = this.obterModelo(modelId)
        const caminho = this.getModelPath(modelId)
        if (!fs.existsSync(caminho)) return false
        const stats = fs.statSync(caminho)
        return stats.size > Math.max(1024 * 1024, modelo.tamanhoEstimado * 0.6)
    }

    getAvailableModels(): ModeloLocalDisponivel[] {
        return Object.values(MODELOS_LOCAIS).map((modelo) => ({
            ...modelo,
            downloaded: this.isModelDownloaded(modelo.id),
            downloading: this.downloadsAtivos.has(modelo.id),
            path: this.getModelPath(modelo.id),
            tamanhoFormatado: formatarBytes(modelo.tamanhoEstimado)
        }))
    }

    listDownloadedModels(): ModeloLocalDisponivel[] {
        return this.getAvailableModels().filter((modelo) => modelo.downloaded)
    }

    async downloadModel(
        modelId: string,
        onProgress: ProgressoDownload = () => {}
    ): Promise<{ success: boolean; modelId: string; path: string }> {
        const modelo = this.obterModelo(modelId)
        if (this.downloadsAtivos.has(modelId)) {
            throw new Error(`Modelo ${modelId} já está em download`)
        }

        const destino = this.getModelPath(modelId)
        const temporario = `${destino}.downloading`
        fs.rmSync(temporario, { force: true })

        const download = baixarArquivo(modelo.url, temporario, onProgress)
        this.downloadsAtivos.set(modelId, { cancelar: download.cancelar })

        try {
            await download.promise
            fs.renameSync(temporario, destino)
            return { success: true, modelId, path: destino }
        } finally {
            this.downloadsAtivos.delete(modelId)
        }
    }

    cancelDownload(modelId: string): boolean {
        const ativo = this.downloadsAtivos.get(modelId)
        if (!ativo) return false
        ativo.cancelar()
        this.downloadsAtivos.delete(modelId)
        return true
    }

    deleteModel(modelId: string): boolean {
        const caminho = this.getModelPath(modelId)
        fs.rmSync(caminho, { force: true })
        fs.rmSync(`${caminho}.downloading`, { force: true })
        return true
    }
}

export const llamaModelManager = new LlamaModelManager()
