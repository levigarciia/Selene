/**
 * Web Search Service for Electron Main Process
 * 
 * Free web search using DuckDuckGo
 * Runs in main process to avoid CORS issues
 */

import { ipcMain, shell } from 'electron'
import * as https from 'https'
import * as http from 'http'

export interface SearchResult {
    title: string
    url: string
    snippet: string
    content?: string  // Full page content
}

export interface WebSearchResponse {
    query: string
    results: SearchResult[]
    timestamp: number
}

function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

/**
 * Fetch URL content with proper handling
 */
function fetchUrl(url: string, timeout = 10000, redirecionamentosRestantes = 3): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url)
            const protocol = urlObj.protocol === 'https:' ? https : http
            
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            }

            const req = protocol.request(options, (res) => {
                // Trata redirecionamentos (301, 302, 303, 307, 308)
                const redirecionamento = [301, 302, 303, 307, 308].includes(res.statusCode || 0)
                if (redirecionamento && res.headers.location) {
                    if (redirecionamentosRestantes <= 0) {
                        reject(new Error('Limite de redirecionamentos excedido'))
                        return
                    }

                    let redirectUrl = res.headers.location
                    try {
                        // Trata URL relativa resolvendo com base na URL original
                        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
                            redirectUrl = new URL(redirectUrl, url).toString()
                        }
                        fetchUrl(redirectUrl, timeout, redirecionamentosRestantes - 1).then(resolve).catch(reject)
                    } catch (err) {
                        reject(err)
                    }
                    return
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`))
                    return
                }

                let data = ''
                res.on('data', chunk => data += chunk)
                res.on('end', () => resolve(data))
            })

            req.on('error', reject)
            req.setTimeout(timeout, () => {
                req.destroy()
                reject(new Error('Timeout'))
            })
            req.end()
        } catch (error) {
            reject(error)
        }
    })
}
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&nbsp;/g, ' ')
}

/**
 * Extract readable text from HTML page
 */
function extractTextFromHtml(html: string, maxLength = 2500): string {
    console.log('[WebSearch] Extracting text from HTML, raw length:', html.length)
    
    // Remove scripts, styles, and other non-content elements
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
    
    // Try to extract main content
    const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                      text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                      text.match(/<div[^>]*class="[^"]*(?:content|article|post|entry|text|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    
    if (mainMatch) {
        console.log('[WebSearch] Found main content section')
        text = mainMatch[1]
    }
    
    // Try to get paragraphs if no main content found
    if (!mainMatch) {
        const paragraphs: string[] = []
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
        let pMatch
        while ((pMatch = pRegex.exec(text)) !== null && paragraphs.length < 20) {
            const pText = pMatch[1].replace(/<[^>]+>/g, ' ').trim()
            if (pText.length > 50) {  // Skip short paragraphs
                paragraphs.push(pText)
            }
        }
        if (paragraphs.length > 2) {
            console.log('[WebSearch] Extracted', paragraphs.length, 'paragraphs')
            text = paragraphs.join('\n\n')
        }
    }
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Decode entities
    text = decodeHtmlEntities(text)
    
    // Normalize whitespace
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim()
    
    console.log('[WebSearch] Extracted text length:', text.length)
    
    // Limit length
    if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...'
    }
    
    return text
}

/**
 * Fetch page content for a search result
 */
async function fetchPageContent(url: string): Promise<string> {
    try {
        console.log('[WebSearch] Fetching page content:', url)
        const html = await fetchUrl(url, 5000)  // 5s timeout per page
        const content = extractTextFromHtml(html)
        console.log('[WebSearch] Got page content, length:', content.length)
        return content
    } catch (error: unknown) {
        console.warn('[WebSearch] Failed to fetch page:', url, obterMensagemErro(error))
        return ''
    }
}

/**
 * Parse html.duckduckgo.com results
 */
/**
 * Extrai o texto completo de um bloco de snippet do DuckDuckGo,
 * removendo tags HTML internas (como <b>, <em>) mas preservando o texto.
 * Captura tudo até o fechamento da tag <a> de snippet.
 */
function extrairTextoSnippet(html: string, posicaoInicio: number): string {
    // Encontra o fechamento da tag <a> do snippet
    const fechamento = html.indexOf('</a>', posicaoInicio)
    if (fechamento === -1) return ''

    const bloco = html.slice(posicaoInicio, fechamento)
    // Remove todas as tags HTML e normaliza espaços
    return decodeHtmlEntities(
        bloco.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    )
}

function parseHtmlDuckDuckGo(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = []

    // Padrão para links de resultado (result__a)
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    let match
    const links: Array<{url: string, title: string}> = []

    while ((match = resultPattern.exec(html)) !== null && links.length < maxResults) {
        let url = match[1]
        const title = decodeHtmlEntities(match[2].trim())

        // Trata redirect do DDG (?uddg=)
        if (url.includes('uddg=')) {
            const uddgMatch = url.match(/uddg=([^&]+)/)
            if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1])
            }
        }

        if (url.includes('duckduckgo.com')) continue

        links.push({ url, title })
    }

    // Extrai snippets capturando o bloco completo (inclusive tags <b>, <em> etc.)
    const snippets: string[] = []
    // Reinicia o regex do snippet para percorrer todo o HTML
    const snippetPatternGlobal = /<a[^>]+class="result__snippet"[^>]*>/gi
    let snippetTagMatch
    while ((snippetTagMatch = snippetPatternGlobal.exec(html)) !== null) {
        const posInicioConteudo = snippetTagMatch.index + snippetTagMatch[0].length
        const textoSnippet = extrairTextoSnippet(html, posInicioConteudo)
        if (textoSnippet) {
            snippets.push(textoSnippet)
        }
    }

    // Combina links com snippets
    for (let i = 0; i < links.length; i++) {
        results.push({
            url: links[i].url,
            title: links[i].title,
            snippet: snippets[i] || ''
        })
    }

    // Fallback se nenhum resultado foi encontrado
    if (results.length === 0) {
        console.log('[WebSearch] No results with primary pattern, trying fallback...')

        const fallbackPattern = /<a[^>]+href="(https?:\/\/(?!duckduckgo)[^"]+)"[^>]*>([^<]{15,100})<\/a>/gi
        while ((match = fallbackPattern.exec(html)) !== null && results.length < maxResults) {
            const url = match[1]
            const title = decodeHtmlEntities(match[2].trim())

            if (results.some(r => r.url === url)) continue

            results.push({ url, title, snippet: '' })
        }
    }
    return results
}

/**
 * Search using Brave as a fallback
 */
async function searchBrave(query: string, maxResults = 3): Promise<SearchResult[]> {
    console.log(`[WebSearch] Executando busca Brave Search para: "${query}"`)
    const urlBusca = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`
    const html = await fetchUrl(urlBusca)
    const resultados: SearchResult[] = []
    
    // Expressão regular robusta para blocos de resultados do Brave
    const regexBloco = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*l1[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]+class="[^"]*generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
    
    let correspondencia
    while ((correspondencia = regexBloco.exec(html)) !== null && resultados.length < maxResults) {
        const url = correspondencia[1]
        const conteudoLink = correspondencia[2]
        const conteudoSnippet = correspondencia[3]
        
        // Extrai o título do elemento com classe title ou search-snippet-title de dentro da tag do link
        const matchTitulo = conteudoLink.match(/<div[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/i) 
                         || conteudoLink.match(/<div[^>]+class="[^"]*search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        let titulo = ''
        if (matchTitulo) {
            titulo = matchTitulo[1].replace(/<[^>]+>/g, '').trim()
        } else {
            titulo = conteudoLink.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
        
        // Extrai o snippet com a classe content de dentro do generic-snippet
        const matchSnippet = conteudoSnippet.match(/<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        let snippet = ''
        if (matchSnippet) {
            snippet = matchSnippet[1].replace(/<[^>]+>/g, '').trim()
        } else {
            snippet = conteudoSnippet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
        
        titulo = decodeHtmlEntities(titulo)
        snippet = decodeHtmlEntities(snippet)
        
        if (url && titulo) {
            resultados.push({
                url,
                title: titulo,
                snippet
            })
        }
    }
    
    // Se o parser estruturado não retornou nenhum resultado, tenta o parser genérico de fallback
    if (resultados.length === 0) {
        console.log('[WebSearch] O parser estruturado do Brave retornou 0 resultados. Executando fallback...')
        const regexFallback = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
        const urlsVistas = new Set<string>()
        let correspondenciaFallback
        
        while ((correspondenciaFallback = regexFallback.exec(html)) !== null && resultados.length < maxResults) {
            const url = correspondenciaFallback[1]
            if (!url.startsWith('http') || url.includes('brave.com') || url.includes('google.com') || url.includes('hackerone.com')) {
                continue
            }
            if (urlsVistas.has(url)) continue
            
            const conteudoLink = correspondenciaFallback[2]
            const possuiClasseTitulo = conteudoLink.includes('title') || conteudoLink.includes('heading') || conteudoLink.includes('search-snippet-title')
            let titulo = conteudoLink.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            
            if (titulo.length < 10 && !possuiClasseTitulo) continue
            
            const indexFimLink = regexFallback.lastIndex
            const subHtml = html.substring(indexFimLink, indexFimLink + 1200)
            
            const matchSnippet = subHtml.match(/<div[^>]+class="[^"]*(?:generic-snippet|content|description|snippet-description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                               || subHtml.match(/<(?:div|p|span)[^>]+class="[^"]*(?:snippet-description|description|snippet-text)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/i)
            
            let snippet = ''
            if (matchSnippet) {
                snippet = matchSnippet[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            }
            
            titulo = decodeHtmlEntities(titulo)
            snippet = decodeHtmlEntities(snippet)
            
            urlsVistas.add(url)
            resultados.push({
                url,
                title: titulo,
                snippet
            })
        }
    }
    
    return resultados
}

/**
 * Busca usando o DuckDuckGo HTML e opcionalmente busca conteúdos da página,
 * realizando fallback automático para o Brave Search em caso de erro (como CAPTCHA) ou falta de resultados.
 */
async function searchDuckDuckGo(query: string, maxResults = 3, fetchContents = true): Promise<WebSearchResponse> {
    console.log(`[WebSearch] Buscando: "${query}" (fetchContents: ${fetchContents})`)
    let resultados: SearchResult[] = []
    let erroDuckDuckGo = ''
    let erroBrave = ''
    
    try {
        const queryCodificada = encodeURIComponent(query)
        const urlBusca = `https://html.duckduckgo.com/html/?q=${queryCodificada}`
        
        console.log('[WebSearch] Requisitando DuckDuckGo:', urlBusca)
        const html = await fetchUrl(urlBusca)
        console.log('[WebSearch] Resposta HTML recebida do DDG, tamanho:', html.length)
        
        resultados = parseHtmlDuckDuckGo(html, maxResults)
        console.log(`[WebSearch] DuckDuckGo encontrou ${resultados.length} resultados`)
    } catch (erro: unknown) {
        erroDuckDuckGo = obterMensagemErro(erro)
        console.warn('[WebSearch] Falha ou rate-limit na busca do DuckDuckGo:', erroDuckDuckGo)
    }
    
    // Realiza o fallback para o Brave Search se o DuckDuckGo falhar ou não retornar nada
    if (resultados.length === 0) {
        console.log('[WebSearch] DuckDuckGo falhou ou retornou 0 resultados. Tentando Brave Search...')
        try {
            resultados = await searchBrave(query, maxResults)
            console.log(`[WebSearch] Brave Search encontrou ${resultados.length} resultados`)
        } catch (erro: unknown) {
            erroBrave = obterMensagemErro(erro)
            console.error('[WebSearch] Falha na busca alternativa do Brave Search:', erroBrave)
        }
    }

    if (resultados.length === 0) {
        const detalhes = [
            erroDuckDuckGo ? `DuckDuckGo: ${erroDuckDuckGo}` : 'DuckDuckGo: nenhum resultado',
            erroBrave ? `Brave: ${erroBrave}` : 'Brave: nenhum resultado',
        ].join(' | ')
        throw new Error(`Busca web cancelada: DuckDuckGo e Brave falharam ou não retornaram resultados. ${detalhes}`)
    }
    
    // Busca conteúdo de texto para os principais resultados
    if (fetchContents && resultados.length > 0) {
        console.log('[WebSearch] Buscando conteúdos das páginas de resultados...')
        
        // Busca conteúdos em paralelo limitando a no máximo 2 para otimização de velocidade
        const promessasConteudo = resultados.slice(0, 2).map(async (resultado) => {
            try {
                const conteudo = await fetchPageContent(resultado.url)
                return { ...resultado, content: conteudo }
            } catch {
                return resultado
            }
        })
        
        const resultadosComConteudo = await Promise.all(promessasConteudo)
        
        // Mescla de volta
        for (let i = 0; i < resultadosComConteudo.length; i++) {
            resultados[i] = resultadosComConteudo[i]
        }
        
        console.log('[WebSearch] Busca de conteúdos das páginas concluída')
    }
    
    return {
        query,
        results: resultados,
        timestamp: Date.now()
    }
}

/**
 * Setup IPC handlers for web search
 */
export function setupWebSearchIPC(): void {
    console.log('[WebSearch] Setting up IPC handlers...')
    
    ipcMain.handle('web-search', async (_event, query: string, maxResults?: number) => {
        try {
            const results = await searchDuckDuckGo(query, maxResults || 3, true)
            return { success: true, data: results }
        } catch (error: unknown) {
            console.error('[WebSearch] IPC error:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })
    
    // Fetch single page content
    ipcMain.handle('web-fetch-page', async (_event, url: string) => {
        try {
            const content = await fetchPageContent(url)
            return { success: true, content }
        } catch (error: unknown) {
            return { success: false, error: obterMensagemErro(error) }
        }
    })
    
    // Open URL in external browser
    ipcMain.handle('open-external', async (_event, url: string) => {
        try {
            await shell.openExternal(url)
            return { success: true }
        } catch (error: unknown) {
            console.error('[WebSearch] Failed to open external URL:', error)
            return { success: false, error: obterMensagemErro(error) }
        }
    })
    
    console.log('[WebSearch] IPC handlers ready!')
}
