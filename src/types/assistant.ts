// Re-export all types and functions from unified assistentesPadrao.ts
// This file exists for convenience, but the canonical source is assistentesPadrao.ts

export type {
    AssistenteConfig,
    AssistantConfig,
    AssistantPermission,
    AssistantBehavior,
    AssistantTone,
    AssistantInteractionFlow
} from '../utils/assistentesPadrao'

export {
    ASSISTENTES_PADRAO,
    DEFAULT_PERMISSIONS,
    DEFAULT_BEHAVIORS,
    DEFAULT_TONE,
    DEFAULT_INTERACTION_FLOW,
    criarAssistenteVazio,
    normalizarAssistente,
    buildSystemPrompt,
    SELENE_DEFAULT_PROMPT
} from '../utils/assistentesPadrao'
