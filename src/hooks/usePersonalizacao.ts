/**
 * usePersonalizacao Hook
 *
 * Gerencia as preferências de personalização da Selene:
 * - Estilo e tom básicos (dropdown)
 * - Instruções personalizadas (textarea livre)
 */

import { useState, useCallback, useMemo } from 'react'
import {
    type ConfigPersonalizacao,
    type EstiloTom,
    PERSONALIZACAO_PADRAO,
    buildPromptPersonalizado
} from '../utils/personalizacao'

// Chaves de persistência no localStorage
const STORAGE_KEYS = {
    estiloTom: 'selene_estilo_tom',
    instrucoesPersonalizadas: 'selene_instrucoes_personalizadas'
}

function carregarConfig(): ConfigPersonalizacao {
    try {
        const estiloTom = (localStorage.getItem(STORAGE_KEYS.estiloTom) || PERSONALIZACAO_PADRAO.estiloTom) as EstiloTom
        const instrucoesPersonalizadas = localStorage.getItem(STORAGE_KEYS.instrucoesPersonalizadas) || PERSONALIZACAO_PADRAO.instrucoesPersonalizadas
        return { estiloTom, instrucoesPersonalizadas }
    } catch {
        return { ...PERSONALIZACAO_PADRAO }
    }
}

export interface UsePersonalizacaoReturn {
    estiloTom: EstiloTom
    instrucoesPersonalizadas: string
    effectiveSystemPrompt: string
    setEstiloTom: (estilo: EstiloTom) => void
    setInstrucoesPersonalizadas: (instrucoes: string) => void
}

export function usePersonalizacao(): UsePersonalizacaoReturn {
    const configInicial = useMemo(() => carregarConfig(), [])

    const [estiloTom, setEstiloTomState] = useState<EstiloTom>(configInicial.estiloTom)
    const [instrucoesPersonalizadas, setInstrucoesPersonalizadasState] = useState(configInicial.instrucoesPersonalizadas)

    // System prompt final — recomputa quando qualquer campo muda
    const effectiveSystemPrompt = useMemo(
        () => buildPromptPersonalizado({ estiloTom, instrucoesPersonalizadas }),
        [estiloTom, instrucoesPersonalizadas]
    )

    const setEstiloTom = useCallback((estilo: EstiloTom) => {
        setEstiloTomState(estilo)
        try {
            localStorage.setItem(STORAGE_KEYS.estiloTom, estilo)
        } catch {
            // silencioso
        }
    }, [])

    const setInstrucoesPersonalizadas = useCallback((instrucoes: string) => {
        setInstrucoesPersonalizadasState(instrucoes)
        try {
            localStorage.setItem(STORAGE_KEYS.instrucoesPersonalizadas, instrucoes)
        } catch {
            // silencioso
        }
    }, [])

    return {
        estiloTom,
        instrucoesPersonalizadas,
        effectiveSystemPrompt,
        setEstiloTom,
        setInstrucoesPersonalizadas
    }
}
