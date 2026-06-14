/**
 * Seção de IA — provedor, credenciais, modelo e latência.
 * Mostra apenas campos relevantes ao provedor ativo.
 */

import React from 'react'
import { Check, Copy, Download, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { CabecalhoGrupo, Divisor, LinhaConfig, classeInput, classePill } from './ComponentesConfig'
import type { PerfilLatencia } from '../../services/ai/types'

export interface SecaoIAProps {
    apiKey: string; setApiKey: (v: string) => void
    geminiKey: string; setGeminiKey: (v: string) => void
    openRouterKey: string; setOpenRouterKey: (v: string) => void
    provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'local'
    setProvedorAtivo: (v: 'openai' | 'gemini' | 'openrouter' | 'local') => void
    modeloOpenRouter: string; setModeloOpenRouter: (v: string) => void
    modeloLmStudio: string; setModeloLmStudio: (v: string) => void
    baseUrlLmStudio: string; setBaseUrlLmStudio: (v: string) => void
    perfilLatencia: PerfilLatencia; setPerfilLatencia: (v: PerfilLatencia) => void
}

const PROVEDORES = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'local', label: 'Local' },
] as const

const PERFIS = [
    { id: 'rapido', label: 'Rápido', desc: 'Menor latência, menos contexto extra.' },
    { id: 'equilibrado', label: 'Equilibrado', desc: 'Bom meio-termo para a maioria dos casos.' },
    { id: 'completo', label: 'Completo', desc: 'Mais contexto e assistências, porém mais lento.' },
] as const

interface GpuDetectada {
    name: string
    vramBytes: number
}

interface HardwareLocalInfo {
    cpuName?: string
    cpuArch?: string
    totalRamBytes?: number
    gpus?: GpuDetectada[]
}

