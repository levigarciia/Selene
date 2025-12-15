/**
 * Memory Extractor
 * Version: 1.0.0
 * 
 * Responsável por extrair memórias duráveis e de alto sinal das mensagens.
 * Usa heurísticas conservadoras e LLM para extração inteligente.
 */

import {
    MEMORY_AUTOPILOT_CONFIG,
    CATEGORY_BLACKLIST,
    INTERNAL_PROMPTS,
    FEATURE_FLAGS
} from '../../config/memoryConfig'
import type {
    ExtractedMemory,
    LLMExtractionResponse,
    ExtractionMetrics
} from './AutoMemoryTypes'
import {
    validateExtractedMemory,
    validateLLMExtractionResponse,
    createExtractionMetrics
} from './AutoMemoryTypes'


// ============================================================================
// HEURÍSTICAS PRÉ-LLM
// ============================================================================

/**
 * Verifica se uma mensagem é candidata para extração
 * (filtragem rápida antes de chamar o LLM)
 */
function isExtractionCandidate(content: string): boolean {
    // Tamanho mínimo
    if (content.length < MEMORY_AUTOPILOT_CONFIG.MIN_MESSAGE_LENGTH_FOR_ANALYSIS) {
        return false
    }

    // Heurísticas de baixo sinal (mensagens que provavelmente não contêm memórias úteis)
    const lowSignalPatterns = [
        /^(ok|sim|não|certo|entendi|obrigad[oa]|valeu|beleza|blz|vlw)$/i,
        /^(pode ser|tá bom|ta bom|show|massa|legal)$/i,
        /^(oi|olá|ola|hey|e aí|eai|fala)\s*$/i,
        /^\?+$/,
        /^!+$/
    ]

    for (const pattern of lowSignalPatterns) {
        if (pattern.test(content.trim())) {
            return false
        }
    }

    // Heurísticas de alto sinal (indicadores de preferências/contexto)
    const highSignalIndicators = [
        /prefir[oa]/i,
        /gosto de/i,
        /não gosto/i,
        /sempre (uso|faço|prefiro)/i,
        /trabalho com/i,
        /meu (projeto|trabalho|objetivo)/i,
        /uso (geralmente|sempre|normalmente)/i,
        /minha stack/i,
        /sou (desenvolvedor|designer|dev|programador)/i,
        /especializ[oa]/i
    ]

    for (const indicator of highSignalIndicators) {
        if (indicator.test(content)) {
            return true
        }
    }

    // Se não tem indicadores claros, ainda pode ser candidata se for longa o suficiente
    return content.length > 150
}

/**
 * Verifica se uma categoria está na blacklist
 */
function isCategoryBlacklisted(category: string, text: string): boolean {
    const lowerCategory = category.toLowerCase()
    const lowerText = text.toLowerCase()

    for (const blocked of CATEGORY_BLACKLIST) {
        if (lowerCategory.includes(blocked) || lowerText.includes(blocked)) {
            return true
        }
    }

    return false
}

// ============================================================================
// EXTRAÇÃO COM LLM
// ============================================================================

/**
 * Extrai memórias usando o LLM
 */
async function extractWithLLM(
    messages: string[],
    chatFn: (prompt: string) => Promise<string>
): Promise<ExtractedMemory[]> {
    const prompt = `${INTERNAL_PROMPTS.MEMORY_EXTRACTION}

MENSAGENS A ANALISAR:
${messages.map((m, i) => `[${i + 1}] ${m}`).join('\n\n')}`

    try {
        const response = await chatFn(prompt)

        // Extrair JSON da resposta
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.warn('[MemoryExtractor] No JSON found in response')
            }
            return []
        }

        const parsed = JSON.parse(jsonMatch[0]) as LLMExtractionResponse

        if (!validateLLMExtractionResponse(parsed)) {
            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.warn('[MemoryExtractor] Invalid response schema')
            }
            return []
        }

        // Validar e filtrar cada memória
        const validMemories: ExtractedMemory[] = []

        for (const mem of parsed.memories) {
            // Verificar blacklist
            if (isCategoryBlacklisted(mem.category, mem.text)) {
                if (FEATURE_FLAGS.DEBUG_LOGGING) {
                    console.log('[MemoryExtractor] Blocked by blacklist:', mem.category)
                }
                continue
            }

            // Truncar texto se necessário
            const text = mem.text.slice(0, MEMORY_AUTOPILOT_CONFIG.MAX_MEMORY_TEXT_LENGTH)

            const extracted: ExtractedMemory = {
                category: mem.category as any,
                text,
                tags: mem.tags.slice(0, 5), // Máximo 5 tags
                confidence: Math.min(Math.max(mem.confidence, 0), 1), // Clamp 0-1
                reasoning: mem.reasoning || ''
            }

            if (validateExtractedMemory(extracted)) {
                validMemories.push(extracted)
            }
        }

        return validMemories
    } catch (error) {
        console.error('[MemoryExtractor] LLM extraction failed:', error)
        return []
    }
}

// ============================================================================
// EXTRAÇÃO LOCAL (FALLBACK)
// ============================================================================

/**
 * Extração baseada em regras (quando LLM não disponível)
 */
