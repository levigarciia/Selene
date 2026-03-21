import { useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage } from '../../../../types/chat'
import type { Conversation, WebSource } from '../types'
import type { ToolCardData } from '../../../../types/tools'
import type { Project } from '../../../../types/project'
import type { InvestigationTrace } from '../../../../services/investigate'
import type { MetaFimStream } from '../../../../services/ai/AIProvider'

// Services
import {
    ORCAMENTO_PROMPT_PADRAO,
    aplicarOrcamentoPrompt,
    composePromptComOrcamento,
    deveInjetarContextoPessoal,
    processUserMessageForMemory,
} from '../../../../services/PromptPipeline'
import {
    extractSearchQuery,
    fetchUrlContent,
    formatSearchResultsForAI,
    generateSearchPlanWithAI,
    mensagemBuscaPareceAmbigua,
    searchWeb,
} from '../../../../services/WebSearchService'
import { investigateService } from '../../../../services/investigate'
import { toolCallingService, type EstrategiaDecisaoTool } from '../../../../services/tools/ToolCallingService'
import { toolRegistry } from '../../../../services/tools/ToolRegistry'
import { obterConfiguracaoPerfilGeracao } from '../../../../services/ai/politicaGeracao'
import {
    buildProjectContext,
    addProjectMemory,
    extractConversationMemory
} from '../../../../services/ProjectContextService'
import { obterNomeFonte } from '../utils'

interface FiltroContextoPerfil {
    consulta?: string
    permitirContextoPessoal?: boolean
    somenteIdentidadeBasica?: boolean
}

interface PoliticaLatencia {
    prestreamBudgetMs: number
    maxMensagensHistorico: number
    maxCharsMensagemHistorico: number
    toolDecisionTimeoutMs: number
    estrategiaTools: EstrategiaDecisaoTool
    timeoutCrossChatMs: number
    webMaxPaginasEnriquecimento: number
    webFetchTimeoutMs: number
    webMaxConteudoChars: number
}

interface MetricasLatencia {
    tempoPreStream: number
    tempoPrompt: number
    tempoTools: number
    tempoWeb: number
    ttft: number | null
    tempoTotal: number
    timestamp: number
    conversationId: string
    modo: 'chat' | 'imagem' | 'investigate'
}

const POLITICA_LATENCIA_PADRAO: PoliticaLatencia = {
    prestreamBudgetMs: 450,
    maxMensagensHistorico: 8,
    maxCharsMensagemHistorico: 500,
    toolDecisionTimeoutMs: 600,
    estrategiaTools: 'heuristic_only',
    timeoutCrossChatMs: 220,
    webMaxPaginasEnriquecimento: 2,
    webFetchTimeoutMs: 2500,
    webMaxConteudoChars: 800,
}

const MAX_AUTO_CONTINUACOES = 2
const MAX_SOBREPOSICAO_DEDUP = 260

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
    promptBase: string
    getProfileContext: (filtro?: FiltroContextoPerfil) => string
    criarOuObterServico: () => any

    // Latency policy
    politicaLatencia?: Partial<PoliticaLatencia>
}

function mergePoliticaLatencia(politica?: Partial<PoliticaLatencia>): PoliticaLatencia {
    return {
        ...POLITICA_LATENCIA_PADRAO,
        ...politica,
    }
}

function truncarTexto(texto: string, maxChars: number): string {
    if (texto.length <= maxChars) return texto
    return texto.slice(0, maxChars).trimEnd() + '...'
}

