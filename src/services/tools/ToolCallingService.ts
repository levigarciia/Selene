/**
 * Tool Calling Service
 * 
 * Bridges AI models with the tool execution system.
 * Handles decision making, execution, and result formatting.
 */

import { toolRegistry } from './ToolRegistry'
import { toolExecutor } from './ToolExecutor'
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
        availableTools?: ToolDefinition[]
    ): Promise<AIToolCallDecision> {
        const tools = availableTools || toolRegistry.getEnabled()
        if (tools.length === 0) {
            return { shouldUseTool: false, toolCalls: [] }
        }

        // FAST HEURISTIC: Skip AI call for simple messages
        const fastDecision = this.tryFastHeuristic(userMessage, tools)
        if (fastDecision) {
            console.log('[ToolCallingService] Fast heuristic decision:', fastDecision.shouldUseTool ? 'use tool' : 'respond')
            return fastDecision
        }

        // No chat function? Return no tools
        if (!this.chatFn) {
            console.warn('[ToolCallingService] No chat function set')
            return { shouldUseTool: false, toolCalls: [] }
        }

        // Build minimal context from chat history (only last 2 messages, 100 chars each)
        const historyContext = chatHistory.length > 0
            ? chatHistory.slice(-2).map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content.substring(0, 100)}`).join('\n')
            : ''

        const prompt = this.buildDecisionPrompt(userMessage, tools, historyContext)

        try {
            const response = await this.chatFn(prompt)
            return this.parseDecisionResponse(response)
        } catch (error) {
            console.error('[ToolCallingService] Decision error:', error)
            return { shouldUseTool: false, toolCalls: [] }
        }
    }

    /**
     * Fast heuristic to decide tool usage without AI call
     * Returns null if AI call is needed
     */
    private tryFastHeuristic(userMessage: string, tools: ToolDefinition[]): AIToolCallDecision | null {
        const msg = userMessage.toLowerCase().trim()
        
        // Skip tool calling for very short messages (greetings, etc)
        if (msg.length < 10) {
            return { shouldUseTool: false, toolCalls: [] }
        }
        
        // Skip for simple greetings/acknowledgments
        const greetings = ['oi', 'olá', 'ola', 'hi', 'hello', 'obrigado', 'valeu', 'ok', 'entendi', 'bom dia', 'boa tarde', 'boa noite']
        if (greetings.some(g => msg === g || msg.startsWith(g + ' ') || msg.startsWith(g + ','))) {
            return { shouldUseTool: false, toolCalls: [] }
        }
        
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
                    return {
                        shouldUseTool: true,
                        toolCalls: [{
                            tool: webSearchTool.id,
                            arguments: { query: userMessage },
                            reasoning: 'Direct search request detected'
                        }]
                    }
                }
            }
        }
        
        // Only skip for pure text transformation tasks (no search needed)
        const textTransformPatterns = [
            /^(resuma|traduza|reescreva|corrija|formate)/i
        ]
        
        for (const pattern of textTransformPatterns) {
            if (pattern.test(msg)) {
                return { shouldUseTool: false, toolCalls: [] }
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
                          'atual', 'recent', 'hoje', 'ontem', '2024', '2025', 'preço', 'cotação', 'clima', 'tempo'],
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

        // Limitar número de ferramentas
        return relevantTools.slice(0, maxTools)
    }

    private parseDecisionResponse(response: string): AIToolCallDecision {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/)
            if (!jsonMatch) {
                console.warn('[ToolCallingService] No JSON in response')
                return { shouldUseTool: false, toolCalls: [], directResponse: response }
            }

            const parsed = JSON.parse(jsonMatch[0])

            // Support both compact format (a/t) and full format (action/tool_calls)
            const action = parsed.action || parsed.a
            const toolCalls = parsed.tool_calls || parsed.t

            if ((action === 'use_tools') && Array.isArray(toolCalls)) {
                return {
                    shouldUseTool: true,
                    toolCalls: toolCalls.map((tc: any) => ({
                        tool: tc.tool,
                        arguments: tc.arguments || tc.args || {},
                        reasoning: tc.reasoning
                    }))
                }
            }

            if (action === 'respond') {
                return {
                    shouldUseTool: false,
                    toolCalls: [],
                    directResponse: parsed.response || parsed.r
                }
            }

            // Fallback
            return { shouldUseTool: false, toolCalls: [], directResponse: response }
        } catch (error) {
            console.error('[ToolCallingService] Parse error:', error)
            return { shouldUseTool: false, toolCalls: [], directResponse: response }
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
        context?: { conversationId?: string; projectId?: string }
    ): Promise<ToolCall[]> {
        if (!decision.shouldUseTool || decision.toolCalls.length === 0) {
            return []
        }

        const results: ToolCall[] = []

        for (const tc of decision.toolCalls) {
            const ferramenta = this.resolverFerramenta(tc.tool)
            const toolId = ferramenta?.id || tc.tool
            const args = tc.arguments

            // Find query for display
            const query = (args.query as string) || (args.path as string) || tc.reasoning || toolId

            onToolStart?.(toolId, query)

            const input: ToolCallInput = {
                toolId,
                arguments: args,
                context: context ? {
                    conversationId: context.conversationId,
                    projectId: context.projectId,
                    userQuery: query
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
                const data = call.result.data as any
                
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
     * @param statusText Optional status message to show before the first card
     */
    toolCallsToCardData(calls: ToolCall[], statusText?: string): ToolCardData[] {
        return calls.map((call, index) => {
            const toolDef = toolRegistry.getById(call.input.toolId)
            const data = call.result?.data as any

            // Extract results for display
            let displayResults: ToolResultItem[] = []
            if (data?.displayResults) {
                displayResults = data.displayResults
            }

            const query = (call.input.arguments.query as string) || 
                         (call.input.arguments.path as string) || 
                         call.input.toolId

            return {
                toolId: call.input.toolId,
                toolName: toolDef?.name || call.input.toolId,
                toolIcon: toolDef?.icon || 'Plug',
                query,
                status: call.status,
                resultCount: displayResults.length || (data?.results?.length || 0),
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
            const query = firstTool.arguments.query as string || userMessage
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
