/**
 * Memory Search Tool Handler
 * 
 * Searches user memories and cross-chat context.
 */

import { getAutoMemoriesForPrompt, getMemoryAutopilot } from '../../memory/MemoryAutopilot'
import { getContextForPrompt } from '../../crosschat/CrossChatContext'
import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'

export const memorySearchHandler: ToolHandler = async (args, context): Promise<ToolCallResult> => {
    const query = args.query as string
    
    if (!query || typeof query !== 'string') {
        return {
            success: false,
            error: 'Query parameter is required and must be a string'
        }
    }

    console.log('[MemorySearchTool] Searching:', query)

    try {
        const results: ToolResultItem[] = []
        let formattedForAI = ''

        // 1. Search auto-memories
        const autoMemories = getAutoMemoriesForPrompt(query, context?.projectId)
        if (autoMemories) {
            formattedForAI += '\n**Memórias do Usuário:**\n' + autoMemories
            results.push({
                type: 'text',
                title: 'Memórias Automáticas',
                content: autoMemories.substring(0, 200) + (autoMemories.length > 200 ? '...' : '')
            })
        }

        // 2. Search cross-chat context
        try {
            const crossChatContext = await getContextForPrompt(query, context?.conversationId, context?.projectId)
            if (crossChatContext) {
                formattedForAI += '\n**Contexto de Conversas Anteriores:**\n' + crossChatContext
                results.push({
                    type: 'text',
                    title: 'Conversas Anteriores',
                    content: crossChatContext.substring(0, 200) + (crossChatContext.length > 200 ? '...' : '')
                })
            }
        } catch (err) {
            console.warn('[MemorySearchTool] Cross-chat search failed:', err)
        }

        // 3. Get memory stats
        const autopilot = getMemoryAutopilot()
        const stats = autopilot.getStats()

        if (results.length === 0) {
            return {
                success: true,
                data: {
                    query,
                    results: [],
                    formattedForAI: `[Nenhuma memória encontrada para: "${query}"]`,
                    displayResults: [],
                    stats
                }
            }
        }

        return {
            success: true,
            data: {
                query,
                results: results.map(r => ({ title: r.title, content: r.content })),
                formattedForAI,
                displayResults: results,
                stats
            }
        }
    } catch (error: unknown) {
        console.error('[MemorySearchTool] Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Memory search failed'
        }
    }
}
