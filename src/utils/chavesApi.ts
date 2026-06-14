function removerCaracteresInvisiveis(valor: string): string {
    return valor.replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/**
 * Normaliza a chave da OpenRouter removendo prefixos e sujeira comum de clipboard.
 */
export function normalizarChaveOpenRouter(valor: string): string {
    return removerCaracteresInvisiveis(valor)
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/^bearer\s+/i, '')
        .replace(/\s+/g, '')
}

export function pareceChaveOpenRouter(valor: string): boolean {
    return /^sk-or(?:-v1)?-[A-Za-z0-9_-]{16,}$/.test(normalizarChaveOpenRouter(valor))
}
