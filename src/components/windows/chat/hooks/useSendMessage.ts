import { useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage } from '../../../../types/chat'
import type { Conversation, WebSource } from '../types'
import type { ToolCardData } from '../../../../types/tools'
import type { Project } from '../../../../types/project'
import type { InvestigationTrace } from '../../../../services/investigate'
import type { EventoStreamIA, MetaFimStream } from '../../../../services/ai/AIProvider'

// Services
import {
    ORCAMENTO_PROMPT_PADRAO,
    aplicarOrcamentoPrompt,
    composePromptEfetivo,
    deveInjetarContextoPessoal,
    processUserMessageForMemory,
} from '../../../../services/PromptPipeline'
import {
    extractSearchQuery,
    fetchUrlContent,
    formatSearchResultsForAI,
    generateSearchPlanWithAI,
    shouldSearchWeb,
    searchWeb,
} from '../../../../services/WebSearchService'
import { investigateService } from '../../../../services/investigate'
import { toolCallingService, type EstrategiaDecisaoTool } from '../../../../services/tools/ToolCallingService'
import { toolRegistry } from '../../../../services/tools/ToolRegistry'
import { obterConfiguracaoPerfilGeracao } from '../../../../services/ai/politicaGeracao'
import {
    addProjectMemory,
    criarContextoArquivosProjeto,
    criarPromptSistemaProjeto,
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
    webQueryPlanTimeoutMs: number
    maxBuscasWebPorMensagem: number
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
    toolDecisionTimeoutMs: 0,
    estrategiaTools: 'ai_only',
    timeoutCrossChatMs: 220,
    webMaxPaginasEnriquecimento: 2,
    webFetchTimeoutMs: 2500,
    webMaxConteudoChars: 800,
    webQueryPlanTimeoutMs: 0,
    maxBuscasWebPorMensagem: 3,
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

const PROMPT_SISTEMA_INVESTIGACAO = 'Você é um assistente de pesquisa. Responda de forma objetiva e estruturada.'
const PROMPT_SISTEMA_TOOLS = 'Você é um assistente de decisão de ferramentas. Seja extremamente conciso.'

function criarPromptSistemaImagem(systemPrompt: string): string {
    return systemPrompt.trim()
}



function anexarBlocosNaMensagem(mensagem: string, blocos: string[]): string {
    const blocosValidos = blocos.map((bloco) => bloco.trim()).filter(Boolean)
    if (blocosValidos.length === 0) return mensagem
    return [
        ...blocosValidos,
        '',
        mensagem,
    ].join('\n\n')
}

function criarChatFnInvestigacao(
    servico: any,
    systemPrompt: string
): (prompt: string) => Promise<string> {
    return async (prompt: string): Promise<string> => {
        const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { investigateMode: true })
        let response = ''
        await servico.streamChat(
            prompt,
            (chunk: string) => { response += chunk },
            systemPrompt,
            [],
            {
                temperature: configGeracao.temperature,
            }
        )
        return response
    }
}

