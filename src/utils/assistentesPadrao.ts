/**
 * Assistentes Padrão e Configurações
 * 
 * Sistema unificado de configuração de assistentes com suporte a:
 * - Campos básicos (nome, descrição, prompt)
 * - Permissões granulares
 * - Comportamentos e tom
 * - Fluxo de interação
 * - Customização visual (ícone, cor)
 */

// ============ TIPOS ============

export type AssistantPermission = 
    | 'memory_read'        // Pode acessar memórias do usuário
    | 'memory_write'       // Pode criar novas memórias
    | 'cross_chat'         // Pode acessar contexto de conversas anteriores
    | 'image_analysis'     // Pode analisar imagens/screenshots
    | 'voice_input'        // Pode receber entrada de voz

export type AssistantBehavior =
    | 'concise'            // Respostas curtas e diretas
    | 'detailed'           // Explicações completas
    | 'conversational'     // Tom natural e amigável
    | 'professional'       // Linguagem formal
    | 'educational'        // Modo professor com exemplos
    | 'creative'           // Imaginativo e ousado

export type AssistantTone =
    | 'neutral'
    | 'friendly'
    | 'formal'
    | 'casual'
    | 'empathetic'
    | 'assertive'
    | 'professional'

export interface AssistantInteractionFlow {
    clarifyFirst: boolean      // Perguntar antes de responder
    stepByStep: boolean        // Respostas em passos
    includeExamples: boolean   // Incluir exemplos
    summarize: boolean         // Resumir no final
    maxResponseLength: number  // Limite de palavras (0 = ilimitado)
}

// Tipo principal - compatível com o antigo + novos campos opcionais
export type AssistenteConfig = {
    id: string
    nome: string
    descricao: string
    prompt: string
    origem: 'padrao' | 'personalizado'
    
    // Campos opcionais expandidos
    permissions?: AssistantPermission[]
    behaviors?: AssistantBehavior[]
    tone?: AssistantTone
    interactionFlow?: AssistantInteractionFlow
    icon?: string
    color?: string
    createdAt?: number
    updatedAt?: number
    usageCount?: number
}

// Alias para manter compatibilidade
export type AssistantConfig = AssistenteConfig

// ============ DEFAULTS ============

export const DEFAULT_PERMISSIONS: AssistantPermission[] = [
    'memory_read',
    'cross_chat',
    'image_analysis',
    'voice_input'
]

export const DEFAULT_BEHAVIORS: AssistantBehavior[] = [
    'conversational',
    'detailed'
]

export const DEFAULT_TONE: AssistantTone = 'friendly'

export const DEFAULT_INTERACTION_FLOW: AssistantInteractionFlow = {
    clarifyFirst: false,
    stepByStep: false,
    includeExamples: true,
    summarize: false,
    maxResponseLength: 0
}

// ============ ASSISTENTES PADRÃO ============

export const ASSISTENTES_PADRAO: AssistenteConfig[] = [
    {
        id: 'assistente-geral',
        nome: 'Assistente Geral',
        descricao: 'Respostas equilibradas para qualquer tema.',
        prompt: 'Você é a Selene, uma assistente clara e objetiva. Responda em português, mantenha o contexto curto e confirme dúvidas antes de agir. Entregue passos práticos quando possível e destaque riscos em bullet points curtos.',
        origem: 'padrao',
        permissions: ['memory_read', 'cross_chat', 'image_analysis', 'voice_input'],
        behaviors: ['conversational', 'detailed'],
        tone: 'friendly',
        icon: '✨',
        color: '#8b5cf6'
    },
    {
        id: 'assistente-codigo',
        nome: 'Assistente de Código',
        descricao: 'Focado em resolução de problemas de programação.',
        prompt: 'Resolva desafios de código passo a passo. Mostre primeiro a estratégia, depois um exemplo mínimo e testes básicos. Evite bibliotecas externas quando não forem necessárias.',
        origem: 'padrao',
        permissions: ['memory_read', 'cross_chat', 'image_analysis'],
        behaviors: ['detailed', 'educational'],
        tone: 'professional',
        interactionFlow: { clarifyFirst: true, stepByStep: true, includeExamples: true, summarize: false, maxResponseLength: 0 },
        icon: '💻',
        color: '#10b981'
    },
    {
        id: 'assistente-estudos',
        nome: 'Assistente de Estudos',
        descricao: 'Explicações em 3 níveis de profundidade.',
        prompt: 'Explique qualquer conceito em 3 camadas: nível 1 resumo simples, nível 2 com analogias técnicas leves, nível 3 com detalhes aprofundados. Sempre inclua 3 exercícios curtos no final.',
        origem: 'padrao',
        permissions: ['memory_read', 'memory_write', 'cross_chat'],
        behaviors: ['educational', 'detailed'],
        tone: 'friendly',
        interactionFlow: { clarifyFirst: false, stepByStep: true, includeExamples: true, summarize: true, maxResponseLength: 0 },
        icon: '📚',
        color: '#3b82f6'
    },
    {
        id: 'assistente-vendas',
        nome: 'Assistente de Vendas',
        descricao: 'Foco em objeções, CTA e próximos passos.',
        prompt: 'Atue como uma SDR consultiva. Resuma rapidamente o problema do cliente, proponha 2 opções de solução e finalize com CTA claro. Liste objeções comuns e respostas curtas.',
        origem: 'padrao',
        permissions: ['memory_read'],
        behaviors: ['concise', 'professional'],
        tone: 'assertive',
        icon: '💼',
        color: '#f59e0b'
    },
    {
        id: 'assistente-criativo',
        nome: 'Assistente Criativo',
        descricao: 'Brainstorming e ideias criativas.',
        prompt: 'Seja um parceiro criativo. Gere ideias ousadas, explore diferentes perspectivas e ajude a desenvolver conceitos inovadores. Não tenha medo de sugerir o inesperado.',
        origem: 'padrao',
        permissions: ['memory_read', 'cross_chat'],
        behaviors: ['creative', 'conversational'],
        tone: 'casual',
        interactionFlow: { clarifyFirst: true, stepByStep: false, includeExamples: true, summarize: false, maxResponseLength: 0 },
        icon: '🎨',
        color: '#ec4899'
    },
    {
        id: 'assistente-notas',
        nome: 'Tomador de Notas',
        descricao: 'Organiza reuniões em tópicos e tarefas.',
        prompt: 'Escute e extraia decisões, próximos passos e responsáveis. Entregue em bullets curtos e marque pendências como TODO.',
        origem: 'padrao',
        permissions: ['memory_read', 'memory_write'],
        behaviors: ['concise'],
        tone: 'formal',
        icon: '📝',
        color: '#06b6d4'
    }
]

