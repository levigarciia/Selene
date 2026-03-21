export type EscopoMemoria = `project:${string}` | 'global'

export function obterEscopoMemoria(projectId?: string): EscopoMemoria {
    if (projectId && projectId.trim()) {
        return `project:${projectId}`
    }
    return 'global'
}

export function pertenceAoEscopo(
    projectIdDaOrigem: string | undefined,
    projectIdAtual: string | undefined
): boolean {
    if (projectIdAtual) {
        return projectIdDaOrigem === projectIdAtual
    }
    return !projectIdDaOrigem
}