function respostaPareceIncompleta(texto: string): boolean {
    const t = (texto || '').trim()
    if (!t) return true
    if (/[.!?…)"'\]]$/.test(t)) return false
    if (t.length < 12) return true
    return /\b(e|ou|mas|porque|que|com|para|de|do|da|no|na|seja|como|se)\s*$/i.test(t)
}

function respostaPareceTruncadaForte(texto: string): boolean {
    const t = (texto || '').trim()
    if (!t) return false
    if (!respostaPareceIncompleta(t)) return false

    const longa = t.length >= 240
    const pareceListaIncompleta = /(^|\n)(\d+\.|[-*])\s+[^\n]{0,120}$/.test(t)

    return longa || pareceListaIncompleta
}

function ehFinishReasonLength(meta: MetaFimStream | null): boolean {
    return meta?.finishReason === 'length'
}

function mesclarComDeduplicacao(base: string, adicional: string): string {
    const textoBase = base || ''
    const textoAdicional = adicional || ''
    if (!textoBase) return textoAdicional
    if (!textoAdicional) return textoBase

    const maxSobreposicao = Math.min(MAX_SOBREPOSICAO_DEDUP, textoBase.length, textoAdicional.length)

    for (let tamanho = maxSobreposicao; tamanho >= 20; tamanho--) {
        const sufixo = textoBase.slice(-tamanho).toLowerCase()
        const prefixo = textoAdicional.slice(0, tamanho).toLowerCase()
        if (sufixo === prefixo) {
            return textoBase + textoAdicional.slice(tamanho)
        }
    }

    const precisaQuebra = !textoBase.endsWith('\n') && !textoAdicional.startsWith('\n')
    return precisaQuebra ? `${textoBase}\n${textoAdicional}` : `${textoBase}${textoAdicional}`
}

function prepararHistoricoParaModelo(
    mensagens: ChatMessage[],
    maxMensagens: number,
    maxCharsPorMensagem: number
): Array<{ role: 'user' | 'assistant'; content: string }> {
    const validas = mensagens
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: truncarTexto(m.content, maxCharsPorMensagem),
        }))

    if (validas.length <= maxMensagens) {
        return validas
    }

    const antigas = validas.slice(0, validas.length - maxMensagens)
    const recentes = validas.slice(-maxMensagens)
    const resumo = antigas
        .slice(-4)
        .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${truncarTexto(m.content, 120)}`)
        .join(' | ')

    return [
        {
            role: 'assistant',
            content: truncarTexto(`Resumo do contexto anterior: ${resumo}`, maxCharsPorMensagem),
        },
        ...recentes,
    ]
}

async function executarComTimeout<T>(promessa: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return promessa.catch(() => fallback)
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs)
    })

    try {
        return await Promise.race([promessa, timeout])
    } catch {
        return fallback
    } finally {
        if (timer) clearTimeout(timer)
    }
}

function publicarMetricasLatencia(metricas: MetricasLatencia): void {
    if (typeof window === 'undefined') return

    const janelaComDebug = window as Window & { __SELENE_LATENCIA__?: MetricasLatencia[] }
    const historico = janelaComDebug.__SELENE_LATENCIA__ || []
    janelaComDebug.__SELENE_LATENCIA__ = [...historico.slice(-29), metricas]

    window.dispatchEvent(new CustomEvent('selene:metricas-latencia', { detail: metricas }))
    console.log('[Latencia]', metricas)
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
    promptBase,
    getProfileContext,
    criarOuObterServico,
    politicaLatencia,
}: UseSendMessageParams) {
    const politica = mergePoliticaLatencia(politicaLatencia)

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

    // Run investigation (message already created, just updates trace)
    const runInvestigation = useCallback(async (question: string, convId: string) => {
        setIsInvestigating(true)
        setCurrentTrace(null)

        // Subscribe to updates for real-time progress
        const unsubscribe = investigateService.subscribe((update) => {
            setCurrentTrace(update.trace)
            
            // Update the existing message with progress
            if (update.message && update.type !== 'completed') {
                setConversations(prev => prev.map(c => {
                    if (c.id === convId) {
                        const lastAiMsg = [...c.messages].reverse().find(m => m.role === 'assistant')
                        if (lastAiMsg) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === lastAiMsg.id 
                                        ? { ...m, content: `🔍 *${update.message}*` } 
                                        : m
                                )
                            }
                        }
                    }
                    return c
                }))
            }
        })

        try {
            const trace = await investigateService.investigate(question)
            setCurrentTrace(trace)
            
            // NOTE: Final answer is set by the calling code, NOT here
            // This prevents duplicate messages
            
        } catch (error) {
            console.error('[useSendMessage] Investigation error:', error)
        } finally {
            unsubscribe()
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
        const configGeracaoChat = obterConfiguracaoPerfilGeracao(userContent, { investigateMode })

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
        const signal = (abortControllerRef as React.MutableRefObject<AbortController | null>).current?.signal
        const inicioTotal = performance.now()
        const inicioPreStream = performance.now()
        let tempoPrompt = 0
        let tempoTools = 0
        let tempoWeb = 0
        let ttft: number | null = null
        let modoMetricas: MetricasLatencia['modo'] = 'chat'

        try {
            if (pendingScreenshots.length > 0 && promptImagem) {
                modoMetricas = 'imagem'
                setIsAnalyzingImage(true)

                const imagemUnica = await juntarScreenshots(pendingScreenshots)
                if (!imagemUnica) throw new Error('Falha ao preparar imagens')
                const configGeracaoImagem = obterConfiguracaoPerfilGeracao(promptImagem, { ehImagem: true })

                let firstChunkReceived = false
                await servico.streamAnalisarImagem(
                    promptImagem,
                    imagemUnica,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (!firstChunkReceived) {
                            firstChunkReceived = true
                            if (ttft === null) {
                                ttft = performance.now() - inicioTotal
                            }
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
                    },
                    {
                        signal,
                        temperature: configGeracaoImagem.temperature,
                    }
                )
            } else if (investigateMode && hasTexto) {
                modoMetricas = 'investigate'
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
                    // Simular streaming da resposta final
                    const fullAnswer = trace.finalAnswer
                    let displayedContent = ''
                    const chunkSize = 20 // caracteres por chunk
                    const delay = 15 // ms entre chunks
                    
                    for (let i = 0; i < fullAnswer.length; i += chunkSize) {
                        displayedContent = fullAnswer.slice(0, i + chunkSize)

                        if (ttft === null) {
                            ttft = performance.now() - inicioTotal
                        }
                        
                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: displayedContent } : m
                                    )
                                }
                            }
                            return c
                        }))
                        
                        // Pequeno delay para criar efeito de streaming
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                    
                    // Garantir que a resposta final completa está lá
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === aiMsgId ? { ...m, content: fullAnswer } : m
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

                const tempoRestantePreStream = () => Math.max(0, politica.prestreamBudgetMs - (performance.now() - inicioPreStream))

                if (webSearchEnabled) {
                    const inicioWeb = performance.now()
                    try {
                        const historicoBusca = prepararHistoricoParaModelo(
                            messages,
                            politica.maxMensagensHistorico,
                            politica.maxCharsMensagemHistorico
                        )

                        let queryBusca = extractSearchQuery(userMsg.content)
                        let statusMessage = `Vou buscar informações sobre ${truncarTexto(queryBusca, 50)}.`

                        const usarPlanejamentoIA = mensagemBuscaPareceAmbigua(userMsg.content) && tempoRestantePreStream() > 80
                        if (usarPlanejamentoIA) {
                            const configPlanejamentoBusca = obterConfiguracaoPerfilGeracao(userMsg.content, { forcarPerfil: 'pergunta_curta' })
                            const searchPlan = await generateSearchPlanWithAI(
                                userMsg.content,
                                historicoBusca,
                                async (prompt: string) => await servico.chat(prompt, '', [], {
                                    signal,
                                    temperature: configPlanejamentoBusca.temperature,
                                }),
                                Math.min(400, Math.max(120, Math.floor(tempoRestantePreStream())))
                            )
                            queryBusca = searchPlan.query || queryBusca
                            statusMessage = searchPlan.statusMessage || statusMessage
                        }

                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: statusMessage } : m
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
                                query: queryBusca,
                                status: 'executing',
                                resultCount: 0,
                                results: []
                            }]
                        }))

                        const searchResponse = await executarComTimeout(
                            searchWeb(queryBusca, 5),
                            1800,
                            { query: queryBusca, results: [], timestamp: Date.now() }
                        )

                        if (searchResponse.results.length > 0) {
                            const enrichedResults = await Promise.all(
                                searchResponse.results.slice(0, politica.webMaxPaginasEnriquecimento).map(async (result) => {
                                    try {
                                        if (result.content && result.content.length > 0) {
                                            return result
                                        }
                                        const content = await fetchUrlContent(
                                            result.url,
                                            politica.webMaxConteudoChars,
                                            politica.webFetchTimeoutMs
                                        )
                                        return { ...result, content }
                                    } catch {
                                        return result
                                    }
                                })
                            )
                            searchResponse.results = enrichedResults

                            const blocoWebAplicado = aplicarOrcamentoPrompt(
                                formatSearchResultsForAI(searchResponse),
                                ORCAMENTO_PROMPT_PADRAO.ferramentasWebTokens
                            )
                            webSearchContext = blocoWebAplicado.texto

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
                                    query: queryBusca,
                                    status: 'completed',
                                    resultCount: searchResponse.results.length,
                                    results: cardResults,
                                    statusText: statusMessage
                                }]
                            }))
                        } else {
                            setMessageSearchCards(prev => ({
                                ...prev,
                                [aiMsgId]: [{
                                    toolId: 'builtin:web_search',
                                    toolName: 'Busca na Web',
                                    toolIcon: 'Globe',
                                    query: queryBusca,
                                    status: 'completed',
                                    resultCount: 0,
                                    results: [],
                                    statusText: statusMessage
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
                    } finally {
                        tempoWeb = performance.now() - inicioWeb
                    }
                }

                if (toolCallingAtivo) {
                    const inicioTools = performance.now()
                    try {
                        const ferramentasDisponiveis = toolRegistry
                            .getEnabled()
                            .filter(tool => !(webSearchEnabled && tool.id === 'builtin:web_search'))

                        if (ferramentasDisponiveis.length > 0) {
                            const historicoChat = prepararHistoricoParaModelo(
                                messages,
                                politica.maxMensagensHistorico,
                                politica.maxCharsMensagemHistorico
                            )

                            const decisao = await toolCallingService.decideToolUsage(
                                userMsg.content,
                                historicoChat,
                                ferramentasDisponiveis,
                                {
                                    estrategiaDecisao: politica.estrategiaTools,
                                    timeoutMs: politica.toolDecisionTimeoutMs
                                }
                            )

                            if (decisao.shouldUseTool && decisao.toolCalls.length > 0) {
                                const statusMessage = await toolCallingService.generateStatusMessage(
                                    userMsg.content,
                                    decisao.toolCalls
                                )

                                const progressContent = statusMessage || ''
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

                                const convForContext = conversations.find(c => c.id === convId)
                                const projectIdForTools = convForContext?.projectId

                                const calls = await toolCallingService.executeToolCalls(
                                    decisao,
                                    undefined,
                                    undefined,
                                    { conversationId: convId!, projectId: projectIdForTools }
                                )

                                const blocoToolsAplicado = aplicarOrcamentoPrompt(
                                    toolCallingService.formatResultsForAI(calls),
                                    ORCAMENTO_PROMPT_PADRAO.ferramentasWebTokens
                                )
                                contextoFerramentas = blocoToolsAplicado.texto
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
                    } finally {
                        tempoTools = performance.now() - inicioTools
                    }
                }

                const inicioPrompt = performance.now()
                const currentConv = conversations.find(c => c.id === convId)
                const currentProjectId = currentConv?.projectId
                const emProjeto = Boolean(currentProjectId)
                const permitirContextoPessoal = deveInjetarContextoPessoal(userMsg.content, true)
                const contextoPerfil = getProfileContext({
                    consulta: userMsg.content,
                    permitirContextoPessoal: emProjeto ? false : permitirContextoPessoal,
                    somenteIdentidadeBasica: emProjeto,
                })

                const { systemPrompt: composedPrompt } = await composePromptComOrcamento(
                    {
                        systemPrompt: promptBase,
                        userProfileContext: contextoPerfil,
                        currentConversationId: convId,
                        currentProjectId,
                        currentUserMessage: userMsg.content,
                        permitirContextoPessoal,
                    },
                    {
                        orcamento: ORCAMENTO_PROMPT_PADRAO,
                        incluirDataHora: 'auto',
                        timeoutCrossChatMs: Math.min(
                            politica.timeoutCrossChatMs,
                            Math.max(80, Math.floor(tempoRestantePreStream()))
                        ),
                    }
                )
                tempoPrompt = performance.now() - inicioPrompt

                let projectContext = ''
                let projectInstructions = ''
                if (currentConv?.projectId) {
                    const project = projects.find(p => p.id === currentConv.projectId)
                    if (project) {
                        if (project.instructions && project.instructions.trim()) {
                            const instrucaoAplicada = aplicarOrcamentoPrompt(
                                `[instrucoes_projeto]\n${project.instructions.trim()}`,
                                Math.floor(ORCAMENTO_PROMPT_PADRAO.projetoTokens / 2)
                            )
                            projectInstructions = instrucaoAplicada.texto
                        }
                        if (project.files.length > 0) {
                            const contextoProjetoBruto = buildProjectContext(project, userContent, project.files)
                            const contextoProjetoAplicado = aplicarOrcamentoPrompt(
                                contextoProjetoBruto,
                                Math.floor(ORCAMENTO_PROMPT_PADRAO.projetoTokens / 2)
                            )
                            projectContext = contextoProjetoAplicado.texto
                        }
                    }
                }

                const instrucaoRespostaCurta = (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    ? '[formato_resposta]\nResponda de forma curta e completa em português do Brasil, finalizando a última frase.'
                    : ''

                const finalPrompt = [
                    composedPrompt,
                    projectInstructions,
                    webSearchContext,
                    contextoFerramentas,
                    projectContext,
                    instrucaoRespostaCurta,
                ].filter(Boolean).join('\n\n')

                const historicoParaModelo = prepararHistoricoParaModelo(
                    messages,
                    politica.maxMensagensHistorico,
                    politica.maxCharsMensagemHistorico
                )

                let metaFimPrincipal: MetaFimStream | null = null
                await servico.streamChat(
                    userMsg.content,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (ttft === null) {
                            ttft = performance.now() - inicioTotal
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
                    },
                    finalPrompt,
                    historicoParaModelo,
                    {
                        signal,
                        temperature: configGeracaoChat.temperature,
                        onFimStream: (meta: MetaFimStream) => {
                            metaFimPrincipal = meta
                        },
                    }
                )

                let continuacoesExecutadas = 0
                let truncamentoPersistente =
                    ehFinishReasonLength(metaFimPrincipal) ||
                    respostaPareceTruncadaForte(streamedContent)

                while (isGenerationActive() && truncamentoPersistente && continuacoesExecutadas < MAX_AUTO_CONTINUACOES) {
                    continuacoesExecutadas += 1
                    const conteudoAntesContinuacao = streamedContent
                    let bufferContinuacao = ''
                    let metaFimContinuacao: MetaFimStream | null = null

                    const instrucaoContinuacao = [
                        'Continue exatamente de onde a resposta anterior parou.',
                        'Não repita conteúdo já escrito.',
                        'Finalize a explicação com fechamento completo.',
                    ].join(' ')

                    const historicoContinuacao = [
                        ...historicoParaModelo,
                        { role: 'user' as const, content: userMsg.content },
                        {
                            role: 'assistant' as const,
                            content: truncarTexto(conteudoAntesContinuacao, 1800),
                        },
                    ]

                    await servico.streamChat(
                        instrucaoContinuacao,
                        (chunk: string) => {
                            if (!isGenerationActive()) return
                            bufferContinuacao += chunk
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
                        historicoContinuacao,
                        {
                            signal,
                            temperature: configGeracaoChat.temperature,
                            onFimStream: (meta: MetaFimStream) => {
                                metaFimContinuacao = meta
                            },
                        }
                    )

                    if (bufferContinuacao.trim()) {
                        const conteudoSemDuplicacao = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacao)
                        if (conteudoSemDuplicacao !== streamedContent) {
                            streamedContent = conteudoSemDuplicacao
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
                    }

                    truncamentoPersistente =
                        ehFinishReasonLength(metaFimContinuacao) ||
                        respostaPareceTruncadaForte(bufferContinuacao || streamedContent)
                }

                if (isGenerationActive() && truncamentoPersistente) {
                    streamedContent = `${streamedContent.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
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

                const respostaVazia = !streamedContent.trim()
                const respostaCurtaIncompleta =
                    (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    && respostaPareceIncompleta(streamedContent)

                if (isGenerationActive() && (respostaVazia || respostaCurtaIncompleta)) {
                    try {
                        const promptReparo = respostaVazia
                            ? userMsg.content
                            : `${userMsg.content}\n\nResponda novamente de forma curta e completa, sem cortar a frase final.`

                        const respostaReparo = await servico.chat(
                            promptReparo,
                            finalPrompt,
                            historicoParaModelo,
                            {
                                signal,
                                temperature: configGeracaoChat.temperature,
                            }
                        )

                        if (respostaReparo?.trim()) {
                            streamedContent = respostaReparo.trim()
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
                    } catch (erroReparo) {
                        console.warn('[useSendMessage] Falha no reparo de resposta curta:', erroReparo)
                    }
                }

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
                userMsg.timestamp,
                conversations.find(c => c.id === convId)?.projectId
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
            const tempoTotal = performance.now() - inicioTotal
            const tempoPreStream = performance.now() - inicioPreStream
            publicarMetricasLatencia({
                tempoPreStream,
                tempoPrompt,
                tempoTools,
                tempoWeb,
                ttft,
                tempoTotal,
                timestamp: Date.now(),
                conversationId: convId,
                modo: modoMetricas,
            })

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
        promptBase, getProfileContext, criarOuObterServico, updateConversationMessages,
        runInvestigation, setConversations, setActiveConversationId, setInput,
        setPendingScreenshots, setPendingMessage, setIsGenerating, setIsAnalyzingImage,
        setMessageSources, setMessageSearchCards, textareaRef, generationIdRef, abortControllerRef,
        politica.maxMensagensHistorico, politica.maxCharsMensagemHistorico, politica.prestreamBudgetMs,
        politica.timeoutCrossChatMs, politica.webMaxPaginasEnriquecimento, politica.webFetchTimeoutMs,
        politica.webMaxConteudoChars, politica.estrategiaTools, politica.toolDecisionTimeoutMs,
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
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = new AbortController()
        const signal = (abortControllerRef as React.MutableRefObject<AbortController | null>).current?.signal

        try {
            const permitirContextoPessoal = deveInjetarContextoPessoal(userContent, true)
            const currentConv = conversations.find(c => c.id === activeConversationId)
            const currentProjectId = currentConv?.projectId
            const emProjeto = Boolean(currentProjectId)
            const contextoPerfil = getProfileContext({
                consulta: userContent,
                permitirContextoPessoal: emProjeto ? false : permitirContextoPessoal,
                somenteIdentidadeBasica: emProjeto,
            })

            const { systemPrompt: composedPrompt } = await composePromptComOrcamento(
                {
                    systemPrompt: promptBase,
                    userProfileContext: contextoPerfil,
                    currentConversationId: activeConversationId,
                    currentProjectId,
                    currentUserMessage: userContent,
                    permitirContextoPessoal,
                },
                {
                    orcamento: ORCAMENTO_PROMPT_PADRAO,
                    incluirDataHora: 'auto',
                    timeoutCrossChatMs: politica.timeoutCrossChatMs,
                }
            )

            const historicoParaModelo = prepararHistoricoParaModelo(
                messagesUpToUser.slice(0, -1),
                politica.maxMensagensHistorico,
                politica.maxCharsMensagemHistorico
            )

            const configGeracaoRegen = obterConfiguracaoPerfilGeracao(userContent, { investigateMode })
            let response = ''
            let metaFimPrincipal: MetaFimStream | null = null
            await servico.streamChat(
                userContent,
                (chunk: string) => { response += chunk },
                composedPrompt,
                historicoParaModelo,
                {
                    signal,
                    temperature: configGeracaoRegen.temperature,
                    onFimStream: (meta: MetaFimStream) => {
                        metaFimPrincipal = meta
                    },
                }
            )

            let continuacoesExecutadas = 0
            let truncamentoPersistente =
                ehFinishReasonLength(metaFimPrincipal) ||
                respostaPareceTruncadaForte(response)

            while (truncamentoPersistente && continuacoesExecutadas < MAX_AUTO_CONTINUACOES) {
                continuacoesExecutadas += 1
                const conteudoAntesContinuacao = response
                let bufferContinuacao = ''
                let metaFimContinuacao: MetaFimStream | null = null

                const instrucaoContinuacao = [
                    'Continue exatamente de onde a resposta anterior parou.',
                    'Não repita conteúdo já escrito.',
                    'Finalize a explicação com fechamento completo.',
                ].join(' ')

                const historicoContinuacao = [
                    ...historicoParaModelo,
                    { role: 'user' as const, content: userContent },
                    {
                        role: 'assistant' as const,
                        content: truncarTexto(conteudoAntesContinuacao, 1800),
                    },
                ]

                await servico.streamChat(
                    instrucaoContinuacao,
                    (chunk: string) => { bufferContinuacao += chunk },
                    composedPrompt,
                    historicoContinuacao,
                    {
                        signal,
                        temperature: configGeracaoRegen.temperature,
                        onFimStream: (meta: MetaFimStream) => {
                            metaFimContinuacao = meta
                        },
                    }
                )

                response = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacao)
                truncamentoPersistente =
                    ehFinishReasonLength(metaFimContinuacao) ||
                    respostaPareceTruncadaForte(bufferContinuacao || response)
            }

            if (truncamentoPersistente) {
                response = `${response.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
            }

            const aiMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }
            updateConversationMessages(activeConversationId, [...messagesUpToUser, aiMsg])
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                console.log('[useSendMessage] Regenerate stopped by user')
                return
            }
            console.error('[useSendMessage] Regenerate error:', error)
        } finally {
            ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = null
            setIsGenerating(false)
        }
    }, [
        activeConversationId, messages, isGenerating, investigateMode, promptBase, getProfileContext,
        criarOuObterServico, updateConversationMessages, setIsGenerating, abortControllerRef,
        politica.maxMensagensHistorico, politica.maxCharsMensagemHistorico,
        politica.timeoutCrossChatMs,
    ])

    return {
        handleSend,
        stopGeneration,
        regenerateLastResponse,
    }
}
