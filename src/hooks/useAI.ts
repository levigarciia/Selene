import { useState, useCallback, useMemo, useEffect } from 'react'
import { AIService } from '../services/AIService'
import { SELENE_BASE_PROMPT } from '../utils/personalizacao'
import { normalizarChaveOpenRouter } from '../utils/chavesApi'

export function useAI() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('selene_openai_key') || '')
    const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('selene_gemini_key') || '')
    const [openRouterKey, setOpenRouterKeyState] = useState(
        () => normalizarChaveOpenRouter(localStorage.getItem('selene_openrouter_key') || '')
    )
    const [modeloOpenRouter, setModeloOpenRouter] = useState(
        () => localStorage.getItem('selene_modelo_openrouter') || ''
    )
    const [modeloLmStudio, setModeloLmStudio] = useState(
        () => localStorage.getItem('selene_modelo_local') || localStorage.getItem('selene_modelo_lmstudio') || 'qwen3.5-4b-q4'
    )
    const [baseUrlLmStudio, setBaseUrlLmStudio] = useState(() => localStorage.getItem('selene_baseurl_lmstudio') || '')
    const [systemPrompt, setSystemPrompt] = useState(
        () => localStorage.getItem('selene_system_prompt') || SELENE_BASE_PROMPT
    )

    // Provedor ativo
    const [provedorAtivo, setProvedorAtivo] = useState<'openai' | 'gemini' | 'openrouter' | 'local'>(() => {
        const provedorSalvo = localStorage.getItem('selene_provedor_ativo')
        if (provedorSalvo === 'lmstudio') return 'local'
        return provedorSalvo === 'gemini' || provedorSalvo === 'openrouter' || provedorSalvo === 'local'
            ? provedorSalvo
            : 'openai'
    })

    const aiService = useMemo(() => {
        const chaveOpenAi = apiKey.trim()
        const chaveGemini = geminiKey.trim()
        const chaveOpenRouter = normalizarChaveOpenRouter(openRouterKey)
        const modOpenRouter = modeloOpenRouter.trim()
        const modLmStudio = modeloLmStudio.trim()

        if (!chaveOpenAi && !chaveGemini && !chaveOpenRouter && provedorAtivo !== 'local') {
            return null
        }

        return new AIService({
            activeProvider: provedorAtivo,
            openai: chaveOpenAi ? { key: chaveOpenAi } : undefined,
            gemini: chaveGemini ? { key: chaveGemini } : undefined,
            openRouter: chaveOpenRouter ? { key: chaveOpenRouter, model: modOpenRouter } : undefined,
            local: { model: modLmStudio || 'qwen3.5-4b-q4' }
        })
    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLmStudio, provedorAtivo])

    const criarOuObterServico = useCallback(() => {
        return aiService
    }, [aiService])

    const setOpenRouterKey = useCallback((valor: string) => {
        setOpenRouterKeyState(normalizarChaveOpenRouter(valor))
    }, [])

    // Persistencia
    useEffect(() => {
        localStorage.setItem('selene_openai_key', apiKey.trim())
        localStorage.setItem('selene_gemini_key', geminiKey.trim())
        localStorage.setItem('selene_openrouter_key', normalizarChaveOpenRouter(openRouterKey))
        localStorage.setItem('selene_system_prompt', systemPrompt)
        localStorage.setItem('selene_modelo_openrouter', modeloOpenRouter)
        localStorage.setItem('selene_modelo_local', modeloLmStudio)
        localStorage.setItem('selene_baseurl_lmstudio', baseUrlLmStudio)
        localStorage.setItem('selene_provedor_ativo', provedorAtivo)

    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLmStudio, baseUrlLmStudio, systemPrompt, provedorAtivo])

    return {
        apiKey, setApiKey,
        geminiKey, setGeminiKey,
        openRouterKey, setOpenRouterKey,
        modeloOpenRouter, setModeloOpenRouter,
        modeloLmStudio, setModeloLmStudio,
        baseUrlLmStudio, setBaseUrlLmStudio,
        provedorAtivo, setProvedorAtivo,
        systemPrompt, setSystemPrompt,
        aiService,
        criarOuObterServico
    }
}
