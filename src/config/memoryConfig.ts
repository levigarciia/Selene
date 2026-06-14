/**
 * Selene Memory & Cross-Chat Configuration
 * Version: 1.0.0
 *
 * Este arquivo contém todas as configurações para os sistemas de memória
 * automática e referência entre chats. Valores são calibrados para
 * baixo custo de tokens e alta precisão.
 */

// ============================================================================
// FEATURE FLAGS - Ativação gradual dos sistemas
// ============================================================================

export const FEATURE_FLAGS = {
    /** Habilita o sistema de referência entre chats */
    CROSS_CHAT_CONTEXT_ENABLED: true,

    /** Habilita o autopilot de memórias */
    MEMORY_AUTOPILOT_ENABLED: true,

    /** Habilita logs detalhados para debug */
    DEBUG_LOGGING: false,

    /** Habilita métricas internas */
    METRICS_ENABLED: true
} as const

// ============================================================================
// CROSS-CHAT CONTEXT - Configuração de referência entre chats
// ============================================================================

export const CROSS_CHAT_CONFIG = {
    /** Número mínimo de caracteres para uma mensagem ser indexada */
    MIN_MESSAGE_LENGTH: 50,

    /** Número máximo de trechos a injetar no prompt */
    MAX_CONTEXT_SNIPPETS: 3,

    /** Tamanho máximo de cada trecho em caracteres */
    MAX_SNIPPET_LENGTH: 220,

    /** Threshold mínimo de similaridade (0-1) para considerar relevante */
    SIMILARITY_THRESHOLD: 0.78,

    /** Limite de tokens para contexto entre chats */
    MAX_CONTEXT_TOKENS: 500,

    /** Idade máxima de mensagens indexadas em dias */
    MAX_MESSAGE_AGE_DAYS: 90,

    /** Número máximo de mensagens no índice */
    MAX_INDEX_SIZE: 1000,

    /** Intervalo de rebuild do índice em ms (a cada 1h) */
    INDEX_REBUILD_INTERVAL_MS: 3600000,

    /** Cache TTL em ms (5 minutos) */
    CACHE_TTL_MS: 300000,

    /** Máximo de resultados na busca semântica */
    MAX_SEARCH_RESULTS: 20,

    /** Modelo de embedding (será usado via OpenAI/OpenRouter) */
    EMBEDDING_MODEL: 'text-embedding-3-small',

    /** Dimensão do embedding */
    EMBEDDING_DIMENSION: 1536
} as const

// ============================================================================
// MEMORY AUTOPILOT - Configuração de extração automática
// ============================================================================

export const MEMORY_AUTOPILOT_CONFIG = {
    /** Confiança mínima para salvar memória (0-1) */
    MIN_CONFIDENCE: 0.75,

    /** Limite de memórias criadas por dia */
    DAILY_CREATION_LIMIT: 10,

    /** Threshold de similaridade para deduplicação (0-1) */
    DEDUP_SIMILARITY_THRESHOLD: 0.85,

    /** Tamanho máximo do texto da memória */
    MAX_MEMORY_TEXT_LENGTH: 200,

    /** Relevancia minima para injetar memoria no prompt (0-1) */
    RELEVANCIA_MINIMA_PARA_PROMPT: 0.25,

    /** Número mínimo de ocorrências para considerar recorrente */
    MIN_OCCURRENCES_FOR_RECURRENT: 2,

    /** Janela de tempo para análise de recorrência em dias */
    RECURRENCE_WINDOW_DAYS: 30,

    /** Intervalo mínimo entre extrações em ms (debounce) */
    EXTRACTION_DEBOUNCE_MS: 5000,

    /** Tamanho mínimo de mensagem para análise */
    MIN_MESSAGE_LENGTH_FOR_ANALYSIS: 80,

    /** Número máximo de mensagens recentes a analisar por vez */
    MAX_MESSAGES_PER_EXTRACTION: 5,

    /** Número máximo de memórias automáticas totais */
    MAX_AUTO_MEMORIES: 100
} as const

// ============================================================================
// CATEGORIAS DE MEMÓRIA
// ============================================================================

export const MEMORY_CATEGORIES = {
    /** Identidade profissional ou preferências de identidade explícitas */
    IDENTITY: 'identity',

    /** Dados de contato não sensíveis citados como contexto útil */
    CONTACT: 'contact',

    /** Preferências pessoais do usuário */
    PREFERENCE: 'preference',

    /** Contexto de projeto ou trabalho */
    PROJECT_CONTEXT: 'project_context',

    /** Stack tecnológico / ferramentas */
    TECH_STACK: 'tech_stack',

    /** Objetivos e metas recorrentes */
    GOAL: 'goal',

    /** Informações profissionais */
    PROFESSIONAL: 'professional',

    /** Estilo de comunicação preferido */
    COMMUNICATION_STYLE: 'communication_style',

    /** Conhecimento ou expertise */
    EXPERTISE: 'expertise',

    /** Fatos duráveis não sensíveis sobre projetos, rotina ou ambiente */
    FACT: 'fact'
} as const

