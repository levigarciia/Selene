import { useState, useRef, useCallback, useEffect } from 'react'
import { AIService } from '../services/AIService'
import { ASSISTENTES_PADRAO } from '../utils/assistentesPadrao'

export function useAI() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('selene_openai_key') || '')
    const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('selene_gemini_key') || '')
    const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('selene_openrouter_key') || '')
    const [modeloOpenRouter, setModeloOpenRouter] = useState(
        () => localStorage.getItem('selene_modelo_openrouter') || ''
    )
    const [modeloLmStudio, setModeloLmStudio] = useState(() => localStorage.getItem('selene_modelo_lmstudio') || '')
    const [baseUrlLmStudio, setBaseUrlLmStudio] = useState(() => localStorage.getItem('selene_baseurl_lmstudio') || '')
    const [systemPrompt, setSystemPrompt] = useState(
        () => localStorage.getItem('selene_system_prompt') || ASSISTENTES_PADRAO[0].prompt
    )

    // Provedor ativo
    const [provedorAtivo, setProvedorAtivo] = useState<'openai' | 'gemini' | 'openrouter' | 'lmstudio'>(() => {
        return (localStorage.getItem('selene_provedor_ativo') as any) || 'openai'
    })

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

    // Persistencia
    useEffect(() => {
        localStorage.setItem('selene_openai_key', apiKey.trim())
        localStorage.setItem('selene_gemini_key', geminiKey.trim())
        localStorage.setItem('selene_openrouter_key', openRouterKey.trim())
        localStorage.setItem('selene_system_prompt', systemPrompt)
        localStorage.setItem('selene_modelo_openrouter', modeloOpenRouter)
        localStorage.setItem('selene_modelo_lmstudio', modeloLmStudio)
        localStorage.setItem('selene_baseurl_lmstudio', baseUrlLmStudio)
        localStorage.setItem('selene_provedor_ativo', provedorAtivo)

        const temChave = apiKey || geminiKey || openRouterKey || baseUrlLmStudio.trim()
        if (!temChave) {
            setAiService(null)
            aiServiceRef.current = null
            ultimaChaveUsadaRef.current = ''
            return
        }

        criarOuObterServico()
    }, [apiKey, geminiKey, openRouterKey, modeloOpenRouter, modeloLmStudio, baseUrlLmStudio, systemPrompt, provedorAtivo, criarOuObterServico])

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
