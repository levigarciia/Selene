import { useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage } from '../../../../types/chat'
import type { Conversation, WebSource } from '../types'
import type { ToolCardData } from '../../../../types/tools'
import type { Project } from '../../../../types/project'
import type { InvestigationTrace } from '../../../../services/investigate'

// Services
import { composePrompt, processUserMessageForMemory } from '../../../../services/PromptPipeline'
import { searchWeb, formatSearchResultsForAI, fetchUrlContent, generateSearchPlanWithAI } from '../../../../services/WebSearchService'
import { investigateService } from '../../../../services/investigate'
import { toolCallingService } from '../../../../services/tools/ToolCallingService'
import { toolRegistry } from '../../../../services/tools/ToolRegistry'
import { mcpToolBridge } from '../../../../services/tools/MCPToolBridge'
import {
    buildProjectContext,
    addProjectMemory,
    extractConversationMemory
} from '../../../../services/ProjectContextService'
import { obterNomeFonte } from '../utils'

interface UseSendMessageParams {
    // Conversation state
    conversations: Conversation[]
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
    activeConversationId: string | null
    setActiveConversationId: (id: string | null) => void
    messages: ChatMessage[]

    // Projects
    projects: Project[]

    // Input state
    input: string
    setInput: (value: string) => void
    pendingScreenshots: string[]
    setPendingScreenshots: React.Dispatch<React.SetStateAction<string[]>>
    pendingMessage: { text: string; screenshots: string[] } | null
    setPendingMessage: React.Dispatch<React.SetStateAction<{ text: string; screenshots: string[] } | null>>
    textareaRef: React.RefObject<HTMLTextAreaElement | null>

    // Generation state
    isGenerating: boolean
    setIsGenerating: (value: boolean) => void
    isAnalyzingImage: boolean
    setIsAnalyzingImage: (value: boolean) => void
    abortControllerRef: React.RefObject<AbortController | null>
    generationIdRef: React.RefObject<string | null>

    // Features
    webSearchEnabled: boolean
    toolCallingAtivo: boolean
    investigateMode: boolean
    setIsInvestigating: (value: boolean) => void
    setCurrentTrace: (trace: InvestigationTrace | null) => void

    // Sources/Cards
    setMessageSources: React.Dispatch<React.SetStateAction<Record<string, WebSource[]>>>
    setMessageSearchCards: React.Dispatch<React.SetStateAction<Record<string, ToolCardData[]>>>

    // Config
    systemPrompt: string
    getProfileContext: () => string
    criarOuObterServico: () => any
}