function criarChatFnFerramentas(servico: any): (prompt: string) => Promise<string> {
    return async (prompt: string): Promise<string> => {
        const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { forcarPerfil: 'pergunta_curta' })
        let response = ''
        await servico.streamChat(
            prompt,
            (chunk: string) => { response += chunk },
            PROMPT_SISTEMA_TOOLS,
            [],
            {
                temperature: configGeracao.temperature,
            }
        )
        return response
    }
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
    const runInvestigation = useCallback(async (
        question: string,
        convId: string,
        opcoes?: {
            chatFn?: (prompt: string) => Promise<string>
            historico?: Array<{ role: 'user' | 'assistant'; content: string }>
            conversationId?: string
            projectId?: string
            restaurarChatFn?: (prompt: string) => Promise<string>
        }
    ) => {
        setIsInvestigating(true)
        setCurrentTrace(null)

        if (opcoes?.chatFn) {
            investigateService.setChatFunction(opcoes.chatFn)
        }
        investigateService.setHistoricoChat(opcoes?.historico || [])
        investigateService.setContextoExecucao({
            conversationId: opcoes?.conversationId || convId,
            projectId: opcoes?.projectId,
        })

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
            if (opcoes?.restaurarChatFn) {
                investigateService.setChatFunction(opcoes.restaurarChatFn)
            }
            const servicoRestauracao = criarOuObterServico()
            if (servicoRestauracao) {
                toolCallingService.setChatFunction(criarChatFnFerramentas(servicoRestauracao))
            }
            setIsInvestigating(false)
        }
    }, [criarOuObterServico, setConversations, setIsInvestigating, setCurrentTrace])

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
        let streamedRaciocinio = ''

        const isGenerationActive = () => generationIdRef.current === currentGenerationId
        const atualizarMensagemAssistente = (conteudo: string, raciocinio: string = streamedRaciocinio) => {
            const raciocinioNormalizado = raciocinio.trim()
            setConversations(prev => prev.map(c => {
                if (c.id === convId) {
                    return {
                        ...c,
                        messages: c.messages.map(m =>
                            m.id === aiMsgId
                                ? { ...m, content: conteudo, raciocinio: raciocinioNormalizado || undefined }
                                : m
                        )
                    }
                }
                return c
            }))
        }
        const signal = (abortControllerRef as React.MutableRefObject<AbortController | null>).current?.signal
        const inicioTotal = performance.now()
        const inicioPreStream = performance.now()
        let tempoPrompt = 0
        let tempoTools = 0
        let tempoWeb = 0
        let ttft: number | null = null
        let modoMetricas: MetricasLatencia['modo'] = 'chat'
        const currentConv = conversations.find(c => c.id === convId)
        const currentProject = currentConv?.projectId
            ? projects.find(project => project.id === currentConv.projectId) || null
            : null

        try {
            if (pendingScreenshots.length > 0 && promptImagem) {
                modoMetricas = 'imagem'
                setIsAnalyzingImage(true)

                const imagemUnica = await juntarScreenshots(pendingScreenshots)
                if (!imagemUnica) throw new Error('Falha ao preparar imagens')
                const configGeracaoImagem = obterConfiguracaoPerfilGeracao(promptImagem, { ehImagem: true })
                let systemPromptOverride: string | undefined
                const promptImagemComContexto = promptImagem
                if (currentProject) {
                    const promptSistemaImagemBase = criarPromptSistemaProjeto(currentProject).promptSistemaProjeto
                    const contextoArquivosProjeto = criarContextoArquivosProjeto(currentProject, promptImagem, {
                        maxCaracteresTotais: Math.max(1200, ORCAMENTO_PROMPT_PADRAO.projetoTokens * 4),
                    }).blocoContexto
                    // Contexto dos arquivos vai no system prompt, não na mensagem do usuário
                    const partesSistema = [criarPromptSistemaImagem(promptSistemaImagemBase)]
                    if (contextoArquivosProjeto) {
                        partesSistema.push(`[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`)
                    }
                    systemPromptOverride = partesSistema.filter(Boolean).join('\n\n')
                }

                let firstChunkReceived = false
                await servico.streamAnalisarImagem(
                    promptImagemComContexto,
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
                        atualizarMensagemAssistente(streamedContent, '')
                    },
                    {
                        signal,
                        temperature: configGeracaoImagem.temperature,
                        systemPromptOverride,
                    }
                )
            } else if (investigateMode && hasTexto) {
                modoMetricas = 'investigate'
                console.log('[useSendMessage] Starting investigation for:', userContent)

                atualizarMensagemAssistente('🔍 *Iniciando investigação...*', '')
                const historicoInvestigacao = prepararHistoricoParaModelo(
                    messages,
                    politica.maxMensagensHistorico,
                    politica.maxCharsMensagemHistorico
                )
                const contextoArquivosProjeto = currentProject
                    ? criarContextoArquivosProjeto(currentProject, userContent, {
                        maxCaracteresTotais: Math.max(1200, ORCAMENTO_PROMPT_PADRAO.projetoTokens * 4),
                    }).blocoContexto
                    : ''
                // Contexto dos arquivos vai no system prompt da investigação
                const promptSistemaInvestigacaoBase = currentProject
                    ? criarPromptSistemaProjeto(currentProject).promptSistemaProjeto
                    : PROMPT_SISTEMA_INVESTIGACAO
                const promptSistemaInvestigacao = contextoArquivosProjeto
                    ? [promptSistemaInvestigacaoBase, `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`].filter(Boolean).join('\n\n')
                    : promptSistemaInvestigacaoBase
                const chatFnInvestigacao = criarChatFnInvestigacao(servico, promptSistemaInvestigacao)
                const chatFnRestauracao = criarChatFnInvestigacao(servico, PROMPT_SISTEMA_INVESTIGACAO)
                const chatFnFerramentas = criarChatFnFerramentas(servico)

                await runInvestigation(userContent, convId!, {
                    chatFn: chatFnInvestigacao,
                    historico: historicoInvestigacao,
                    conversationId: convId,
                    projectId: currentProject?.id,
                    restaurarChatFn: chatFnRestauracao,
                })
                toolCallingService.setChatFunction(chatFnFerramentas)

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
                        
                        atualizarMensagemAssistente(displayedContent, '')
                        
                        // Pequeno delay para criar efeito de streaming
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                    
                    // Garantir que a resposta final completa está lá
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === aiMsgId ? { ...m, content: fullAnswer, raciocinio: undefined } : m
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
                let houveBuscaWeb = false
                let buscaWebComResultados = false

                const tempoRestantePreStream = () => Math.max(0, politica.prestreamBudgetMs - (performance.now() - inicioPreStream))

                // Fallback legado: busca direta apenas quando o tool calling está desligado.
                // Com tool calling ativo, a IA decide se/como usar web_search.
                if (webSearchEnabled && !toolCallingAtivo) {
                    const inicioWeb = performance.now()
                    try {
                        const historicoBusca = prepararHistoricoParaModelo(
                            messages,
                            politica.maxMensagensHistorico,
                            politica.maxCharsMensagemHistorico
                        )

                        let queryBusca = extractSearchQuery(userMsg.content)
                        const usarPlanejamentoIA = true
                        let statusMessage = ''
                        if (usarPlanejamentoIA) {
                            const configPlanejamentoBusca = obterConfiguracaoPerfilGeracao(userMsg.content, { forcarPerfil: 'pergunta_curta' })
                            const searchPlan = await generateSearchPlanWithAI(
                                userMsg.content,
                                historicoBusca,
                                async (prompt: string) => await servico.chat(prompt, '', [], {
                                    signal,
                                    temperature: configPlanejamentoBusca.temperature,
                                }),
                                politica.webQueryPlanTimeoutMs
                            )
                            if (!searchPlan.planejamentoValido) {
                                queryBusca = ''
                            } else {
                                queryBusca = searchPlan.queryPrincipal || searchPlan.query || ''
                                statusMessage = (searchPlan.statusMessage || '').trim()
                            }
                        }

                        queryBusca = extractSearchQuery(queryBusca || '')
                        if (!queryBusca?.trim()) {
                            queryBusca = ''
                        }

                        if (queryBusca) {
                            houveBuscaWeb = true
                            statusMessage = statusMessage || `Vou buscar informações sobre ${truncarTexto(queryBusca, 50)}.`

                            setConversations(prev => prev.map(c => {
                                if (c.id === convId) {
                                    return {
                                        ...c,
                                        messages: c.messages.map(m =>
                                            m.id === aiMsgId ? { ...m, content: statusMessage, raciocinio: undefined } : m
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
                                buscaWebComResultados = true
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
                                            m.id === aiMsgId ? { ...m, content: '', raciocinio: undefined } : m
                                        )
                                    }
                                }
                                return c
                            }))
                        }
                    } catch (err) {
                        console.warn('[useSendMessage] Web search failed:', err)
                    } finally {
                        tempoWeb = performance.now() - inicioWeb
                    }
                }

                if (toolCallingAtivo) {
                    const inicioTools = performance.now()
                    try {
                        // No fluxo de tool calling, a IA decide se usa web_search.
                        // O toggle "Busca na Web" fica apenas para o fallback legado (sem tool calling).
                        const ferramentasDisponiveis = toolRegistry.getEnabled()

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
                                    timeoutMs: politica.toolDecisionTimeoutMs,
                                    timeoutQueryMs: politica.webQueryPlanTimeoutMs,
                                    maxBuscasWebPorMensagem: politica.maxBuscasWebPorMensagem,
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
                                                    m.id === aiMsgId ? { ...m, content: progressContent, raciocinio: undefined } : m
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
                                    { conversationId: convId!, projectId: projectIdForTools, userQuery: userMsg.content }
                                )

                                const chamadasWeb = calls.filter((call) => call.input.toolId.includes('web_search'))
                                if (chamadasWeb.length > 0) {
                                    houveBuscaWeb = true
                                    const encontrouResultadoWeb = chamadasWeb.some((call) => {
                                        const data = call.result?.data as { results?: unknown[] } | undefined
                                        return Array.isArray(data?.results) && data.results.length > 0
                                    })
                                    if (encontrouResultadoWeb) {
                                        buscaWebComResultados = true
                                    }
                                }

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
                                                    m.id === aiMsgId ? { ...m, content: '', raciocinio: undefined } : m
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
                const permitirContextoPessoal = currentProject ? false : deveInjetarContextoPessoal(userMsg.content, true)
                const { systemPrompt: composedPrompt, metadata: promptMetadata } = await composePromptEfetivo(
                    {
                        systemPrompt: promptBase,
                        userProfileContext: currentProject ? '' : getProfileContext({
                            consulta: userMsg.content,
                            permitirContextoPessoal,
                            somenteIdentidadeBasica: false,
                        }),
                        currentConversationId: convId,
                        currentProjectId: currentProject?.id,
                        currentProject,
                        currentUserMessage: userMsg.content,
                        permitirContextoPessoal,
                        permitirMemoriaPerfil: !currentProject,
                        permitirMemoriasAuto: !currentProject,
                        permitirCrossChat: !currentProject,
                    },
                    {
                        orcamento: ORCAMENTO_PROMPT_PADRAO,
                        incluirDataHora: currentProject ? false : 'auto',
                        timeoutCrossChatMs: currentProject
                            ? 0
                            : Math.min(
                                politica.timeoutCrossChatMs,
                                Math.max(80, Math.floor(tempoRestantePreStream()))
                            ),
                    }
                )
                tempoPrompt = performance.now() - inicioPrompt

                console.log('[useSendMessage] Prompt mode:', {
                    mode: promptMetadata.mode,
                    totalArquivosProjeto: promptMetadata.totalArquivosProjeto || 0,
                    trechosProjetoIncluidos: promptMetadata.trechosProjetoIncluidos || 0,
                })
                const contextoArquivosProjeto = currentProject
                    ? criarContextoArquivosProjeto(currentProject, userMsg.content, {
                        maxCaracteresTotais: Math.max(1200, ORCAMENTO_PROMPT_PADRAO.projetoTokens * 4),
                    }).blocoContexto
                    : ''
                // Contexto dos arquivos vai no system prompt; web/ferramentas ficam na msg do usuário
                const mensagemUsuarioParaModelo = currentProject
                    ? anexarBlocosNaMensagem(userMsg.content, [
                        webSearchContext,
                        contextoFerramentas,
                    ])
                    : userMsg.content

                const instrucaoRespostaCurta = (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    ? '[formato_resposta]\nResponda de forma curta e completa em português do Brasil, finalizando a última frase.'
                    : ''
                const solicitouBuscaWeb = shouldSearchWeb(userMsg.content)
                const instrucaoSemFonteConfiavel = (houveBuscaWeb && !buscaWebComResultados)
                    ? '[confiabilidade_web]\nA busca na web não retornou fontes confiáveis suficientes. Informe a incerteza de forma explícita, não invente fatos e sugira refinar a busca.'
                    : ''
                const instrucaoFalhaBuscaWeb = (solicitouBuscaWeb && !houveBuscaWeb)
                    ? '[busca_web_indisponivel]\nO usuário pediu pesquisa na web, mas a coleta não foi concluída nesta rodada. Não diga que você nunca tem internet. Informe falha temporária de busca e peça para tentar novamente.'
                    : ''

                // Arquivos do projeto como seção no system, não na mensagem do usuário
                const secaoArquivosProjeto = contextoArquivosProjeto
                    ? `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`
                    : ''

                const finalPrompt = currentProject
                    ? [composedPrompt, secaoArquivosProjeto, instrucaoRespostaCurta, instrucaoSemFonteConfiavel, instrucaoFalhaBuscaWeb].filter(Boolean).join('\n\n')
                    : [
                        composedPrompt,
                        webSearchContext,
                        contextoFerramentas,
                        instrucaoRespostaCurta,
                        instrucaoSemFonteConfiavel,
                        instrucaoFalhaBuscaWeb,
                    ].filter(Boolean).join('\n\n')

                const historicoParaModelo = prepararHistoricoParaModelo(
                    messages,
                    politica.maxMensagensHistorico,
                    politica.maxCharsMensagemHistorico
                )

                let metaFimPrincipal: MetaFimStream | null = null
                await servico.streamChat(
                    mensagemUsuarioParaModelo,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (ttft === null) {
                            ttft = performance.now() - inicioTotal
                        }

                        streamedContent += chunk
                        atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                    },
                    finalPrompt,
                    historicoParaModelo,
                    {
                        signal,
                        temperature: configGeracaoChat.temperature,
                        onEventoStream: (evento: EventoStreamIA) => {
                            if (!isGenerationActive()) return
                            if (evento.tipo !== 'raciocinio' || !evento.texto) return
                            streamedRaciocinio += evento.texto
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                        },
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
                        { role: 'user' as const, content: mensagemUsuarioParaModelo },
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
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                        },
                        finalPrompt,
                        historicoContinuacao,
                        {
                            signal,
                            temperature: configGeracaoChat.temperature,
                            onEventoStream: (evento: EventoStreamIA) => {
                                if (!isGenerationActive()) return
                                if (evento.tipo !== 'raciocinio' || !evento.texto) return
                                streamedRaciocinio += evento.texto
                                atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                            },
                            onFimStream: (meta: MetaFimStream) => {
                                metaFimContinuacao = meta
                            },
                        }
                    )

                    if (bufferContinuacao.trim()) {
                        const conteudoSemDuplicacao = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacao)
                        if (conteudoSemDuplicacao !== streamedContent) {
                            streamedContent = conteudoSemDuplicacao
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                        }
                    }

                    truncamentoPersistente =
                        ehFinishReasonLength(metaFimContinuacao) ||
                        respostaPareceTruncadaForte(bufferContinuacao || streamedContent)
                }

                if (isGenerationActive() && truncamentoPersistente) {
                    streamedContent = `${streamedContent.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
                    atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                }

                const respostaVazia = !streamedContent.trim()
                const respostaCurtaIncompleta =
                    (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    && respostaPareceIncompleta(streamedContent)

                if (isGenerationActive() && (respostaVazia || respostaCurtaIncompleta)) {
                    try {
                        const promptReparo = respostaVazia
                            ? mensagemUsuarioParaModelo
                            : `${mensagemUsuarioParaModelo}\n\nResponda novamente de forma curta e completa, sem cortar a frase final.`

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
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
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
        politica.webQueryPlanTimeoutMs, politica.maxBuscasWebPorMensagem,
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
            const currentConv = conversations.find(c => c.id === activeConversationId)
            const currentProject = currentConv?.projectId
                ? projects.find(project => project.id === currentConv.projectId) || null
                : null
            const permitirContextoPessoal = currentProject ? false : deveInjetarContextoPessoal(userContent, true)

            const { systemPrompt: composedPrompt, metadata: promptMetadata } = await composePromptEfetivo(
                {
                    systemPrompt: promptBase,
                    userProfileContext: currentProject ? '' : getProfileContext({
                        consulta: userContent,
                        permitirContextoPessoal,
                        somenteIdentidadeBasica: false,
                    }),
                    currentConversationId: activeConversationId,
                    currentProjectId: currentProject?.id,
                    currentProject,
                    currentUserMessage: userContent,
                    permitirContextoPessoal,
                    permitirMemoriaPerfil: !currentProject,
                    permitirMemoriasAuto: !currentProject,
                    permitirCrossChat: !currentProject,
                },
                {
                    orcamento: ORCAMENTO_PROMPT_PADRAO,
                    incluirDataHora: currentProject ? false : 'auto',
                    timeoutCrossChatMs: currentProject ? 0 : politica.timeoutCrossChatMs,
                }
            )

            console.log('[useSendMessage] Prompt mode regenerate:', {
                mode: promptMetadata.mode,
                totalArquivosProjeto: promptMetadata.totalArquivosProjeto || 0,
                trechosProjetoIncluidos: promptMetadata.trechosProjetoIncluidos || 0,
            })
            const contextoArquivosProjeto = currentProject
                ? criarContextoArquivosProjeto(currentProject, userContent, {
                    maxCaracteresTotais: Math.max(1200, ORCAMENTO_PROMPT_PADRAO.projetoTokens * 4),
                }).blocoContexto
                : ''
            // Contexto dos arquivos vai no system prompt, não na mensagem do usuário
            const secaoArquivosProjeto = contextoArquivosProjeto
                ? `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`
                : ''
            const mensagemUsuarioParaModelo = userContent
            const finalPromptRegen = secaoArquivosProjeto
                ? [composedPrompt, secaoArquivosProjeto].filter(Boolean).join('\n\n')
                : composedPrompt

            const historicoParaModelo = prepararHistoricoParaModelo(
                messagesUpToUser.slice(0, -1),
                politica.maxMensagensHistorico,
                politica.maxCharsMensagemHistorico
            )

            const configGeracaoRegen = obterConfiguracaoPerfilGeracao(userContent, { investigateMode })
            let response = ''
            let responseRaciocinio = ''
            let metaFimPrincipal: MetaFimStream | null = null
            await servico.streamChat(
                mensagemUsuarioParaModelo,
                (chunk: string) => { response += chunk },
                finalPromptRegen,
                historicoParaModelo,
                {
                    signal,
                    temperature: configGeracaoRegen.temperature,
                    onEventoStream: (evento: EventoStreamIA) => {
                        if (evento.tipo === 'raciocinio' && evento.texto) {
                            responseRaciocinio += evento.texto
                        }
                    },
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
                    { role: 'user' as const, content: mensagemUsuarioParaModelo },
                    {
                        role: 'assistant' as const,
                        content: truncarTexto(conteudoAntesContinuacao, 1800),
                    },
                ]

                await servico.streamChat(
                    instrucaoContinuacao,
                    (chunk: string) => { bufferContinuacao += chunk },
                    finalPromptRegen,
                    historicoContinuacao,
                    {
                        signal,
                        temperature: configGeracaoRegen.temperature,
                        onEventoStream: (evento: EventoStreamIA) => {
                            if (evento.tipo === 'raciocinio' && evento.texto) {
                                responseRaciocinio += evento.texto
                            }
                        },
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
                raciocinio: responseRaciocinio.trim() || undefined,
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
