// Source Formatting Utilities for Web Search Results
import React from 'react'
import type { WebSource } from '../types'
import { FontePill } from './FontePill'

// Get source name from URL
export const obterNomeFonte = (url: string, titulo: string): string => {
    try {
        const hostname = new URL(url).hostname.replace('www.', '')
        const base = hostname.split('.')[0] || ''
        if (base) return base.charAt(0).toUpperCase() + base.slice(1)
    } catch {
        // Ignora erro e usa fallback
    }
    return titulo.substring(0, 20)
}

// Normalize source name for comparison
export const normalizarNomeFonte = (nome: string): string => nome.trim().toLowerCase()

// Find source by label
export const encontrarFonte = (rotulo: string, fontes: WebSource[]): WebSource | undefined => {
    const alvo = normalizarNomeFonte(rotulo)
    return fontes.find((fonte) => {
        const nomeFonte = fonte.nomeFonte ? normalizarNomeFonte(fonte.nomeFonte) : ''
        const dominio = fonte.dominio ? normalizarNomeFonte(fonte.dominio) : ''
        const titulo = fonte.title ? normalizarNomeFonte(fonte.title) : ''
        return nomeFonte === alvo || dominio === alvo || titulo === alvo
    })
}

// Transform text with source references
export const transformarTextoComFontes = (texto: string, fontes: WebSource[]) => {
    const regex = /\[\[(fonte|fontes)\s*:\s*([^\]]+)\]\]/gi
    const partes: React.ReactNode[] = []
    let ultimoIndice = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(texto)) !== null) {
        if (match.index > ultimoIndice) {
            partes.push(texto.slice(ultimoIndice, match.index))
        }

        const nomes = match[2].split(',').map((item) => item.trim()).filter(Boolean)
        nomes.forEach((nome, idx) => {
            const fonte = encontrarFonte(nome, fontes)
            partes.push(<FontePill key={`${match?.index}-${idx}-${nome}`} rotulo={nome} fonte={fonte} />)
            if (idx < nomes.length - 1) {
                partes.push(' ')
            }
        })

        ultimoIndice = match.index + match[0].length
    }

    if (ultimoIndice < texto.length) {
        partes.push(texto.slice(ultimoIndice))
    }

    return partes
}

// Recursively render nodes with source formatting
export const renderizarNosComFontes = (nos: React.ReactNode, fontes: WebSource[]): React.ReactNode => {
    return React.Children.map(nos, (no) => {
        if (typeof no === 'string') {
            return transformarTextoComFontes(no, fontes)
        }
        if (React.isValidElement(no)) {
            const props = no.props as { children?: React.ReactNode }
            if (props.children) {
                const filhos = renderizarNosComFontes(props.children, fontes)
                return React.cloneElement(no, {}, filhos)
            }
        }
        return no
    })
}

