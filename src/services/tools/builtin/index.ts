/**
 * Built-in Tools Registration
 * 
 * Registers all built-in tools with the ToolRegistry.
 * This should be called during app initialization.
 */

import { toolRegistry } from '../ToolRegistry'
import { toolExecutor } from '../ToolExecutor'
import { webSearchHandler } from './webSearchTool'
import { memorySearchHandler } from './memorySearchTool'
import type { ToolDefinition } from '../../../types/tools'

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const builtInTools: ToolDefinition[] = [
    {
        id: 'builtin:web_search',
        name: 'Busca na Web',
        description: 'Pesquisa informações atuais na internet. Use para notícias, preços, eventos recentes, e qualquer informação que precise estar atualizada.',
        category: 'search',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'O que pesquisar na web',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Globe'
    },
    {
        id: 'builtin:memory_search',
        name: 'Memória do Usuário',
        description: 'Busca informações sobre o usuário salvas em conversas anteriores. Use quando precisar lembrar preferências, projetos, ou contexto pessoal.',
        category: 'memory',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'O que buscar na memória',
                required: true
            }
        ],
        source: { type: 'builtin' },
        enabled: true,
        icon: 'Brain'
    },
    {
        id: 'builtin:analyze_screenshot',
        name: 'Analisar Tela',
        description: 'Captura e analisa o conteúdo atual da tela do usuário.',
        category: 'system',
        parameters: [
            {
                name: 'question',
                type: 'string',
                description: 'Pergunta sobre o conteúdo da tela',
                required: false
            }
        ],
        source: { type: 'builtin' },
        enabled: false, // Disabled by default, requires user activation
        icon: 'Camera'
    }
]

// ============================================================================
// INITIALIZATION
// ============================================================================

let initialized = false

/**
 * Initialize and register all built-in tools
 */
export function initializeBuiltInTools(): void {
    if (initialized) {
        console.log('[BuiltInTools] Already initialized')
        return
    }

    console.log('[BuiltInTools] Initializing built-in tools...')

    // Register tool definitions
    toolRegistry.registerMany(builtInTools)

    // Register handlers
    toolExecutor.registerHandler('builtin:web_search', webSearchHandler)
    toolExecutor.registerHandler('builtin:memory_search', memorySearchHandler)
    // Screenshot handler will be registered when enabled

    initialized = true
    console.log('[BuiltInTools] Initialized', builtInTools.length, 'built-in tools')
}

/**
 * Get all built-in tool definitions
 */
export function getBuiltInToolDefinitions(): ToolDefinition[] {
    return [...builtInTools]
}

export { webSearchHandler, memorySearchHandler }