export function useSendMessage({
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    projects,
    input,
    setInput,
    pendingScreenshots,
    setPendingScreenshots,
    pendingMessage,
    setPendingMessage,
    textareaRef,
    isGenerating,
    setIsGenerating,
    isAnalyzingImage,
    setIsAnalyzingImage,
    abortControllerRef,
    generationIdRef,
    webSearchEnabled,
    toolCallingAtivo,
    investigateMode,
    setIsInvestigating,
    setCurrentTrace,
    setMessageSources,
    setMessageSearchCards,
    systemPrompt,
    getProfileContext,
    criarOuObterServico,
}: UseSendMessageParams) {

    // Helper to update conversation messages
    const updateConversationMessages = useCallback((convId: string, newMessages: ChatMessage[]) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convId) {
                const title = newMessages[0]?.content.slice(0, 30) + (newMessages[0]?.content.length > 30 ? '...' : '') || 'Nova conversa'
                return { ...c, messages: newMessages, title, updatedAt: Date.now() }
            }
            return c
        }))
    }, [setConversations])

    // Run investigation
    const runInvestigation = useCallback(async (question: string, convId: string) => {
        setIsInvestigating(true)
        setCurrentTrace(null)

        try {
            const trace = await investigateService.investigate(question)
            setCurrentTrace(trace)

            if (trace.finalAnswer) {
                const aiMsg: ChatMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: trace.finalAnswer,
                    timestamp: Date.now()
                }

                setConversations(prev => prev.map(c => {
                    if (c.id === convId) {
                        return { ...c, messages: [...c.messages, aiMsg], updatedAt: Date.now() }
                    }
                    return c
                }))
            }
        } catch (error) {
            console.error('[useSendMessage] Investigation error:', error)
        } finally {
            setIsInvestigating(false)
        }
    }, [setConversations, setIsInvestigating, setCurrentTrace])

    // Join multiple screenshots into one
    const juntarScreenshots = async (imagens: string[]) => {
        if (imagens.length === 1) return imagens[0]
        const carregadas = await Promise.all(imagens.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image()
            im.onload = () => resolve(im)
            im.onerror = (e) => reject(e)
            im.src = src
        })))
        const largura = Math.max(...carregadas.map(im => im.width))
        const altura = carregadas.reduce((acc, im) => acc + im.height, 0)
        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        let offsetY = 0
        carregadas.forEach((im) => {
            ctx.drawImage(im, 0, offsetY, im.width, im.height)
            offsetY += im.height
        })
        return canvas.toDataURL('image/png')
    }

    // Main send function
    const handleSend = useCallback(async () => {
        const hasTexto = input.trim().length > 0
        if (!hasTexto && pendingScreenshots.length === 0) return

        // If currently generating, queue the message
        if (isGenerating) {
            console.log('[useSendMessage] Queueing message for later processing')
            setPendingMessage({
                text: input.trim(),
                screenshots: [...pendingScreenshots]
            })
            setInput('')
            setPendingScreenshots([])
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
            return
        }

        const servico = criarOuObterServico()
        if (!servico) {
            console.error('[useSendMessage] No AI service available')
            return
        }

        // Create conversation if none active
        let convId = activeConversationId
        if (!convId) {
            const titulo = hasTexto ? input.trim().slice(0, 30) : 'Screenshots'
            const newConv: Conversation = {
                id: uuidv4(),
                title: titulo + (hasTexto && input.trim().length > 30 ? '...' : ''),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            setConversations(prev => [newConv, ...prev])
            setActiveConversationId(newConv.id)
            convId = newConv.id
        }

        const promptImagem = pendingScreenshots.length > 0 ? (hasTexto ? input.trim() : 'Descreva a imagem e responda em português.') : null
        const userContent = promptImagem ?? input.trim()

        const userMsg: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: userContent,
            timestamp: Date.now(),
            images: pendingScreenshots.length > 0 ? [...pendingScreenshots] : undefined
        }

        const aiMsgId = uuidv4()
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }

        const currentMessages = [...messages, userMsg, aiMsg]
        updateConversationMessages(convId, currentMessages)
        setInput('')
        setPendingScreenshots([])
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
        setIsGenerating(true)

        const currentGenerationId = aiMsgId
        ;(generationIdRef as React.MutableRefObject<string | null>).current = currentGenerationId
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = new AbortController()
        let streamedContent = ''

        const isGenerationActive = () => generationIdRef.current === currentGenerationId

        try {
            if (pendingScreenshots.length > 0 && promptImagem) {
                setIsAnalyzingImage(true)

                const imagemUnica = await juntarScreenshots(pendingScreenshots)
                if (!imagemUnica) throw new Error('Falha ao preparar imagens')

                let firstChunkReceived = false
                await servico.streamAnalisarImagem(
                    promptImagem,
                    imagemUnica,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (!firstChunkReceived) {
                            firstChunkReceived = true
                            setIsAnalyzingImage(false)
                        }

                        streamedContent += chunk
                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: streamedContent } : m
                                    )
                                }
                            }
                            return c
                        }))
                    }
                )
            } else if (investigateMode && hasTexto) {
                console.log('[useSendMessage] Starting investigation for:', userContent)

                setConversations(prev => prev.map(c => {
                    if (c.id === convId) {
                        return {
                            ...c,
                            messages: c.messages.map(m =>
                                m.id === aiMsgId ? { ...m, content: '🔍 *Iniciando investigação...*' } : m
                            )
                        }
                    }
                    return c
                }))

                await runInvestigation(userContent, convId!)

                const trace = investigateService.getCurrentTrace()
                if (trace?.finalAnswer) {
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === aiMsgId ? { ...m, content: trace.finalAnswer } : m
                                ),
                                updatedAt: Date.now()
                            }
                        }
                        return c
                    }))
                }
            } else {
                let webSearchContext = ''
                let searchSources: WebSource[] = []
                let contextoFerramentas = ''
                let cartoesFerramentas: ToolCardData[] = []

                if (webSearchEnabled) {
                    try {
                        const chatHistory = messages.map(m => ({
                            role: m.role as 'user' | 'assistant',
                            content: m.content
                        }))

                        const searchPlan = await generateSearchPlanWithAI(
                            userMsg.content,
                            chatHistory,
                            async (prompt: string) => {
                                return await servico.chat(prompt, '', [])
                            }
                        )

                        console.log('[useSendMessage] AI Search Plan:', searchPlan)

                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: searchPlan.statusMessage } : m
                                    )
                                }
                            }
                            return c
                        }))

                        setMessageSearchCards(prev => ({
                            ...prev,
                            [aiMsgId]: [{
                                toolId: 'builtin:web_search',
                                toolName: 'Busca na Web',
                                toolIcon: 'Globe',
                                query: searchPlan.query,
                                status: 'executing',
                                resultCount: 0,
                                results: []
                            }]
                        }))

                        const searchResponse = await searchWeb(searchPlan.query, 5)

                        if (searchResponse.results.length > 0) {
                            const enrichedResults = await Promise.all(
                                searchResponse.results.slice(0, 3).map(async (result) => {
                                    try {
                                        if (result.content && result.content.length > 0) {
                                            return result
                                        }
                                        const content = await fetchUrlContent(result.url, 1500)
                                        return { ...result, content }
                                    } catch {
                                        return result
                                    }
                                })
                            )
                            searchResponse.results = enrichedResults

                            webSearchContext = formatSearchResultsForAI(searchResponse)

                            const cardResults = searchResponse.results.map(r => ({
                                type: 'link' as const,
                                title: r.title,
                                content: r.snippet || '',
                                url: r.url,
                                favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.url).hostname}&sz=32`
                            }))

                            searchSources = searchResponse.results.map(r => {
                                let dominio = ''
                                try {
                                    dominio = new URL(r.url).hostname.replace('www.', '')
                                } catch {
                                    dominio = ''
                                }
                                return {
                                    url: r.url,
                                    title: r.title,
                                    favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.url).hostname}&sz=32`,
                                    resumo: r.content && r.content.length > 0 ? r.content : r.snippet,
                                    nomeFonte: obterNomeFonte(r.url, r.title),
                                    dominio
                                }
                            })

                            setMessageSearchCards(prev => ({
                                ...prev,
                                [aiMsgId]: [{
                                    toolId: 'builtin:web_search',
                                    toolName: 'Busca na Web',
                                    toolIcon: 'Globe',
                                    query: searchPlan.query,
                                    status: 'completed',
                                    resultCount: searchResponse.results.length,
                                    results: cardResults,
                                    statusText: searchPlan.statusMessage
                                }]
                            }))

                            console.log('[useSendMessage] Web search found', searchSources.length, 'sources')
                        } else {
                            setMessageSearchCards(prev => ({
                                ...prev,
                                [aiMsgId]: [{
                                    toolId: 'builtin:web_search',
                                    toolName: 'Busca na Web',
                                    toolIcon: 'Globe',
                                    query: searchPlan.query,
                                    status: 'completed',
                                    resultCount: 0,
                                    results: [],
                                    statusText: searchPlan.statusMessage
                                }]
                            }))
                        }

                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: '' } : m
                                    )
                                }
                            }
                            return c
                        }))
                    } catch (err) {
                        console.warn('[useSendMessage] Web search failed:', err)
                    }
                }

                if (toolCallingAtivo) {
                    try {
                        await mcpToolBridge.syncAllTools()
                    } catch (error) {
                        console.warn('[useSendMessage] Falha ao sincronizar MCP:', error)
                    }

                    const ferramentasDisponiveis = toolRegistry
                        .getEnabled()
                        .filter(tool => !(webSearchEnabled && tool.id === 'builtin:web_search'))

                    if (ferramentasDisponiveis.length > 0) {
                        const historicoChat = messages.map(m => ({
                            role: m.role as 'user' | 'assistant',
                            content: m.content
                        }))

                        const decisao = await toolCallingService.decideToolUsage(
                            userMsg.content,
                            historicoChat,
                            ferramentasDisponiveis
                        )

                        if (decisao.shouldUseTool && decisao.toolCalls.length > 0) {
                            const statusMessage = await toolCallingService.generateStatusMessage(
                                userMsg.content,
                                decisao.toolCalls
                            )

                            let progressContent = statusMessage || ''
                            if (progressContent) {
                                setConversations(prev => prev.map(c => {
                                    if (c.id === convId) {
                                        return {
                                            ...c,
                                            messages: c.messages.map(m =>
                                                m.id === aiMsgId ? { ...m, content: progressContent } : m
                                            )
                                        }
                                    }
                                    return c
                                }))
                            }

                            const calls = await toolCallingService.executeToolCalls(decisao)
                            contextoFerramentas = toolCallingService.formatResultsForAI(calls)
                            cartoesFerramentas = toolCallingService.toolCallsToCardData(calls, progressContent)

                            if (cartoesFerramentas.length > 0) {
                                setMessageSearchCards(prev => {
                                    const existentes = prev[aiMsgId] || []
                                    return {
                                        ...prev,
                                        [aiMsgId]: [...existentes, ...cartoesFerramentas]
                                    }
                                })

                                setConversations(prev => prev.map(c => {
                                    if (c.id === convId) {
                                        return {
                                            ...c,
                                            messages: c.messages.map(m =>
                                                m.id === aiMsgId ? { ...m, content: '' } : m
                                            )
                                        }
                                    }
                                    return c
                                }))
                            }
                        }
                    }
                }

                const { systemPrompt: composedPrompt } = await composePrompt({
                    systemPrompt,
                    userProfileContext: getProfileContext(),
                    currentConversationId: convId,
                    currentUserMessage: userMsg.content
                })

                let projectContext = ''
                const currentConv = conversations.find(c => c.id === convId)
                if (currentConv?.projectId) {
                    const project = projects.find(p => p.id === currentConv.projectId)
                    if (project && project.files.length > 0) {
                        projectContext = '\n\n' + buildProjectContext(project, userContent, project.files)
                        console.log('[useSendMessage] Injected project context from', project.files.length, 'files')
                    }
                }

                const finalPrompt = composedPrompt + webSearchContext + contextoFerramentas + projectContext

                await servico.streamChat(
                    userMsg.content,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        streamedContent += chunk
                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: streamedContent } : m
                                    )
                                }
                            }
                            return c
                        }))
                    },
                    finalPrompt,
                    messages
                )

                if (searchSources.length > 0) {
                    setMessageSources(prev => ({
                        ...prev,
                        [aiMsgId]: searchSources
                    }))
                }
            }

            processUserMessageForMemory(
                userMsg.id,
                convId,
                userMsg.content,
                userMsg.timestamp
            ).catch(err => console.warn('[useSendMessage] Memory processing failed:', err))

            const currentConv = conversations.find(c => c.id === convId)
            if (currentConv?.projectId && streamedContent) {
                const aiResponse = streamedContent
                const extractedMemories = extractConversationMemory([userMsg, {
                    id: aiMsgId,
                    role: 'assistant' as const,
                    content: aiResponse,
                    timestamp: Date.now()
                }])

                for (const memoryText of extractedMemories) {
                    addProjectMemory(currentConv.projectId, memoryText, 'extracted')
                    console.log('[useSendMessage] Added project memory:', memoryText.slice(0, 50) + '...')
                }
            }

        } catch (error: any) {
            if (!isGenerationActive()) {
                console.log('[useSendMessage] Generation was cancelled, ignoring error')
                return
            }

            if (error?.name === 'AbortError') {
                console.log('[useSendMessage] Generation stopped by user')
            } else {
                console.error('[useSendMessage] Chat error:', error)

                const errorMessage = error?.message?.toLowerCase() || ''
                const isContextOverflow =
                    errorMessage.includes('context') ||
                    errorMessage.includes('token') ||
                    errorMessage.includes('limit') ||
                    errorMessage.includes('maximum') ||
                    errorMessage.includes('too long') ||
                    error?.status === 400

                let errorContent = 'Falha ao processar mensagem. Verifique sua conexão ou chaves de API.'

                if (isContextOverflow) {
                    errorContent = '⚠️ **Limite de contexto atingido**\n\nPor favor:\n- Inicie uma nova conversa\n- Ou apague mensagens antigas manualmente\n\n_Dica: Clique em "+" para iniciar nova conversa._'
                }

                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: errorContent,
                    timestamp: Date.now()
                }
                updateConversationMessages(convId, [...messages, userMsg, errorMsg])
            }
        } finally {
            if (isGenerationActive()) {
                setIsGenerating(false)
                setIsAnalyzingImage(false)
                ;(generationIdRef as React.MutableRefObject<string | null>).current = null
            }
            ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = null
        }
    }, [
        input, pendingScreenshots, isGenerating, activeConversationId, messages,
        conversations, projects, webSearchEnabled, toolCallingAtivo, investigateMode,
        systemPrompt, getProfileContext, criarOuObterServico, updateConversationMessages,
        runInvestigation, setConversations, setActiveConversationId, setInput,
        setPendingScreenshots, setPendingMessage, setIsGenerating, setIsAnalyzingImage,
        setMessageSources, setMessageSearchCards, textareaRef, generationIdRef, abortControllerRef
    ])

    // Stop generation
    const stopGeneration = useCallback(() => {
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current?.abort()
        setIsGenerating(false)
        setPendingMessage(null)
    }, [setIsGenerating, setPendingMessage, abortControllerRef])

    // Process queued message when generation finishes
    useEffect(() => {
        if (!isGenerating && pendingMessage) {
            console.log('[useSendMessage] Processing queued message')
            const { text, screenshots } = pendingMessage
            setPendingMessage(null)

            setTimeout(() => {
                setInput(text)
                setPendingScreenshots(screenshots)
                setTimeout(() => {
                    const sendBtn = document.querySelector('[data-send-button]') as HTMLButtonElement
                    sendBtn?.click()
                }, 50)
            }, 100)
        }
    }, [isGenerating, pendingMessage, setInput, setPendingScreenshots, setPendingMessage])

    // Regenerate last response
    const regenerateLastResponse = useCallback(async () => {
        if (!activeConversationId || messages.length < 2 || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) return

        const lastUserMsgIndex = messages.map(m => m.role).lastIndexOf('user')
        if (lastUserMsgIndex === -1) return

        const messagesUpToUser = messages.slice(0, lastUserMsgIndex + 1)
        const userContent = messages[lastUserMsgIndex].content

        updateConversationMessages(activeConversationId, messagesUpToUser)
        setIsGenerating(true)

        try {
            const { systemPrompt: composedPrompt } = await composePrompt({
                systemPrompt,
                userProfileContext: getProfileContext(),
                currentConversationId: activeConversationId,
                currentUserMessage: userContent
            })

            const response = await servico.chat(userContent, composedPrompt, messagesUpToUser.slice(0, -1))
            const aiMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }
            updateConversationMessages(activeConversationId, [...messagesUpToUser, aiMsg])
        } catch (error) {
            console.error('[useSendMessage] Regenerate error:', error)
        } finally {
            setIsGenerating(false)
        }
    }, [activeConversationId, messages, isGenerating, systemPrompt, getProfileContext, criarOuObterServico, updateConversationMessages, setIsGenerating])

    return {
        handleSend,
        stopGeneration,
        regenerateLastResponse,
    }
}
