/**
 * VoiceSettings — configuração de transcrição por voz.
 * Suporta nuvem, Whisper local e Parakeet local experimental.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MicOff, Cloud, HardDrive, Check, Loader2,
    ChevronDown, Download, Zap,
    Mic, Trash2, Radio, Cpu
} from 'lucide-react'
import type { WhisperModelSize } from '../../services/whisper'
import type { MotorTranscricaoLocal, TranscriptionProvider } from '../../hooks/useVoiceInput'
import type { ParakeetModelName } from '../../services/parakeet'
import {
    MODELO_PARAKEET_PADRAO,
    ORDEM_MODELOS_PARAKEET,
    PARAKEET_MODEL_INFO
} from '../../services/parakeet'

interface ModeloLocal {
    name: string
    displayName: string
    size: number
    description: string
    ramRequired: string
    downloaded: boolean
    downloading: boolean
    experimental?: boolean
    recommendedForPtBr?: boolean
}

interface DownloadProgress {
    modelName: string
    downloaded: number
    total: number
    percent: number
    stage?: string
}

interface DisponibilidadeWhisper {
    binaryAvailable: boolean
    hasModels: boolean
    available: boolean
}

interface DisponibilidadeParakeet {
    runtimeAvailable: boolean
    hasModels: boolean
    available: boolean
}

interface VoiceSettingsProps {
    provider: TranscriptionProvider
    onProviderChange: (provider: TranscriptionProvider) => void
    motorLocal: MotorTranscricaoLocal
    onMotorLocalChange: (motor: MotorTranscricaoLocal) => void
    whisperModel: WhisperModelSize
    onModelChange: (model: WhisperModelSize) => void
    parakeetModel: ParakeetModelName
    onParakeetModelChange: (model: ParakeetModelName) => void
    whisperBinaryPath: string
    onBinaryPathChange: (path: string) => void
    isWhisperReady: boolean
    onInitializeWhisper: () => Promise<void>
    isParakeetReady: boolean
    onInitializeParakeet: () => Promise<void>
    isRecording?: boolean
    error?: string | null
    microfoneId: string
    onMicrofoneChange: (microfoneId: string) => void
}

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
const classeOpcaoAtiva = 'border-white/[0.1] bg-white/[0.08]'
const classeOpcaoInativa = 'border-white/[0.05] bg-white/[0.025] hover:border-white/[0.07] hover:bg-white/[0.04]'

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
    provider,
    onProviderChange,
    motorLocal,
    onMotorLocalChange,
    whisperModel,
    onModelChange,
    parakeetModel,
    onParakeetModelChange,
    isWhisperReady,
    onInitializeWhisper,
    isParakeetReady,
    onInitializeParakeet,
    isRecording,
    error,
    microfoneId,
    onMicrofoneChange,
}) => {
    const [showWhisperDropdown, setShowWhisperDropdown] = useState(false)
    const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])
    const [carregandoMicrofones, setCarregandoMicrofones] = useState(false)
    const [erroMicrofones, setErroMicrofones] = useState<string | null>(null)
    const [whisperModels, setWhisperModels] = useState<ModeloLocal[]>([])
    const [parakeetModels, setParakeetModels] = useState<ModeloLocal[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [downloadProgressWhisper, setDownloadProgressWhisper] = useState<DownloadProgress | null>(null)
    const [downloadProgressParakeet, setDownloadProgressParakeet] = useState<DownloadProgress | null>(null)
    const [erroDownloadParakeet, setErroDownloadParakeet] = useState<string | null>(null)
    const [disponibilidadeWhisper, setDisponibilidadeWhisper] = useState<DisponibilidadeWhisper | null>(null)
    const [disponibilidadeParakeet, setDisponibilidadeParakeet] = useState<DisponibilidadeParakeet | null>(null)

    const carregarStatus = useCallback(async () => {
        try {
            setIsLoadingModels(true)

            const [whisperAvailability, whisperLista, parakeetAvailability, parakeetLista] = await Promise.all([
                window.electronAPI?.localWhisper?.checkAvailability(),
                window.electronAPI?.localWhisper?.listModels(),
                window.electronAPI?.localParakeet?.checkAvailability(),
                window.electronAPI?.localParakeet?.listModels()
            ])

            if (whisperAvailability?.success) {
                setDisponibilidadeWhisper({
                    binaryAvailable: Boolean(whisperAvailability.binaryAvailable),
                    hasModels: Boolean(whisperAvailability.hasModels),
                    available: Boolean(whisperAvailability.available)
                })
            }

            if (whisperLista?.success && whisperLista.models) {
                setWhisperModels(whisperLista.models)
            }

            if (parakeetAvailability?.success) {
                setDisponibilidadeParakeet({
                    runtimeAvailable: Boolean(parakeetAvailability.runtimeAvailable),
                    hasModels: Boolean(parakeetAvailability.hasModels),
                    available: Boolean(parakeetAvailability.available)
                })
            }

            if (parakeetLista?.success && parakeetLista.models) {
                setParakeetModels(parakeetLista.models)
            }
        } catch (err) {
            console.error('[VoiceSettings] Falha ao carregar status:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }, [])

    useEffect(() => {
        void carregarStatus()

        const apiWhisper = window.electronAPI?.localWhisper
        const apiParakeet = window.electronAPI?.localParakeet
        const unsubscribers: Array<() => void> = []

        if (apiWhisper) {
            unsubscribers.push(apiWhisper.onDownloadProgress((data) => setDownloadProgressWhisper(data)))
            unsubscribers.push(apiWhisper.onDownloadComplete(() => { setDownloadProgressWhisper(null); void carregarStatus() }))
            unsubscribers.push(apiWhisper.onDownloadError(() => { setDownloadProgressWhisper(null); void carregarStatus() }))
        }

        if (apiParakeet) {
            unsubscribers.push(apiParakeet.onDownloadProgress((data) => setDownloadProgressParakeet(data)))
            unsubscribers.push(apiParakeet.onDownloadComplete(() => {
                setErroDownloadParakeet(null)
                setDownloadProgressParakeet(null)
                void carregarStatus()
            }))
            unsubscribers.push(apiParakeet.onDownloadError((data) => {
                setErroDownloadParakeet(data.error)
                setDownloadProgressParakeet(null)
                void carregarStatus()
            }))
        }

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe())
        }
    }, [carregarStatus])

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
        void carregarMicrofones()
        navigator.mediaDevices?.addEventListener?.('devicechange', carregarMicrofones)
        return () => navigator.mediaDevices?.removeEventListener?.('devicechange', carregarMicrofones)
    }, [carregarMicrofones])

    const baixarModeloWhisper = async (name: string) => {
        try {
            await window.electronAPI?.localWhisper?.downloadModel(name)
        } catch (err) {
            console.error('[VoiceSettings] Falha ao baixar Whisper:', err)
        }
    }

    const excluirModeloWhisper = async (name: string) => {
        try {
            await window.electronAPI?.localWhisper?.deleteModel(name)
            await carregarStatus()
        } catch (err) {
            console.error('[VoiceSettings] Falha ao excluir Whisper:', err)
        }
    }

    const baixarModeloParakeet = async (name: string) => {
        try {
            setErroDownloadParakeet(null)
            setDownloadProgressParakeet({
                modelName: name,
                downloaded: 1,
                total: 100,
                percent: 1,
                stage: 'preparing-runtime'
            })
            const resultado = await window.electronAPI?.localParakeet?.downloadModel(name)
            if (!resultado?.success) {
                throw new Error(resultado?.error || 'Falha ao baixar Parakeet.')
            }
        } catch (err) {
            console.error('[VoiceSettings] Falha ao baixar Parakeet:', err)
            setDownloadProgressParakeet(null)
            setErroDownloadParakeet(err instanceof Error ? err.message : 'Falha ao baixar Parakeet.')
        }
    }

    const excluirModeloParakeet = async (name: string) => {
        try {
            await window.electronAPI?.localParakeet?.deleteModel(name)
            await carregarStatus()
        } catch (err) {
            console.error('[VoiceSettings] Falha ao excluir Parakeet:', err)
        }
    }

    const currentModelInfo = MODEL_INFO[whisperModel]
    const localDisponivel = Boolean(disponibilidadeWhisper?.available || disponibilidadeParakeet?.available)
    const whisperOrdenados = [...whisperModels].sort((a, b) => {
        const iA = ORDEM_MODELOS.indexOf(a.name as WhisperModelSize)
        const iB = ORDEM_MODELOS.indexOf(b.name as WhisperModelSize)
        return (iA === -1 ? Infinity : iA) - (iB === -1 ? Infinity : iB)
    })
    const modeloWhisperSelecionado = whisperOrdenados.find((m) => m.name === whisperModel)
    const modeloWhisperResolvido = modeloWhisperSelecionado || {
        name: whisperModel,
        displayName: currentModelInfo.label,
        size: 0,
        description: '',
        ramRequired: '',
        downloaded: false,
        downloading: false,
    }
    const modelosParakeetResolvidos = ORDEM_MODELOS_PARAKEET.map((nomeModelo) => {
        const status = parakeetModels.find((m) => m.name === nomeModelo)
        const info = PARAKEET_MODEL_INFO[nomeModelo]

        return {
            name: nomeModelo,
            displayName: status?.displayName || info.label,
            size: status?.size || 0,
            description: status?.description || info.description,
            ramRequired: status?.ramRequired || '~2 GB',
            downloaded: Boolean(status?.downloaded),
            downloading: Boolean(status?.downloading),
            experimental: true,
            recommendedForPtBr: Boolean(status?.recommendedForPtBr || info.recommendedForPtBr)
        } satisfies ModeloLocal
    })
    const modeloParakeetSelecionado = modelosParakeetResolvidos.find((m) => m.name === parakeetModel)
        || modelosParakeetResolvidos.find((m) => m.name === MODELO_PARAKEET_PADRAO)
        || modelosParakeetResolvidos[0]

    return (
        <div className="space-y-4">
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
                    <button
                        type="button"
                        onClick={() => void carregarMicrofones()}
                        disabled={carregandoMicrofones}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-[#dfe4ec] transition-colors hover:bg-white/[0.06]"
                    >
                        {carregandoMicrofones ? 'Atualizando...' : 'Atualizar'}
                    </button>
                </div>
                {erroMicrofones && <p className="text-xs text-[#d4a574]">{erroMicrofones}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Provedor de Transcrição</label>
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={() => onProviderChange('cloud')}
                        disabled={isRecording}
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                            provider === 'cloud' ? classeOpcaoAtiva : classeOpcaoInativa
                        } ${isRecording ? 'cursor-not-allowed opacity-50' : ''}`}
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

                    <button
                        onClick={() => onProviderChange('local')}
                        disabled={isRecording || !localDisponivel}
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                            provider === 'local' ? classeOpcaoAtiva : classeOpcaoInativa
                        } ${(isRecording || !localDisponivel) ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                            provider === 'local' ? 'border-white/[0.1] bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.03]'
                        }`}>
                            <HardDrive size={20} className={provider === 'local' ? 'text-white' : 'text-[#aeb6c3]'} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-[#f3f5f9]">
                                Local offline
                                {!localDisponivel && <span className="ml-2 text-xs text-[#d4a574]">(baixe um modelo)</span>}
                            </p>
                            <p className="text-xs text-[#7f8794]">Whisper.cpp em tempo real ou Parakeet experimental por blocos</p>
                        </div>
                        {provider === 'local' && <Check size={16} className="text-white" />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {provider === 'local' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <button
                                    onClick={() => onMotorLocalChange('whisper')}
                                    disabled={isRecording}
                                    className={`rounded-2xl border p-4 text-left transition-all ${
                                        motorLocal === 'whisper' ? classeOpcaoAtiva : classeOpcaoInativa
                                    } ${isRecording ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <Mic size={16} className="text-[#dfe4ed]" />
                                        <span className="text-sm font-medium text-white">Whisper.cpp</span>
                                    </div>
                                    <p className="text-xs text-[#7f8794]">Tempo real, 100% offline e já maduro no app.</p>
                                </button>

                                <button
                                    onClick={() => onMotorLocalChange('parakeet')}
                                    disabled={isRecording}
                                    className={`rounded-2xl border p-4 text-left transition-all ${
                                        motorLocal === 'parakeet' ? classeOpcaoAtiva : classeOpcaoInativa
                                    } ${isRecording ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <Cpu size={16} className="text-[#dfe4ed]" />
                                        <span className="text-sm font-medium text-white">NVIDIA Parakeet</span>
                                        <span className="rounded-full bg-[#243243] px-1.5 py-0.5 text-[10px] text-[#9ed2ff]">Experimental</span>
                                    </div>
                                    <p className="text-xs text-[#7f8794]">Inferência local por blocos. Melhor suporte atual em inglês.</p>
                                </button>
                            </div>

                            {motorLocal === 'whisper' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Mic className="h-4 w-4 text-[#aeb6c3]" />
                                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Modelos Whisper Local</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isLoadingModels && <Loader2 className="h-4 w-4 animate-spin text-[#7f8794]" />}
                                            <button
                                                type="button"
                                                onClick={() => void onInitializeWhisper()}
                                                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#dfe4ec] transition-colors hover:bg-white/[0.06]"
                                            >
                                                {isWhisperReady ? 'Whisper pronto' : 'Validar'}
                                            </button>
                                        </div>
                                    </div>

                                    {disponibilidadeWhisper && !disponibilidadeWhisper.binaryAvailable && (
                                        <div className="rounded-2xl border border-[#3d3422] bg-[#1a1710] p-3 text-xs text-[#c4a678]">
                                            Binário Whisper não encontrado. Confira `native/whisper/bin/`.
                                        </div>
                                    )}

                                    <div className="relative">
                                        <button
                                            onClick={() => setShowWhisperDropdown(!showWhisperDropdown)}
                                            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#11141a] p-3 transition-colors hover:bg-white/[0.03]"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04]">
                                                    <Zap className="h-4 w-4 text-[#dfe4ed]" />
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-white">{modeloWhisperResolvido.displayName}</span>
                                                        {MODELOS_RECOMENDADOS.has(whisperModel) && (
                                                            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-[#7f8794]">
                                                        {currentModelInfo.size} · {currentModelInfo.quality} · {currentModelInfo.speed}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronDown className={`h-4 w-4 text-[#aeb6c3] transition-transform ${showWhisperDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showWhisperDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 6 }}
                                                    className="mt-2 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0f1116] shadow-xl"
                                                >
                                                    <div className="max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                                                        {whisperOrdenados.map((model) => (
                                                            <button
                                                                key={model.name}
                                                                onClick={() => { if (!isRecording) { onModelChange(model.name as WhisperModelSize); setShowWhisperDropdown(false) } }}
                                                                className={`w-full border-b border-white/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 ${
                                                                    model.name === whisperModel ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                                                                } ${isRecording ? 'cursor-not-allowed opacity-60' : ''}`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-medium text-white">{model.displayName}</span>
                                                                            {MODELOS_RECOMENDADOS.has(model.name as WhisperModelSize) && (
                                                                                <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="mt-0.5 text-[11px] text-[#7f8794]">{formatBytes(model.size)} · RAM: {model.ramRequired}</p>
                                                                    </div>
                                                                    {!model.downloaded && <span className="text-[10px] text-[#d4a574]">Não baixado</span>}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="rounded-2xl border border-white/[0.07] bg-[#11141a] p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-white">{modeloWhisperResolvido.displayName}</span>
                                                    {MODELOS_RECOMENDADOS.has(modeloWhisperResolvido.name as WhisperModelSize) && (
                                                        <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">Recomendado</span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-[#7f8794]">
                                                    {(modeloWhisperResolvido.size > 0 ? formatBytes(modeloWhisperResolvido.size) : currentModelInfo.size)} · RAM: {modeloWhisperResolvido.ramRequired || 'N/D'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {downloadProgressWhisper?.modelName === modeloWhisperResolvido.name ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                                                            <motion.div className="h-full bg-white/[0.3]" initial={{ width: 0 }} animate={{ width: `${downloadProgressWhisper.percent}%` }} />
                                                        </div>
                                                        <span className="w-8 text-[10px] text-[#aeb6c3]">{downloadProgressWhisper.percent}%</span>
                                                    </div>
                                                ) : modeloWhisperResolvido.downloaded ? (
                                                    <button
                                                        onClick={() => void excluirModeloWhisper(modeloWhisperResolvido.name)}
                                                        disabled={isRecording}
                                                        title="Excluir modelo"
                                                        className="rounded-xl border border-[#4d2834] bg-[#24161c] p-1.5 text-[#efb5c2] transition-colors hover:bg-[#311c24]"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => void baixarModeloWhisper(modeloWhisperResolvido.name)}
                                                        disabled={isRecording}
                                                        className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#dfe4ec] transition-colors hover:bg-white/[0.06]"
                                                    >
                                                        <Download className="h-3 w-3" /> Baixar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                                        <div className="flex gap-2">
                                            <Radio size={14} className="mt-0.5 shrink-0 text-[#aeb6c3]" />
                                            <div className="text-xs text-[#98a3b4]">
                                                <p className="mb-1 font-medium text-[#dfe4ed]">Whisper em tempo real</p>
                                                <p className="text-[#7f8794]">Melhor opção atual da Selene para captura contínua enquanto você fala.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4 text-[#aeb6c3]" />
                                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7f8794]">Modelo Parakeet Local</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isLoadingModels && <Loader2 className="h-4 w-4 animate-spin text-[#7f8794]" />}
                                            <button
                                                type="button"
                                                onClick={() => void onInitializeParakeet()}
                                                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#dfe4ec] transition-colors hover:bg-white/[0.06]"
                                            >
                                                {isParakeetReady ? 'Parakeet pronto' : 'Validar'}
                                            </button>
                                        </div>
                                    </div>

                                    {disponibilidadeParakeet && !disponibilidadeParakeet.runtimeAvailable && (
                                        <div className="rounded-2xl border border-[#3d3422] bg-[#1a1710] p-3 text-xs text-[#c4a678]">
                                            Runtime do Parakeet ainda não está pronto no ambiente atual.
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {modelosParakeetResolvidos.map((modelo) => {
                                            const infoModelo = PARAKEET_MODEL_INFO[modelo.name as ParakeetModelName]
                                            const estaSelecionado = modelo.name === modeloParakeetSelecionado?.name
                                            const estaBaixando = downloadProgressParakeet?.modelName === modelo.name

                                            return (
                                                <div
                                                    key={modelo.name}
                                                    className={`rounded-2xl border p-3 transition-colors ${
                                                        estaSelecionado
                                                            ? 'border-white/[0.12] bg-white/[0.05]'
                                                            : 'border-white/[0.07] bg-[#11141a]'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-sm font-medium text-white">{modelo.displayName}</span>
                                                                {modelo.recommendedForPtBr && (
                                                                <span className="rounded-full bg-[#1e3340] px-1.5 py-0.5 text-[10px] text-[#9ed2ff]">
                                                                        Recomendado para pt-BR + inglês
                                                                    </span>
                                                                )}
                                                                <span className="rounded-full bg-[#243243] px-1.5 py-0.5 text-[10px] text-[#9ed2ff]">
                                                                    Experimental
                                                                </span>
                                                                {estaSelecionado && (
                                                                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#dce2ea]">
                                                                        Selecionado
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="mt-0.5 text-xs text-[#7f8794]">
                                                                {(modelo.size > 0 ? formatBytes(modelo.size) : infoModelo.size)} · RAM: {modelo.ramRequired}
                                                            </p>
                                                            <p className="mt-1 text-[11px] text-[#7f8794]">
                                                                {modelo.description || infoModelo.description}
                                                            </p>
                                                            <p className="mt-1 text-[11px] text-[#98a3b4]">
                                                                {infoModelo.quality} · {infoModelo.speed}
                                                            </p>
                                                            {estaBaixando && downloadProgressParakeet?.stage === 'preparing-runtime' && (
                                                                <p className="mt-1 text-[11px] text-[#9fb0c6]">
                                                                    Preparando runtime local e dependências do Parakeet...
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => onParakeetModelChange(modelo.name as ParakeetModelName)}
                                                                disabled={isRecording}
                                                                className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                                                                    estaSelecionado
                                                                        ? 'border-white/[0.1] bg-white/[0.08] text-white'
                                                                        : 'border-white/[0.06] bg-white/[0.03] text-[#dfe4ec] hover:bg-white/[0.06]'
                                                                }`}
                                                            >
                                                                {estaSelecionado ? 'Em uso' : 'Usar modelo'}
                                                            </button>

                                                            {estaBaixando ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                                                                        <motion.div
                                                                            className="h-full bg-[#8bbcff]"
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: `${downloadProgressParakeet.percent}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="w-8 text-[10px] text-[#aeb6c3]">
                                                                        {downloadProgressParakeet.percent}%
                                                                    </span>
                                                                </div>
                                                            ) : modelo.downloaded ? (
                                                                <button
                                                                    onClick={() => void excluirModeloParakeet(modelo.name)}
                                                                    disabled={isRecording}
                                                                    title="Excluir modelo"
                                                                    className="rounded-xl border border-[#4d2834] bg-[#24161c] p-1.5 text-[#efb5c2] transition-colors hover:bg-[#311c24]"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        onParakeetModelChange(modelo.name as ParakeetModelName)
                                                                        void baixarModeloParakeet(modelo.name)
                                                                    }}
                                                                    disabled={isRecording}
                                                                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#dfe4ec] transition-colors hover:bg-white/[0.06]"
                                                                >
                                                                    <Download className="h-3 w-3" /> Baixar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {erroDownloadParakeet && (
                                        <div className="rounded-2xl border border-[#4d2834] bg-[#24161c] p-3 text-xs text-[#efb5c2]">
                                            {erroDownloadParakeet}
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                                        <div className="flex gap-2">
                                            <Radio size={14} className="mt-0.5 shrink-0 text-[#aeb6c3]" />
                                            <div className="text-xs text-[#98a3b4]">
                                                <p className="mb-1 font-medium text-[#dfe4ed]">Parakeet experimental</p>
                                                <p className="text-[#7f8794]">
                                                    O pipeline atual roda localmente por blocos curtos. Para misturar português com termos em inglês, a melhor opção agora é o
                                                    {' '}<span className="text-[#dfe4ed]">Parakeet TDT 0.6B v3 Multilingual INT8</span>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
