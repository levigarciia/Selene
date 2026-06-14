/**
 * Web Search Tool Handler
 * 
 * Handles web search tool calls using the existing WebSearchService.
 */

import { searchWeb, fetchUrlContent, formatSearchResultsForAI } from '../../WebSearchService'
import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'
import { toolExecutor } from '../ToolExecutor'

function extrairDominio(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
        return ''
    }
}

function normalizarUrl(url: string): string {
    try {
        const parsed = new URL(url)
        parsed.hash = ''
        return parsed.toString().replace(/\/$/, '')
    } catch {
        return url.trim()
    }
}

function consultaExigeEscalonamento(queryUsuario: string): boolean {
    const texto = (queryUsuario || '').toLowerCase()
    if (!texto) return false

    const padroes = [
        /\b(explica|explic[aç][aã]o|resumo)\b/i,
        /\b(treta|pol[eê]mica|esc[âa]ndalo|crise)\b/i,
        /\b(o que aconteceu|o que est[aá] acontecendo|causa|motivo)\b/i,
        /\b(ultim[oa]s?\s+dias|esta\s+semana)\b/i
    ]

    return padroes.some((padrao) => padrao.test(texto))
}

function avaliarQualidadeResultados(urls: string[], snippets: string[]): { baixaQualidade: boolean } {
    const resultadosUteis = snippets.filter((snippet) => (snippet || '').trim().length >= 25).length
    const dominiosUnicos = new Set(
        urls
            .map((url) => extrairDominio(url))
            .filter(Boolean)
    ).size

    return {
        baixaQualidade: resultadosUteis < 3 || dominiosUnicos < 2,
    }
}

type ResultadoBusca = {
    title: string
    url: string
    snippet: string
    content?: string
}

function deduplicarResultados(resultados: ResultadoBusca[]): ResultadoBusca[] {
    const porUrl = new Set<string>()
    const contagemDominio = new Map<string, number>()
    const deduplicados: ResultadoBusca[] = []

    for (const resultado of resultados) {
        const chaveUrl = normalizarUrl(resultado.url)
        if (!chaveUrl || porUrl.has(chaveUrl)) continue

        const dominio = extrairDominio(resultado.url)
        const quantidadeNoDominio = contagemDominio.get(dominio) || 0
        if (dominio && quantidadeNoDominio >= 2) continue

        porUrl.add(chaveUrl)
        if (dominio) {
            contagemDominio.set(dominio, quantidadeNoDominio + 1)
        }
        deduplicados.push(resultado)
        if (deduplicados.length >= 10) break
    }

    return deduplicados
}

export const webSearchHandler: ToolHandler = async (args, context): Promise<ToolCallResult> => {
    const queryPrincipalBruta = (args.queryPrincipal as string) || (args.query as string) || ''
    const queryPrincipal = String(queryPrincipalBruta || '').replace(/\s+/g, ' ').trim().slice(0, 100)
    
    if (!queryPrincipal || typeof queryPrincipal !== 'string') {
        return {
            success: false,
            error: 'Query parameter is required and must be a string'
        }
    }

    const callId = context?.callId

    console.log('[WebSearchTool] Searching:', queryPrincipal)
    if (callId) {
        toolExecutor.reportProgress(callId, `Buscando: "${queryPrincipal}"...`)
    }

    try {
        const respostaPrincipal = await searchWeb(queryPrincipal, 5)

        const urlsPrincipais = respostaPrincipal.results.map((resultado) => resultado.url)
        const snippetsPrincipais = respostaPrincipal.results.map((resultado) => resultado.snippet || resultado.content || '')
        const qualidadePrincipal = avaliarQualidadeResultados(urlsPrincipais, snippetsPrincipais)
        const exigeAnalisePosterior = consultaExigeEscalonamento((context?.userQuery as string) || queryPrincipal)

        const resultadosAgregados = deduplicarResultados(
            respostaPrincipal.results
        )

        if (resultadosAgregados.length === 0) {
            return {
                success: true,
                data: {
                    query: queryPrincipal,
                    queryPrincipal,
                    results: [],
                    formattedForAI: `[Nenhum resultado encontrado para: "${queryPrincipal}"]`,
                    baixaQualidade: qualidadePrincipal.baixaQualidade,
                    exigeAnalisePosterior,
                    displayResults: []
                }
            }
        }

        // Enriquecer os primeiros resultados com conteúdo da página
        // Timeout curto (2500ms): sites de placares ao vivo usam JS e bloqueiam fetch estático
        if (resultadosAgregados.length > 0 && callId) {
            toolExecutor.reportProgress(callId, `Extraindo conteúdo das principais páginas encontradas...`)
        }
        const enrichedResults = await Promise.all(
            resultadosAgregados.slice(0, 3).map(async (result) => {
                try {
                    if (result.content && result.content.length > 0) {
                        return result
                    }
                    const content = await fetchUrlContent(result.url, 1500, 2500)

                    // Descarta conteúdo que é mensagem de erro ou muito curto para ser útil
                    // Nesse caso o formatador usará o snippet do DuckDuckGo
                    const conteudoUtil = content
                        && content.length >= 80
                        && !content.startsWith('[Erro')
                        && !content.startsWith('[Conteúdo')

                    return { ...result, content: conteudoUtil ? content : undefined }
                } catch {
                    return result
                }
            })
        )

        const resultadosFinais = [
            ...enrichedResults,
            ...resultadosAgregados.slice(enrichedResults.length)
        ]

        // Format for AI context
        const formattedForAI = formatSearchResultsForAI({
            query: queryPrincipal,
            results: resultadosFinais,
            timestamp: Date.now(),
        })

        // Format for UI display
        const displayResults: ToolResultItem[] = resultadosFinais.map(r => {
            const dominio = extrairDominio(r.url)
            return {
                type: 'link' as const,
                title: r.title,
                content: r.snippet || r.content?.substring(0, 150) || '',
                url: r.url,
                favicon: `https://www.google.com/s2/favicons?domain=${dominio || 'google.com'}&sz=32`
            }
        })

        return {
            success: true,
            data: {
                query: queryPrincipal,
                queryPrincipal,
                results: resultadosFinais,
                formattedForAI,
                baixaQualidade: qualidadePrincipal.baixaQualidade,
                exigeAnalisePosterior,
                displayResults
            }
        }
    } catch (error: unknown) {
        console.error('[WebSearchTool] Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Web search failed'
        }
    }
}
