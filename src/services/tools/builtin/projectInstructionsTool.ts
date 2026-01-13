/**
 * Project Instructions Tool
 * 
 * Allows the AI to update project instructions dynamically.
 * This tool enables AI to maintain and update project-specific
 * context and guidelines.
 */

import type { ToolHandler } from '../../../types/tools'

// Store for the project update callback
let projectUpdateCallback: ((projectId: string, updates: { instructions?: string }) => void) | null = null

/**
 * Set the callback for updating projects
 * This should be called from the ChatWindow to connect with project state
 */
export function setProjectUpdateCallback(
    callback: (projectId: string, updates: { instructions?: string }) => void
): void {
    projectUpdateCallback = callback
    console.log('[ProjectInstructionsTool] Callback registered')
}

/**
 * Clear the project update callback
 */
export function clearProjectUpdateCallback(): void {
    projectUpdateCallback = null
}

/**
 * Handler for the project instructions tool
 */
export const projectInstructionsHandler: ToolHandler = async (args, context) => {
    const { projectId, action, instructions } = args as {
        projectId?: string
        action: 'update' | 'append' | 'clear'
        instructions?: string
    }

    // Use projectId from args or context
    const targetProjectId = projectId || context?.projectId

    if (!targetProjectId) {
        return {
            success: false,
            error: 'Nenhum projeto ativo. Esta ferramenta só pode ser usada em conversas dentro de projetos.'
        }
    }

    if (!projectUpdateCallback) {
        return {
            success: false,
            error: 'Sistema de projetos não disponível no momento.'
        }
    }

    try {
        switch (action) {
            case 'update':
                if (!instructions) {
                    return {
                        success: false,
                        error: 'As novas instruções são obrigatórias para a ação "update".'
                    }
                }
                projectUpdateCallback(targetProjectId, { instructions })
                console.log('[ProjectInstructionsTool] Updated instructions for project:', targetProjectId)
                return {
                    success: true,
                    data: {
                        message: 'Instruções do projeto atualizadas com sucesso.',
                        action: 'update',
                        projectId: targetProjectId
                    }
                }

            case 'append':
                if (!instructions) {
                    return {
                        success: false,
                        error: 'O texto a adicionar é obrigatório para a ação "append".'
                    }
                }
                // For append, we need to get current instructions first
                // This is handled by the callback knowing the current state
                projectUpdateCallback(targetProjectId, { 
                    instructions: `__APPEND__${instructions}` 
                })
                console.log('[ProjectInstructionsTool] Appended to instructions for project:', targetProjectId)
                return {
                    success: true,
                    data: {
                        message: 'Instruções adicionadas ao projeto com sucesso.',
                        action: 'append',
                        projectId: targetProjectId
                    }
                }

            case 'clear':
                projectUpdateCallback(targetProjectId, { instructions: '' })
                console.log('[ProjectInstructionsTool] Cleared instructions for project:', targetProjectId)
                return {
                    success: true,
                    data: {
                        message: 'Instruções do projeto limpas com sucesso.',
                        action: 'clear',
                        projectId: targetProjectId
                    }
                }

            default:
                return {
                    success: false,
                    error: `Ação desconhecida: ${action}. Use "update", "append" ou "clear".`
                }
        }
    } catch (error: any) {
        console.error('[ProjectInstructionsTool] Error:', error)
        return {
            success: false,
            error: error.message || 'Erro ao atualizar instruções do projeto.'
        }
    }
}
