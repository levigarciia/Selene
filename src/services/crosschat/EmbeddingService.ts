/**
 * Embedding Service
 * Version: 1.0.0
 * 
 * Serviço para geração de embeddings vetoriais.
 * Usa a API de embeddings da OpenAI ou fallback para hash simples.
 */

import { CROSS_CHAT_CONFIG, STORAGE_KEYS, FEATURE_FLAGS } from '../../config/memoryConfig'

// ============================================================================
// TIPOS
// ============================================================================

interface EmbeddingCacheEntry {
    embedding: number[]
    createdAt: number
}

interface EmbeddingCacheStore {
    entries: Record<string, EmbeddingCacheEntry>
    lastCleanup: number
}

// ============================================================================
// CACHE EM MEMÓRIA
// ============================================================================

let memoryCache: Map<string, number[]> = new Map()

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Gera um hash simples de uma string para uso como chave de cache
 */
function hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
}

/**
 * Normaliza texto para embedding
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 8000) // Limite para API
}

/**
 * Estima tokens de um texto (aproximação)
 */
export function estimateTokens(text: string): number {
    // Aproximação: 1 token ≈ 4 caracteres em português/inglês
    return Math.ceil(text.length / 4)
}

// ============================================================================
// FALLBACK: EMBEDDING LOCAL SIMPLES
// ============================================================================

/**
 * Gera um embedding local simples baseado em características do texto.
 * Usado como fallback quando API não está disponível.
 * NOTA: Não é tão preciso quanto embeddings de LLM, mas funciona offline.
 */
function generateLocalEmbedding(text: string): number[] {
    const normalized = normalizeText(text)
    const dimension = 128 // Dimensão reduzida para embedding local
    const embedding: number[] = new Array(dimension).fill(0)

    // Características básicas
    const words = normalized.split(' ')
    const chars = normalized.split('')

    // 1. Distribuição de caracteres (primeiros 26 dims - letras)
    for (const char of chars) {
        const code = char.charCodeAt(0)
        if (code >= 97 && code <= 122) { // a-z
            embedding[code - 97] += 1
        }
    }

    // 2. Comprimento e estatísticas (dims 26-35)
    embedding[26] = Math.min(words.length / 100, 1) // Normalizado
    embedding[27] = Math.min(chars.length / 1000, 1)
    embedding[28] = words.length > 0 ? chars.length / words.length / 10 : 0 // Comprimento médio de palavra

    // 3. N-grams hash (dims 36-99) - bigrams de caracteres
    for (let i = 0; i < chars.length - 1; i++) {
        const bigram = chars[i] + chars[i + 1]
        const idx = 36 + (hashString(bigram).charCodeAt(0) % 64)
        embedding[idx] += 0.1
    }

    // 4. Word hash (dims 100-127)
    for (const word of words) {
        const idx = 100 + (hashString(word).charCodeAt(0) % 28)
        embedding[idx] += 0.1
    }

    // Normalizar para vetor unitário
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= magnitude
        }
    }

    return embedding
}

// ============================================================================
// API DE EMBEDDINGS
// ============================================================================

/**
 * Gera embedding usando a API da OpenAI
 */
async function generateOpenAIEmbedding(
    text: string,
    apiKey: string
): Promise<number[] | null> {
    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: CROSS_CHAT_CONFIG.EMBEDDING_MODEL,
                input: normalizeText(text)
            })
        })

        if (!response.ok) {
            console.warn('[EmbeddingService] OpenAI API error:', response.status)
            return null
        }

        const data = await response.json()
        return data.data?.[0]?.embedding ?? null
    } catch (error) {
        console.warn('[EmbeddingService] OpenAI API failed:', error)
        return null
    }
}

// ============================================================================
// CACHE PERSISTENTE
// ============================================================================

function loadCache(): EmbeddingCacheStore {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.EMBEDDING_CACHE)
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (e) {
        console.warn('[EmbeddingService] Failed to load cache:', e)
    }
    return { entries: {}, lastCleanup: Date.now() }
}

function saveCache(cache: EmbeddingCacheStore): void {
    try {
        localStorage.setItem(STORAGE_KEYS.EMBEDDING_CACHE, JSON.stringify(cache))
    } catch (e) {
        console.warn('[EmbeddingService] Failed to save cache:', e)
    }
}

