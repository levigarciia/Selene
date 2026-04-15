/**
 * Memory Extractor Tests
 * 
 * Testes unitários para funções de deduplicação e thresholds
 * do sistema de memória automática.
 */

import { describe, test, expect } from 'vitest'
import { areSimilar, deduplicateMemories } from '../MemoryExtractor'
import type { ExtractedMemory } from '../AutoMemoryTypes'
import type { MemoryCategory } from '../../../config/memoryConfig'

describe('areSimilar', () => {
    test('should detect identical texts as similar', () => {
        const text = 'Eu trabalho como desenvolvedor de software'
        expect(areSimilar(text, text)).toBe(true)
    })

    test('should detect very similar texts', () => {
        const text1 = 'Eu uso React e TypeScript para desenvolvimento web'
        const text2 = 'Uso React e TypeScript no desenvolvimento web'
        expect(areSimilar(text1, text2, 0.7)).toBe(true)
    })

    test('should not detect dissimilar texts as similar', () => {
        const text1 = 'Eu trabalho com Python e machine learning'
        const text2 = 'Prefiro café sem açúcar'
        expect(areSimilar(text1, text2)).toBe(false)
    })

    test('should respect custom threshold', () => {
        const text1 = 'Desenvolvedor React'
        const text2 = 'Desenvolvedor Vue'

        // Com threshold baixo, deve ser similar (compartilham "Desenvolvedor")
        expect(areSimilar(text1, text2, 0.3)).toBe(true)

        // Com threshold alto, não deve ser similar
        expect(areSimilar(text1, text2, 0.9)).toBe(false)
    })

    test('should handle empty strings', () => {
        expect(areSimilar('', '')).toBe(true)
        expect(areSimilar('texto', '')).toBe(false)
    })

    test('should be case insensitive', () => {
        const text1 = 'DESENVOLVIMENTO WEB'
        const text2 = 'desenvolvimento web'
        expect(areSimilar(text1, text2)).toBe(true)
    })

    test('should ignore punctuation', () => {
        const text1 = 'Eu gosto de programar!'
        const text2 = 'Eu gosto de programar'
        expect(areSimilar(text1, text2)).toBe(true)
    })
})

describe('deduplicateMemories', () => {
    const createMemory = (text: string): ExtractedMemory => ({
        category: 'preference' as MemoryCategory,
        text,
        tags: [],
        confidence: 0.8,
        reasoning: 'test'
    })

    test('should keep unique memories', () => {
        const memories = [
            createMemory('Prefiro TypeScript'),
            createMemory('Uso React para frontend'),
            createMemory('Trabalho com Node.js')
        ]

        const { unique, duplicates } = deduplicateMemories(memories, [])

        expect(unique.length).toBe(3)
        expect(duplicates).toBe(0)
    })

    test('should remove duplicates from new memories', () => {
        const memories = [
            createMemory('Prefiro TypeScript'),
            createMemory('Eu prefiro TypeScript'),
            createMemory('Trabalho com Node.js')
        ]

        const { unique, duplicates } = deduplicateMemories(memories, [])

        expect(unique.length).toBe(2)
        expect(duplicates).toBe(1)
    })

    test('should remove duplicates against existing memories', () => {
        const memories = [
            createMemory('Prefiro TypeScript'),
            createMemory('Uso React')
        ]

        const existing = ['Eu prefiro usar TypeScript']

        const { unique, duplicates } = deduplicateMemories(memories, existing)

        expect(unique.length).toBe(1)
        expect(unique[0].text).toBe('Uso React')
        expect(duplicates).toBe(1)
    })

    test('should handle empty inputs', () => {
        const { unique, duplicates } = deduplicateMemories([], [])
        expect(unique.length).toBe(0)
        expect(duplicates).toBe(0)
    })

    test('should handle empty new memories with existing', () => {
        const { unique, duplicates } = deduplicateMemories([], ['existing memory'])
        expect(unique.length).toBe(0)
        expect(duplicates).toBe(0)
    })
})
