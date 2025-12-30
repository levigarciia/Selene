/**
 * Prompt Pipeline
 * Version: 1.0.0
 * 
 * Pipeline unificado de montagem de prompt.
 * Ordem: system → memória persistente → (auto-memories) → histórico → (cross-chat context)
 * 
 * Este arquivo centraliza a lógica de composição do prompt final,
 * garantindo previsibilidade e fácil manutenção.
 */

import { FEATURE_FLAGS } from '../config/memoryConfig'
import { getContextForPrompt, getCrossChatService } from './crosschat/CrossChatContext'
import { getAutoMemoriesForPrompt, getMemoryAutopilot } from './memory/MemoryAutopilot'

// ============================================================================
// TIPOS
// ============================================================================

export interface PromptContext {
    /** Prompt do sistema base */
    systemPrompt: string

    /** Contexto do perfil do usuário (memória persistente existente) */
    userProfileContext: string

    /** ID da conversa atual (para exclusão na busca cross-chat) */
    currentConversationId?: string

    /** Mensagem do usuário atual (query para busca semântica) */
    currentUserMessage: string

    /** Preferir evitar contexto pessoal quando possivel */
    preferirSemContextoPessoal?: boolean

    /** Permitir contexto pessoal mesmo quando nao recomendado */
    permitirContextoPessoal?: boolean

    /** Permitir contexto cross-chat */
    permitirCrossChat?: boolean

    /** Permitir memorias automaticas */
    permitirMemoriasAuto?: boolean

    /** Permitir contexto do perfil do usuario */
    permitirMemoriaPerfil?: boolean
}

export interface ComposedPrompt {
    /** Prompt do sistema completo */
    systemPrompt: string

    /** Metadados da composição */
    metadata: {
        /** Se contexto cross-chat foi incluído */
        hasCrossChatContext: boolean

        /** Se memórias automáticas foram incluídas */
        hasAutoMemories: boolean

        /** Estimativa de tokens adicionados */
        additionalTokens: number

        /** Timestamp da composição */
        composedAt: number
    }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

function normalizarTextoParaAnalise(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function contemIndicadoresPessoais(textoNormalizado: string): boolean {
    const indicadores = [
        /meu\s+(projeto|app|produto|sistema|negocio|codigo|site|jogo|bot|trabalho)\b/,
        /minha\s+(stack|empresa|equipe|api|marca|startup|aplicacao|carreira|rotina)\b/,
        /nosso\s+(projeto|app|produto|sistema|negocio|time|equipe)\b/,
        /minhas?\s+preferencias?\b/,
        /meus?\s+objetivos?\b/,
        /pra\s+mim|para\s+mim|comigo/,
        /no\s+outro\s+chat|como\s+falamos|como\s+comentei|lembra\b/
    ]

    return indicadores.some(padrao => padrao.test(textoNormalizado))
}

export function deveInjetarContextoPessoal(
    mensagem: string,
    preferirSemContextoPessoal: boolean = false
): boolean {
    const textoNormalizado = normalizarTextoParaAnalise(mensagem)
    if (!textoNormalizado) {
        return false
    }

    if (contemIndicadoresPessoais(textoNormalizado)) {
        return true
    }

    if (preferirSemContextoPessoal) {
        return false
    }

    if (textoNormalizado.length < 80) {
        return false
    }

    return true
}

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

/**
 * Compõe o prompt final com todos os contextos relevantes.
 * 
 * ORDEM DE COMPOSIÇÃO:
 * 1. System prompt base
 * 2. Memória persistente existente (perfil do usuário)
 * 3. Memórias automáticas (se habilitado)
 * 4. [Histórico do chat - gerenciado externamente]
 * 5. Contexto cross-chat (se habilitado)
 * 
 * O histórico do chat não é incluído aqui pois é gerenciado pelo ChatWindow.
 * Esta função retorna o system prompt enriquecido.
 */
export async function composePrompt(context: PromptContext): Promise<ComposedPrompt> {
    const startTime = Date.now()
    const permitirContextoPessoal = context.permitirContextoPessoal ?? deveInjetarContextoPessoal(
        context.currentUserMessage,
        context.preferirSemContextoPessoal ?? false
    )
    const permitirMemoriaPerfil = context.permitirMemoriaPerfil ?? true
    const permitirMemoriasAuto = context.permitirMemoriasAuto ?? true
    const permitirCrossChat = context.permitirCrossChat ?? true
    let additionalTokens = 0
    let hasCrossChatContext = false
    let hasAutoMemories = false
    // 1. Iniciar com system prompt base + data atual
    const now = new Date()
    const dataAtual = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    const horaAtual = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })
    
    let systemPrompt = context.systemPrompt + `\n\n📅 **Data e hora atual:** ${dataAtual}, ${horaAtual}.`

    // 2. Adicionar contexto do perfil do usuário (memória persistente existente)
    if (context.userProfileContext && permitirMemoriaPerfil) {
        systemPrompt += context.userProfileContext
        additionalTokens += estimateTokens(context.userProfileContext)
    }

