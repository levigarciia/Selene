/**
 * useAssistants Hook
 * 
 * Manages multiple AI assistants with enhanced configuration,
 * permissions, and interaction flows for the ChatWindow.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { 
    AssistenteConfig, 
    AssistantPermission
} from '../utils/assistentesPadrao'
import { 
    DEFAULT_PERMISSIONS, 
    buildSystemPrompt,
    normalizarAssistente,
    ASSISTENTES_PADRAO,
    SELENE_DEFAULT_PROMPT
} from '../utils/assistentesPadrao'

// Alias para compatibilidade
type AssistantConfig = AssistenteConfig

// Storage keys
const STORAGE_KEYS = {
    assistants: 'selene_assistants_v2',
    activeId: 'selene_active_assistant_id',
    useDefault: 'selene_use_default_prompt'
}

// Note: SELENE_DEFAULT_PROMPT and DEFAULT_ASSISTANTS now come from assistentesPadrao.ts

export interface UseAssistantsReturn {
    // State
    assistants: AssistantConfig[]
    activeAssistant: AssistantConfig | null
    useDefaultPrompt: boolean
    
    // Computed
    effectiveSystemPrompt: string
    hasActiveAssistant: boolean
    
    // Actions
    selectAssistant: (id: string | null) => void
    toggleDefaultPrompt: () => void
    addAssistant: (config: Partial<AssistantConfig> & { nome: string; prompt: string }) => AssistantConfig
    updateAssistant: (id: string, updates: Partial<AssistantConfig>) => void
    removeAssistant: (id: string) => boolean
    duplicateAssistant: (id: string) => AssistantConfig | null
    restoreDefaults: () => void
    
    // Permission helpers
    hasPermission: (permission: AssistantPermission) => boolean
    getActivePermissions: () => AssistantPermission[]
    
    // Usage tracking
    incrementUsage: (id: string) => void
    getMostUsed: (limit?: number) => AssistantConfig[]
}

export function useAssistants(): UseAssistantsReturn {
    // Load assistants from storage
    const [assistants, setAssistants] = useState<AssistantConfig[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.assistants)
            if (stored) {
                const parsed = JSON.parse(stored) as AssistantConfig[]
                // Ensure all assistants have required fields
                return parsed.map(a => normalizarAssistente({ ...a, id: a.id, nome: a.nome, prompt: a.prompt }))
            }
        } catch (e) {
            console.warn('[useAssistants] Failed to load from storage:', e)
        }
        return ASSISTENTES_PADRAO
    })
    
    // Active assistant ID (null = use default prompt)
    const [activeAssistantId, setActiveAssistantId] = useState<string | null>(() => {
        return localStorage.getItem(STORAGE_KEYS.activeId) || null
    })
    
    // Whether to use the default Selene prompt instead of any assistant
    const [useDefaultPrompt, setUseDefaultPrompt] = useState<boolean>(() => {
        return localStorage.getItem(STORAGE_KEYS.useDefault) === 'true'
    })
    
    // Persist to storage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.assistants, JSON.stringify(assistants))
    }, [assistants])
    
    useEffect(() => {
        if (activeAssistantId) {
            localStorage.setItem(STORAGE_KEYS.activeId, activeAssistantId)
        } else {
            localStorage.removeItem(STORAGE_KEYS.activeId)
        }
    }, [activeAssistantId])
    
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.useDefault, String(useDefaultPrompt))
    }, [useDefaultPrompt])
    
    // Get active assistant
    const activeAssistant = useMemo(() => {
        if (useDefaultPrompt || !activeAssistantId) return null
        return assistants.find(a => a.id === activeAssistantId) || null
    }, [assistants, activeAssistantId, useDefaultPrompt])
    
    // Build effective system prompt
    const effectiveSystemPrompt = useMemo(() => {
        if (useDefaultPrompt || !activeAssistant) {
            return SELENE_DEFAULT_PROMPT
        }
        return buildSystemPrompt(activeAssistant)
    }, [activeAssistant, useDefaultPrompt])
    
    // Select assistant
    const selectAssistant = useCallback((id: string | null) => {
        setActiveAssistantId(id)
        if (id) {
            setUseDefaultPrompt(false)
        }
    }, [])
    
    // Toggle default prompt mode
    const toggleDefaultPrompt = useCallback(() => {
        setUseDefaultPrompt(prev => !prev)
    }, [])
    
    // Add new assistant
    const addAssistant = useCallback((config: Partial<AssistantConfig> & { nome: string; prompt: string }) => {
        const newAssistant = normalizarAssistente({
            ...config,
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            nome: config.nome,
            prompt: config.prompt,
            origem: 'personalizado'
        })
        
        setAssistants(prev => [...prev, newAssistant])
        return newAssistant
    }, [])
    
    // Update assistant
    const updateAssistant = useCallback((id: string, updates: Partial<AssistantConfig>) => {
        setAssistants(prev => prev.map(a => {
            if (a.id === id) {
                return { ...a, ...updates, updatedAt: Date.now() }
            }
            return a
        }))
    }, [])
    
    // Remove assistant
    const removeAssistant = useCallback((id: string) => {
        const assistant = assistants.find(a => a.id === id)
        if (!assistant || assistant.origem === 'padrao') {
            return false
        }
        
        setAssistants(prev => prev.filter(a => a.id !== id))
        
        if (activeAssistantId === id) {
            setActiveAssistantId(null)
        }
        
        return true
    }, [assistants, activeAssistantId])
    
    // Duplicate assistant
    const duplicateAssistant = useCallback((id: string) => {
        const source = assistants.find(a => a.id === id)
        if (!source) return null
        
        const duplicate = normalizarAssistente({
            ...source,
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            nome: `${source.nome} (Cópia)`,
            prompt: source.prompt,
            origem: 'personalizado',
            usageCount: 0
        })
        
        setAssistants(prev => [...prev, duplicate])
        return duplicate
    }, [assistants])
    
    // Restore default assistants
    const restoreDefaults = useCallback(() => {
        // Keep custom assistants, reset default ones
        const customAssistants = assistants.filter(a => a.origem === 'personalizado')
        setAssistants([...ASSISTENTES_PADRAO, ...customAssistants])
    }, [assistants])
    
    // Check if active assistant has a permission
    const hasPermission = useCallback((permission: AssistantPermission) => {
        if (useDefaultPrompt || !activeAssistant) {
            // Default prompt has all standard permissions
            return DEFAULT_PERMISSIONS.includes(permission)
        }
        return activeAssistant.permissions?.includes(permission) || false
    }, [activeAssistant, useDefaultPrompt])
    
    // Get all active permissions
    const getActivePermissions = useCallback(() => {
        if (useDefaultPrompt || !activeAssistant) {
            return [...DEFAULT_PERMISSIONS]
        }
        return activeAssistant.permissions || []
    }, [activeAssistant, useDefaultPrompt])
    
    // Increment usage counter
    const incrementUsage = useCallback((id: string) => {
        setAssistants(prev => prev.map(a => {
            if (a.id === id) {
                return { ...a, usageCount: (a.usageCount || 0) + 1 }
            }
            return a
        }))
    }, [])
    
    // Get most used assistants
    const getMostUsed = useCallback((limit = 5) => {
        return [...assistants]
            .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
            .slice(0, limit)
    }, [assistants])
    
    return {
        assistants,
        activeAssistant,
        useDefaultPrompt,
        effectiveSystemPrompt,
        hasActiveAssistant: !!activeAssistant,
        selectAssistant,
        toggleDefaultPrompt,
        addAssistant,
        updateAssistant,
        removeAssistant,
        duplicateAssistant,
        restoreDefaults,
        hasPermission,
        getActivePermissions,
        incrementUsage,
        getMostUsed
    }
}
