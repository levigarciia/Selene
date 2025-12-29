/**
 * VoiceSettings Component
 * 
 * Configuration panel for voice input settings,
 * supporting cloud and local Whisper transcription with streaming.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MicOff, Cloud, HardDrive, Check, Loader2,
    ChevronDown, AlertCircle, Download, Zap,
    Mic, Trash2, Radio
} from 'lucide-react'
import type { WhisperModelSize } from '../../services/whisper'
import type { TranscriptionProvider } from '../../hooks/useVoiceInput'

interface WhisperModel {
    name: string
    displayName: string
    size: number
    description: string
    ramRequired: string
    downloaded: boolean
    downloading: boolean
}

interface DownloadProgress {
    modelName: string
    downloaded: number
    total: number
    percent: number
}

interface VoiceSettingsProps {
    provider: TranscriptionProvider
    onProviderChange: (provider: TranscriptionProvider) => void
    whisperModel: WhisperModelSize
    onModelChange: (model: WhisperModelSize) => void
    whisperBinaryPath: string
    onBinaryPathChange: (path: string) => void
    isWhisperReady: boolean
    onInitialize: () => Promise<void>
    isRecording?: boolean
    error?: string | null
}

// Model info with sizes and capabilities
const MODEL_INFO: Record<WhisperModelSize, { label: string; size: string; quality: string; speed: string }> = {
    tiny: {
        label: 'Tiny',
        size: '~75 MB',
        quality: 'Básica',
        speed: 'Muito Rápido'
    },
    base: {
        label: 'Base',
        size: '~145 MB',
        quality: 'Boa',
        speed: 'Rápido'
    },
    small: {
        label: 'Small',
        size: '~480 MB',
        quality: 'Muito Boa',
        speed: 'Moderado'
    },
    medium: {
        label: 'Medium',
        size: '~1.5 GB',
        quality: 'Excelente',
        speed: 'Lento'
    },
    large: {
        label: 'Large',
        size: '~3 GB',
        quality: 'Melhor',
        speed: 'Muito Lento'
    }
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
    provider,
    onProviderChange,
    whisperModel,
    onModelChange,
    whisperBinaryPath,
    onBinaryPathChange,
    isWhisperReady,
    onInitialize,
    isRecording,
    error
}) => {
    const [isInitializing, setIsInitializing] = useState(false)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    
    // Local Whisper Streaming state
    const [models, setModels] = useState<WhisperModel[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
    const [localAvailability, setLocalAvailability] = useState<{
        binaryAvailable: boolean
        hasModels: boolean
        available: boolean
    } | null>(null)
    
    // Load local whisper models and availability
    useEffect(() => {
        loadLocalWhisperStatus()
        
        // Setup event listeners for download progress
        const api = window.electronAPI?.localWhisper
        if (!api) return
        
        const unsubProgress = api.onDownloadProgress((data) => {
            setDownloadProgress(data)
        })
        
        const unsubComplete = api.onDownloadComplete(() => {
            setDownloadProgress(null)
            loadLocalWhisperStatus()
        })
        
        const unsubError = api.onDownloadError(() => {
            setDownloadProgress(null)
            loadLocalWhisperStatus()
        })
        
        return () => {
            unsubProgress()
            unsubComplete()
            unsubError()
        }
    }, [])
    
    const loadLocalWhisperStatus = async () => {
        try {
            setIsLoadingModels(true)
            
            // Check availability
            const availability = await window.electronAPI?.localWhisper?.checkAvailability()
            if (availability?.success) {
                setLocalAvailability({
                    binaryAvailable: availability.binaryAvailable || false,
                    hasModels: availability.hasModels || false,
                    available: availability.available || false
                })
            }
            
            // Load models
            const result = await window.electronAPI?.localWhisper?.listModels()
            if (result?.success && result.models) {
                setModels(result.models)
            }
        } catch (err) {
            console.error('[VoiceSettings] Failed to load local whisper status:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }
    
    const downloadModel = async (modelName: string) => {
        try {
            await window.electronAPI?.localWhisper?.downloadModel(modelName)
        } catch (err) {
            console.error('[VoiceSettings] Failed to download model:', err)
        }
    }
    
    const deleteModel = async (modelName: string) => {
        try {
            await window.electronAPI?.localWhisper?.deleteModel(modelName)
            loadLocalWhisperStatus()
        } catch (err) {
            console.error('[VoiceSettings] Failed to delete model:', err)
        }
    }
    
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
    
    const handleInitialize = async () => {
        setIsInitializing(true)
        try {
            await onInitialize()
        } finally {
            setIsInitializing(false)
        }
    }
    
    const currentModelInfo = MODEL_INFO[whisperModel]
    const isLocalStreamingAvailable = localAvailability?.available
    
    return (
        <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-neutral-500">
                    Provedor de Transcrição
                </label>
                <div className="grid grid-cols-1 gap-3">
                    {/* Cloud Option */}
                    <button
                        onClick={() => onProviderChange('cloud')}
                        disabled={isRecording}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                            provider === 'cloud'
                                ? 'bg-blue-500/15 border-blue-500/30'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                        } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            provider === 'cloud' ? 'bg-blue-500/20' : 'bg-white/10'
                        }`}>
                            <Cloud size={20} className={provider === 'cloud' ? 'text-blue-400' : 'text-neutral-400'} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-neutral-200">Nuvem via API</p>
                            <p className="text-xs text-neutral-500">OpenAI Whisper / Gemini / Groq</p>
                        </div>
                        {provider === 'cloud' && (
                            <Check size={16} className="text-blue-400" />
                        )}
                    </button>
                    
                    {/* Local Streaming Option */}
                    <button
                        onClick={() => onProviderChange('local')}
                        disabled={isRecording || !isLocalStreamingAvailable}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                            provider === 'local'
                                ? 'bg-green-500/15 border-green-500/30'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                        } ${(isRecording || !isLocalStreamingAvailable) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            provider === 'local' ? 'bg-green-500/20' : 'bg-white/10'
                        }`}>
                            <HardDrive size={20} className={provider === 'local' ? 'text-green-400' : 'text-neutral-400'} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-neutral-200">
                                Local
                                {!isLocalStreamingAvailable && (
                                    <span className="ml-2 text-xs text-amber-400">(baixe um modelo)</span>
                                )}
                            </p>
                            <p className="text-xs text-neutral-500">Whisper.cpp - 100% offline, tempo real</p>
                        </div>
                        {provider === 'local' && (
                            <Check size={16} className="text-green-400" />
                        )}
                    </button>
                </div>
            </div>
            
            {/* Local Whisper Models Section */}
            <AnimatePresence>
                {(provider === 'local' || !isLocalStreamingAvailable) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-3 pt-2">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4 text-purple-400" />
                                    <span className="text-xs font-semibold uppercase text-neutral-500">
                                        Modelos Whisper Local
                                    </span>
                                </div>
                                {isLoadingModels && (
                                    <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                                )}
                            </div>
                            
                            {/* Binary status */}
                            {localAvailability && !localAvailability.binaryAvailable && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <div className="flex gap-2">
                                        <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs text-amber-200/80">
                                            <p className="font-medium">Binário Whisper não encontrado</p>
                                            <p className="text-amber-200/60 mt-1">
                                                Compile o whisper.cpp ou copie whisper.exe para a pasta native/whisper/bin/
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Models list */}
                            <div className="space-y-2">
                                {models.slice(0, 4).map((model) => {
                                    const isDownloading = downloadProgress?.modelName === model.name
                                    const isSelected = whisperModel === model.name
                                    
                                    return (
                                        <div
                                            key={model.name}
                                            onClick={() => {
                                                if (model.downloaded && !isRecording) {
                                                    onModelChange(model.name as WhisperModelSize)
                                                }
                                            }}
                                            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                                                isSelected && model.downloaded
                                                    ? 'bg-purple-500/15 border-purple-500/40 ring-1 ring-purple-500/30'
                                                    : model.downloaded
                                                        ? 'bg-green-500/10 border-green-500/30 hover:border-purple-500/30'
                                                        : 'bg-neutral-800/50 border-white/10'
                                            } ${!model.downloaded ? 'cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-white">{model.displayName}</span>
                                                        {isSelected && model.downloaded && (
                                                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-semibold">
                                                                ATIVO
                                                            </span>
                                                        )}
                                                        {!isSelected && model.downloaded && (
                                                            <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                                                                Pronto
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-neutral-500 mt-0.5">
                                                        {formatBytes(model.size)} • RAM: {model.ramRequired}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isDownloading ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-purple-500"
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${downloadProgress.percent}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-neutral-400 w-8">
                                                                {downloadProgress.percent}%
                                                            </span>
                                                        </div>
                                                    ) : model.downloaded ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                deleteModel(model.name)
                                                            }}
                                                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                            title="Excluir modelo"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                downloadModel(model.name)
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-xs"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            Baixar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            
                            {/* Info Note */}
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <div className="flex gap-2">
                                    <Radio size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-blue-200/80">
                                        <p className="font-medium mb-1">Transcrição com Streaming</p>
                                        <ul className="list-disc list-inside space-y-0.5 text-blue-200/60">
                                            <li>Funciona 100% offline após download</li>
                                            <li>Transcrição em tempo real enquanto você fala</li>
                                            <li>Detecção automática de pausas (VAD)</li>
                                            <li>Recomendado: <strong>Base</strong> para uso diário</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Cloud Mode Info */}
            <AnimatePresence>
                {provider === 'cloud' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <div className="flex gap-2">
                                <Cloud size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-200/80">
                                    <p className="font-medium mb-1">Transcrição na Nuvem</p>
                                    <p className="text-blue-200/60">
                                        Usa a API do provedor ativo (OpenAI Whisper, Gemini, Groq).
                                        Requer chave de API configurada e conexão com internet.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex gap-2">
                        <MicOff size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">{error}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VoiceSettings
