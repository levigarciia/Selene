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

    /** ID do projeto atual para isolamento de memória/contexto */
    currentProjectId?: string

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

export interface OrcamentoPrompt {
    systemBaseTokens: number
    perfilTokens: number
    autoMemoriasTokens: number
    crossChatTokens: number
    projetoTokens: number
    ferramentasWebTokens: number
}

export interface OpcoesComposicaoPrompt {
    orcamento?: Partial<OrcamentoPrompt>
    incluirDataHora?: boolean | 'auto'
    timeoutCrossChatMs?: number
}

export const ORCAMENTO_PROMPT_PADRAO: OrcamentoPrompt = {
    systemBaseTokens: 300,
    perfilTokens: 180,
    autoMemoriasTokens: 120,
    crossChatTokens: 120,
    projetoTokens: 300,
    ferramentasWebTokens: 500
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

export function limitarTextoPorTokens(texto: string, maxTokens: number): string {
    if (!texto || maxTokens <= 0) return ''
    const limiteCaracteres = Math.max(0, maxTokens * 4)
    if (texto.length <= limiteCaracteres) return texto
    return texto.slice(0, limiteCaracteres).trimEnd() + '...'
}

export function aplicarOrcamentoPrompt(
    texto: string,
    maxTokens: number
): { texto: string; tokensOriginais: number; tokensFinais: number; truncado: boolean } {
    const tokensOriginais = estimateTokens(texto)
    const textoLimitado = limitarTextoPorTokens(texto, maxTokens)
    const tokensFinais = estimateTokens(textoLimitado)
    return {
        texto: textoLimitado,
        tokensOriginais,
        tokensFinais,
        truncado: tokensFinais < tokensOriginais
    }
}

function mergeOrcamentoPrompt(orcamento?: Partial<OrcamentoPrompt>): OrcamentoPrompt {
    return {
        ...ORCAMENTO_PROMPT_PADRAO,
        ...orcamento
    }
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

const PADROES_TEMPORAIS = [
    /\bhoje\b/,
    /\bamanh[ãa]\b/,
    /\bontem\b/,
    /\bagora\b/,
    /\besta semana\b/,
    /\beste m[eê]s\b/,
    /\bdata\b/,
    /\bhor[aá]rio\b/,
    /\batual\b/,
    /\brecente\b/
]

function deveIncluirDataHoraPorMensagem(mensagem: string): boolean {
    const textoNormalizado = normalizarTextoParaAnalise(mensagem)
    if (!textoNormalizado) return false
    return PADROES_TEMPORAIS.some((padrao) => padrao.test(textoNormalizado))
}

function formatarDataHoraCurta(): string {
    const agora = new Date()
    const data = agora.toLocaleDateString('pt-BR')
    const hora = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })
    return `Data/hora local: ${data} ${hora}.`
}

async function obterContextoCrossChatComTimeout(
    mensagem: string,
    currentConversationId: string | undefined,
    currentProjectId: string | undefined,
    timeoutMs: number
): Promise<string> {
    if (timeoutMs <= 0) return ''

    const timeout = new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
            clearTimeout(timer)
            resolve('')
        }, timeoutMs)
    })

    const busca = getContextForPrompt(mensagem, currentConversationId, currentProjectId)
        .then((valor) => valor || '')
        .catch(() => '')

    return Promise.race([busca, timeout])
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
 * O histórico do chat não é incluído aqui pois é gerenciado externamente.
 */
