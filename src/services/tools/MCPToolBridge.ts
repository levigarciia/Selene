/**
 * MCP Tool Bridge
 * 
 * Bridges MCP server tools with the Selene tool system.
 * Syncs tools from connected MCP servers to the ToolRegistry
 * and registers handlers for them in the ToolExecutor.
 */

import { toolRegistry } from './ToolRegistry'
import { toolExecutor } from './ToolExecutor'
import type { ToolDefinition, ToolParameter, ToolCallResult } from '../../types/tools'

interface MCPTool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    serverId: string
    serverName: string
    annotations?: {
        readOnlyHint?: boolean
        destructiveHint?: boolean
        idempotentHint?: boolean
        openWorldHint?: boolean
    }
}

class MCPToolBridge {
    private syncedServers: Set<string> = new Set()

    /**
     * Sync all tools from connected MCP servers
     */
    async syncAllTools(): Promise<void> {
        try {
            const tools = await window.electronAPI?.mcp?.getAllTools()
            if (!tools || tools.length === 0) {
                console.log('[MCPToolBridge] No MCP tools available')
                return
            }

            console.log(`[MCPToolBridge] Syncing ${tools.length} MCP tools`)

            for (const tool of tools) {
                this.registerMCPTool(tool)
            }

        } catch (error) {
            console.error('[MCPToolBridge] Failed to sync tools:', error)
        }
    }

    /**
     * Sync tools from a specific MCP server
     */
    async syncServerTools(serverId: string): Promise<void> {
        try {
            const tools = await window.electronAPI?.mcp?.getTools(serverId)
            if (!tools || tools.length === 0) {
                console.log(`[MCPToolBridge] No tools from server: ${serverId}`)
                return
            }

            // Get server name from config
            const servers = await window.electronAPI?.mcp?.getServers()
            const server = servers?.find(s => s.config.id === serverId)
            const serverName = server?.config.name || serverId

            console.log(`[MCPToolBridge] Syncing ${tools.length} tools from: ${serverName}`)

            for (const tool of tools) {
                this.registerMCPTool({
                    ...tool,
                    serverId,
                    serverName
                })
            }

            this.syncedServers.add(serverId)

        } catch (error) {
            console.error(`[MCPToolBridge] Failed to sync server ${serverId}:`, error)
        }
    }

    /**
     * Remove all tools from a disconnected MCP server
     */
    removeServerTools(serverId: string): void {
        const toolsToRemove = toolRegistry.getMcpToolsByServer(serverId)
        const count = toolRegistry.unregisterByMcpServer(serverId)
        this.syncedServers.delete(serverId)
        
        // Unregister handlers
        for (const tool of toolsToRemove) {
            toolExecutor.unregisterHandler(tool.id)
        }

        console.log(`[MCPToolBridge] Removed ${count} tools from server: ${serverId}`)
    }

    /**
     * Register a single MCP tool
     */
    private registerMCPTool(tool: MCPTool): void {
        const toolId = `mcp:${tool.serverId}:${tool.name}`

        // Convert JSON Schema to ToolParameters
        const parameters = this.convertSchemaToParameters(tool.inputSchema)

        // Create tool definition
        const definition: ToolDefinition = {
            id: toolId,
            name: tool.name,
            description: tool.description || `MCP tool from ${tool.serverName}`,
            category: 'mcp',
            source: {
                type: 'mcp',
                mcpServerId: tool.serverId,
                mcpServerName: tool.serverName
            },
            parameters,
            enabled: true,
            icon: 'Plug',
            ...this.inferirMetadadosMCP(tool)
        }

        // Register in registry
        toolRegistry.register(definition)

        // Register handler
        this.registerMCPHandler(toolId, tool.serverId, tool.name)
    }

    /**
     * Register handler for MCP tool
     */
    private registerMCPHandler(toolId: string, serverId: string, toolName: string): void {
        const handler = async (args: Record<string, unknown>): Promise<ToolCallResult> => {
            try {
                console.log(`[MCPToolBridge] Calling MCP tool: ${toolName}`, args)

                const result = await window.electronAPI?.mcp?.callTool(serverId, toolName, args)

                if (!result) {
                    return {
                        success: false,
                        error: 'No response from MCP server'
                    }
                }

                if (!result.success) {
                    return {
                        success: false,
                        error: result.error || 'MCP tool call failed'
                    }
                }

                return {
                    success: true,
                    data: result.result
                }

            } catch (error: unknown) {
                console.error(`[MCPToolBridge] Tool ${toolName} error:`, error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error calling MCP tool'
                }
            }
        }

        toolExecutor.registerHandler(toolId, handler)
    }

    /**
     * Convert JSON Schema to ToolParameter[]
     */
    private convertSchemaToParameters(schema: Record<string, unknown>): ToolParameter[] {
        const parameters: ToolParameter[] = []

        if (!schema || typeof schema !== 'object') {
            return parameters
        }

        const properties = (schema.properties || {}) as Record<string, { type?: string | string[]; description?: string; default?: unknown }>
        const required = (schema.required || []) as string[]

        for (const [name, prop] of Object.entries(properties)) {
            parameters.push({
                name,
                type: this.mapSchemaType(prop.type),
                description: prop.description || '',
                required: required.includes(name),
                default: prop.default
            })
        }

        return parameters
    }

    /**
     * Map JSON Schema types to ToolParameter types
     */
    private mapSchemaType(type: string | string[] | undefined): 'string' | 'number' | 'boolean' | 'array' | 'object' {
        if (Array.isArray(type)) {
            type = type[0]
        }

        switch (type) {
            case 'string': return 'string'
            case 'number':
            case 'integer': return 'number'
            case 'boolean': return 'boolean'
            case 'array': return 'array'
            case 'object': return 'object'
            default: return 'string'
        }
    }

    private inferirMetadadosMCP(tool: MCPTool): Pick<ToolDefinition, 'readOnly' | 'supportsParallel' | 'deferLoading' | 'riskLevel'> {
        const texto = `${tool.name} ${tool.description}`.toLowerCase()
        const readOnlyHint = tool.annotations?.readOnlyHint === true
        const destructiveHint = tool.annotations?.destructiveHint === true
        const pareceDestrutiva = /\b(delete|remove|destroy|drop|truncate|excluir|deletar|remover|apagar)\b/i.test(texto)
        const pareceEscrita = /\b(write|create|update|edit|patch|send|post|put|upload|insert|criar|editar|enviar|salvar|gravar)\b/i.test(texto)
        const readOnly = readOnlyHint || (!destructiveHint && !pareceDestrutiva && !pareceEscrita)

        return {
            readOnly,
            supportsParallel: readOnly,
            deferLoading: true,
            riskLevel: destructiveHint || pareceDestrutiva ? 'destructive' : readOnly ? 'read' : 'write',
        }
    }

    /**
     * Check if a server's tools are synced
     */
    isServerSynced(serverId: string): boolean {
        return this.syncedServers.has(serverId)
    }

    /**
     * Get stats
     */
    getStats(): { syncedServers: number; mcpToolsCount: number } {
        return {
            syncedServers: this.syncedServers.size,
            mcpToolsCount: toolRegistry.getMcpTools().length
        }
    }
}

// Singleton instance
export const mcpToolBridge = new MCPToolBridge()
export default mcpToolBridge