    // 3. Adicionar memórias automáticas (se habilitado)
    if (FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED && permitirMemoriasAuto && permitirContextoPessoal) {
        const autoMemoriesContext = getAutoMemoriesForPrompt(context.currentUserMessage)
        if (autoMemoriesContext) {
            systemPrompt += autoMemoriesContext
            additionalTokens += estimateTokens(autoMemoriesContext)
            hasAutoMemories = true
        }
    }

    // 4. [Histórico do chat - gerenciado externamente pelo ChatWindow]

    // 5. Adicionar contexto cross-chat (se habilitado)
    if (FEATURE_FLAGS.CROSS_CHAT_CONTEXT_ENABLED && permitirCrossChat && permitirContextoPessoal) {
        try {
            const crossChatContext = await getContextForPrompt(
                context.currentUserMessage,
                context.currentConversationId
            )

            if (crossChatContext) {
                systemPrompt += crossChatContext
                additionalTokens += estimateTokens(crossChatContext)
                hasCrossChatContext = true
            }
        } catch (error) {
            console.warn('[PromptPipeline] Cross-chat context failed:', error)
        }
    }

    if (FEATURE_FLAGS.DEBUG_LOGGING) {
        console.log('[PromptPipeline] Composed prompt:', {
            baseLength: context.systemPrompt.length,
            finalLength: systemPrompt.length,
            additionalTokens,
            hasCrossChatContext,
            hasAutoMemories,
            timeMs: Date.now() - startTime
        })
    }

    return {
        systemPrompt,
        metadata: {
            hasCrossChatContext,
            hasAutoMemories,
            additionalTokens,
            composedAt: Date.now()
        }
    }
}

/**
 * Versão síncrona simplificada (sem cross-chat context)
 * Útil quando não se quer esperar pela busca semântica
 */
export function composePromptSync(context: Omit<PromptContext, 'currentUserMessage'>): string {
    const permitirMemoriaPerfil = context.permitirMemoriaPerfil ?? true
    const permitirMemoriasAuto = context.permitirMemoriasAuto ?? true
    const permitirContextoPessoal = context.permitirContextoPessoal ?? true

    // Adicionar data atual ao prompt
    const now = new Date()
    const dataAtual = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    const horaAtual = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })
    
    let systemPrompt = context.systemPrompt + `\n\n📅 **Data e hora atual:** ${dataAtual}, ${horaAtual}.`

    // Adicionar contexto do perfil
    if (context.userProfileContext && permitirMemoriaPerfil) {
        systemPrompt += context.userProfileContext
    }

    // Adicionar memórias automáticas
    if (FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED && permitirMemoriasAuto && permitirContextoPessoal) {
        const autoMemoriesContext = getAutoMemoriesForPrompt()
        if (autoMemoriesContext) {
            systemPrompt += autoMemoriesContext
        }
    }

    return systemPrompt
}

// ============================================================================
// HOOKS DE INTEGRAÇÃO
// ============================================================================

/**
 * Configura os serviços com as chaves de API necessárias
 */
export function configureServices(config: {
    openAiKey?: string
    chatFunction?: (prompt: string) => Promise<string>
}): void {
    // Configurar embedding service
    if (config.openAiKey) {
        getCrossChatService().setApiKey(config.openAiKey)
    }

    // Configurar memory autopilot
    if (config.chatFunction) {
        getMemoryAutopilot().setChatFunction(config.chatFunction)
    }
}

/**
 * Processa uma mensagem do usuário após envio
 * Indexa para cross-chat e processa para autopilot
 */
export async function processUserMessageForMemory(
    messageId: string,
    conversationId: string,
    content: string,
    timestamp: number
): Promise<void> {
    // 1. Indexar para cross-chat (NUNCA grava memória permanente)
    if (FEATURE_FLAGS.CROSS_CHAT_CONTEXT_ENABLED) {
        try {
            await getCrossChatService().indexUserMessage(
                messageId,
                conversationId,
                content,
                timestamp
            )
        } catch (error) {
            console.warn('[PromptPipeline] Cross-chat indexing failed:', error)
        }
    }

    // 2. Processar para autopilot de memória (separado, isolado)
    if (FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED) {
        try {
            await getMemoryAutopilot().processMessage(
                messageId,
                conversationId,
                content,
                timestamp
            )
        } catch (error) {
            console.warn('[PromptPipeline] Memory autopilot failed:', error)
        }
    }
}

// ============================================================================
// UTILITÁRIOS DE ESTADO
// ============================================================================

/**
 * Obtém estado atual dos sistemas
 */
export function getSystemsStatus(): {
    crossChat: {
        enabled: boolean
        indexedMessages: number
    }
    memoryAutopilot: {
        enabled: boolean
        totalMemories: number
        createdToday: number
    }
} {
    const crossChatService = getCrossChatService()
    const autopilot = getMemoryAutopilot()

    const indexStats = crossChatService.getIndexStats()
    const autopilotStats = autopilot.getStats()

    return {
        crossChat: {
            enabled: crossChatService.isEnabled(),
            indexedMessages: indexStats.totalMessages
        },
        memoryAutopilot: {
            enabled: autopilot.isEnabled(),
            totalMemories: autopilotStats.totalMemories,
            createdToday: autopilotStats.todayCreated
        }
    }
}

/**
 * Força flush de dados pendentes
 */
export function flushAll(): void {
    getCrossChatService().flush()
}
