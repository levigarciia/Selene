/**
 * MCP Service
 * 
 * Manages connections to MCP (Model Context Protocol) servers.
 * Runs in the main Electron process.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ============================================================================
// TYPES
// ============================================================================

export interface MCPServerConfig {
    id: string
    name: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    headers?: Record<string, string>
    transport?: 'stdio' | 'streamable-http'
    url?: string
    enabled: boolean
    autoConnect?: boolean
}

export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MCPTool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    annotations?: {
        readOnlyHint?: boolean
        destructiveHint?: boolean
        idempotentHint?: boolean
        openWorldHint?: boolean
    }
}

interface MCPServerState {
    config: MCPServerConfig
    status: MCPServerStatus
    error?: string
    tools: MCPTool[]
    process?: ChildProcess
    connectedAt?: number
    requestId: number
    pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>
}

interface JsonRpcRequest {
    jsonrpc: '2.0'
    id: number
    method: string
    params?: unknown
}

interface JsonRpcResponse {
    jsonrpc: '2.0'
    id: number
    result?: unknown
    error?: { code: number; message: string; data?: unknown }
}

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

// ============================================================================
// MCP SERVICE
// ============================================================================

class MCPService extends EventEmitter {
    private servers: Map<string, MCPServerState> = new Map()
    private configPath: string

    constructor() {
        super()
        this.configPath = path.join(app.getPath('userData'), 'mcp-servers.json')
    }

    // ========================================================================
    // CONFIG MANAGEMENT
    // ========================================================================

    async loadConfig(): Promise<MCPServerConfig[]> {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8')
                return JSON.parse(data) as MCPServerConfig[]
            }
        } catch (error) {
            console.error('[MCP] Failed to load config:', error)
        }
        return []
    }

    async saveConfig(configs: MCPServerConfig[]): Promise<void> {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2))
            console.log('[MCP] Config saved')
        } catch (error) {
            console.error('[MCP] Failed to save config:', error)
        }
    }

    async addServer(config: MCPServerConfig): Promise<void> {
        const configs = await this.loadConfig()
        const existing = configs.findIndex(c => c.id === config.id)
        if (existing >= 0) {
            configs[existing] = config
        } else {
            configs.push(config)
        }
        await this.saveConfig(configs)
        
        // Initialize state
        this.servers.set(config.id, {
            config,
            status: 'disconnected',
            tools: [],
            requestId: 0,
            pendingRequests: new Map()
        })

        this.emit('server-added', config)
    }

    private obterTransporte(config: MCPServerConfig): 'stdio' | 'streamable-http' {
        return config.transport || 'stdio'
    }

    async removeServer(serverId: string): Promise<void> {
        await this.disconnect(serverId)
        this.servers.delete(serverId)
        
        const configs = await this.loadConfig()
        const filtered = configs.filter(c => c.id !== serverId)
        await this.saveConfig(filtered)
        
        this.emit('server-removed', serverId)
    }

    // ========================================================================
    // CONNECTION MANAGEMENT
    // ========================================================================

    async connect(serverId: string): Promise<void> {
        const state = this.servers.get(serverId)
        if (!state) {
            throw new Error(`Server ${serverId} not found`)
        }

        const transporte = this.obterTransporte(state.config)
        if (state.status === 'connected' || state.status === 'connecting') {
            return
        }

        console.log(`[MCP] Connecting to ${state.config.name}...`)
        state.status = 'connecting'
        this.emit('status-changed', serverId, 'connecting')

        try {
            if (transporte !== 'stdio') {
                await this.conectarRemoto(state)
                return
            }

            if (!state.config.command) {
                throw new Error('Comando nao configurado')
            }

            // Preparar argumentos e ambiente
            const env = { ...process.env, ...state.config.env }

            const ehContainer = state.config.command.toLowerCase() === 'docker' || state.config.command.toLowerCase() === 'podman'
            const baseArgs = state.config.args || []
            const envArgs = ehContainer && state.config.env
                ? Object.entries(state.config.env).flatMap(([chave, valor]) => ['-e', `${chave}=${valor}`])
                : []

            let finalArgs: string[] = []
            if (ehContainer && envArgs.length > 0) {
                let envInserido = false
                for (let i = 0; i < baseArgs.length; i++) {
                    const arg = baseArgs[i]
                    // Inserir antes da primeira entrada que não seja flag nem "run" (a imagem normalmente)
                    if (!envInserido && i > 0 && !arg.startsWith('-') && arg !== 'run') {
                        finalArgs.push(...envArgs)
                        envInserido = true
                    }
                    finalArgs.push(arg)
                }
                if (!envInserido) {
                    finalArgs = [...baseArgs, ...envArgs]
                }
            } else {
                finalArgs = [...baseArgs, ...envArgs]
            }

            // Spawn the MCP server process
            const proc = spawn(state.config.command, finalArgs, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            })

            state.process = proc
            let buffer = ''

            // Handle stdout (JSON-RPC responses)
            proc.stdout?.on('data', (data: Buffer) => {
                buffer += data.toString()
                
                // Try to parse complete JSON objects
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const response = JSON.parse(line) as JsonRpcResponse
                            this.handleResponse(serverId, response)
                        } catch {
                            console.warn('[MCP] Failed to parse response:', line)
                        }
                    }
                }
            })

            // Handle stderr
            proc.stderr?.on('data', (data: Buffer) => {
                console.error(`[MCP] ${state.config.name} stderr:`, data.toString())
            })

            // Handle process exit
            proc.on('exit', (code) => {
                console.log(`[MCP] ${state.config.name} exited with code ${code}`)
                state.status = 'disconnected'
                state.process = undefined
                this.emit('status-changed', serverId, 'disconnected')
            })

            proc.on('error', (error) => {
                console.error(`[MCP] ${state.config.name} error:`, error)
                state.status = 'error'
                state.error = error.message
                this.emit('status-changed', serverId, 'error', error.message)
            })

            // Wait a bit for the server to start
            await new Promise(resolve => setTimeout(resolve, 500))

            // Initialize the connection
            await this.sendRequest(serverId, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'selene', version: '1.0.0' }
            })

            // List available tools
            const toolsResult = await this.sendRequest(serverId, 'tools/list', {}) as { tools: MCPTool[] }
            state.tools = toolsResult.tools || []

            state.status = 'connected'
            state.connectedAt = Date.now()
            state.error = undefined
            
            console.log(`[MCP] Connected to ${state.config.name}, ${state.tools.length} tools available`)
            this.emit('status-changed', serverId, 'connected')
            this.emit('tools-updated', serverId, state.tools)

        } catch (error: unknown) {
            console.error(`[MCP] Failed to connect to ${state.config.name}:`, error)
            state.status = 'error'
            state.error = obterMensagemErro(error)
            this.emit('status-changed', serverId, 'error', obterMensagemErro(error))
            throw error
        }
    }

    private async conectarRemoto(state: MCPServerState): Promise<void> {
        const url = state.config.url
        if (!url) {
            throw new Error('URL remota nao configurada')
        }

        await this.sendRequestRemoto(state, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'selene', version: '1.0.0' }
        })

        const toolsResult = await this.sendRequestRemoto(state, 'tools/list', {}) as { tools: MCPTool[] }
        state.tools = toolsResult.tools || []

        state.status = 'connected'
        state.connectedAt = Date.now()
        state.error = undefined

        console.log(`[MCP] Connected to ${state.config.name}, ${state.tools.length} tools available`)
        this.emit('status-changed', state.config.id, 'connected')
        this.emit('tools-updated', state.config.id, state.tools)
    }

    async disconnect(serverId: string): Promise<void> {
        const state = this.servers.get(serverId)
        if (!state) return

        if (this.obterTransporte(state.config) !== 'stdio') {
            state.status = 'disconnected'
            state.tools = []
            state.pendingRequests.clear()
            state.error = undefined
            this.emit('status-changed', serverId, 'disconnected')
            return
        }

        if (state.process) {
            state.process.kill()
            state.process = undefined
        }

        state.status = 'disconnected'
        state.tools = []
        state.pendingRequests.clear()
        
        console.log(`[MCP] Disconnected from ${state.config.name}`)
        this.emit('status-changed', serverId, 'disconnected')
    }

    async reconnectAll(): Promise<void> {
        const configs = await this.loadConfig()
        for (const config of configs) {
            this.servers.set(config.id, {
                config,
                status: 'disconnected',
                tools: [],
                requestId: 0,
                pendingRequests: new Map()
            })
            
            if (config.enabled && config.autoConnect) {
                try {
                    await this.connect(config.id)
                } catch {
                    console.error(`[MCP] Failed to auto-connect ${config.name}`)
                }
            }
        }
    }

    // ========================================================================
    // TOOL EXECUTION
    // ========================================================================

    async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
        const state = this.servers.get(serverId)
        if (!state || state.status !== 'connected') {
            throw new Error(`Server ${serverId} not connected`)
        }

        console.log(`[MCP] Calling tool ${toolName} on ${state.config.name}`)
        
        const result = await this.sendRequest(serverId, 'tools/call', {
            name: toolName,
            arguments: args
        })

        return result
    }

    getTools(serverId: string): MCPTool[] {
        return this.servers.get(serverId)?.tools || []
    }

    getAllTools(): Array<MCPTool & { serverId: string; serverName: string }> {
        const allTools: Array<MCPTool & { serverId: string; serverName: string }> = []
        
        for (const [serverId, state] of this.servers) {
            if (state.status === 'connected') {
                for (const tool of state.tools) {
                    allTools.push({
                        ...tool,
                        serverId,
                        serverName: state.config.name
                    })
                }
            }
        }
        
        return allTools
    }

    // ========================================================================
    // STATUS
    // ========================================================================

    getStatus(serverId: string): MCPServerStatus {
        return this.servers.get(serverId)?.status || 'disconnected'
    }

    getError(serverId: string): string | undefined {
        return this.servers.get(serverId)?.error
    }

    getAllServers(): Array<{ config: MCPServerConfig; status: MCPServerStatus; toolCount: number }> {
        const result: Array<{ config: MCPServerConfig; status: MCPServerStatus; toolCount: number }> = []
        
        for (const [, state] of this.servers) {
            result.push({
                config: state.config,
                status: state.status,
                toolCount: state.tools.length
            })
        }
        
        return result
    }

    // ========================================================================
    // JSON-RPC COMMUNICATION
    // ========================================================================

    private sendRequest(serverId: string, method: string, params?: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const state = this.servers.get(serverId)
            if (!state || !state.process) {
                const transporte = state ? this.obterTransporte(state.config) : 'stdio'
                if (state && transporte !== 'stdio') {
                    this.sendRequestRemoto(state, method, params)
                        .then(resolve)
                        .catch(reject)
                    return
                }
                reject(new Error('Server not connected'))
                return
            }

            const id = ++state.requestId
            const request: JsonRpcRequest = {
                jsonrpc: '2.0',
                id,
                method,
                params
            }

            state.pendingRequests.set(id, { resolve, reject })

            const message = JSON.stringify(request) + '\n'
            state.process.stdin?.write(message)

            // Timeout after 30 seconds
            setTimeout(() => {
                if (state.pendingRequests.has(id)) {
                    state.pendingRequests.delete(id)
                    reject(new Error('Request timeout'))
                }
            }, 30000)
        })
    }

    private async sendRequestRemoto(state: MCPServerState, method: string, params?: unknown): Promise<unknown> {
        const url = state.config.url
        if (!url) {
            throw new Error('URL remota nao configurada')
        }

        const id = ++state.requestId
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(state.config.headers || {})
        }

        console.log(`[MCP] Sending request to ${url}`)
        console.log(`[MCP] Headers:`, JSON.stringify(headers, null, 2))

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        })

        if (!response.ok) {
            console.log(`[MCP] Response status: ${response.status}`)
            console.log(`[MCP] Response headers:`, Object.fromEntries(response.headers.entries()))
            throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json() as JsonRpcResponse
        if (data.error) {
            throw new Error(data.error.message)
        }
        return data.result
    }

    private handleResponse(serverId: string, response: JsonRpcResponse): void {
        const state = this.servers.get(serverId)
        if (!state) return

        const pending = state.pendingRequests.get(response.id)
        if (!pending) return

        state.pendingRequests.delete(response.id)

        if (response.error) {
            pending.reject(new Error(response.error.message))
        } else {
            pending.resolve(response.result)
        }
    }
}

// Singleton
export const mcpService = new MCPService()
export default mcpService
