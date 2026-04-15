/**
 * VoiceSettings — configuração de transcrição por voz.
 * Suporta nuvem (cloud) e Whisper local com streaming.
 * Paleta alinhada à filosofia Selene: tons escuros, sem saturação alta.
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

// Informações dos modelos
const MODEL_INFO: Record<WhisperModelSize, { label: string; size: string; quality: string; speed: string }> = {
    'base-q5': { label: 'Base Q5 ⚡', size: '~57 MB', quality: 'Boa', speed: '2x Mais Rápido' },
    'small-q5': { label: 'Small Q5 ⚡', size: '~182 MB', quality: 'Muito Boa', speed: '2x Mais Rápido' },
    'medium-q5': { label: 'Medium Q5 ⚡', size: '~514 MB', quality: 'Excelente', speed: '2x Mais Rápido' },
    base: { label: 'Base', size: '~145 MB', quality: 'Boa', speed: 'Rápido' },
    turbo: { label: 'Turbo', size: '~550 MB', quality: 'Muito Alta', speed: 'Rápido' },
    tiny: { label: 'Tiny', size: '~75 MB', quality: 'Básica', speed: 'Muito Rápido' },
    small: { label: 'Small', size: '~480 MB', quality: 'Muito Boa', speed: 'Moderado' },
    medium: { label: 'Medium', size: '~1.5 GB', quality: 'Excelente', speed: 'Lento' },
    large: { label: 'Large', size: '~3 GB', quality: 'Melhor', speed: 'Muito Lento' },
}

const ORDEM_MODELOS: WhisperModelSize[] = ['base-q5', 'base', 'turbo', 'small-q5', 'tiny', 'small', 'medium-q5', 'medium', 'large']
const MODELOS_RECOMENDADOS = new Set<WhisperModelSize>(['base-q5', 'base', 'turbo'])

// Classes alinhadas à paleta Selene
const classeOpcaoAtiva = 'border-white/[0.1] bg-white/[0.08]'
const classeOpcaoInativa = 'border-white/[0.05] bg-white/[0.025] hover:border-white/[0.07] hover:bg-white/[0.04]'

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
    provider, onProviderChange, whisperModel, onModelChange,
    isRecording, error, microfoneId, onMicrofoneChange,
}) => {
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])
    const [carregandoMicrofones, setCarregandoMicrofones] = useState(false)
    const [erroMicrofones, setErroMicrofones] = useState<string | null>(null)
    const [models, setModels] = useState<WhisperModel[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
    const [localAvailability, setLocalAvailability] = useState<{
        binaryAvailable: boolean; hasModels: boolean; available: boolean
    } | null>(null)

    useEffect(() => {
        loadLocalWhisperStatus()
        const api = window.electronAPI?.localWhisper
        if (!api) return
        const unsubProgress = api.onDownloadProgress((data) => setDownloadProgress(data))
        const unsubComplete = api.onDownloadComplete(() => { setDownloadProgress(null); loadLocalWhisperStatus() })
        const unsubError = api.onDownloadError(() => { setDownloadProgress(null); loadLocalWhisperStatus() })
        return () => { unsubProgress(); unsubComplete(); unsubError() }
    }, [])

    const carregarMicrofones = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return
        setCarregandoMicrofones(true)
        setErroMicrofones(null)
        try {
            const dispositivos = await navigator.mediaDevices.enumerateDevices()
            setMicrofones(dispositivos.filter((d) => d.kind === 'audioinput'))
        } catch {
            setErroMicrofones('Não foi possível listar os microfones.')
        } finally {
            setCarregandoMicrofones(false)
        }
    }, [])

    useEffect(() => {
        carregarMicrofones()
        navigator.mediaDevices?.addEventListener?.('devicechange', carregarMicrofones)
        return () => navigator.mediaDevices?.removeEventListener?.('devicechange', carregarMicrofones)
    }, [carregarMicrofones])

    const loadLocalWhisperStatus = async () => {
        try {
            setIsLoadingModels(true)
            const availability = await window.electronAPI?.localWhisper?.checkAvailability()
            if (availability?.success) {
                setLocalAvailability({
                    binaryAvailable: availability.binaryAvailable || false,
                    hasModels: availability.hasModels || false,
                    available: availability.available || false,
                })
            }
            const result = await window.electronAPI?.localWhisper?.listModels()
            if (result?.success && result.models) setModels(result.models)
        } catch (err) {
            console.error('[VoiceSettings] Falha ao carregar status:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    const downloadModel = async (name: string) => {
        try { await window.electronAPI?.localWhisper?.downloadModel(name) } catch (err) {
            console.error('[VoiceSettings] Falha ao baixar modelo:', err)
        }
    }

    const deleteModel = async (name: string) => {
        try { await window.electronAPI?.localWhisper?.deleteModel(name); loadLocalWhisperStatus() } catch (err) {
            console.error('[VoiceSettings] Falha ao excluir modelo:', err)
        }
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    const currentModelInfo = MODEL_INFO[whisperModel]
    const isLocalAvailable = localAvailability?.available
    const modelosOrdenados = [...models].sort((a, b) => {
        const iA = ORDEM_MODELOS.indexOf(a.name as WhisperModelSize)
        const iB = ORDEM_MODELOS.indexOf(b.name as WhisperModelSize)
        return (iA === -1 ? Infinity : iA) - (iB === -1 ? Infinity : iB)
    })
    const modeloSelecionado = modelosOrdenados.find((m) => m.name === whisperModel)
    const modeloResolvido = modeloSelecionado || {
        name: whisperModel, displayName: currentModelInfo.label,
        size: 0, description: '', ramRequired: '', downloaded: false, downloading: false,
    }
    const tamanhoModelo = modeloResolvido.size > 0 ? formatBytes(modeloResolvido.size) : currentModelInfo.size
    const downloadAtivo = downloadProgress?.modelName === modeloResolvido.name ? downloadProgress : null

    return (
        <div className="space-y-4">
            {/* Microfone */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Microfone</label>
                <div className="flex items-center gap-2">
                    <select
                        value={microfoneId}
                        onChange={(e) => onMicrofoneChange(e.target.value)}
                        disabled={isRecording || carregandoMicrofones}
                        className="flex-1 rounded-2xl border border-white/[0.07] bg-[#11141a] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/[0.14] disabled:opacity-60"
                    >
                        <option value="">Microfone padrão</option>
                        {microfones.map((m, i) => (
                            <option key={m.deviceId} value={m.deviceId}>{m.label || `Microfone ${i + 1}`}</option>
                        ))}
                        {microfones.length === 0 && <option value="" disabled>Nenhum microfone encontrado</option>}
                    </select>
                    <button type="button" onClick={() => void carregarMicrofones()} disabled={carregandoMicrofones}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-[#dfe4ec] transition-colors hover:bg-white/[0.06]">
                        {carregandoMicrofones ? 'Atualizando...' : 'Atualizar'}
                    </button>
                </div>
                {erroMicrofones && <p className="text-xs text-[#d4a574]">{erroMicrofones}</p>}
            </div>

            {/* Provedor de transcrição */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Provedor de Transcrição</label>
                <div className="grid grid-cols-1 gap-3">
                    {/* Nuvem */}
                    <button
                        onClick={() => onProviderChange('cloud')}
                        disabled={isRecording}
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                            provider === 'cloud' ? classeOpcaoAtiva : classeOpcaoInativa
                        } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                            provider === 'cloud' ? 'border-white/[0.1] bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.03]'
                        }`}>
                            <Cloud size={20} className={provider === 'cloud' ? 'text-white' : 'text-[#aeb6c3]'} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-[#f3f5f9]">Nuvem por blocos</p>
                            <p className="text-xs text-[#7f8794]">Chunks via API: OpenAI Whisper / Gemini / Groq</p>
                        </div>
                        {provider === 'cloud' && <Check size={16} className="text-white" />}
                    </button>

                    {/* Local */}
                    <button
                        onClick={() => onProviderChange('local')}
                        disabled={isRecording || !isLocalAvailable}
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                            provider === 'local' ? classeOpcaoAtiva : classeOpcaoInativa
                        } ${(isRecording || !isLocalAvailable) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                            provider === 'local' ? 'border-white/[0.1] bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.03]'
                        }`}>
                            <HardDrive size={20} className={provider === 'local' ? 'text-white' : 'text-[#aeb6c3]'} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-[#f3f5f9]">
                                Local em tempo real
                                {!isLocalAvailable && <span className="ml-2 text-xs text-[#d4a574]">(baixe um modelo)</span>}
                            </p>
                            <p className="text-xs text-[#7f8794]">Whisper.cpp — 100% offline, tempo real</p>
                        </div>
                        {provider === 'local' && <Check size={16} className="text-white" />}
                    </button>
                </div>
            </div>

            {/* Modelos Whisper local */}
            <AnimatePresence>
                {(provider === 'local' || !isLocalAvailable) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={showModelDropdown ? 'overflow-visible' : 'overflow-hidden'}
                    >
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-[#aeb6c3]" />
                                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Modelos Whisper Local</span>
                                </div>
                                {isLoadingModels && <Loader2 className="h-4 w-4 animate-spin text-[#7f8794]" />}
                            </div>

                            {/* Aviso: binário ausente */}
                            {localAvailability && !localAvailability.binaryAvailable && (
                                <div className="rounded-2xl border border-[#3d3422] bg-[#1a1710] p-3">
                                    <div className="flex gap-2">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#d4a574]" />
                                        <div className="text-xs text-[#c4a678]">
                                            <p className="font-medium">Binário Whisper não encontrado</p>
                                            <p className="mt-1 text-[#a89060]">Compile o whisper.cpp ou copie whisper.exe para native/whisper/bin/</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Seletor de modelo */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#11141a] p-3 transition-colors hover:bg-white/[0.03]"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04]">
                                            <Zap className="h-4 w-4 text-[#dfe4ed]" />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">
                                                    {modeloSelecionado?.displayName || currentModelInfo.label}
                                                </span>
                                                {MODELOS_RECOMENDADOS.has(whisperModel) && (
                                                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>
                                                )}
                                                {modeloSelecionado && !modeloSelecionado.downloaded && (
                                                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#d4a574]">Não baixado</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-[#7f8794]">
                                                {currentModelInfo.size} · {currentModelInfo.quality} · {currentModelInfo.speed}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronDown className={`h-4 w-4 text-[#aeb6c3] transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showModelDropdown && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            className="mt-2 z-50 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0f1116] shadow-xl"
                                        >
                                            <div className="max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                                                {modelosOrdenados.map((model) => {
                                                    const recomendado = MODELOS_RECOMENDADOS.has(model.name as WhisperModelSize)
                                                    const selecionado = model.name === whisperModel
                                                    return (
                                                        <button
                                                            key={model.name}
                                                            onClick={() => { if (!isRecording) { onModelChange(model.name as WhisperModelSize); setShowModelDropdown(false) } }}
                                                            className={`w-full border-b border-white/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 ${
                                                                selecionado ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                                                            } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-white">{model.displayName}</span>
                                                                        {recomendado && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>}
                                                                        {selecionado && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Atual</span>}
                                                                    </div>
                                                                    <p className="mt-0.5 text-[11px] text-[#7f8794]">{formatBytes(model.size)} · RAM: {model.ramRequired}</p>
                                                                </div>
                                                                {!model.downloaded && <span className="text-[10px] text-[#d4a574]">Não baixado</span>}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Modelo selecionado: ações */}
                            {modeloResolvido && (
                                <div className="rounded-2xl border border-white/[0.07] bg-[#11141a] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">{modeloResolvido.displayName}</span>
                                                {MODELOS_RECOMENDADOS.has(modeloResolvido.name as WhisperModelSize) && (
                                                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-[#7f8794]">{tamanhoModelo} · RAM: {modeloResolvido.ramRequired || 'N/D'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {downloadAtivo ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                                                        <motion.div className="h-full bg-white/[0.3]" initial={{ width: 0 }} animate={{ width: `${downloadAtivo.percent}%` }} />
                                                    </div>
                                                    <span className="w-8 text-[10px] text-[#aeb6c3]">{downloadAtivo.percent}%</span>
                                                </div>
                                            ) : modeloResolvido.downloaded ? (
                                                <button onClick={() => deleteModel(modeloResolvido.name)} disabled={isRecording} title="Excluir modelo"
                                                    className="rounded-xl border border-[#4d2834] bg-[#24161c] p-1.5 text-[#efb5c2] transition-colors hover:bg-[#311c24]">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            ) : (
                                                <button onClick={() => downloadModel(modeloResolvido.name)} disabled={isRecording}
                                                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#dfe4ec] transition-colors hover:bg-white/[0.06]">
                                                    <Download className="h-3 w-3" /> Baixar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Nota informativa */}
                            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                                <div className="flex gap-2">
                                    <Radio size={14} className="mt-0.5 shrink-0 text-[#aeb6c3]" />
                                    <div className="text-xs text-[#98a3b4]">
                                        <p className="mb-1 font-medium text-[#dfe4ed]">Transcrição com Streaming</p>
                                        <ul className="list-inside list-disc space-y-0.5 text-[#7f8794]">
                                            <li>100% offline após download</li>
                                            <li>Tempo real enquanto você fala</li>
                                            <li>Detecção automática de pausas (VAD)</li>
                                            <li>Modelos <strong className="text-[#dfe4ed]">Q5 ⚡</strong> são 2x mais rápidos</li>
                                            <li>Recomendado: <strong className="text-[#dfe4ed]">Base Q5</strong></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info nuvem */}
            <AnimatePresence>
                {provider === 'cloud' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                            <div className="flex gap-2">
                                <Cloud size={14} className="mt-0.5 shrink-0 text-[#aeb6c3]" />
                                <div className="text-xs text-[#98a3b4]">
                                    <p className="mb-1 font-medium text-[#dfe4ed]">Transcrição na Nuvem</p>
                                    <p className="text-[#7f8794]">
                                        Usa a API do provedor ativo (OpenAI Whisper, Gemini, Groq). Retorno progressivo por blocos. Requer chave de API e internet.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Erro */}
            {error && (
                <div className="rounded-2xl border border-[#4d2834] bg-[#24161c] p-3">
                    <div className="flex gap-2">
                        <MicOff size={14} className="mt-0.5 shrink-0 text-[#efb5c2]" />
                        <p className="text-xs text-[#efb5c2]">{error}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VoiceSettings
