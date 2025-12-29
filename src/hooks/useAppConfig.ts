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

import { useState, useCallback, useRef, useEffect } from 'react'
import { AIService } from '../services/AIService'
import { ASSISTENTES_PADRAO } from '../utils/assistentesPadrao'
import { useVoiceInput } from './useVoiceInput'
import { useUserProfile } from './useUserProfile'

// ============================================
// Types
// ============================================

export type ProvedorAtivo = 'openai' | 'gemini' | 'openrouter' | 'lmstudio'

export interface AppConfig {
    // API Keys
    apiKey: string
    geminiKey: string
    openRouterKey: string
    
    // Provider settings
    provedorAtivo: ProvedorAtivo
    modeloOpenRouter: string
    modeloLmStudio: string
    baseUrlLmStudio: string
    
    // System prompt
    systemPrompt: string
    
    // Shortcuts
    atalhoGramatical: string
    atalhoScreenshot: string
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

// ============================================
// Storage Helpers
// ============================================

function loadString(key: string, fallback: string): string {
    try {
        return localStorage.getItem(key) || fallback
    } catch {
        return fallback
    }
}

function saveString(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
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
    
    const [provedorAtivo, setProvedorAtivoState] = useState<ProvedorAtivo>(() => 
        loadString('selene_provedor_ativo', 'openai') as ProvedorAtivo
    )
    const [modeloOpenRouter, setModeloOpenRouterState] = useState(() => 
        loadString('selene_modelo_openrouter', '')
    )
    const [modeloLmStudio, setModeloLmStudioState] = useState(() => 
        loadString('selene_modelo_lmstudio', '')
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
    // Screenshots State
    // ========================================
    
    const [pendingScreenshots, setPendingScreenshots] = useState<string[]>([])
    
    // ========================================
    // AI Service
    // ========================================
    
    const [aiService, setAiService] = useState<AIService | null>(null)
    const aiServiceRef = useRef<AIService | null>(null)
    const ultimaChaveUsadaRef = useRef<string>('')
    
    const criarOuObterServico = useCallback(() => {
        const chaveOpenAi = apiKey.trim()
        const chaveGemini = geminiKey.trim()
        const chaveOpenRouter = openRouterKey.trim()
        const urlLmStudio = baseUrlLmStudio.trim()
        const modOpenRouter = modeloOpenRouter.trim()
        const modLmStudio = modeloLmStudio.trim()

        const assinatura = [chaveOpenAi, chaveGemini, chaveOpenRouter, modOpenRouter, urlLmStudio, modLmStudio, provedorAtivo].join('|')

        if (!chaveOpenAi && !chaveGemini && !chaveOpenRouter && !urlLmStudio) {
            return null
        }

        if (!aiServiceRef.current || ultimaChaveUsadaRef.current !== assinatura) {
            const servico = new AIService({
                activeProvider: provedorAtivo,
                openai: chaveOpenAi ? { key: chaveOpenAi } : undefined,
                gemini: chaveGemini ? { key: chaveGemini } : undefined,
                openRouter: chaveOpenRouter ? { key: chaveOpenRouter, model: modOpenRouter } : undefined,
                lmStudio: urlLmStudio ? { baseUrl: urlLmStudio, model: modLmStudio } : undefined
            })
            aiServiceRef.current = servico
            setAiService(servico)
            ultimaChaveUsadaRef.current = assinatura
        }

        return aiServiceRef.current
    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLmStudio, baseUrlLmStudio, provedorAtivo])
    
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
        setOpenRouterKeyState(key)
        saveString('selene_openrouter_key', key.trim())
    }, [])
    
    const setProvedorAtivo = useCallback((provedor: ProvedorAtivo) => {
        setProvedorAtivoState(provedor)
        saveString('selene_provedor_ativo', provedor)
    }, [])
    
    const setModeloOpenRouter = useCallback((modelo: string) => {
        setModeloOpenRouterState(modelo)
        saveString('selene_modelo_openrouter', modelo)
    }, [])
    
    const setModeloLmStudio = useCallback((modelo: string) => {
        setModeloLmStudioState(modelo)
        saveString('selene_modelo_lmstudio', modelo)
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
    
    // ========================================
    // Effects: AI Service Auto-Create
    // ========================================
    
    useEffect(() => {
        const temChave = apiKey || geminiKey || openRouterKey || baseUrlLmStudio.trim()
        if (!temChave) {
            setAiService(null)
            aiServiceRef.current = null
            ultimaChaveUsadaRef.current = ''
            return
        }
        criarOuObterServico()
    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLmStudio, baseUrlLmStudio, systemPrompt, provedorAtivo, criarOuObterServico])
    
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
        modeloOpenRouter,
        modeloLmStudio,
        baseUrlLmStudio,
        systemPrompt,
        atalhoGramatical,
        atalhoScreenshot,
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
        modeloOpenRouter,
        setModeloOpenRouter,
        modeloLmStudio,
        setModeloLmStudio,
        baseUrlLmStudio,
        setBaseUrlLmStudio,
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
        setTranscription: voiceInput.setTranscription,
        toggleRecording: voiceInput.toggleRecording,
    }
}

export default useAppConfig