function extractLocally(messages: string[]): ExtractedMemory[] {
    const memories: ExtractedMemory[] = []

    const patterns: Array<{
        regex: RegExp
        category: string
        confidence: number
    }> = [
            {
                regex: /(?:eu\s+)?(?:sou|trabalho\s+como)\s+(.{5,50})/i,
                category: 'professional',
                confidence: 0.7
            },
            {
                regex: /minha?\s+stack\s+(?:é|inclui|tem)\s+(.{5,80})/i,
                category: 'tech_stack',
                confidence: 0.75
            },
            {
                regex: /(?:eu\s+)?(?:uso|utilizo)\s+(?:sempre|geralmente|normalmente)\s+(.{5,50})/i,
                category: 'preference',
                confidence: 0.65
            },
            {
                regex: /(?:eu\s+)?prefiro\s+(.{5,80})/i,
                category: 'preference',
                confidence: 0.7
            },
            {
                regex: /(?:meu\s+)?projeto\s+(?:é|sobre|de)\s+(.{5,100})/i,
                category: 'project_context',
                confidence: 0.6
            }
        ]

    for (const msg of messages) {
        for (const pattern of patterns) {
            const match = msg.match(pattern.regex)
            if (match && match[1]) {
                const text = match[1].trim().slice(0, MEMORY_AUTOPILOT_CONFIG.MAX_MEMORY_TEXT_LENGTH)

                if (text.length > 10 && !isCategoryBlacklisted(pattern.category, text)) {
                    memories.push({
                        category: pattern.category as any,
                        text,
                        tags: [],
                        confidence: pattern.confidence,
                        reasoning: 'Extracted by pattern matching'
                    })
                }
            }
        }
    }

    return memories
}

// ============================================================================
// API PRINCIPAL
// ============================================================================

export interface ExtractorConfig {
    /** Função para chamar o LLM */
    chatFn?: (prompt: string) => Promise<string>

    /** Usar apenas extração local (sem LLM) */
    localOnly?: boolean
}

/**
 * Extrai memórias de um conjunto de mensagens
 */
export async function extractMemories(
    messages: Array<{ id: string; content: string; timestamp: number }>,
    config: ExtractorConfig = {}
): Promise<{ memories: ExtractedMemory[]; metrics: ExtractionMetrics }> {
    const startTime = Date.now()
    const metrics = createExtractionMetrics()

    // Filtrar mensagens candidatas
    const candidates = messages
        .filter(m => isExtractionCandidate(m.content))
        .slice(0, MEMORY_AUTOPILOT_CONFIG.MAX_MESSAGES_PER_EXTRACTION)

    if (candidates.length === 0) {
        metrics.processingTimeMs = Date.now() - startTime
        return { memories: [], metrics }
    }

    let extracted: ExtractedMemory[]

    if (config.localOnly || !config.chatFn) {
        // Extração local
        extracted = extractLocally(candidates.map(c => c.content))
    } else {
        // Extração com LLM
        extracted = await extractWithLLM(
            candidates.map(c => c.content),
            config.chatFn
        )

        // Fallback para local se LLM não retornar nada
        if (extracted.length === 0) {
            extracted = extractLocally(candidates.map(c => c.content))
        }
    }

    metrics.generated = extracted.length

    // Filtrar por confiança mínima
    const confident = extracted.filter(m => {
        if (m.confidence < MEMORY_AUTOPILOT_CONFIG.MIN_CONFIDENCE) {
            metrics.discardedLowConfidence++
            return false
        }
        return true
    })

    metrics.saved = confident.length
    metrics.processingTimeMs = Date.now() - startTime

    if (FEATURE_FLAGS.DEBUG_LOGGING) {
        console.log('[MemoryExtractor] Extracted', confident.length, 'memories from', candidates.length, 'messages')
    }

    return { memories: confident, metrics }
}

/**
 * Verifica se duas memórias são duplicadas (baseado em texto)
 * Usa similaridade de Jaccard para comparação rápida
 */
export function areSimilar(text1: string, text2: string, threshold: number = 0.85): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)

    const words1 = new Set(normalize(text1))
    const words2 = new Set(normalize(text2))

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    const jaccard = intersection.size / union.size

    return jaccard >= threshold
}

/**
 * Deduplica memórias por similaridade
 */
export function deduplicateMemories(
    newMemories: ExtractedMemory[],
    existingMemories: string[]
): { unique: ExtractedMemory[]; duplicates: number } {
    const unique: ExtractedMemory[] = []
    let duplicates = 0

    for (const mem of newMemories) {
        let isDuplicate = false

        // Verificar contra existentes
        for (const existing of existingMemories) {
            if (areSimilar(mem.text, existing, MEMORY_AUTOPILOT_CONFIG.DEDUP_SIMILARITY_THRESHOLD)) {
                isDuplicate = true
                duplicates++
                break
            }
        }

        // Verificar contra novas já aceitas
        if (!isDuplicate) {
            for (const accepted of unique) {
                if (areSimilar(mem.text, accepted.text, MEMORY_AUTOPILOT_CONFIG.DEDUP_SIMILARITY_THRESHOLD)) {
                    isDuplicate = true
                    duplicates++
                    break
                }
            }
        }

        if (!isDuplicate) {
            unique.push(mem)
        }
    }

    return { unique, duplicates }
}
