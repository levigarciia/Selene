/**
 * LocalWhisperModelManager
 * Component for managing local Whisper models (download, delete, status)
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Trash2, Check, AlertCircle, Loader2, HardDrive, Mic } from 'lucide-react'

interface WhisperModel {
    name: string
    displayName: string
    size: number
    description: string
    ramRequired: string
    downloaded: boolean
    downloading: boolean
    path: string
}

function obterMensagemErro(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return fallback
}

interface DownloadProgress {
    modelName: string
    downloaded: number
    total: number
    percent: number
}

export function LocalWhisperModelManager() {
    const [models, setModels] = useState<WhisperModel[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
    const [isAvailable, setIsAvailable] = useState(false)

    // Load models on mount
    useEffect(() => {
        loadModels()
        checkAvailability()
    }, [])

    // Setup download progress listener
    useEffect(() => {
        const api = window.electronAPI?.localWhisper
        if (!api) return

        const unsubProgress = api.onDownloadProgress((data) => {
            setDownloadProgress(data)
        })

        const unsubComplete = api.onDownloadComplete(() => {
            setDownloadProgress(null)
            loadModels() // Refresh list
        })

        const unsubError = api.onDownloadError((data) => {
            setDownloadProgress(null)
            setError(data.error)
            loadModels() // Refresh list
        })

        return () => {
            unsubProgress()
            unsubComplete()
            unsubError()
        }
    }, [])

    const loadModels = async () => {
        try {
            setIsLoading(true)
            const result = await window.electronAPI?.localWhisper?.listModels()
            if (result?.success && result.models) {
                setModels(result.models)
            } else {
                setError(result?.error || 'Failed to load models')
            }
        } catch (erro) {
            setError(obterMensagemErro(erro, 'Failed to load models'))
        } finally {
            setIsLoading(false)
        }
    }

    const checkAvailability = async () => {
        try {
            const result = await window.electronAPI?.localWhisper?.checkAvailability()
            setIsAvailable(result?.available || false)
        } catch (err) {
            console.error('Failed to check availability:', err)
        }
    }

    const downloadModel = async (modelName: string) => {
        try {
            setError(null)
            const result = await window.electronAPI?.localWhisper?.downloadModel(modelName)
            if (!result?.success) {
                setError(result?.error || 'Download failed')
            }
        } catch (erro) {
            setError(obterMensagemErro(erro, 'Download failed'))
        }
    }

    const cancelDownload = async (modelName: string) => {
        try {
            await window.electronAPI?.localWhisper?.cancelDownload(modelName)
            setDownloadProgress(null)
            loadModels()
        } catch (erro) {
            setError(obterMensagemErro(erro, 'Failed to cancel download'))
        }
    }

    const deleteModel = async (modelName: string) => {
        try {
            setError(null)
            const result = await window.electronAPI?.localWhisper?.deleteModel(modelName)
            if (result?.success) {
                loadModels()
            } else {
                setError(result?.error || 'Failed to delete model')
            }
        } catch (erro) {
            setError(obterMensagemErro(erro, 'Failed to delete model'))
        }
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="ml-2 text-neutral-400">Carregando modelos...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Modelos Whisper Local</h3>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                    isAvailable 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                    {isAvailable ? (
                        <>
                            <Check className="w-3 h-3" />
                            <span>Pronto</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-3 h-3" />
                            <span>Baixe um modelo</span>
                        </>
                    )}
                </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Models list */}
            <div className="space-y-2">
                {models.map((model) => {
                    const isDownloading = downloadProgress?.modelName === model.name
                    
                    return (
                        <div
                            key={model.name}
                            className={`p-4 rounded-xl border transition-colors ${
                                model.downloaded
                                    ? 'bg-purple-500/10 border-purple-500/30'
                                    : 'bg-neutral-800/50 border-white/10 hover:border-white/20'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-white">{model.displayName}</h4>
                                        {model.downloaded && (
                                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                                                Instalado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-neutral-400 mt-1">{model.description}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                                        <span className="flex items-center gap-1">
                                            <HardDrive className="w-3 h-3" />
                                            {formatBytes(model.size)}
                                        </span>
                                        <span>RAM: {model.ramRequired}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isDownloading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-neutral-700 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-purple-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${downloadProgress.percent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-neutral-400 w-10">
                                                {downloadProgress.percent}%
                                            </span>
                                            <button
                                                onClick={() => cancelDownload(model.name)}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : model.downloaded ? (
                                        <button
                                            onClick={() => deleteModel(model.name)}
                                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            title="Excluir modelo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => downloadModel(model.name)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span className="text-sm">Baixar</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Info text */}
            <p className="text-xs text-neutral-500">
                Modelos maiores são mais precisos, mas requerem mais RAM e são mais lentos.
                Recomendamos o modelo "Base" para uso geral.
            </p>
        </div>
    )
}

export default LocalWhisperModelManager
