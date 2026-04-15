/**
 * Tool Calling Service
 * 
 * Bridges AI models with the tool execution system.
 * Handles decision making, execution, and result formatting.
 */

import { toolRegistry } from './ToolRegistry'
import { toolExecutor } from './ToolExecutor'
import { extractSearchQuery, generateSearchPlanWithAI, shouldSearchWeb } from '../WebSearchService'
import type {
    ToolDefinition,
    ToolCall,
    ToolCallInput,
    AIToolCallDecision,
    AIToolCallRequest,
    ToolCardData,
    ToolResultItem
} from '../../types/tools'

type ChatFunction = (prompt: string) => Promise<string>
export type EstrategiaDecisaoTool = 'heuristic_only' | 'ai_fallback' | 'ai_first_fallback' | 'ai_only'

export interface OpcoesDecisaoTool {
    estrategiaDecisao?: EstrategiaDecisaoTool
    timeoutMs?: number
    timeoutQueryMs?: number
    maxBuscasWebPorMensagem?: number
}

class ToolCallingService {
    private chatFn: ChatFunction | null = null

    /**
     * Set the chat function to use for AI calls
     */
    setChatFunction(fn: ChatFunction): void {
        this.chatFn = fn
    }

    // ========================================================================
    // DECISION MAKING
    // ========================================================================

    /**
     * Ask AI if tools should be used for a given message
     * Now with fast heuristic mode to skip AI calls when possible
     */
    async decideToolUsage(
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        availableTools?: ToolDefinition[],
        opcoes: OpcoesDecisaoTool = {}
    ): Promise<AIToolCallDecision> {
        const estrategiaDecisao = opcoes.estrategiaDecisao || 'heuristic_only'
        const timeoutMs = opcoes.timeoutMs ?? 0
        const timeoutQueryMs = opcoes.timeoutQueryMs ?? 0
        const maxBuscasWebPorMensagem = this.normalizarMaxBuscasWeb(opcoes.maxBuscasWebPorMensagem)
        const tools = availableTools || toolRegistry.getEnabled()
        if (tools.length === 0) {
            return { shouldUseTool: false, toolCalls: [] }
        }

        const decisaoForcadaBusca = this.criarDecisaoBuscaWebExplicita(userMessage, tools)
        if (decisaoForcadaBusca) {
            console.log('[ToolCallingService] Pedido explícito de busca web detectado; forçando web_search com query planejada por IA.')
            return this.aprimorarQueryWebComIA(
                decisaoForcadaBusca,
                userMessage,
                chatHistory,
                timeoutQueryMs,
                true,
                maxBuscasWebPorMensagem
            )
        }

        if (this.devePularToolCalling(userMessage)) {
            return { shouldUseTool: false, toolCalls: [] }
        }

        if (estrategiaDecisao === 'ai_only') {
            const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
            if (!decisaoIA) {
                return { shouldUseTool: false, toolCalls: [] }
            }

            const decisaoNormalizada = this.normalizarEValidarDecisao(
                decisaoIA,
                userMessage,
                tools,
                maxBuscasWebPorMensagem,
                true
            )
            if (!decisaoNormalizada) {
                return { shouldUseTool: false, toolCalls: [] }
            }

            return this.aprimorarQueryWebComIA(
                decisaoNormalizada,
                userMessage,
                chatHistory,
                timeoutQueryMs,
                true,
                maxBuscasWebPorMensagem
            )
        }

        if (estrategiaDecisao === 'ai_first_fallback') {
            const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
            const decisaoNormalizadaIA = this.normalizarEValidarDecisao(decisaoIA, userMessage, tools, maxBuscasWebPorMensagem)
            if (decisaoNormalizadaIA?.shouldUseTool && decisaoNormalizadaIA.toolCalls.length > 0) {
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizadaIA,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    true,
                    maxBuscasWebPorMensagem
                )
            }

            // Segurança: se a IA não chamou ferramenta (ou retornou inválido), tenta heurística.
            // Isso evita alucinação em perguntas com sinais de atualidade.
            const decisaoHeuristica = this.tryFastHeuristic(userMessage, tools)
            const decisaoNormalizadaHeuristica = this.normalizarEValidarDecisao(decisaoHeuristica, userMessage, tools, maxBuscasWebPorMensagem)
            if (decisaoNormalizadaHeuristica?.shouldUseTool && decisaoNormalizadaHeuristica.toolCalls.length > 0) {
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizadaHeuristica,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    true,
                    maxBuscasWebPorMensagem
                )
            }

