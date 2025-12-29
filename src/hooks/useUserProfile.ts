import { useState, useEffect, useCallback } from 'react'
import { MEMORY_AUTOPILOT_CONFIG } from '../config/memoryConfig'
import { areSimilar } from '../services/memory/MemoryExtractor'
import { v4 as uuidv4 } from 'uuid'

export interface UserProfile {
    name: string
    occupation: string
    aboutMe: string
}

export interface Memory {
    id: string
    content: string
    createdAt: number
}


export interface FiltroContextoPerfil {
    consulta?: string
    permitirContextoPessoal?: boolean
}

function normalizarTextoParaRelevancia(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function filtrarMemoriasPorRelevancia(memorias: Memory[], consulta?: string): Memory[] {
    if (!consulta) {
        return memorias
    }

    const consultaNormalizada = normalizarTextoParaRelevancia(consulta)
    if (!consultaNormalizada) {
        return memorias
    }

    return memorias.filter(memoria => {
        return areSimilar(
            consultaNormalizada,
            memoria.content,
            MEMORY_AUTOPILOT_CONFIG.RELEVANCIA_MINIMA_PARA_PROMPT
        )
    })
}

const PROFILE_KEY = 'selene_user_profile'
const MEMORIES_KEY = 'selene_memories'

export function useUserProfile() {
    // Profile state
    const [profile, setProfileState] = useState<UserProfile>(() => {
        const saved = localStorage.getItem(PROFILE_KEY)
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return { name: '', occupation: '', aboutMe: '' }
            }
        }
        return { name: '', occupation: '', aboutMe: '' }
    })

    // Memories state
    const [memories, setMemoriesState] = useState<Memory[]>(() => {
        const saved = localStorage.getItem(MEMORIES_KEY)
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return []
            }
        }
        return []
    })

    // Persist profile
    const setProfile = useCallback((newProfile: UserProfile) => {
        setProfileState(newProfile)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile))
    }, [])

    // Persist memories
    const setMemories = useCallback((newMemories: Memory[]) => {
        setMemoriesState(newMemories)
        localStorage.setItem(MEMORIES_KEY, JSON.stringify(newMemories))
    }, [])

    // Add memory
    const addMemory = useCallback((content: string) => {
        const memory: Memory = {
            id: uuidv4(),
            content,
            createdAt: Date.now()
        }
        const updated = [...memories, memory]
        setMemories(updated)
    }, [memories, setMemories])

    // Remove memory
    const removeMemory = useCallback((id: string) => {
        const updated = memories.filter(m => m.id !== id)
        setMemories(updated)
    }, [memories, setMemories])

    // Listen for storage changes from other windows
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === PROFILE_KEY && e.newValue) {
                try {
                    setProfileState(JSON.parse(e.newValue))
                } catch { }
            }
            if (e.key === MEMORIES_KEY && e.newValue) {
                try {
                    setMemoriesState(JSON.parse(e.newValue))
                } catch { }
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [])

    // Build enhanced system prompt context
    const getProfileContext = useCallback((filtro: FiltroContextoPerfil = {}) => {
        const permitirContextoPessoal = filtro.permitirContextoPessoal ?? true
        const consulta = filtro.consulta?.trim() || ''

        const memoriasFiltradas = permitirContextoPessoal
            ? filtrarMemoriasPorRelevancia(memories, consulta)
            : []

        const incluirSobreMim = Boolean(permitirContextoPessoal && profile.aboutMe)
        let context = ''

        if (profile.name || profile.occupation || incluirSobreMim || memoriasFiltradas.length > 0) {
            context += '\n\n--- Contexto do Usu\u00e1rio ---\n'

            if (profile.name) {
                context += `O usu\u00e1rio quer ser chamado de: ${profile.name}\n`
            }
            if (profile.occupation) {
                context += `Ocupa\u00e7\u00e3o: ${profile.occupation}\n`
            }
            if (incluirSobreMim) {
                context += `Sobre o usu\u00e1rio: ${profile.aboutMe}\n`
            }
            if (memoriasFiltradas.length > 0) {
                context += '\nMem\u00f3rias importantes:\n'
                memoriasFiltradas.forEach(m => {
                    context += `- ${m.content}\n`
                })
            }
        }

        return context
    }, [profile, memories])


    return {
        profile,
        setProfile,
        memories,
        addMemory,
        removeMemory,
        getProfileContext
    }
}