interface ConfigServidorLocal {
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

type AtualizacaoConfigServidorLocal = Partial<ConfigServidorLocal>

export const SecaoIA: React.FC<SecaoIAProps> = (props) => {
    const { provedorAtivo, setProvedorAtivo, perfilLatencia, setPerfilLatencia } = props
    const [httpConfig, setHttpConfig] = React.useState<{ baseUrl?: string; key?: string; running?: boolean; error?: string | null }>({})
    const [runtimePronto, setRuntimePronto] = React.useState<boolean | null>(null)
    const [baixandoRuntime, setBaixandoRuntime] = React.useState(false)
    const [progressoRuntime, setProgressoRuntime] = React.useState(0)
    const [mostrarChave, setMostrarChave] = React.useState(false)
    const [hardwareInfo, setHardwareInfo] = React.useState<HardwareLocalInfo | null>(null)
    const [serverSettings, setServerSettings] = React.useState<ConfigServidorLocal>({
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
    })

    // Campo de API contextual ao provedor ativo
    const campoApi = {
        openai: { label: 'OpenAI API Key', valor: props.apiKey, onChange: props.setApiKey, ph: 'sk-...' },
        gemini: { label: 'Gemini API Key', valor: props.geminiKey, onChange: props.setGeminiKey, ph: 'AIza...' },
        openrouter: { label: 'OpenRouter API Key', valor: props.openRouterKey, onChange: props.setOpenRouterKey, ph: 'sk-or-v1-...' },
        local: null,
    }[provedorAtivo]

    const carregarLocal = React.useCallback(async () => {
        const [status, config, settingsRes, hwRes] = await Promise.all([
            window.electronAPI?.localLLM?.checkAvailability(),
            window.electronAPI?.localLLM?.getHttpConfig(),
            window.electronAPI?.localLLM?.getServerSettings(),
            window.electronAPI?.localLLM?.getHardwareInfo(),
        ])
        if (status?.success) {
            setRuntimePronto(Boolean(status.runtimeAvailable))
        }
        if (config?.success) {
            setHttpConfig(config)
        }
        if (settingsRes?.success && settingsRes.settings) {
            setServerSettings(settingsRes.settings)
        }
        if (hwRes?.success && hwRes.hardware) {
            setHardwareInfo(hwRes.hardware)
        }
    }, [])

    React.useEffect(() => {
        void carregarLocal()
        const removerProgresso = window.electronAPI?.localLLM?.onRuntimeProgress((data) => {
            setProgressoRuntime(data.percent)
        })
        return () => removerProgresso?.()
    }, [carregarLocal])

    const baixarRuntime = async () => {
        setBaixandoRuntime(true)
        setProgressoRuntime(1)
        const runtimeDisponivel = serverSettings.runtimeType === 'hip' ? 'vulkan' : serverSettings.runtimeType
        await window.electronAPI?.localLLM?.downloadRuntime(runtimeDisponivel)
        setBaixandoRuntime(false)
        setProgressoRuntime(0)
        await carregarLocal()
    }

    const salvarConfig = async (novasConfig: AtualizacaoConfigServidorLocal) => {
        const atualizadas = { ...serverSettings, ...novasConfig }
        setServerSettings(atualizadas)
        await window.electronAPI?.localLLM?.setServerSettings(atualizadas)
        await carregarLocal()
    }

    const rotacionarChave = async () => {
        const resposta = await window.electronAPI?.localLLM?.rotateHttpKey()
        if (resposta?.success) {
            setHttpConfig(resposta)
            setMostrarChave(true)
        }
    }

    const copiarConfig = async () => {
        const texto = `Base URL: ${httpConfig.baseUrl || 'http://127.0.0.1:11435/v1'}\nAPI Key: ${httpConfig.key || ''}`
        await navigator.clipboard.writeText(texto)
    }

    return (
        <>
            <CabecalhoGrupo titulo="Provedor" />

            <div className="flex flex-wrap gap-2 py-3">
                {PROVEDORES.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProvedorAtivo(p.id)} className={classePill(provedorAtivo === p.id)}>
                        {p.label}
                    </button>
                ))}
            </div>

            {campoApi && (
                <>
                    <Divisor />
                    <LinhaConfig titulo={campoApi.label} vertical>
                        <input type="password" value={campoApi.valor}
                            onChange={(e) => campoApi.onChange(e.target.value)}
                            placeholder={campoApi.ph} className={classeInput} />
                    </LinhaConfig>
                </>
            )}

            {provedorAtivo === 'local' && (
                <>
                    <Divisor />
                    <div className="space-y-4 py-2">
                        {/* Painel de Hardware estilo LM Studio */}
                        <div className="rounded-xl border border-white/[0.06] bg-[#0c0e14] p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
                                <span className="text-[12px] font-bold text-white tracking-wide uppercase">Hardware</span>
                                <span className="text-[10px] text-[#5c6675]">Recursos do Sistema</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Informações do CPU */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium text-[#697386] uppercase tracking-wider">CPU</span>
                                        <span className="text-[9px] font-bold text-emerald-500">✓ Compatível</span>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.025] px-3 py-2 border border-white/[0.03] space-y-1">
                                        <p className="text-[11px] font-semibold text-[#cdd4e0] truncate" title={hardwareInfo?.cpuName || 'Detectando...'}>
                                            {hardwareInfo?.cpuName || 'Detectando...'}
                                        </p>
                                        <div className="flex gap-1.5 text-[8px] text-[#697386]">
                                            <span className="bg-white/[0.05] px-1 rounded uppercase">{hardwareInfo?.cpuArch || 'x64'}</span>
                                            <span className="bg-white/[0.05] px-1 rounded">AVX2</span>
                                            <span className="bg-white/[0.05] px-1 rounded">AVX</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Capacidade de Memória */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-medium text-[#697386] uppercase tracking-wider">Memória</span>
                                    <div className="rounded-xl bg-white/[0.025] px-3 py-2 border border-white/[0.03] space-y-1">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[#697386]">RAM</span>
                                            <span className="font-semibold text-[#cdd4e0]">
                                                {hardwareInfo?.totalRamBytes ? `${(hardwareInfo.totalRamBytes / (1024 ** 3)).toFixed(1)} GB` : '...'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[#697386]">VRAM</span>
                                            <span className="font-semibold text-[#cdd4e0]">
                                                {hardwareInfo?.gpus ? `${hardwareInfo.gpus.reduce((acc, g) => acc + (g.vramBytes / (1024 ** 3)), 0).toFixed(1)} GB` : '0.0 GB'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                                                {/* GPU Switch & Toggles */}
                            {!serverSettings.usarServidorExterno && hardwareInfo?.gpus && hardwareInfo.gpus.length > 0 && (
                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center gap-1.5 border-t border-white/[0.03] pt-2 pb-1">
                                        <span className="text-[10px] font-medium text-[#697386] uppercase tracking-wider">GPU(s) Detectada(s)</span>
                                    </div>
                                    {hardwareInfo.gpus.map((gpu, idx) => {
                                        const deviceId = `Vulkan${idx}`;
                                        const isGpuSelected = serverSettings.gpuOn && serverSettings.gpuDevice === deviceId;
                                        return (
                                            <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.015] px-3 py-2 border border-white/[0.03]">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-medium text-[#cdd4e0] truncate" title={gpu.name}>{gpu.name}</p>
                                                    <p className="text-[9px] text-[#697386]">
                                                        Capacidade: {(gpu.vramBytes / (1024 ** 3)).toFixed(2)} GB • Vulkan
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ligar = !isGpuSelected;
                                                        void salvarConfig({
                                                            gpuOn: ligar,
                                                            runtimeType: ligar ? (serverSettings.runtimeType === 'cpu' ? 'vulkan' : serverSettings.runtimeType) : 'cpu',
                                                            gpuDevice: ligar ? deviceId : 'Vulkan0'
                                                        });
                                                    }}
                                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                        isGpuSelected ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                    }`}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                            isGpuSelected ? 'translate-x-4' : 'translate-x-0'
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {serverSettings.gpuOn && (
                                        <div className="flex items-center justify-between gap-3 px-1 pt-1">
                                            <span className="text-[11px] text-[#697386]">Offload do Cache KV para a GPU</span>
                                            <button
                                                type="button"
                                                onClick={() => void salvarConfig({ offloadKv: !serverSettings.offloadKv })}
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                    serverSettings.offloadKv ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        serverSettings.offloadKv ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Runtime e Downloader (com Dropdown como menu de seleção) */}
                        {!serverSettings.usarServidorExterno && (
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 border border-white/[0.03]">
                                <div>
                                    <span className="text-[10px] font-medium text-[#697386] uppercase tracking-wider">Mecanismo de Execução Local</span>
                                    <div className="mt-1">
                                        <select
                                            value={serverSettings.runtimeType}
                                            onChange={(e) => {
                                                const val = e.target.value as 'cpu' | 'vulkan' | 'hip';
                                                void salvarConfig({ 
                                                    runtimeType: val,
                                                    gpuOn: val !== 'cpu'
                                                });
                                            }}
                                            className="rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] font-semibold text-[#cdd4e0] outline-none cursor-pointer"
                                        >
                                            <option value="cpu">CPU Llama.cpp</option>
                                            <option value="hip">ROCm Llama.cpp</option>
                                            <option value="vulkan">Vulkan Llama.cpp</option>
                                        </select>
                                    </div>
                                    <p className="mt-1 text-[11px] text-[#697386]">
                                        Status: <span className={runtimePronto ? 'text-green-400 font-medium' : 'text-yellow-500'}>
                                            {runtimePronto ? 'Instalado e Pronto' : baixandoRuntime ? `Baixando ${progressoRuntime}%` : 'Não instalado'}
                                        </span>
                                    </p>
                                </div>
                                {!runtimePronto && (
                                    <button
                                        type="button"
                                        onClick={baixarRuntime}
                                        disabled={baixandoRuntime}
                                        className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 text-[12px] font-semibold transition-colors hover:bg-blue-500/30 disabled:opacity-60"
                                    >
                                        <Download size={14} />
                                        Baixar
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Configurações de Desempenho / Servidor Externo */}
                        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-[#0c0e14] p-4">
                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
                                <span className="text-[12px] font-bold text-white tracking-wide uppercase">Servidor Local</span>
                                <span className="text-[10px] text-[#697386] italic">Configuração de IA Local</span>
                            </div>

                            {/* Servidor Externo Switch */}
                            <div className="space-y-3 border-b border-white/[0.03] pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] text-[#cdd4e0] font-semibold">Usar Servidor Externo</p>
                                        <p className="text-[9px] text-[#697386]">Conecta ao Ollama / LM Studio rodando em background.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void salvarConfig({ usarServidorExterno: !serverSettings.usarServidorExterno })}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                            serverSettings.usarServidorExterno ? 'bg-blue-500' : 'bg-white/[0.08]'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                serverSettings.usarServidorExterno ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {serverSettings.usarServidorExterno && (
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">URL do Servidor API</span>
                                            <input
                                                type="text"
                                                value={serverSettings.urlServidorExterno || ''}
                                                placeholder="http://127.0.0.1:11434/v1"
                                                onChange={(e) => void salvarConfig({ urlServidorExterno: e.target.value })}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Ex: Ollama usa a porta 11434.</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">Nome do Modelo Externo</span>
                                            <input
                                                type="text"
                                                value={serverSettings.modeloServidorExterno || ''}
                                                placeholder="Ex: qwen2.5:7b"
                                                onChange={(e) => void salvarConfig({ modeloServidorExterno: e.target.value })}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Nome do modelo no Ollama.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Ajustes do Servidor Integrado */}
                            {!serverSettings.usarServidorExterno && (
                                <>
                                    {/* GPU Offload Slider */}
                                    {(serverSettings.runtimeType === 'vulkan' || serverSettings.runtimeType === 'hip') && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex justify-between items-center text-[12px]">
                                                <span className="text-[#cdd4e0]">Camadas na GPU (Offload)</span>
                                                <span className="font-bold text-[#cdd4e0]">{serverSettings.gpuLayers === 0 ? 'Auto (99)' : serverSettings.gpuLayers}</span>
                                            </div>
                                            <p className="text-[10px] text-[#697386]">
                                                Número de camadas a enviar para a placa de vídeo. Deixe 0 para todas (99).
                                            </p>
                                            <div className="flex items-center gap-3 pt-1">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="128"
                                                    value={serverSettings.gpuLayers}
                                                    onChange={(e) => void salvarConfig({ gpuLayers: parseInt(e.target.value, 10) })}
                                                    className="w-full h-1 bg-[#121620] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Threads e Contexto */}
                                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.03] pt-2.5">
                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">Threads do CPU</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="64"
                                                value={serverSettings.threads || ''}
                                                placeholder="Auto"
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                                                    void salvarConfig({ threads: isNaN(val) ? 0 : val });
                                                }}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Alocação do processador.</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">Limite de Contexto</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1024"
                                                value={serverSettings.ctxSize || ''}
                                                placeholder="Padrão (32k)"
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                                                    void salvarConfig({ ctxSize: isNaN(val) ? 0 : val });
                                                }}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Tokens do modelo local.</p>
                                        </div>
                                    </div>

                                    {/* RAM options */}
                                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.03] pt-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] text-[#cdd4e0] font-semibold">Desativar mmap</p>
                                                <p className="text-[9px] text-[#697386]">Carrega tudo na RAM ativa.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void salvarConfig({ noMmap: !serverSettings.noMmap })}
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                    serverSettings.noMmap ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        serverSettings.noMmap ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] text-[#cdd4e0] font-semibold">Travar na RAM (mlock)</p>
                                                <p className="text-[9px] text-[#697386]">Evita paginação do SO.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void salvarConfig({ mlock: !serverSettings.mlock })}
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                    serverSettings.mlock ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        serverSettings.mlock ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cache e Checkpoints */}
                                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.03] pt-2.5">
                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">Cache de Prompt (RAM)</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1024"
                                                value={serverSettings.cacheRam ?? 0}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                                                    void salvarConfig({ cacheRam: isNaN(val) ? 0 : val });
                                                }}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Tamanho em MiB. 0 desativa (Recomendado).</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[11px] text-[#cdd4e0] font-medium">Checkpoints de Contexto</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="64"
                                                value={serverSettings.ctxCheckpoints ?? 0}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                                                    void salvarConfig({ ctxCheckpoints: isNaN(val) ? 0 : val });
                                                }}
                                                className="w-full rounded-lg bg-[#121620] border border-white/[0.08] px-2.5 py-1 text-[12px] text-[#cdd4e0] outline-none"
                                            />
                                            <p className="text-[9px] text-[#697386]">Nº de checkpoints. 0 desativa (Recomendado).</p>
                                        </div>
                                    </div>

                                    {/* GPU Optimizations */}
                                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.03] pt-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] text-[#cdd4e0] font-semibold">Flash Attention</p>
                                                <p className="text-[9px] text-[#697386]">Acelera e reduz VRAM do KV Cache.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void salvarConfig({ flashAttn: !serverSettings.flashAttn })}
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                    serverSettings.flashAttn ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        serverSettings.flashAttn ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] text-[#cdd4e0] font-semibold">Auto-fit Memória</p>
                                                <p className="text-[9px] text-[#697386]">Ajusta VRAM automaticamente.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void salvarConfig({ fitOn: !serverSettings.fitOn })}
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                    serverSettings.fitOn ? 'bg-blue-500' : 'bg-white/[0.08]'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                        serverSettings.fitOn ? 'translate-x-4' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Informações da API local */}
                        <div className="space-y-2 rounded-xl bg-white/[0.025] px-3 py-2 border border-white/[0.03]">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[12px] text-[#cdd4e0]">Endereço da API Pública</p>
                                    <p className="truncate text-[11px] text-[#697386]">{httpConfig.baseUrl || 'http://127.0.0.1:11435/v1'}</p>
                                </div>
                                <button type="button" onClick={copiarConfig} className="rounded-lg p-2 text-[#8a93a2] hover:bg-white/[0.05] outline-none">
                                    <Copy size={14} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/20 px-2 py-1.5 text-[11px] text-[#8d96a8]">
                                    {mostrarChave ? httpConfig.key : 'selene-local-••••••••••••••••'}
                                </code>
                                <button type="button" onClick={() => setMostrarChave((valor) => !valor)} className="rounded-lg p-2 text-[#8a93a2] hover:bg-white/[0.05] outline-none">
                                    {mostrarChave ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button type="button" onClick={rotacionarChave} className="rounded-lg p-2 text-[#8a93a2] hover:bg-white/[0.05] outline-none">
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                            {httpConfig.error && <p className="text-[11px] text-[#e49aa8]">{httpConfig.error}</p>}
                        </div>

                        {/* Aviso de reinício */}
                        <p className="text-[10px] text-[#697386] italic text-center">
                            Nota: O servidor local será reiniciado automaticamente na próxima inferência para aplicar novas configurações.
                        </p>
                    </div>
                </>
            )}

            {/* Modelo — só para provedores que precisam */}
            {provedorAtivo === 'openrouter' && (
                <>
                    <CabecalhoGrupo titulo="Modelo" />
                    <LinhaConfig titulo="Modelo OpenRouter" vertical>
                        <input type="text" value={props.modeloOpenRouter}
                            onChange={(e) => props.setModeloOpenRouter(e.target.value)}
                            placeholder="openrouter/auto" className={classeInput} />
                    </LinhaConfig>
                </>
            )}

            <CabecalhoGrupo titulo="Perfil de latência" />
            <div className="space-y-1 py-2">
                {PERFIS.map((p) => (
                    <button
                        key={p.id} type="button"
                        onClick={() => setPerfilLatencia(p.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-100 ${
                            perfilLatencia === p.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                    >
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            perfilLatencia === p.id ? 'border-white/[0.25] bg-white/[0.12]' : 'border-white/[0.08]'
                        }`}>
                            {perfilLatencia === p.id && <Check size={9} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                            <span className="text-[13px] text-[#cdd4e0]">{p.label}</span>
                            <span className="ml-2 text-[11px] text-[#4e5768]">{p.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
        </>
    )
}