            if (decisaoNormalizadaIA) {
                return decisaoNormalizadaIA
            }

            return { shouldUseTool: false, toolCalls: [], directResponse: decisaoIA?.directResponse }
        }

        // FAST HEURISTIC: Skip AI call for simple messages ou decisões óbvias
        const decisaoHeuristica = this.tryFastHeuristic(userMessage, tools)
        if (decisaoHeuristica) {
            const decisaoNormalizada = this.normalizarEValidarDecisao(decisaoHeuristica, userMessage, tools, maxBuscasWebPorMensagem)
            console.log('[ToolCallingService] Fast heuristic decision:', decisaoNormalizada?.shouldUseTool ? 'use tool' : 'respond')
            if (decisaoNormalizada) {
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizada,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    true,
                    maxBuscasWebPorMensagem
                )
            }
        }
        if (estrategiaDecisao === 'heuristic_only') {
            return { shouldUseTool: false, toolCalls: [] }
        }

        const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
        if (!decisaoIA) return { shouldUseTool: false, toolCalls: [] }
        const decisaoNormalizada = this.normalizarEValidarDecisao(decisaoIA, userMessage, tools, maxBuscasWebPorMensagem)
        if (!decisaoNormalizada) return { shouldUseTool: false, toolCalls: [] }
        return this.aprimorarQueryWebComIA(
            decisaoNormalizada,
            userMessage,
            chatHistory,
            timeoutQueryMs,
            true,
            maxBuscasWebPorMensagem
        )
    }

    private async decidirComIA(
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        tools: ToolDefinition[],
        timeoutMs: number
    ): Promise<AIToolCallDecision | null> {
        if (!this.chatFn) {
            console.warn('[ToolCallingService] No chat function set')
            return null
        }

        const historyContext = chatHistory.length > 0
            ? chatHistory.slice(-2).map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content.substring(0, 100)}`).join('\n')
            : ''

        const prompt = this.buildDecisionPrompt(userMessage, tools, historyContext)

        try {
            const respostaComTimeout = this.executarComTimeout(this.chatFn(prompt), timeoutMs)
            const response = await respostaComTimeout
            return this.parseDecisionResponse(response)
        } catch (error) {
            console.warn('[ToolCallingService] Decision timeout/failure:', error)
            return null
        }
    }

    private devePularToolCalling(userMessage: string): boolean {
        const msg = userMessage.toLowerCase().trim()

        if (msg.length < 10) return true

        const saudacoes = ['oi', 'olá', 'ola', 'hi', 'hello', 'obrigado', 'valeu', 'ok', 'entendi', 'bom dia', 'boa tarde', 'boa noite']
        if (saudacoes.some((saudacao) => msg === saudacao || msg.startsWith(saudacao + ' ') || msg.startsWith(saudacao + ','))) {
            return true
        }

        return /^(resuma|traduza|reescreva|corrija|formate)/i.test(msg)
    }

    private criarDecisaoBuscaWebExplicita(userMessage: string, tools: ToolDefinition[]): AIToolCallDecision | null {
        const mensagem = (userMessage || '').toLowerCase().trim()
        if (!mensagem) return null

        const padroesExplicitos = [
            /\b(pesquis|pesquisa|busca|busque|procura|procure)\b.*\b(internet|web|google)\b/i,
            /\bna internet\b/i,
            /\bpesquisa na internet\b/i,
            /\bbusca na web\b/i,
        ]

        if (!padroesExplicitos.some((padrao) => padrao.test(mensagem))) {
            return null
        }

        const webSearchTool = tools.find((tool) => tool.id.includes('web_search'))
        if (!webSearchTool) return null

        return {
            shouldUseTool: true,
            toolCalls: [
                {
                    tool: webSearchTool.id,
                    arguments: { query: '' },
                    reasoning: 'Pedido explícito do usuário para pesquisar na web'
                }
            ]
        }
    }

    /**
     * Fast heuristic to decide tool usage without AI call
     * Returns null if AI call is needed
     */
    private tryFastHeuristic(userMessage: string, tools: ToolDefinition[]): AIToolCallDecision | null {
        const msg = userMessage.toLowerCase().trim()

        // Direct web search request
        const webSearchPatterns = [
            /^(pesquis|busc|procur).*(na web|na internet|no google)/i,
            /^(qual|quanto|quem|onde|quando).*(atual|hoje|agora|2024|2025)/i,
            /^(preço|cotação|valor).*(atual|hoje|do|da)/i
        ]
        
        const webSearchTool = tools.find(t => t.id.includes('web_search'))
        if (webSearchTool) {
            for (const pattern of webSearchPatterns) {
                if (pattern.test(msg)) {
                    const queryBusca = this.derivarQueryFinalWeb('', userMessage)
                    return {
                        shouldUseTool: true,
                        toolCalls: [{
                            tool: webSearchTool.id,
                            arguments: { query: queryBusca },
                            reasoning: 'Direct search request detected'
                        }]
                    }
                }
            }

            const sinaisAtualidade = this.detectarSinaisAtualidade(msg)
            if (sinaisAtualidade || shouldSearchWeb(userMessage)) {
                const queryBusca = this.derivarQueryFinalWeb('', userMessage)
                return {
                    shouldUseTool: true,
                    toolCalls: [{
                        tool: webSearchTool.id,
                        arguments: { query: queryBusca },
                        reasoning: 'Consulta com sinais de atualidade detectada; priorizar busca web'
                    }]
                }
            }
        }

        // If no heuristic matched, let AI decide
        return null
    }

    private buildDecisionPrompt(userMessage: string, tools: ToolDefinition[], historyContext: string): string {
        // Pré-filtrar ferramentas relevantes para economizar tokens
        const relevantTools = this.preFilterTools(userMessage, tools)
        
        if (relevantTools.length === 0) {
            // Se não há ferramentas relevantes, responder diretamente sem chamar IA
            // NOTE: This shouldn't happen often due to tryFastHeuristic
            return `{"action":"respond"}`
        }

        // Ultra-compact prompt format (~100 tokens instead of ~300)
        let prompt = `Tools:`
        relevantTools.forEach((tool, i) => {
            // Only tool name/id, max 30 char desc
            const name = tool.id.replace('builtin:', '').replace('mcp:', '')
            const shortDesc = tool.description.substring(0, 30)
            prompt += `\n${i + 1}.${name}:${shortDesc}`
        })

        prompt += `\n\nQ:"${userMessage.substring(0, 200)}"`

        // Only add context if really needed (complex query)
        if (historyContext && userMessage.length > 50) {
            prompt += `\nCtx:${historyContext.substring(0, 150)}`
        }

        prompt += `\nRule: If question depends on current events/prices/news, prefer web_search.`
        prompt += `\nRule: If using web_search, ALWAYS include arguments.query with concise search keywords in pt-BR.`

        prompt += `\n\nJSON only:
