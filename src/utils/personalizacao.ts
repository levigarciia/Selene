/**
 * Personalização da Selene
 *
 * Sistema simples inspirado no ChatGPT:
 * - Estilos de tom predefinidos (dropdown)
 * - Instruções personalizadas livres (textarea)
 */

// ============ TIPOS ============

export type EstiloTom =
    | 'padrao'
    | 'conciso'
    | 'detalhado'
    | 'criativo'
    | 'profissional'
    | 'casual'

export interface ConfigPersonalizacao {
    estiloTom: EstiloTom
    instrucoesPersonalizadas: string
}

// ============ CONSTANTES ============

/** Prompt base da Selene — sempre incluído */
export const SELENE_BASE_PROMPT = `Você é a Selene, uma assistente de IA inteligente, prestativa e amigável.

Características:
- Responda sempre em português do Brasil
- Seja clara, objetiva e útil
- Adapte o nível de detalhe ao contexto da pergunta
- Quando não souber algo, admita honestamente
- Use formatação Markdown quando apropriado
- Seja natural e conversacional`

/** Metadados dos estilos de tom disponíveis */
export const ESTILOS_TOM: Record<EstiloTom, { label: string; descricao: string; instrucao: string }> = {
    padrao: {
        label: 'Padrão',
        descricao: 'Equilibrado e adaptável ao contexto.',
        instrucao: ''
    },
    conciso: {
        label: 'Conciso',
        descricao: 'Respostas curtas e diretas ao ponto.',
        instrucao: 'Seja breve e direto. Prefira respostas curtas e evite explicações desnecessárias.'
    },
    detalhado: {
        label: 'Detalhado',
        descricao: 'Explicações completas e aprofundadas.',
        instrucao: 'Forneça explicações completas e detalhadas. Inclua exemplos e contexto quando relevante.'
    },
    criativo: {
        label: 'Criativo',
        descricao: 'Imaginativo, ousado e com novas perspectivas.',
        instrucao: 'Seja criativo e imaginativo. Explore ângulos incomuns e sugira ideias ousadas quando apropriado.'
    },
    profissional: {
        label: 'Profissional',
        descricao: 'Tom formal e linguagem corporativa.',
        instrucao: 'Use linguagem formal e profissional. Mantenha um tom corporativo e objetivo.'
    },
    casual: {
        label: 'Casual',
        descricao: 'Descontraído e informal.',
        instrucao: 'Use um tom informal e descontraído. Seja natural como em uma conversa entre amigos.'
    }
}

/** Valores padrão da personalização */
export const PERSONALIZACAO_PADRAO: ConfigPersonalizacao = {
    estiloTom: 'padrao',
    instrucoesPersonalizadas: ''
}

// ============ FUNÇÕES ============

/**
 * Constrói o system prompt efetivo combinando:
 * 1. Prompt base da Selene
 * 2. Instrução do estilo/tom selecionado
 * 3. Instruções personalizadas do usuário
 */
export function buildPromptPersonalizado(config: ConfigPersonalizacao): string {
    const partes: string[] = [SELENE_BASE_PROMPT]

    const instrucaoEstilo = ESTILOS_TOM[config.estiloTom]?.instrucao
    if (instrucaoEstilo) {
        partes.push(instrucaoEstilo)
    }

    const instrucaoPersonalizada = config.instrucoesPersonalizadas.trim()
    if (instrucaoPersonalizada) {
        partes.push(instrucaoPersonalizada)
    }

    return partes.join('\n\n')
}
