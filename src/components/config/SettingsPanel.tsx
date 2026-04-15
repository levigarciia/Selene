/**
 * SettingsPanel — layout sidebar + content.
 * Navegação por seções na esquerda, conteúdo na direita.
 * Zero cards pesados, zero sub-abas. Scroll vertical limpo.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Mic, Settings2, Sparkles, UserRound, X } from 'lucide-react'
import { SecaoPerfil } from './SecaoPerfil'
import { SecaoIA } from './SecaoIA'
import { SecaoPersonalizacao } from './SecaoPersonalizacao'
import { SecaoAvancado } from './SecaoAvancado'
import { VoiceSettings } from './VoiceSettings'
import { CabecalhoGrupo } from './ComponentesConfig'
import type { UserProfile, Memory } from '../../hooks/useUserProfile'
import type { UseVoiceInputReturn } from '../../hooks/useVoiceInput'
import type { PerfilLatencia } from '../../services/ai/types'
import type { UseAssistantsReturn } from '../../hooks/useAssistants'
import type { AssistenteConfig } from '../../utils/assistentesPadrao'
import type { ConfiguracaoOverlayProativo, NivelIntervencaoOverlay } from '../../types/overlayProativo'

export type { AutoMemory } from './ComponentesConfig'
export type SettingsTab = 'perfil' | 'memorias' | 'api' | 'modelos' | 'atalhos' | 'transcricao' | 'avancado'
export type SecaoConfiguracoes = 'perfil' | 'personalizacao' | 'configuracao'

// Seções internas da sidebar
type SecaoNav = 'perfil' | 'ia' | 'personalizacao' | 'voz' | 'avancado'

const SECOES = [
    { id: 'perfil' as SecaoNav, titulo: 'Perfil', icone: UserRound },
    { id: 'ia' as SecaoNav, titulo: 'IA', icone: Cpu },
    { id: 'personalizacao' as SecaoNav, titulo: 'Personalização', icone: Sparkles },
    { id: 'voz' as SecaoNav, titulo: 'Voz', icone: Mic },
    { id: 'avancado' as SecaoNav, titulo: 'Avançado', icone: Settings2 },
]

// Mapear secaoInicial (externa) → secaoNav (interna)
function mapearSecaoInicial(s?: SecaoConfiguracoes): SecaoNav {
    if (s === 'configuracao') return 'ia'
    if (s === 'personalizacao') return 'personalizacao'
    return 'perfil'
}

export interface SettingsPanelProps {
    profile: UserProfile; setProfile: (p: UserProfile) => void
    memories: Memory[]; addMemory: (c: string) => void; removeMemory: (id: string) => void
    autoMemories?: Array<{ id: string; text: string; category: string; confidence: number; createdAt: number }>
    removeAutoMemory?: (id: string) => void; clearAutoMemories?: () => void
    apiKey: string; setApiKey: (v: string) => void
    geminiKey: string; setGeminiKey: (v: string) => void
    openRouterKey: string; setOpenRouterKey: (v: string) => void
    modeloOpenRouter: string; setModeloOpenRouter: (v: string) => void
    modeloLmStudio: string; setModeloLmStudio: (v: string) => void
    baseUrlLmStudio: string; setBaseUrlLmStudio: (v: string) => void
    perfilLatencia: PerfilLatencia; setPerfilLatencia: (v: PerfilLatencia) => void
    provedorAtivo: 'openai' | 'gemini' | 'openrouter' | 'lmstudio'
    setProvedorAtivo: (v: 'openai' | 'gemini' | 'openrouter' | 'lmstudio') => void
    overlayProativoConfig?: ConfiguracaoOverlayProativo
    setOverlayProativoHabilitado?: (v: boolean) => void
    setOverlayProativoNivelIntervencao?: (v: NivelIntervencaoOverlay) => void
    setOverlayProativoSonecaAte?: (v: number | null) => void
    atalhoGramatical?: string; setAtalhoGramatical?: (v: string) => void
    atalhoScreenshot?: string; setAtalhoScreenshot?: (v: string) => void
    crossChatEnabled?: boolean; setCrossChatEnabled?: (v: boolean) => void
    memoryAutopilotEnabled?: boolean; setMemoryAutopilotEnabled?: (v: boolean) => void
    voiceInput?: UseVoiceInputReturn
    onClose: () => void
    variant?: 'modal' | 'inline'
    visibleTabs?: SettingsTab[]
    secaoInicial?: SecaoConfiguracoes
    assistentes?: UseAssistantsReturn
    onAbrirEditorAssistente?: (a: AssistenteConfig | null) => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
    const {
        profile, setProfile, memories, addMemory, removeMemory,
        autoMemories, removeAutoMemory, clearAutoMemories,
        crossChatEnabled, setCrossChatEnabled,
        memoryAutopilotEnabled, setMemoryAutopilotEnabled,
        assistentes, onAbrirEditorAssistente,
        onClose, variant = 'inline', visibleTabs,
        secaoInicial, voiceInput,
    } = props

    const [secaoAtiva, setSecaoAtiva] = useState<SecaoNav>(() => mapearSecaoInicial(secaoInicial))

    // Seções visíveis baseados em visibleTabs
    const secoesVisiveis = useMemo(() => {
        if (!visibleTabs) return SECOES
        return SECOES.filter((s) => {
            if (s.id === 'perfil') return visibleTabs.includes('perfil')
            if (s.id === 'ia') return visibleTabs.includes('api') || visibleTabs.includes('modelos')
            if (s.id === 'personalizacao') return visibleTabs.includes('memorias')
            if (s.id === 'voz') return visibleTabs.includes('transcricao')
            if (s.id === 'avancado') return visibleTabs.includes('atalhos') || visibleTabs.includes('avancado')
            return true
        })
    }, [visibleTabs])

    // Sincronizar com secaoInicial
    useEffect(() => {
        const mapeada = mapearSecaoInicial(secaoInicial)
        const existe = secoesVisiveis.some((s) => s.id === mapeada)
        setSecaoAtiva(existe ? mapeada : secoesVisiveis[0]?.id || 'perfil')
    }, [secaoInicial, secoesVisiveis])

    const containerClass = variant === 'modal'
        ? 'bg-[#0c0e14] border border-white/[0.05] rounded-[24px] shadow-[0_40px_120px_rgba(0,0,0,0.55)] overflow-hidden'
        : 'absolute inset-0 z-20 flex flex-col bg-[#0c0e12]'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={`${containerClass} pointer-events-auto flex flex-col`}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <div className="flex min-h-0 flex-1">
                {/* Sidebar */}
                <nav className="flex w-[180px] shrink-0 flex-col border-r border-white/[0.035] bg-[#090b10] px-3 pt-5 pb-4">
                    <div className="mb-5 px-3">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#454d5c]">Configurações</h2>
                    </div>

                    <div className="flex-1 space-y-0.5">
                        {secoesVisiveis.map((s) => {
                            const ativa = secaoAtiva === s.id
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setSecaoAtiva(s.id)}
                                    className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-100 ${
                                        ativa
                                            ? 'bg-white/[0.05] text-[#e0e6ef]'
                                            : 'text-[#5c6675] hover:bg-white/[0.025] hover:text-[#8b95a5]'
                                    }`}
                                >
                                    {ativa && <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-white/[0.2]" />}
                                    <s.icone size={15} />
                                    <span className="text-[13px]">{s.titulo}</span>
                                </button>
                            )
                        })}
                    </div>
                </nav>

                {/* Conteúdo */}
                <div className="relative min-w-0 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.06] hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.12] [&::-webkit-scrollbar-track]:bg-transparent">
                    {/* Botão fechar */}
                    <div className="sticky top-0 z-10 flex justify-end bg-gradient-to-b from-[#0c0e14] to-transparent px-6 pt-4 pb-1">
                        <button onClick={onClose} className="rounded-lg p-2 text-[#454d5c] transition-colors hover:bg-white/[0.04] hover:text-[#8b95a5]">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="mx-auto max-w-[560px] px-6 pb-10">
                        {secaoAtiva === 'perfil' && (
                            <SecaoPerfil profile={profile} setProfile={setProfile} />
                        )}

                        {secaoAtiva === 'ia' && (
                            <SecaoIA
                                apiKey={props.apiKey} setApiKey={props.setApiKey}
                                geminiKey={props.geminiKey} setGeminiKey={props.setGeminiKey}
                                openRouterKey={props.openRouterKey} setOpenRouterKey={props.setOpenRouterKey}
                                provedorAtivo={props.provedorAtivo} setProvedorAtivo={props.setProvedorAtivo}
                                modeloOpenRouter={props.modeloOpenRouter} setModeloOpenRouter={props.setModeloOpenRouter}
                                modeloLmStudio={props.modeloLmStudio} setModeloLmStudio={props.setModeloLmStudio}
                                baseUrlLmStudio={props.baseUrlLmStudio} setBaseUrlLmStudio={props.setBaseUrlLmStudio}
                                perfilLatencia={props.perfilLatencia} setPerfilLatencia={props.setPerfilLatencia}
                            />
                        )}

                        {secaoAtiva === 'personalizacao' && (
                            <SecaoPersonalizacao
                                memories={memories} addMemory={addMemory} removeMemory={removeMemory}
                                autoMemories={autoMemories} removeAutoMemory={removeAutoMemory}
                                clearAutoMemories={clearAutoMemories}
                                crossChatEnabled={crossChatEnabled} setCrossChatEnabled={setCrossChatEnabled}
                                memoryAutopilotEnabled={memoryAutopilotEnabled}
                                setMemoryAutopilotEnabled={setMemoryAutopilotEnabled}
                                assistentes={assistentes} onAbrirEditorAssistente={onAbrirEditorAssistente}
                            />
                        )}

                        {secaoAtiva === 'voz' && voiceInput && (
                            <>
                                <CabecalhoGrupo titulo="Transcrição" />
                                <div className="py-2">
                                    <VoiceSettings
                                        provider={voiceInput.provider}
                                        onProviderChange={voiceInput.setProvider}
                                        whisperModel={voiceInput.whisperConfig.modelSize}
                                        onModelChange={voiceInput.setWhisperModel}
                                        whisperBinaryPath={voiceInput.whisperBinaryPath}
                                        onBinaryPathChange={voiceInput.setWhisperBinaryPath}
                                        isWhisperReady={voiceInput.isWhisperReady}
                                        onInitialize={voiceInput.initializeWhisper}
                                        isRecording={voiceInput.isRecording}
                                        error={voiceInput.error}
                                        microfoneId={voiceInput.microfoneId}
                                        onMicrofoneChange={voiceInput.setMicrofoneId}
                                    />
                                </div>
                            </>
                        )}

                        {secaoAtiva === 'avancado' && (
                            <SecaoAvancado
                                overlayProativoConfig={props.overlayProativoConfig}
                                setOverlayProativoHabilitado={props.setOverlayProativoHabilitado}
                                setOverlayProativoNivelIntervencao={props.setOverlayProativoNivelIntervencao}
                                setOverlayProativoSonecaAte={props.setOverlayProativoSonecaAte}
                                atalhoGramatical={props.atalhoGramatical}
                                setAtalhoGramatical={props.setAtalhoGramatical}
                                atalhoScreenshot={props.atalhoScreenshot}
                                setAtalhoScreenshot={props.setAtalhoScreenshot}
                            />
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default SettingsPanel
