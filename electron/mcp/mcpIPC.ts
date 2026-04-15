/**
 * MCP IPC Handlers
 * 
 * Exposes MCP functionality to the renderer process via IPC.
 */

import { ipcMain } from 'electron'
import { mcpService } from './MCPService.js'
import type { MCPServerConfig } from './MCPService.js'

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

export function setupMCPIPC(): void {
    console.log('[MCP] Setting up IPC handlers...')

    // ========================================================================
    // CONFIG MANAGEMENT
    // ========================================================================

    ipcMain.handle('mcp:get-servers', async () => {
        try {
            return mcpService.getAllServers()
        } catch (error: unknown) {
            console.error('[MCP IPC] get-servers error:', error)
            return []
        }
    })

    ipcMain.handle('mcp:get-config', async () => {
        try {
            return await mcpService.loadConfig()
        } catch (error: unknown) {
            console.error('[MCP IPC] get-config error:', error)
            return []
        }
    })

    ipcMain.handle('mcp:add-server', async (_event, config: MCPServerConfig) => {
        try {
            await mcpService.addServer(config)
            return { success: true }
        } catch (error: unknown) {
            console.error('[MCP IPC] add-server error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('mcp:remove-server', async (_event, serverId: string) => {
        try {
            await mcpService.removeServer(serverId)
            return { success: true }
        } catch (error: unknown) {
            console.error('[MCP IPC] remove-server error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // ========================================================================
    // CONNECTION MANAGEMENT
    // ========================================================================

    ipcMain.handle('mcp:connect', async (_event, serverId: string) => {
        try {
            await mcpService.connect(serverId)
            return { success: true }
        } catch (error: unknown) {
            console.error('[MCP IPC] connect error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
        try {
            await mcpService.disconnect(serverId)
            return { success: true }
        } catch (error: unknown) {
            console.error('[MCP IPC] disconnect error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    ipcMain.handle('mcp:get-status', async (_event, serverId: string) => {
        return mcpService.getStatus(serverId)
    })

    // ========================================================================
    // TOOLS
    // ========================================================================

    ipcMain.handle('mcp:get-tools', async (_event, serverId: string) => {
        return mcpService.getTools(serverId)
    })

    ipcMain.handle('mcp:get-all-tools', async () => {
        return mcpService.getAllTools()
    })

    ipcMain.handle('mcp:call-tool', async (_event, serverId: string, toolName: string, args: unknown) => {
        try {
            const result = await mcpService.callTool(serverId, toolName, args)
            return { success: true, result }
        } catch (error: unknown) {
            console.error('[MCP IPC] call-tool error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    // Auto-connect enabled servers on startup
    mcpService.reconnectAll().catch(err => {
        console.error('[MCP] Failed to reconnect servers:', err)
    })

    console.log('[MCP] IPC handlers registered')
}