export async function composePromptComOrcamento(
    context: PromptContext,
    opcoes: OpcoesComposicaoPrompt = {}
): Promise<ComposedPrompt> {
    const startTime = Date.now()
    const orcamento = mergeOrcamentoPrompt(opcoes.orcamento)
    const permitirContextoPessoal = context.permitirContextoPessoal ?? deveInjetarContextoPessoal(
        context.currentUserMessage,
        context.preferirSemContextoPessoal ?? false
    )
    const permitirMemoriaPerfil = context.permitirMemoriaPerfil ?? true
    const permitirMemoriasAuto = context.permitirMemoriasAuto ?? true
    const permitirCrossChat = context.permitirCrossChat ?? true
    const incluirDataHora = opcoes.incluirDataHora === 'auto'
        ? deveIncluirDataHoraPorMensagem(context.currentUserMessage)
        : Boolean(opcoes.incluirDataHora)
    const timeoutCrossChatMs = opcoes.timeoutCrossChatMs ?? 250

    let additionalTokens = 0
    let hasCrossChatContext = false
    let hasAutoMemories = false
    const partesPrompt: string[] = []

    // 1. Prompt base com orçamento fixo
    const baseAplicado = aplicarOrcamentoPrompt(context.systemPrompt, orcamento.systemBaseTokens)
    partesPrompt.push(baseAplicado.texto)
    additionalTokens += Math.max(0, baseAplicado.tokensFinais - baseAplicado.tokensOriginais)

    // 2. Data/hora somente quando necessário
    if (incluirDataHora) {
        const dataHora = aplicarOrcamentoPrompt(formatarDataHoraCurta(), 32)
        partesPrompt.push(dataHora.texto)
    }

    // 3. Contexto de perfil com orçamento
    if (context.userProfileContext && permitirMemoriaPerfil) {
        const perfilAplicado = aplicarOrcamentoPrompt(context.userProfileContext, orcamento.perfilTokens)
        if (perfilAplicado.texto) {
            partesPrompt.push(`[contexto_usuario]\n${perfilAplicado.texto}`)
            additionalTokens += perfilAplicado.tokensFinais
        }
    }

    // 4. Memórias automáticas com orçamento
    if (FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED && permitirMemoriasAuto && permitirContextoPessoal) {
        const autoMemoriesContext = getAutoMemoriesForPrompt(context.currentUserMessage, context.currentProjectId)
        if (autoMemoriesContext) {
            const autoAplicado = aplicarOrcamentoPrompt(autoMemoriesContext, orcamento.autoMemoriasTokens)
            if (autoAplicado.texto) {
                partesPrompt.push(`[memorias_automaticas]\n${autoAplicado.texto}`)
                additionalTokens += autoAplicado.tokensFinais
            }
            hasAutoMemories = true
        }
    }

    // 5. Cross-chat com timeout e orçamento
    if (FEATURE_FLAGS.CROSS_CHAT_CONTEXT_ENABLED && permitirCrossChat && permitirContextoPessoal) {
        try {
            const crossChatContext = await obterContextoCrossChatComTimeout(
                context.currentUserMessage,
                context.currentConversationId,
                context.currentProjectId,
                timeoutCrossChatMs
            )

            if (crossChatContext) {
                const crossAplicado = aplicarOrcamentoPrompt(crossChatContext, orcamento.crossChatTokens)
                if (crossAplicado.texto) {
                    partesPrompt.push(`[cross_chat]\n${crossAplicado.texto}`)
                    additionalTokens += crossAplicado.tokensFinais
                }
                hasCrossChatContext = true
            }
        } catch (error) {
            console.warn('[PromptPipeline] Cross-chat context failed:', error)
        }
    }

    const systemPrompt = partesPrompt.filter(Boolean).join('\n\n')

    if (FEATURE_FLAGS.DEBUG_LOGGING) {
        console.log('[PromptPipeline] Composed prompt:', {
            baseLength: context.systemPrompt.length,
            finalLength: systemPrompt.length,
            additionalTokens,
            hasCrossChatContext,
            hasAutoMemories,
            orcamento,
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

export async function composePrompt(context: PromptContext): Promise<ComposedPrompt> {
    return composePromptComOrcamento(context, {
        incluirDataHora: 'auto',
        timeoutCrossChatMs: 250
    })
}

/**
 * Versão síncrona simplificada (sem cross-chat context)
 * Útil quando não se quer esperar pela busca semântica
 */
export function composePromptSync(context: Omit<PromptContext, 'currentUserMessage'>): string {
    const orcamento = ORCAMENTO_PROMPT_PADRAO
    const permitirMemoriaPerfil = context.permitirMemoriaPerfil ?? true
    const permitirMemoriasAuto = context.permitirMemoriasAuto ?? true
    const permitirContextoPessoal = context.permitirContextoPessoal ?? true
    let systemPrompt = limitarTextoPorTokens(context.systemPrompt, orcamento.systemBaseTokens)

    // Adicionar contexto do perfil
    if (context.userProfileContext && permitirMemoriaPerfil) {
        const perfil = limitarTextoPorTokens(context.userProfileContext, orcamento.perfilTokens)
        if (perfil) {
            systemPrompt += `\n\n[contexto_usuario]\n${perfil}`
        }
    }

    // Adicionar memórias automáticas
    if (FEATURE_FLAGS.MEMORY_AUTOPILOT_ENABLED && permitirMemoriasAuto && permitirContextoPessoal) {
        const autoMemoriesContext = getAutoMemoriesForPrompt(undefined, context.currentProjectId)
        if (autoMemoriesContext) {
            const autoMemorias = limitarTextoPorTokens(autoMemoriesContext, orcamento.autoMemoriasTokens)
            if (autoMemorias) {
                systemPrompt += `\n\n[memorias_automaticas]\n${autoMemorias}`
            }
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
    timestamp: number,
    projectId?: string
): Promise<void> {
    // 1. Indexar para cross-chat (NUNCA grava memória permanente)
    if (FEATURE_FLAGS.CROSS_CHAT_CONTEXT_ENABLED) {
        try {
            await getCrossChatService().indexUserMessage(
                messageId,
                conversationId,
                content,
                timestamp,
                projectId
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
                timestamp,
                projectId
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
