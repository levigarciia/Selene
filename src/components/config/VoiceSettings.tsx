/**
 * VoiceSettings Component
 * 
 * Configuration panel for voice input settings,
 * supporting cloud and local Whisper transcription with streaming.
 */

import React, { useState, useEffect, useCallback } from 'react'
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
    microfoneId: string
    onMicrofoneChange: (microfoneId: string) => void
}

// Informacoes dos modelos com tamanhos e capacidades
const MODEL_INFO: Record<WhisperModelSize, { label: string; size: string; quality: string; speed: string }> = {
    // Quantized models (faster)
    'base-q5': {
        label: 'Base Q5 ⚡',
        size: '~57 MB',
        quality: 'Boa',
        speed: '2x Mais Rapido'
    },
    'small-q5': {
        label: 'Small Q5 ⚡',
        size: '~182 MB',
        quality: 'Muito Boa',
        speed: '2x Mais Rapido'
    },
    'medium-q5': {
        label: 'Medium Q5 ⚡',
        size: '~514 MB',
        quality: 'Excelente',
        speed: '2x Mais Rapido'
    },
    // Standard models
    base: {
        label: 'Base',
        size: '~145 MB',
        quality: 'Boa',
        speed: 'Rapido'
    },
    turbo: {
        label: 'Turbo',
        size: '~550 MB',
        quality: 'Muito Alta',
        speed: 'Rapido'
    },
    tiny: {
        label: 'Tiny',
        size: '~75 MB',
        quality: 'Basica',
        speed: 'Muito Rapido'
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

// Ordem de exibição: modelos quantizados primeiro (mais rápidos)
const ORDEM_MODELOS: WhisperModelSize[] = ['base-q5', 'base', 'turbo', 'small-q5', 'tiny', 'small', 'medium-q5', 'medium', 'large']
const MODELOS_RECOMENDADOS = new Set<WhisperModelSize>(['base-q5', 'base', 'turbo'])

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
    error,
    microfoneId,
    onMicrofoneChange
}) => {
    const [isInitializing, setIsInitializing] = useState(false)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])
    const [carregandoMicrofones, setCarregandoMicrofones] = useState(false)
    const [erroMicrofones, setErroMicrofones] = useState<string | null>(null)
    
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

    const carregarMicrofones = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return
        setCarregandoMicrofones(true)
        setErroMicrofones(null)
        try {
            const dispositivos = await navigator.mediaDevices.enumerateDevices()
            const entradasAudio = dispositivos.filter((dispositivo) => dispositivo.kind === 'audioinput')
            setMicrofones(entradasAudio)
        } catch (err) {
            console.error('[VoiceSettings] Falha ao listar microfones:', err)
            setErroMicrofones('Não foi possível listar os microfones disponíveis.')
        } finally {
            setCarregandoMicrofones(false)
        }
    }, [])

    useEffect(() => {
        carregarMicrofones()
        navigator.mediaDevices?.addEventListener?.('devicechange', carregarMicrofones)
        return () => {
            navigator.mediaDevices?.removeEventListener?.('devicechange', carregarMicrofones)
        }
    }, [carregarMicrofones])
    
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
    const modelosOrdenados = [...models].sort((a, b) => {
        const indiceA = ORDEM_MODELOS.indexOf(a.name as WhisperModelSize)
        const indiceB = ORDEM_MODELOS.indexOf(b.name as WhisperModelSize)
        const ordemA = indiceA === -1 ? Number.POSITIVE_INFINITY : indiceA
        const ordemB = indiceB === -1 ? Number.POSITIVE_INFINITY : indiceB
        return ordemA - ordemB
    })
    const modeloSelecionado = modelosOrdenados.find((model) => model.name === whisperModel)
    const modeloSelecionadoResolvido = modeloSelecionado || {
        name: whisperModel,
        displayName: currentModelInfo.label,
        size: 0,
        description: '',
        ramRequired: '',
        downloaded: false,
        downloading: false
    }
    const tamanhoModeloSelecionado = modeloSelecionadoResolvido.size > 0
        ? formatBytes(modeloSelecionadoResolvido.size)
        : currentModelInfo.size
    const downloadSelecionado = downloadProgress?.modelName === modeloSelecionadoResolvido.name
        ? downloadProgress
        : null
    const temMicrofones = microfones.length > 0
    
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-neutral-500">
                    Microfone
                </label>
                <div className="flex items-center gap-2">
                    <select
                        value={microfoneId}
                        onChange={(e) => onMicrofoneChange(e.target.value)}
                        disabled={isRecording || carregandoMicrofones}
                        className="flex-1 bg-neutral-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400 transition-colors disabled:opacity-60"
                    >
                        <option value="">Microfone padrão</option>
                        {microfones.map((microfone, index) => (
                            <option key={microfone.deviceId} value={microfone.deviceId}>
                                {microfone.label || `Microfone ${index + 1}`}
                            </option>
                        ))}
                        {!temMicrofones && (
                            <option value="" disabled>
                                Nenhum microfone encontrado
                            </option>
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            void carregarMicrofones()
                        }}
                        className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors"
                        disabled={carregandoMicrofones}
                    >
                        {carregandoMicrofones ? 'Atualizando...' : 'Atualizar'}
                    </button>
                </div>
                {erroMicrofones && (
                    <p className="text-xs text-amber-300">{erroMicrofones}</p>
                )}
            </div>
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
                        className={showModelDropdown ? 'overflow-visible' : 'overflow-hidden'}
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
                            {/* Seletor de modelo */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    className="w-full p-3 rounded-xl border border-white/10 bg-neutral-900/60 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                                            <Zap className="w-4 h-4 text-purple-300" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">
                                                    {modeloSelecionado?.displayName || currentModelInfo.label}
                                                </span>
                                                {MODELOS_RECOMENDADOS.has(whisperModel) && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[10px] uppercase tracking-wide">
                                                        Recomendado
                                                    </span>
                                                )}
                                                {modeloSelecionado && !modeloSelecionado.downloaded && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                                                        Nao baixado
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-neutral-500">
                                                {currentModelInfo.size} - Qualidade: {currentModelInfo.quality} - Velocidade: {currentModelInfo.speed}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showModelDropdown && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            className="mt-2 rounded-xl border border-white/10 bg-neutral-900 shadow-xl z-50 overflow-hidden"
                                        >
                                            <div className="max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                                                {modelosOrdenados.map((model) => {
                                                    const recomendado = MODELOS_RECOMENDADOS.has(model.name as WhisperModelSize)
                                                    const selecionado = model.name === whisperModel
                                                    const indisponivel = !!isRecording
                                                    return (
                                                        <button
                                                            key={`dropdown-${model.name}`}
                                                            onClick={() => {
                                                                if (isRecording) return
                                                                onModelChange(model.name as WhisperModelSize)
                                                                setShowModelDropdown(false)
                                                            }}
                                                            className={`w-full px-4 py-3 text-left transition-colors border-b border-white/5 last:border-b-0 ${
                                                                selecionado ? 'bg-purple-500/15' : 'hover:bg-white/5'
                                                            } ${indisponivel ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-white">{model.displayName}</span>
                                                                        {recomendado && (
                                                                            <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[10px] uppercase tracking-wide">
                                                                                Recomendado
                                                                            </span>
                                                                        )}
                                                                        {selecionado && (
                                                                            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                                                                                Atual
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-neutral-500 mt-0.5">
                                                                        {formatBytes(model.size)} - RAM: {model.ramRequired}
                                                                    </p>
                                                                </div>
                                                                {!model.downloaded && (
                                                                    <span className="text-[10px] text-amber-300">Nao baixado</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Modelo selecionado */}
                            {modeloSelecionadoResolvido && (
                                <div className="p-3 rounded-xl border border-white/10 bg-neutral-900/50">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">{modeloSelecionadoResolvido.displayName}</span>
                                                {MODELOS_RECOMENDADOS.has(modeloSelecionadoResolvido.name as WhisperModelSize) && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[10px] uppercase tracking-wide">
                                                        Recomendado
                                                    </span>
                                                )}
                                                {modeloSelecionadoResolvido.name === whisperModel && (
                                                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-semibold">
                                                        ATIVO
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-500 mt-0.5">
                                                {tamanhoModeloSelecionado} - RAM: {modeloSelecionadoResolvido.ramRequired || 'N/D'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {downloadSelecionado ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-purple-500"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${downloadSelecionado.percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-neutral-400 w-8">
                                                        {downloadSelecionado.percent}%
                                                    </span>
                                                </div>
                                            ) : modeloSelecionadoResolvido.downloaded ? (
                                                <button
                                                    onClick={() => deleteModel(modeloSelecionadoResolvido.name)}
                                                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                    title="Excluir modelo"
                                                    disabled={isRecording}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => downloadModel(modeloSelecionadoResolvido.name)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-xs"
                                                    disabled={isRecording}
                                                >
                                                    <Download className="w-3 h-3" />
                                                    Baixar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Nota informativa */}
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <div className="flex gap-2">
                                    <Radio size={14} className="text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-blue-200/80">
                                        <p className="font-medium mb-1">Transcrição Otimizada com Streaming</p>
                                        <ul className="list-disc list-inside space-y-0.5 text-blue-200/60">
                                            <li>Funciona 100% offline após download</li>
                                            <li>Transcrição em tempo real enquanto você fala</li>
                                            <li>Detecção automática de pausas (VAD)</li>
                                            <li>Modelos <strong>Q5 ⚡</strong> são 2x mais rápidos!</li>
                                            <li>Recomendado: <strong>Base Q5</strong> para velocidade máxima</li>
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