// ============ FUNÇÕES HELPER ============

const gerarId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `assistente-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const criarAssistenteVazio = (): AssistenteConfig => ({
    id: gerarId(),
    nome: 'Novo assistente',
    descricao: 'Personalizado',
    prompt: 'Descreva como este assistente deve se comportar.',
    origem: 'personalizado',
    permissions: [...DEFAULT_PERMISSIONS],
    behaviors: [...DEFAULT_BEHAVIORS],
    tone: DEFAULT_TONE,
    interactionFlow: { ...DEFAULT_INTERACTION_FLOW },
    icon: '✨',
    color: '#8b5cf6',
    createdAt: Date.now()
})

/**
 * Garante que um assistente tem todos os campos necessários
 */
export function normalizarAssistente(assistente: Partial<AssistenteConfig> & { id: string; nome: string; prompt: string }): AssistenteConfig {
    return {
        id: assistente.id,
        nome: assistente.nome,
        descricao: assistente.descricao || '',
        prompt: assistente.prompt,
        origem: assistente.origem || 'personalizado',
        permissions: assistente.permissions || [...DEFAULT_PERMISSIONS],
        behaviors: assistente.behaviors || [...DEFAULT_BEHAVIORS],
        tone: assistente.tone || DEFAULT_TONE,
        interactionFlow: assistente.interactionFlow || { ...DEFAULT_INTERACTION_FLOW },
        icon: assistente.icon || '✨',
        color: assistente.color || '#8b5cf6',
        createdAt: assistente.createdAt || Date.now(),
        updatedAt: assistente.updatedAt,
        usageCount: assistente.usageCount || 0
    }
}

/**
 * Constrói o system prompt completo a partir da configuração
 */
export function buildSystemPrompt(config: AssistenteConfig): string {
    const parts: string[] = [config.prompt]
    
    // Adiciona instruções de comportamento
    if (config.behaviors?.length) {
        const behaviorInstructions: Record<AssistantBehavior, string> = {
            concise: 'Seja breve e direto nas respostas.',
            detailed: 'Forneça explicações completas e detalhadas.',
            conversational: 'Mantenha um tom natural e amigável.',
            professional: 'Use linguagem formal e profissional.',
            educational: 'Explique conceitos como um professor, com exemplos.',
            creative: 'Seja criativo e imaginativo nas suas respostas.'
        }
        
        const behaviorTexts = config.behaviors
            .map(b => behaviorInstructions[b])
            .filter(Boolean)
        
        if (behaviorTexts.length) {
            parts.push(behaviorTexts.join(' '))
        }
    }
    
    // Adiciona modificador de tom
    if (config.tone && config.tone !== 'neutral') {
        const toneInstructions: Record<AssistantTone, string> = {
            neutral: '',
            friendly: 'Seja simpático e acolhedor.',
            formal: 'Mantenha formalidade nas respostas.',
            casual: 'Use linguagem informal e descontraída.',
            empathetic: 'Demonstre compreensão e empatia.',
            assertive: 'Seja confiante e decisivo nas respostas.',
            professional: 'Mantenha um tom profissional e objetivo.'
        }
        
        const toneText = toneInstructions[config.tone]
        if (toneText) {
            parts.push(toneText)
        }
    }
    
    // Adiciona instruções de fluxo
    if (config.interactionFlow) {
        const flowParts: string[] = []
        
        if (config.interactionFlow.clarifyFirst) {
            flowParts.push('Faça perguntas esclarecedoras antes de responder quando necessário.')
        }
        if (config.interactionFlow.stepByStep) {
            flowParts.push('Organize suas respostas em passos claros e numerados.')
        }
        if (config.interactionFlow.includeExamples) {
            flowParts.push('Inclua exemplos práticos quando apropriado.')
        }
        if (config.interactionFlow.summarize) {
            flowParts.push('Sempre termine com um breve resumo.')
        }
        if (config.interactionFlow.maxResponseLength > 0) {
            flowParts.push(`Mantenha respostas com no máximo ${config.interactionFlow.maxResponseLength} palavras.`)
        }
        
        if (flowParts.length) {
            parts.push(flowParts.join(' '))
        }
    }
    
    return parts.join('\n\n')
}

// Prompt padrão da Selene (sem assistente selecionado)
export const SELENE_DEFAULT_PROMPT = `Você é a Selene, uma assistente de IA inteligente, prestativa e amigável.

Características:
- Responda sempre em português do Brasil
- Seja clara, objetiva e útil
- Adapte o nível de detalhe ao contexto da pergunta
- Quando não souber algo, admita honestamente
- Use formatação Markdown quando apropriado
- Seja natural e conversacional`
