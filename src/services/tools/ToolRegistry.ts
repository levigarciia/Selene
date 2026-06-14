/**
 * Tool Registry
 * 
 * Central registry for all available tools in Selene.
 * Handles registration, queries, and state management.
 */

import type { ToolDefinition, ToolCategory } from '../../types/tools'

type RegistryListener = () => void

class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map()
    private listeners: Set<RegistryListener> = new Set()

    // ========================================================================
    // REGISTRATION
    // ========================================================================

    /**
     * Register a new tool
     */
    register(tool: ToolDefinition): void {
        if (this.tools.has(tool.id)) {
            console.warn(`[ToolRegistry] Tool "${tool.id}" already registered, updating...`)
        }
        this.tools.set(tool.id, { ...tool })
        this.notifyListeners()
        console.log(`[ToolRegistry] Registered tool: ${tool.id}`)
    }

    /**
     * Register multiple tools at once
     */
    registerMany(tools: ToolDefinition[]): void {
        tools.forEach(tool => {
            this.tools.set(tool.id, { ...tool })
        })
        this.notifyListeners()
        console.log(`[ToolRegistry] Registered ${tools.length} tools`)
    }

    /**
     * Unregister a tool
     */
    unregister(toolId: string): boolean {
        const existed = this.tools.delete(toolId)
        if (existed) {
            this.notifyListeners()
            console.log(`[ToolRegistry] Unregistered tool: ${toolId}`)
        }
        return existed
    }

    /**
     * Unregister all tools from a specific MCP server
     */
    unregisterByMcpServer(serverId: string): number {
        let count = 0
        for (const [id, tool] of this.tools) {
            if (tool.source.type === 'mcp' && tool.source.mcpServerId === serverId) {
                this.tools.delete(id)
                count++
            }
        }
        if (count > 0) {
            this.notifyListeners()
            console.log(`[ToolRegistry] Unregistered ${count} tools from MCP server: ${serverId}`)
        }
        return count
    }

    // ========================================================================
    // QUERIES
    // ========================================================================

    /**
     * Get all registered tools
     */
    getAll(): ToolDefinition[] {
        return Array.from(this.tools.values())
    }

    /**
     * Get a tool by ID
     */
    getById(id: string): ToolDefinition | undefined {
        return this.tools.get(id)
    }

    /**
     * Get tools by category
     */
    getByCategory(category: ToolCategory): ToolDefinition[] {
        return this.getAll().filter(t => t.category === category)
    }

    /**
     * Get only enabled tools
     */
    getEnabled(): ToolDefinition[] {
        return this.getAll().filter(t => t.enabled)
    }

    /**
     * Busca ferramentas por relevância local, sem chamar IA.
     */
    searchTools(query: string, limit: number = 8, tools: ToolDefinition[] = this.getEnabled()): ToolDefinition[] {
        const consulta = this.normalizarTexto(query)
        const termos = consulta.split(' ').filter((termo) => termo.length >= 2)
        if (termos.length === 0) {
            return tools
                .filter((tool) => tool.source.type === 'builtin' && !tool.deferLoading)
                .slice(0, limit)
        }

        return tools
            .map((tool, indice) => ({
                tool,
                indice,
                score: this.pontuarFerramenta(tool, termos, consulta),
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score
                if (a.tool.source.type !== b.tool.source.type) {
                    return a.tool.source.type === 'builtin' ? -1 : 1
                }
                return a.indice - b.indice
            })
            .slice(0, limit)
            .map((item) => item.tool)
    }

    /**
     * Get all built-in tools
     */
    getBuiltIn(): ToolDefinition[] {
        return this.getAll().filter(t => t.source.type === 'builtin')
    }

    /**
     * Get all MCP tools
     */
    getMcpTools(): ToolDefinition[] {
        return this.getAll().filter(t => t.source.type === 'mcp')
    }

    /**
     * Get MCP tools from a specific server
     */
    getMcpToolsByServer(serverId: string): ToolDefinition[] {
        return this.getAll().filter(
            t => t.source.type === 'mcp' && t.source.mcpServerId === serverId
        )
    }

    /**
     * Check if a tool exists
     */
    has(toolId: string): boolean {
        return this.tools.has(toolId)
    }

    /**
     * Get count of registered tools
     */
    get count(): number {
        return this.tools.size
    }

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    /**
     * Enable or disable a tool
     */
    setEnabled(toolId: string, enabled: boolean): boolean {
        const tool = this.tools.get(toolId)
        if (tool) {
            tool.enabled = enabled
            this.notifyListeners()
            console.log(`[ToolRegistry] Tool ${toolId} ${enabled ? 'enabled' : 'disabled'}`)
            return true
        }
        return false
    }

    /**
     * Toggle a tool's enabled state
     */
    toggleEnabled(toolId: string): boolean {
        const tool = this.tools.get(toolId)
        if (tool) {
            tool.enabled = !tool.enabled
            this.notifyListeners()
            return tool.enabled
        }
        return false
    }

    // ========================================================================
    // AI PROMPT GENERATION
    // ========================================================================

    /**
     * Generate formatted tool descriptions for AI prompt
     */
    getToolsForPrompt(): string {
        const enabledTools = this.getEnabled()
        if (enabledTools.length === 0) {
            return ''
        }

        let prompt = '\n\n---\n**FERRAMENTAS DISPONÍVEIS**\n\n'
        prompt += 'Você pode usar as seguintes ferramentas quando necessário:\n\n'

        enabledTools.forEach((tool, index) => {
            prompt += `${index + 1}. **${tool.name}** (\`${tool.id}\`)\n`
            prompt += `   ${tool.description}\n`
            
            if (tool.parameters.length > 0) {
                prompt += `   Parâmetros:\n`
                tool.parameters.forEach(param => {
                    const required = param.required ? '(obrigatório)' : '(opcional)'
                    prompt += `   - \`${param.name}\`: ${param.type} ${required} - ${param.description}\n`
                })
            }
            prompt += '\n'
        })

        prompt += `Para usar uma ferramenta, responda em JSON:\n`
        prompt += '```json\n'
        prompt += '{\n'
        prompt += '  "action": "use_tools",\n'
        prompt += '  "tool_calls": [\n'
        prompt += '    { "tool": "tool_id", "arguments": { ... }, "reasoning": "Por que usar" }\n'
        prompt += '  ]\n'
        prompt += '}\n'
        prompt += '```\n\n'
        prompt += 'Se não precisar de ferramentas, responda normalmente.\n'

        return prompt
    }

    /**
     * Generate a compact list of tool names for context
     */
    getToolsList(): string {
        const enabledTools = this.getEnabled()
        if (enabledTools.length === 0) {
            return 'Nenhuma ferramenta disponível.'
        }
        return enabledTools.map(t => `${t.name} (${t.id})`).join(', ')
    }

    private pontuarFerramenta(tool: ToolDefinition, termos: string[], consulta: string): number {
        const partesParametros = tool.parameters.flatMap((parametro) => [
            parametro.name,
            parametro.description,
            parametro.type,
            ...(parametro.enum || []),
        ])
        const texto = this.normalizarTexto([
            tool.id,
            tool.name,
            tool.description,
            tool.category,
            tool.source.mcpServerId,
            tool.source.mcpServerName,
            ...partesParametros,
        ].filter(Boolean).join(' '))

        let score = 0
        for (const termo of termos) {
            if (texto.includes(termo)) score += 2
            if (tool.source.type === 'builtin' && texto.includes(termo)) score += 1
        }

        if (texto.includes(consulta)) score += 4
        if (tool.source.type === 'builtin' && !tool.deferLoading) score += 1
        if (tool.riskLevel === 'destructive') score -= 2

        return score
    }

    private normalizarTexto(texto: string): string {
        return (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s:.-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    // ========================================================================
    // REACTIVITY
    // ========================================================================

    /**
     * Subscribe to registry changes
     */
    subscribe(callback: RegistryListener): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private notifyListeners(): void {
        this.listeners.forEach(cb => {
            try {
                cb()
            } catch (err) {
                console.error('[ToolRegistry] Listener error:', err)
            }
        })
    }

    // ========================================================================
    // DEBUG
    // ========================================================================

    /**
     * Get registry stats for debugging
     */
    getStats(): {
        total: number
        enabled: number
        builtin: number
        mcp: number
        byCategory: Record<string, number>
    } {
        const all = this.getAll()
        const byCategory: Record<string, number> = {}
        
        all.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + 1
        })

        return {
            total: all.length,
            enabled: all.filter(t => t.enabled).length,
            builtin: all.filter(t => t.source.type === 'builtin').length,
            mcp: all.filter(t => t.source.type === 'mcp').length,
            byCategory
        }
    }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()
export default toolRegistry
