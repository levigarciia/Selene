import type { ProjectFile } from '../../../types/project'
import type { ToolHandler, ToolResultItem } from '../../../types/tools'

interface ProjetoParaBusca {
    id: string
    files: ProjectFile[]
}

let obterProjetoCallback: ((projectId: string) => ProjetoParaBusca | null) | null = null

export function setProjectFilesSearchCallback(callback: (projectId: string) => ProjetoParaBusca | null): void {
    obterProjetoCallback = callback
}

export function clearProjectFilesSearchCallback(): void {
    obterProjetoCallback = null
}

export const projectFilesSearchHandler: ToolHandler = async (args, context) => {
    const projectId = typeof args.projectId === 'string' && args.projectId.trim()
        ? args.projectId.trim()
        : context?.projectId
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    const fileName = typeof args.fileName === 'string' ? args.fileName.trim() : ''

    if (!projectId) {
        return { success: false, error: 'Nenhum projeto ativo para buscar arquivos.' }
    }

    if (!query) {
        return { success: false, error: 'O parâmetro "query" é obrigatório.' }
    }

    if (!obterProjetoCallback) {
        return { success: false, error: 'Busca em arquivos do projeto não está disponível no momento.' }
    }

    const projeto = obterProjetoCallback(projectId)
    if (!projeto || projeto.files.length === 0) {
        return { success: false, error: 'O projeto ativo não possui arquivos indexados.' }
    }

    const arquivos = fileName
        ? projeto.files.filter((file) => normalizarTexto(file.name).includes(normalizarTexto(fileName)))
        : projeto.files

    if (arquivos.length === 0) {
        return { success: false, error: `Nenhum arquivo do projeto corresponde a "${fileName}".` }
    }

    const resultados = buscarNosArquivos(arquivos, query)
    if (resultados.length === 0) {
        return {
            success: true,
            data: {
                results: [],
                formattedForAI: `[Busca em arquivos do projeto]: nenhum trecho encontrado para "${query}".`,
                displayResults: [{
                    type: 'text',
                    title: 'Nenhum trecho encontrado',
                    content: query,
                } satisfies ToolResultItem],
            },
        }
    }

    const formattedForAI = [
        `[Busca em arquivos do projeto]: encontrados ${resultados.length} trecho(s) para "${query}".`,
        ...resultados.map((resultado, indice) => {
            return `\n### ${indice + 1}. ${resultado.file.name}\n${resultado.trecho}`
        }),
    ].join('\n')

    return {
        success: true,
        data: {
            results: resultados.map((resultado) => ({
                fileName: resultado.file.name,
                trecho: resultado.trecho,
            })),
            formattedForAI,
            displayResults: resultados.map((resultado) => ({
                type: 'text',
                title: resultado.file.name,
                content: resultado.trecho,
            } satisfies ToolResultItem)),
        },
    }
}

function buscarNosArquivos(files: ProjectFile[], query: string): Array<{ file: ProjectFile; trecho: string; score: number }> {
    const frases = extrairFrasesBusca(query)
    const termos = extrairTermosBusca(query, frases)
    if (termos.length === 0) return []

    return files
        .flatMap((file) => buscarNoArquivo(file, termos, frases))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
}

function buscarNoArquivo(
    file: ProjectFile,
    termos: string[],
    frases: string[]
): Array<{ file: ProjectFile; trecho: string; score: number }> {
    const paragrafos = file.content
        .split(/\n{2,}|(?<=\.)\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 20)

    return paragrafos
        .map((paragrafo) => {
            const textoNormalizado = normalizarTexto(paragrafo)
            const scoreTermos = termos.reduce((total, termo) => {
                return total + (textoNormalizado.includes(termo) ? 1 : 0)
            }, 0)
            const scoreFrases = frases.reduce((total, frase) => {
                return total + (textoNormalizado.includes(frase) ? 6 : 0)
            }, 0)
            return {
                file,
                trecho: limitarTrecho(paragrafo),
                score: scoreTermos + scoreFrases,
            }
        })
        .filter((resultado) => resultado.score > 0)
}

function extrairFrasesBusca(query: string): string[] {
    const frases = Array.from(query.matchAll(/["“”']([^"“”']{3,120})["“”']/g))
        .map((match) => normalizarTexto(match[1]))
        .filter((frase) => frase.length >= 3)

    return Array.from(new Set(frases)).slice(0, 4)
}

function extrairTermosBusca(query: string, frases: string[]): string[] {
    const ignoradas = new Set([
        'me', 'explique', 'explica', 'resuma', 'resumo', 'sobre', 'que', 'qual', 'quais', 'uma', 'uns',
        'umas', 'para', 'por', 'com', 'sem', 'pdf', 'arquivo', 'projeto', 'do', 'da', 'de', 'dos', 'das',
        'o', 'a', 'os', 'as', 'e',
    ])

    return normalizarTexto(query)
        .split(/\s+/)
        .filter((termo) => termo.length >= 3 && !ignoradas.has(termo))
        .filter((termo) => !frases.some((frase) => frase === termo))
        .slice(0, 8)
}

function normalizarTexto(texto: string): string {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function limitarTrecho(texto: string): string {
    const limpo = texto.replace(/\s+/g, ' ').trim()
    return limpo.length > 900 ? `${limpo.slice(0, 900).trimEnd()}...` : limpo
}
