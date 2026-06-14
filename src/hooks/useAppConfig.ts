/**
 * useAppConfig Hook
 * 
 * Centralized configuration and state management shared between
 * ChatWindow, BottomToolbar, and other components.
 * 
 * This hook consolidates:
 * - API Keys and Provider settings (from useAI)
 * - User Profile and Memories (from useUserProfile)
 * - Voice Input (from useVoiceInput)
 * - Keyboard Shortcuts (from useShortcuts)
 * - Screenshots state
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { AIService } from '../services/AIService'
import { ASSISTENTES_PADRAO } from '../utils/assistentesPadrao'
import { useVoiceInput } from './useVoiceInput'
import { useUserProfile } from './useUserProfile'
import type { PerfilLatencia } from '../services/ai/types'
import type { ConfiguracaoOverlayProativo, NivelIntervencaoOverlay } from '../types/overlayProativo'
import { normalizarChaveOpenRouter } from '../utils/chavesApi'

// ============================================
// Types
// ============================================

export type ProvedorAtivo = 'openai' | 'gemini' | 'openrouter' | 'local'

export interface AppConfig {
    // API Keys
    apiKey: string
    geminiKey: string
    openRouterKey: string
    
    // Provider settings
    provedorAtivo: ProvedorAtivo
    modeloOpenRouter: string
    modeloLocal: string
    baseUrlLmStudio: string
    perfilLatencia: PerfilLatencia
    
    // System prompt
    systemPrompt: string
    
    // Shortcuts
    atalhoGramatical: string
    atalhoScreenshot: string

    // Overlay proativo
    overlayProativo: ConfiguracaoOverlayProativo
}

export interface UseAppConfigOptions {
    onTriggerGrammar?: (textoSelecionado?: string) => void
    onTriggerScreenshot?: () => void
    exibirToast?: (mensagem: string) => void
}

// ============================================
// Constants
// ============================================

const ATALHO_PADRAO = 'Control+Alt+X'
const ATALHO_SCREENSHOT_PADRAO = 'Control+Alt+S'
const OVERLAY_COOLDOWN_PADRAO_MS = 25_000
const MODELO_OPENROUTER_PADRAO = 'openrouter/auto'

function obterPerfilLatenciaPadrao(provedor: ProvedorAtivo): PerfilLatencia {
    return provedor === 'local' ? 'rapido' : 'equilibrado'
}

function loadProvedorAtivo(): ProvedorAtivo {
    const salvo = loadString('selene_provedor_ativo', 'openai')
    if (salvo === 'lmstudio') return 'local'
    if (salvo === 'gemini' || salvo === 'openrouter' || salvo === 'local') return salvo
    return 'openai'
}

// ============================================
// Storage Helpers
// ============================================

function loadString(key: string, fallback: string): string {
    try {
        const valor = localStorage.getItem(key) || fallback
        if (key === 'selene_openrouter_key') {
            return normalizarChaveOpenRouter(valor)
        }
        return valor
    } catch {
        return fallback
    }
}

function saveString(key: string, value: string): void {
    try {
        const valorNormalizado = key === 'selene_openrouter_key'
            ? normalizarChaveOpenRouter(value)
            : value
        localStorage.setItem(key, valorNormalizado)
    } catch (e) {
        console.warn(`[useAppConfig] Failed to save ${key}:`, e)
    }
}

function loadNumber(key: string, fallback: number): number {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return fallback
        const valor = Number(raw)
        return Number.isFinite(valor) ? valor : fallback
    } catch {
        return fallback
    }
}

function saveNumber(key: string, value: number): void {
    try {
        localStorage.setItem(key, String(value))
    } catch (e) {
        console.warn(`[useAppConfig] Failed to save ${key}:`, e)
    }
}

function loadNullableNumber(key: string): number | null {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const valor = Number(raw)
        return Number.isFinite(valor) ? valor : null
    } catch {
        return null
    }
}

function saveNullableNumber(key: string, value: number | null): void {
    try {
        if (value === null) {
            localStorage.removeItem(key)
            return
        }
        localStorage.setItem(key, String(value))
    } catch (e) {
        console.warn(`[useAppConfig] Failed to save ${key}:`, e)
    }
}

// ============================================
// Main Hook
// ============================================

export function useAppConfig(options: UseAppConfigOptions = {}) {
    const { onTriggerGrammar, onTriggerScreenshot, exibirToast } = options

    // ========================================
    // API Keys State
    // ========================================
    
    const [apiKey, setApiKeyState] = useState(() => 
        loadString('selene_openai_key', '')
    )
    const [geminiKey, setGeminiKeyState] = useState(() => 
        loadString('selene_gemini_key', '')
    )
    const [openRouterKey, setOpenRouterKeyState] = useState(() => 
        loadString('selene_openrouter_key', '')
    )
    
    // ========================================
    // Provider Settings State
    // ========================================
    
    const [provedorAtivo, setProvedorAtivoState] = useState<ProvedorAtivo>(() => loadProvedorAtivo())
    const [perfilLatencia, setPerfilLatenciaState] = useState<PerfilLatencia>(() => {
        const provedorInicial = loadProvedorAtivo()
        return loadString('selene_perfil_latencia', obterPerfilLatenciaPadrao(provedorInicial)) as PerfilLatencia
    })
    const [modeloOpenRouter, setModeloOpenRouterState] = useState(() => 
        loadString('selene_modelo_openrouter', '')
    )
    const [modeloLocal, setModeloLocalState] = useState(() => 
        loadString('selene_modelo_local', loadString('selene_modelo_lmstudio', 'qwen3.5-4b-q4'))
    )
    const [baseUrlLmStudio, setBaseUrlLmStudioState] = useState(() => 
        loadString('selene_baseurl_lmstudio', '')
    )
    const [systemPrompt, setSystemPromptState] = useState(() => 
        loadString('selene_system_prompt', ASSISTENTES_PADRAO[0].prompt)
    )
    
    // ========================================
    // Shortcuts State
    // ========================================
    
    const [atalhoGramatical, setAtalhoGramaticalState] = useState(() => 
        loadString('selene_atalho_gramatical', ATALHO_PADRAO)
    )
    const [atalhoScreenshot, setAtalhoScreenshotState] = useState(() => 
        loadString('selene_atalho_screenshot', ATALHO_SCREENSHOT_PADRAO)
    )

    // ========================================
    // Overlay Proativo State
    // ========================================

    const [overlayProativoHabilitado, setOverlayProativoHabilitadoState] = useState(() =>
        loadString('selene_overlay_proativo_habilitado', 'true') !== 'false'
    )
    const [overlayProativoNivelIntervencao, setOverlayProativoNivelIntervencaoState] = useState<NivelIntervencaoOverlay>(() =>
        loadString('selene_overlay_proativo_nivel', 'equilibrado') as NivelIntervencaoOverlay
    )
    const [overlayProativoSonecaAte, setOverlayProativoSonecaAteState] = useState<number | null>(() =>
        loadNullableNumber('selene_overlay_proativo_soneca_ate')
    )
    const [overlayProativoCooldownMs, setOverlayProativoCooldownMsState] = useState(() =>
        loadNumber('selene_overlay_proativo_cooldown_ms', OVERLAY_COOLDOWN_PADRAO_MS)
    )
    
    // ========================================
    // Screenshots State
    // ========================================
    
    const [pendingScreenshots, setPendingScreenshots] = useState<string[]>([])
    
    // ========================================
    // AI Service
    // ========================================
    
    const aiService = useMemo(() => {
        const chaveOpenAi = apiKey.trim()
        const chaveGemini = geminiKey.trim()
        const chaveOpenRouter = openRouterKey.trim()
        const modOpenRouter = modeloOpenRouter.trim()
        const modLocal = modeloLocal.trim()

        if (!chaveOpenAi && !chaveGemini && !chaveOpenRouter && provedorAtivo !== 'local') {
            return null
        }

        return new AIService({
            activeProvider: provedorAtivo,
            openai: chaveOpenAi ? { key: chaveOpenAi } : undefined,
            gemini: chaveGemini ? { key: chaveGemini } : undefined,
            openRouter: chaveOpenRouter ? { key: chaveOpenRouter, model: modOpenRouter } : undefined,
            local: { model: modLocal || 'qwen3.5-4b-q4' }
        })
    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLocal, provedorAtivo])

    const criarOuObterServico = useCallback(() => {
        return aiService
    }, [aiService])
    
    // ========================================
    // Setters with Persistence
    // ========================================
    
    const setApiKey = useCallback((key: string) => {
        setApiKeyState(key)
        saveString('selene_openai_key', key.trim())
    }, [])
    
    const setGeminiKey = useCallback((key: string) => {
        setGeminiKeyState(key)
        saveString('selene_gemini_key', key.trim())
    }, [])
    
    const setOpenRouterKey = useCallback((key: string) => {
        const chaveNormalizada = normalizarChaveOpenRouter(key)
        setOpenRouterKeyState(chaveNormalizada)
        saveString('selene_openrouter_key', chaveNormalizada)
    }, [])
    
    const setProvedorAtivo = useCallback((provedor: ProvedorAtivo) => {
        setProvedorAtivoState((anterior) => {
            const perfilAnteriorPadrao = obterPerfilLatenciaPadrao(anterior)
            if (perfilLatencia === perfilAnteriorPadrao) {
                const novoPerfilPadrao = obterPerfilLatenciaPadrao(provedor)
                setPerfilLatenciaState(novoPerfilPadrao)
                saveString('selene_perfil_latencia', novoPerfilPadrao)
            }
            return provedor
        })
        saveString('selene_provedor_ativo', provedor)
    }, [perfilLatencia])

    const setPerfilLatencia = useCallback((perfil: PerfilLatencia) => {
        setPerfilLatenciaState(perfil)
        saveString('selene_perfil_latencia', perfil)
    }, [])
    
    const setModeloOpenRouter = useCallback((modelo: string) => {
        setModeloOpenRouterState(modelo)
        saveString('selene_modelo_openrouter', modelo)
    }, [])
    
    const setModeloLocal = useCallback((modelo: string) => {
        setModeloLocalState(modelo)
        saveString('selene_modelo_local', modelo)
    }, [])
    
    const setBaseUrlLmStudio = useCallback((url: string) => {
        setBaseUrlLmStudioState(url)
        saveString('selene_baseurl_lmstudio', url)
    }, [])
    
    const setSystemPrompt = useCallback((prompt: string) => {
        setSystemPromptState(prompt)
        saveString('selene_system_prompt', prompt)
    }, [])
    
    const setAtalhoGramatical = useCallback((atalho: string) => {
        setAtalhoGramaticalState(atalho)
        saveString('selene_atalho_gramatical', atalho)
    }, [])
    
    const setAtalhoScreenshot = useCallback((atalho: string) => {
        setAtalhoScreenshotState(atalho)
        saveString('selene_atalho_screenshot', atalho)
    }, [])

    const setOverlayProativoHabilitado = useCallback((habilitado: boolean) => {
        setOverlayProativoHabilitadoState(habilitado)
        saveString('selene_overlay_proativo_habilitado', String(habilitado))
    }, [])

    const setOverlayProativoNivelIntervencao = useCallback((nivel: NivelIntervencaoOverlay) => {
        setOverlayProativoNivelIntervencaoState(nivel)
        saveString('selene_overlay_proativo_nivel', nivel)
    }, [])

    const setOverlayProativoSonecaAte = useCallback((timestamp: number | null) => {
        setOverlayProativoSonecaAteState(timestamp)
        saveNullableNumber('selene_overlay_proativo_soneca_ate', timestamp)
    }, [])

    const setOverlayProativoCooldownMs = useCallback((cooldownMs: number) => {
        setOverlayProativoCooldownMsState(cooldownMs)
        saveNumber('selene_overlay_proativo_cooldown_ms', cooldownMs)
    }, [])
    
    // ========================================
    // Screenshot Helpers
    // ========================================
    
    const addScreenshot = useCallback((screenshot: string) => {
        setPendingScreenshots(prev => [...prev, screenshot])
    }, [])
    
    const removeScreenshot = useCallback((index: number) => {
        setPendingScreenshots(prev => prev.filter((_, i) => i !== index))
    }, [])
    
    const clearScreenshots = useCallback(() => {
        setPendingScreenshots([])
    }, [])
    
    // ========================================
    // User Profile Hook
    // ========================================
    
    const userProfile = useUserProfile()
    
    // ========================================
    // Voice Input Hook
    // ========================================
    
    const voiceInput = useVoiceInput(aiService)

    useEffect(() => {
        const chavePersistida = localStorage.getItem('selene_openrouter_key') || ''
        const chaveNormalizada = normalizarChaveOpenRouter(chavePersistida)
        if (chavePersistida !== chaveNormalizada) {
            saveString('selene_openrouter_key', chaveNormalizada)
        }
        if (localStorage.getItem('selene_provedor_ativo') === 'lmstudio') {
            saveString('selene_provedor_ativo', 'local')
        }
    }, [])
    
    // ========================================
    // Effects: Shortcut Registration
    // ========================================
    
    useEffect(() => {
        window.electronAPI?.registrarAtalhoGramatical?.(atalhoGramatical)
    }, [atalhoGramatical])

    useEffect(() => {
        window.electronAPI?.registrarAtalhoScreenshot?.(atalhoScreenshot)
    }, [atalhoScreenshot])
    
    // ========================================
    // Effects: Shortcut Listeners
    // ========================================
    
    useEffect(() => {
        if (!onTriggerGrammar) return
        
        const removerAtalho = window.electronAPI?.onAtalhoGramatical?.((textoSelecionadoGlobal?: string) => {
            onTriggerGrammar(textoSelecionadoGlobal)
        })
        
        return () => {
            removerAtalho?.()
        }
    }, [onTriggerGrammar])
    
    useEffect(() => {
        if (!onTriggerScreenshot) return
        
        const removerAtalho = window.electronAPI?.onAtalhoScreenshot?.(() => {
            console.log('[useAppConfig] onAtalhoScreenshot recebido')
            exibirToast?.('Atalho de screenshot recebido')
            onTriggerScreenshot()
        })
        
        return () => {
            removerAtalho?.()
        }
    }, [onTriggerScreenshot, exibirToast])
    
    // ========================================
    // Config Object (read-only snapshot)
    // ========================================
    
    const config: AppConfig = {
        apiKey,
        geminiKey,
        openRouterKey,
        provedorAtivo,
        perfilLatencia,
        modeloOpenRouter,
        modeloLocal,
        baseUrlLmStudio,
        systemPrompt,
        atalhoGramatical,
        atalhoScreenshot,
        overlayProativo: {
            habilitado: overlayProativoHabilitado,
            nivelIntervencao: overlayProativoNivelIntervencao,
            sonecaAte: overlayProativoSonecaAte,
            cooldownMs: overlayProativoCooldownMs,
        },
    }
    
    // ========================================
    // Return
    // ========================================
    
    return {
        // Config snapshot
        config,
        
        // API Keys
        apiKey,
        setApiKey,
        geminiKey,
        setGeminiKey,
        openRouterKey,
        setOpenRouterKey,
        
        // Provider Settings
        provedorAtivo,
        setProvedorAtivo,
        perfilLatencia,
        setPerfilLatencia,
        modeloOpenRouter,
        setModeloOpenRouter,
        modeloLocal,
        setModeloLocal,
        modeloLmStudio: modeloLocal,
        setModeloLmStudio: setModeloLocal,
        baseUrlLmStudio,
        setBaseUrlLmStudio,
        modeloAtivo: provedorAtivo === 'local'
            ? modeloLocal || 'qwen3.5-4b-q4'
            : provedorAtivo === 'openrouter'
            ? modeloOpenRouter || MODELO_OPENROUTER_PADRAO
            : provedorAtivo === 'openai'
            ? 'gpt-4o'
            : 'gemini-2.0-flash',
        systemPrompt,
        setSystemPrompt,
        
        // AI Service
        aiService,
        criarOuObterServico,
        
        // Shortcuts
        atalhoGramatical,
        setAtalhoGramatical,
        atalhoScreenshot,
        setAtalhoScreenshot,

        // Overlay Proativo
        overlayProativoConfig: config.overlayProativo,
        setOverlayProativoHabilitado,
        setOverlayProativoNivelIntervencao,
        setOverlayProativoSonecaAte,
        setOverlayProativoCooldownMs,

        // Screenshots
        pendingScreenshots,
        setPendingScreenshots,
        addScreenshot,
        removeScreenshot,
        clearScreenshots,
        
        // User Profile (spread from useUserProfile)
        profile: userProfile.profile,
        setProfile: userProfile.setProfile,
        memories: userProfile.memories,
        addMemory: userProfile.addMemory,
        removeMemory: userProfile.removeMemory,
        getProfileContext: userProfile.getProfileContext,
        
        // Voice Input (full hook)
        voiceInput,
        
        // Voice Input shortcuts
        isRecording: voiceInput.isRecording,
        transcription: voiceInput.transcription,
        transcriptionConfirmada: voiceInput.transcriptionConfirmada,
        transcriptionParcial: voiceInput.transcriptionParcial,
        ultimaAtualizacaoTranscricaoEm: voiceInput.ultimaAtualizacaoTranscricaoEm,
        ultimaParadaGravacaoEm: voiceInput.ultimaParadaGravacaoEm,
        setTranscription: voiceInput.setTranscription,
        toggleRecording: voiceInput.toggleRecording,
    }
}

export default useAppConfig