function cleanupCache(cache: EmbeddingCacheStore): EmbeddingCacheStore {
    const now = Date.now()
    const maxAge = CROSS_CHAT_CONFIG.CACHE_TTL_MS * 10 // 10x TTL para limpeza

    const entries: Record<string, EmbeddingCacheEntry> = {}
    let count = 0

    for (const [key, entry] of Object.entries(cache.entries)) {
        if (now - entry.createdAt < maxAge && count < 1000) {
            entries[key] = entry
            count++
        }
    }

    return { entries, lastCleanup: now }
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class EmbeddingService {
    private apiKey: string | null = null
    private cache: EmbeddingCacheStore
    private useLocalFallback: boolean = false

    constructor() {
        this.cache = loadCache()

        // Cleanup periódico
        if (Date.now() - this.cache.lastCleanup > 3600000) {
            this.cache = cleanupCache(this.cache)
            saveCache(this.cache)
        }
    }

    /**
     * Configura a API key para embeddings
     */
    setApiKey(key: string): void {
        this.apiKey = key
        this.useLocalFallback = !key
    }

    /**
     * Força uso de embedding local (para testes ou offline)
     */
    setLocalMode(enabled: boolean): void {
        this.useLocalFallback = enabled
    }

    /**
     * Gera embedding para um texto
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const normalized = normalizeText(text)
        const cacheKey = hashString(normalized)

        // 1. Verificar cache em memória
        if (memoryCache.has(cacheKey)) {
            return memoryCache.get(cacheKey)!
        }

        // 2. Verificar cache persistente
        const cached = this.cache.entries[cacheKey]
        if (cached && Date.now() - cached.createdAt < CROSS_CHAT_CONFIG.CACHE_TTL_MS) {
            memoryCache.set(cacheKey, cached.embedding)
            return cached.embedding
        }

        // 3. Gerar novo embedding
        let embedding: number[]

        if (!this.useLocalFallback && this.apiKey) {
            const apiEmbedding = await generateOpenAIEmbedding(normalized, this.apiKey)
            if (apiEmbedding) {
                embedding = apiEmbedding
            } else {
                // Fallback para local se API falhar
                embedding = generateLocalEmbedding(normalized)
            }
        } else {
            embedding = generateLocalEmbedding(normalized)
        }

        // 4. Atualizar caches
        memoryCache.set(cacheKey, embedding)
        this.cache.entries[cacheKey] = {
            embedding,
            createdAt: Date.now()
        }

        // Salvar cache periodicamente (não a cada chamada para performance)
        if (Object.keys(this.cache.entries).length % 10 === 0) {
            saveCache(this.cache)
        }

        return embedding
    }

    /**
     * Gera embeddings para múltiplos textos
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(t => this.generateEmbedding(t)))
    }

    /**
     * Calcula similaridade cosseno entre dois embeddings
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            // Se dimensões diferentes, usar embedding local para ambos
            if (FEATURE_FLAGS.DEBUG_LOGGING) {
                console.warn('[EmbeddingService] Dimension mismatch, cannot compare')
            }
            return 0
        }

        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
        if (magnitude === 0) return 0

        return dotProduct / magnitude
    }

    /**
     * Encontra os K textos mais similares
     */
    async findMostSimilar(
        query: string,
        candidates: Array<{ text: string; embedding?: number[] }>,
        k: number = 5
    ): Promise<Array<{ index: number; similarity: number }>> {
        const queryEmbedding = await this.generateEmbedding(query)

        const similarities: Array<{ index: number; similarity: number }> = []

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i]
            const embedding = candidate.embedding ?? await this.generateEmbedding(candidate.text)
            const similarity = this.cosineSimilarity(queryEmbedding, embedding)
            similarities.push({ index: i, similarity })
        }

        // Ordenar por similaridade decrescente
        similarities.sort((a, b) => b.similarity - a.similarity)

        return similarities.slice(0, k)
    }

    /**
     * Limpa caches
     */
    clearCache(): void {
        memoryCache.clear()
        this.cache = { entries: {}, lastCleanup: Date.now() }
        saveCache(this.cache)
    }

    /**
     * Obtém estatísticas do cache
     */
    getCacheStats(): { memorySize: number; persistentSize: number } {
        return {
            memorySize: memoryCache.size,
            persistentSize: Object.keys(this.cache.entries).length
        }
    }
}

// Singleton
let instance: EmbeddingService | null = null

export function getEmbeddingService(): EmbeddingService {
    if (!instance) {
        instance = new EmbeddingService()
    }
    return instance
}