use_tools:{"a":"use_tools","t":[{"tool":"id","arguments":{}}]}
respond:{"a":"respond"}`

        return prompt
    }

    /**
     * Pré-filtra ferramentas baseado em palavras-chave da mensagem
     * Reduz drasticamente o número de tokens enviados
     */
    private preFilterTools(userMessage: string, allTools: ToolDefinition[]): ToolDefinition[] {
        const msg = userMessage.toLowerCase()
        const relevantTools: ToolDefinition[] = []
        const maxTools = 5 // Limite para evitar prompt muito grande

        // Patterns para cada tipo de ferramenta
        const patterns: { keywords: string[]; toolPatterns: string[] }[] = [
            // Web search
            {
                keywords: ['busca', 'pesquis', 'procur', 'search', 'internet', 'web', 'google', 'notícia', 'news', 
                          'atual', 'recent', 'recente', 'hoje', 'ontem', 'agora', '2024', '2025', '2026',
                          'preço', 'cotação', 'clima', 'tempo', 'acontecendo', 'aconteceu', 'ultimos dias', 'últimos dias'],
                toolPatterns: ['web_search', 'search', 'busca']
            },
            // Memory
            {
                keywords: ['lembr', 'memória', 'memory', 'salvar', 'guardar', 'preferência', 'você sabe', 'já te disse'],
                toolPatterns: ['memory', 'remember', 'store']
            },
            // File operations
            {
                keywords: ['arquivo', 'file', 'ler', 'read', 'escrever', 'write', 'pasta', 'folder', 'diretório'],
                toolPatterns: ['file', 'read', 'write', 'folder', 'filesystem']
            },
            // Code/execution
            {
                keywords: ['código', 'code', 'executar', 'run', 'python', 'javascript', 'terminal', 'comando'],
                toolPatterns: ['code', 'execute', 'run', 'terminal', 'command']
            },
            // Communications
            {
                keywords: ['discord', 'slack', 'email', 'mensagem', 'message', 'enviar', 'send', 'chat'],
                toolPatterns: ['discord', 'slack', 'email', 'message', 'send']
            },
            // Database/data
            {
                keywords: ['banco', 'database', 'sql', 'query', 'dados', 'data'],
                toolPatterns: ['database', 'sql', 'notion', 'airtable']
            }
        ]

        // Adicionar ferramentas que correspondem aos patterns
        for (const pattern of patterns) {
            const hasKeyword = pattern.keywords.some(k => msg.includes(k))
            if (hasKeyword) {
                for (const tool of allTools) {
                    const toolLower = (tool.id + ' ' + tool.name + ' ' + tool.description).toLowerCase()
                    const matches = pattern.toolPatterns.some(p => toolLower.includes(p))
                    if (matches && !relevantTools.includes(tool)) {
                        relevantTools.push(tool)
                    }
                }
            }
        }

        // Se a mensagem é uma pergunta genérica, pode precisar de web search
        if (msg.endsWith('?') && relevantTools.length === 0) {
            const webSearchTool = allTools.find(t => t.id.includes('web_search'))
            if (webSearchTool) {
                relevantTools.push(webSearchTool)
            }
        }

        if (shouldSearchWeb(userMessage)) {
            const webSearchTool = allTools.find(t => t.id.includes('web_search'))
            if (webSearchTool && !relevantTools.includes(webSearchTool)) {
                relevantTools.push(webSearchTool)
            }
        }

        // Limitar número de ferramentas
        return relevantTools.slice(0, maxTools)
    }

    private detectarSinaisAtualidade(msg: string): boolean {
        const padroesAtualidade = [
            /\b(agora|hoje|ontem|amanh[ãa]|recent(e|es)|atual|atualmente)\b/i,
            /\b(ultim[oa]s?\s+dias|esta\s+semana|esse\s+m[eê]s|nos\s+ultimos?\s+dias)\b/i,
            /\b(acontecendo|aconteceu|rolando|em andamento)\b/i,
            /\b(not[ií]cia|not[ií]cias|novidades|crise|treta|esc[âa]ndalo)\b/i,
            /\b(cota[cç][aã]o|pre[cç]o|d[oó]lar|bitcoin|ibovespa|selic|juros)\b/i
        ]

        return padroesAtualidade.some((padrao) => padrao.test(msg))
    }

    private extrairPrimeiroJsonValido(texto: string): Record<string, unknown> | null {
        const conteudo = (texto || '')
            .replace(/```json/gi, '```')
            .replace(/```/g, '')

        let inicio = -1
        let profundidade = 0
        let emString = false
        let escapando = false

        for (let i = 0; i < conteudo.length; i++) {
            const char = conteudo[i]

            if (escapando) {
                escapando = false
                continue
            }

            if (char === '\\' && emString) {
                escapando = true
                continue
            }

            if (char === '"') {
                emString = !emString
                continue
            }

            if (emString) continue

            if (char === '{') {
                if (profundidade === 0) {
                    inicio = i
                }
                profundidade++
                continue
            }

            if (char === '}' && profundidade > 0) {
                profundidade--
                if (profundidade === 0 && inicio >= 0) {
                    const candidato = conteudo.slice(inicio, i + 1)
                    try {
                        const parsed = JSON.parse(candidato) as unknown
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            return parsed as Record<string, unknown>
                        }
                    } catch {
                        // continua procurando próximo bloco JSON válido
                    }
                    inicio = -1
                }
            }
        }

        return null
    }

    private parseDecisionResponse(response: string): AIToolCallDecision | null {
        try {
            const parsed = this.extrairPrimeiroJsonValido(response)
            if (!parsed) {
                console.warn('[ToolCallingService] No JSON in response')
                return null
            }

            // Support both compact format (a/t) and full format (action/tool_calls)
            const action = parsed.action || parsed.a
            const toolCalls = parsed.tool_calls || parsed.t

            if ((action === 'use_tools') && Array.isArray(toolCalls)) {
                return {
                    shouldUseTool: true,
                    toolCalls: toolCalls
                        .filter((tc): tc is Record<string, unknown> => !!tc && typeof tc === 'object')
                        .map((tc) => ({
                            tool: String(tc.tool || ''),
                            arguments: (tc.arguments || tc.args || {}) as Record<string, unknown>,
                            reasoning: typeof tc.reasoning === 'string' ? tc.reasoning : undefined
                        }))
                        .filter((tc) => tc.tool.trim().length > 0)
                }
            }

            if (action === 'respond') {
                const respostaDireta = typeof parsed.response === 'string'
                    ? parsed.response
                    : (typeof parsed.r === 'string' ? parsed.r : undefined)
                return {
                    shouldUseTool: false,
                    toolCalls: [],
                    directResponse: respostaDireta
                }
            }

            // Fallback
            return null
        } catch (error) {
            console.error('[ToolCallingService] Parse error:', error)
            return null
        }
    }

    private async aprimorarQueryWebComIA(
        decisao: AIToolCallDecision,
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        timeoutQueryMs: number,
        usarIA: boolean,
        maxBuscasWebPorMensagem: number
    ): Promise<AIToolCallDecision> {
        if (!decisao.shouldUseTool || decisao.toolCalls.length === 0) {
            return decisao
        }

        const chamadas = decisao.toolCalls.map((call) => ({
            ...call,
            arguments: { ...call.arguments }
        }))
        const chamadasAprovadas: AIToolCallRequest[] = []

        for (const call of chamadas) {
            const ferramenta = this.resolverFerramenta(call.tool)
            if (!ferramenta) {
                chamadasAprovadas.push(call)
                continue
            }

            if (!ferramenta.id.includes('web_search')) {
                chamadasAprovadas.push(call)
                continue
            }

            const queryAtual = typeof call.arguments.queryPrincipal === 'string'
                ? call.arguments.queryPrincipal
                : (typeof call.arguments.query === 'string' ? call.arguments.query : '')

            if (usarIA) {
                if (!this.chatFn) {
                    continue
                }
                try {
                    const plano = await generateSearchPlanWithAI(
                        userMessage,
                        chatHistory,
                        this.chatFn,
                        timeoutQueryMs
                    )
                    if (!plano.planejamentoValido) {
                        continue
                    }
                    const queryPrincipal = this.derivarQueryFinalWeb(plano.queryPrincipal || plano.query, userMessage)
                    const queriesSecundarias = this.normalizarQueriesSecundarias(
                        plano.queriesSecundarias,
                        userMessage,
                        queryPrincipal,
                        maxBuscasWebPorMensagem
                    )
                    call.arguments.query = queryPrincipal
                    call.arguments.queryPrincipal = queryPrincipal
                    call.arguments.queriesSecundarias = queriesSecundarias
                    call.arguments.statusMessage = this.normalizarStatusBusca(plano.statusMessage, queryPrincipal)
                    if (plano.motivoEscalonamento) {
                        call.arguments.motivoEscalonamento = plano.motivoEscalonamento
                    }
                    chamadasAprovadas.push(call)
                    continue
                } catch (erro) {
                    console.warn('[ToolCallingService] Falha ao planejar query web com IA:', erro)
                    continue
                }
            }

            const queryPrincipal = this.derivarQueryFinalWeb(queryAtual, userMessage)
            call.arguments.query = queryPrincipal
            call.arguments.queryPrincipal = queryPrincipal
            call.arguments.queriesSecundarias = this.normalizarQueriesSecundarias(
                call.arguments.queriesSecundarias,
                userMessage,
                queryPrincipal,
                maxBuscasWebPorMensagem
            )
            call.arguments.statusMessage = this.normalizarStatusBusca(
                typeof call.arguments.statusMessage === 'string' ? call.arguments.statusMessage : '',
                queryPrincipal
            )
            chamadasAprovadas.push(call)
        }

        if (chamadasAprovadas.length === 0) {
            return {
                shouldUseTool: false,
                toolCalls: [],
                directResponse: decisao.directResponse
            }
        }

        return {
            ...decisao,
            shouldUseTool: true,
            toolCalls: chamadasAprovadas
        }
    }

    private normalizarTextoComparacao(texto: string): string {
        return (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    private normalizarEValidarDecisao(
        decisao: AIToolCallDecision | null | undefined,
        userMessage: string,
        toolsDisponiveis: ToolDefinition[],
        maxBuscasWebPorMensagem: number,
        exigirQueryIAWeb: boolean = false
    ): AIToolCallDecision | null {
        if (!decisao) return null

        if (!decisao.shouldUseTool || decisao.toolCalls.length === 0) {
            return { shouldUseTool: false, toolCalls: [], directResponse: decisao.directResponse }
        }

        const toolIdsPermitidos = new Set(toolsDisponiveis.map((tool) => tool.id))
        const chamadasNormalizadas: AIToolCallRequest[] = []

        for (const chamada of decisao.toolCalls) {
            const ferramenta = this.resolverFerramenta(chamada.tool)
            if (!ferramenta) continue
            if (!toolIdsPermitidos.has(ferramenta.id)) continue

            const argumentos = (chamada.arguments && typeof chamada.arguments === 'object')
                ? { ...chamada.arguments }
                : {}

            if (ferramenta.id.includes('web_search')) {
                const queryIA = typeof argumentos.query === 'string' ? argumentos.query : ''
                const queryPrincipalIA = typeof argumentos.queryPrincipal === 'string' ? argumentos.queryPrincipal : ''
                const queryFonte = queryIA || queryPrincipalIA

                if (exigirQueryIAWeb && !queryFonte.trim()) {
                    continue
                }

                const queryPrincipal = exigirQueryIAWeb
                    ? this.normalizarQueryWeb(queryFonte).slice(0, 100)
                    : this.derivarQueryFinalWeb(queryFonte, userMessage)

                if (!queryPrincipal) {
                    continue
                }
                argumentos.query = queryPrincipal
                argumentos.queryPrincipal = queryPrincipal
                argumentos.queriesSecundarias = this.normalizarQueriesSecundarias(
                    argumentos.queriesSecundarias,
                    userMessage,
                    queryPrincipal,
                    maxBuscasWebPorMensagem
                )
                if (typeof argumentos.statusMessage === 'string') {
                    argumentos.statusMessage = this.normalizarStatusBusca(argumentos.statusMessage, queryPrincipal)
                }
            }

            const faltandoObrigatorio = ferramenta.parameters
                .filter((parametro) => parametro.required)
                .some((parametro) => {
                    const valor = argumentos[parametro.name]
                    if (typeof valor === 'string') return !valor.trim()
                    return valor === undefined || valor === null
                })

            if (faltandoObrigatorio) continue

            chamadasNormalizadas.push({
                tool: ferramenta.id,
                arguments: argumentos,
                reasoning: chamada.reasoning
            })
        }

        if (chamadasNormalizadas.length === 0) {
            return { shouldUseTool: false, toolCalls: [], directResponse: decisao.directResponse }
        }

        return {
            shouldUseTool: true,
            toolCalls: chamadasNormalizadas
        }
    }

    // ========================================================================
    // EXECUTION
    // ========================================================================

    /**
     * Execute tool calls from an AI decision
     */
    async executeToolCalls(
        decision: AIToolCallDecision,
        onToolStart?: (toolId: string, query: string) => void,
        onToolComplete?: (call: ToolCall) => void,
        context?: { conversationId?: string; projectId?: string; userQuery?: string }
    ): Promise<ToolCall[]> {
        if (!decision.shouldUseTool || decision.toolCalls.length === 0) {
            return []
        }

        const results: ToolCall[] = []

        for (const tc of decision.toolCalls) {
            const ferramenta = this.resolverFerramenta(tc.tool)
            const toolId = ferramenta?.id || tc.tool
            const args = { ...tc.arguments }

            if (toolId.includes('web_search')) {
                const queryOriginal =
                    (typeof args.queryPrincipal === 'string' && args.queryPrincipal.trim())
                        ? String(args.queryPrincipal)
                        : (typeof args.query === 'string' && args.query.trim())
                        ? String(args.query)
                        : (context?.userQuery || '')
                const queryPrincipal = this.derivarQueryFinalWeb(queryOriginal, context?.userQuery || '')
                args.query = queryPrincipal
                args.queryPrincipal = queryPrincipal
                args.queriesSecundarias = this.normalizarQueriesSecundarias(
                    args.queriesSecundarias,
                    context?.userQuery || '',
                    queryPrincipal,
                    3
                )
                args.statusMessage = this.normalizarStatusBusca(
                    typeof args.statusMessage === 'string' ? args.statusMessage : '',
                    queryPrincipal
                )
            }

            // Find query for display
            const query = (args.query as string) || (args.path as string) || tc.reasoning || toolId

            onToolStart?.(toolId, query)

            const input: ToolCallInput = {
                toolId,
                arguments: args,
                context: context ? {
                    conversationId: context.conversationId,
                    projectId: context.projectId,
                    userQuery: context.userQuery || query
                } : undefined
            }

            const result = await toolExecutor.execute(input)
            results.push(result)

            onToolComplete?.(result)
        }

        return results
    }

    // ========================================================================
    // RESULT FORMATTING
    // ========================================================================

    /**
     * Format tool results for AI context
     */
    formatResultsForAI(calls: ToolCall[]): string {
        if (calls.length === 0) return ''

        let formatted = '\n\n---\n📌 **RESULTADOS DAS FERRAMENTAS**\n\n'

        calls.forEach((call, index) => {
            const toolDef = toolRegistry.getById(call.input.toolId)
            const toolName = toolDef?.name || call.input.toolId

            formatted += `### ${index + 1}. ${toolName}\n`

            if (call.status === 'failed') {
                formatted += `❌ Erro: ${call.result?.error || 'Falha desconhecida'}\n\n`
                return
            }

            if (call.result?.data) {
                const data = call.result.data as Record<string, unknown>
                
                // Check if it has formatted content
                if (data.formattedForAI) {
                    formatted += data.formattedForAI + '\n'
                } else if (typeof data === 'string') {
                    formatted += data + '\n'
                } else {
                    formatted += '```json\n' + JSON.stringify(data, null, 2) + '\n```\n'
                }
            }

            formatted += '\n'
        })

        return formatted
    }

    /**
     * Convert tool calls to ToolCardData for UI display
     * @param statusText Optional status message to show in the first card
     */
    toolCallsToCardData(calls: ToolCall[], statusText?: string): ToolCardData[] {
        return calls.map((call, index) => {
            const toolDef = toolRegistry.getById(call.input.toolId)
            const data = call.result?.data as Record<string, unknown> | undefined

            // Extract results for display
            let displayResults: ToolResultItem[] = []
            if (data?.displayResults) {
                displayResults = data.displayResults
            }

            const query = (call.input.arguments.queryPrincipal as string) || 
                         (call.input.arguments.query as string) || 
                         (call.input.arguments.path as string) || 
                         call.input.toolId

            return {
                toolId: call.input.toolId,
                toolName: toolDef?.name || call.input.toolId,
                toolIcon: toolDef?.icon || 'Plug',
                query,
                status: call.status,
                resultCount: displayResults.length || (Array.isArray(data?.results) ? data.results.length : 0),
                results: displayResults,
                durationMs: call.result?.metadata?.durationMs,
                error: call.result?.error,
                // Only first card gets the status text
                statusText: index === 0 ? statusText : undefined
            }
        })
    }

    // ========================================================================
    // STATUS MESSAGE GENERATION
    // ========================================================================

    /**
     * Generate a natural status message for tool usage
     */
    async generateStatusMessage(
        userMessage: string,
        toolCalls: AIToolCallRequest[]
    ): Promise<string> {
        if (toolCalls.length === 0) return ''

        // Simple heuristic-based message generation
        const firstTool = toolCalls[0]
        const toolDef = this.resolverFerramenta(firstTool.tool) || toolRegistry.getById(firstTool.tool)
        const idResolvido = toolDef?.id || firstTool.tool

        if (idResolvido.includes('web_search')) {
            const statusPlanejado = typeof firstTool.arguments.statusMessage === 'string'
                ? firstTool.arguments.statusMessage.trim()
                : ''
            if (statusPlanejado) {
                return statusPlanejado.length > 120 ? `${statusPlanejado.slice(0, 117)}...` : statusPlanejado
            }
            const queryBase = (firstTool.arguments.queryPrincipal as string) || (firstTool.arguments.query as string) || ''
            const query = this.derivarQueryFinalWeb(queryBase, userMessage)
            return `Vou buscar informações sobre ${this.summarizeQuery(query)}.`
        }

        if (idResolvido.includes('memory')) {
            return 'Deixa eu verificar o que sei sobre você...'
        }

        if (idResolvido.includes('file') || idResolvido.includes('read')) {
            const path = firstTool.arguments.path as string || 'arquivo'
            return `Vou ler o ${path.split('/').pop()}...`
        }

        if (toolDef) {
            return `Usando ${toolDef.name}...`
        }

        return 'Procurando informações...'
    }

    private summarizeQuery(query: string): string {
        // Shorten long queries
        if (query.length > 50) {
            return query.substring(0, 47) + '...'
        }
        return query
    }

    private normalizarQueryWeb(query: string): string {
        const base = (query || '').trim()
        if (!base) return ''
        const extraida = extractSearchQuery(base)
        return extraida || base
    }

    private derivarQueryFinalWeb(queryIA: string, userMessage: string): string {
        const queryIAFinal = this.normalizarQueryWeb(queryIA || '')
        if (queryIAFinal) return queryIAFinal.slice(0, 100)

        const queryExtraida = this.normalizarQueryWeb(extractSearchQuery(userMessage || ''))
        if (queryExtraida) return queryExtraida.slice(0, 100)

        return 'notícias recentes'
    }

    private normalizarQueriesSecundarias(
        queriesBrutas: unknown,
        userMessage: string,
        queryPrincipal: string,
        maxBuscasWebPorMensagem: number
    ): string[] {
        if (!Array.isArray(queriesBrutas)) return []

        const limiteSecundarias = Math.max(0, this.normalizarMaxBuscasWeb(maxBuscasWebPorMensagem) - 1)
        if (limiteSecundarias === 0) return []

        const principalNormalizada = this.normalizarTextoComparacao(queryPrincipal)

        return queriesBrutas
            .map((query) => this.derivarQueryFinalWeb(String(query || ''), userMessage))
            .filter((query) => query.length >= 3)
            .filter((query) => this.normalizarTextoComparacao(query) !== principalNormalizada)
            .filter((query, indice, lista) => lista.indexOf(query) === indice)
            .slice(0, limiteSecundarias)
    }

    private normalizarStatusBusca(statusMessage: string, queryPrincipal: string): string {
        const status = (statusMessage || '').trim()
        if (!status) {
            return `Vou buscar informações sobre ${this.summarizeQuery(queryPrincipal)}.`
        }
        return status.length > 120 ? `${status.slice(0, 117)}...` : status
    }

    private normalizarMaxBuscasWeb(maxBuscasWebPorMensagem?: number): number {
        const valor = Number(maxBuscasWebPorMensagem)
        if (!Number.isFinite(valor)) return 3
        const inteiro = Math.floor(valor)
        if (inteiro < 1) return 1
        if (inteiro > 3) return 3
        return inteiro
    }

    private async executarComTimeout<T>(promessa: Promise<T>, timeoutMs: number): Promise<T> {
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            return promessa
        }
        let timer: ReturnType<typeof setTimeout> | null = null
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Tool decision timeout (${timeoutMs}ms)`))
            }, timeoutMs)
        })

        try {
            return await Promise.race([promessa, timeout])
        } finally {
            if (timer) clearTimeout(timer)
        }
    }

    private resolverFerramenta(toolIdOuNome: string): ToolDefinition | undefined {
        const idOriginal = toolIdOuNome?.trim()
        if (!idOriginal) return undefined

        const direto = toolRegistry.getById(idOriginal)
        if (direto?.enabled) return direto

        const normalizado = idOriginal.toLowerCase()
        const ferramentas = toolRegistry.getEnabled()
        const correspondentes = ferramentas.filter((tool) => {
            const nome = tool.name?.trim().toLowerCase()
            const id = tool.id.toLowerCase()
            return id === normalizado || nome === normalizado || id.endsWith(`:${normalizado}`)
        })

        if (correspondentes.length > 1) {
            console.warn('[ToolCallingService] Ferramenta ambigua:', idOriginal, correspondentes.map(t => t.id))
        }

        return correspondentes[0]
    }
}

// Singleton instance
export const toolCallingService = new ToolCallingService()
export default toolCallingService