export type MemoryCategory = typeof MEMORY_CATEGORIES[keyof typeof MEMORY_CATEGORIES]

// ============================================================================
// BLACKLIST DE CATEGORIAS - Categorias sensíveis que não são extraídas
// ============================================================================

export const CATEGORY_BLACKLIST: string[] = [
    'password',
    'senha',
    'credential',
    'credencial',
    'secret',
    'segredo',
    'token',
    'api_key',
    'chave_api',
    'financial',
    'financeiro',
    'medical',
    'medico',
    'health',
    'saude',
    'legal',
    'juridico'
]

// ============================================================================
// PROMPTS INTERNOS VERSIONADOS
// ============================================================================

export const INTERNAL_PROMPTS = {
    version: '1.0.0',

    /** Prompt para extração de memórias */
    MEMORY_EXTRACTION: `Você é um sistema de extração de memórias. Analise as mensagens abaixo e extraia APENAS informações duráveis, explícitas e de alto sinal que seriam úteis lembrar em conversas futuras.

EXTRAIA APENAS:
- Identidade profissional ou forma explícita como o usuário quer ser tratado
- Preferências estáveis do usuário (estilo, tom, formato)
- Contexto recorrente de projetos
- Stack tecnológico/ferramentas usadas frequentemente
- Objetivos ou metas repetidos
- Informações profissionais relevantes
- Fatos duráveis não sensíveis sobre rotina, ambiente ou constraints de trabalho
- Dados de contato apenas quando o usuário os apresentar como informação útil para trabalho

NÃO EXTRAIA:
- Informações sensíveis (senhas, tokens, dados financeiros, médicos, jurídicos)
- Contexto temporário ou específico de uma tarefa
- Opiniões momentâneas ou emoções
- Dados pessoais identificáveis sem utilidade clara em futuras conversas
- Suposições, inferências fracas ou preferências que o usuário não afirmou

Responda APENAS com um JSON válido no formato:
{
  "memories": [
    {
      "category": "identity|contact|preference|project_context|tech_stack|goal|professional|communication_style|expertise|fact",
      "text": "texto curto e objetivo (max 200 chars)",
      "tags": ["tag1", "tag2"],
      "confidence": 0.0-1.0,
      "reasoning": "breve justificativa"
    }
  ]
}

Se não houver memórias relevantes, retorne: {"memories": []}`,

    /** Prompt para refinar/atualizar memória existente */
    MEMORY_REFINEMENT: `Você está atualizando uma memória existente com novas informações.

MEMÓRIA ATUAL:
{existingMemory}

NOVAS INFORMAÇÕES:
{newInfo}

Se as novas informações complementam ou refinam a memória existente, retorne a versão atualizada.
Se são contraditórias ou a nova informação é mais recente/precisa, substitua.
Se não há relação, retorne null.

Responda APENAS com JSON:
{
  "action": "update|replace|ignore",
  "updatedText": "novo texto se action != ignore",
  "confidence": 0.0-1.0,
  "reasoning": "justificativa"
}`
} as const

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
    /** Configurações do usuário */
    CROSS_CHAT_ENABLED: 'selene_cross_chat_enabled',
    MEMORY_AUTOPILOT_ENABLED: 'selene_memory_autopilot_enabled',

    /** Índices e caches */
    EMBEDDING_INDEX: 'selene_embedding_index',
    EMBEDDING_CACHE: 'selene_embedding_cache',

    /** Memórias automáticas */
    AUTO_MEMORIES: 'selene_auto_memories',

    /** Métricas */
    CROSS_CHAT_METRICS: 'selene_cross_chat_metrics',
    MEMORY_AUTOPILOT_METRICS: 'selene_memory_autopilot_metrics',

    /** Controle diário */
    DAILY_MEMORY_COUNT: 'selene_daily_memory_count',
    LAST_RESET_DATE: 'selene_last_reset_date'
} as const

// ============================================================================
// TIPOS UTILITÁRIOS
// ============================================================================

export interface MetricsData {
    generated: number
    saved: number
    discarded: number
    deduplicated: number
    lastUpdated: number
}

export const createEmptyMetrics = (): MetricsData => ({
    generated: 0,
    saved: 0,
    discarded: 0,
    deduplicated: 0,
    lastUpdated: Date.now()
})
