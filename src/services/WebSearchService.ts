/**
 * Web Search Service
 * 
 * Free web search using DuckDuckGo HTML scraping
 * No API key required!
 */

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

type RespostaBuscaIpc = { success: boolean; data?: WebSearchResponse; error?: string }
type RespostaPaginaIpc = { success: boolean; content?: string; error?: string }

// DuckDuckGo HTML search endpoint
const DDG_SEARCH_URL = 'https://html.duckduckgo.com/html/'

async function buscarNaWebViaIpc(query: string, maxResults: number): Promise<WebSearchResponse | null> {
    if (typeof window === 'undefined') return null
    const api = window.electronAPI?.webSearch
    if (!api) return null

    try {
        const resposta = await api(query, maxResults) as RespostaBuscaIpc
        if (resposta?.success && resposta.data) {
            return resposta.data
        }
        if (resposta?.error) {
            console.warn('[WebSearch] IPC error:', resposta.error)
        }
    } catch (error: any) {
        console.warn('[WebSearch] IPC error:', error)
    }

    return null
}

async function buscarConteudoViaIpc(url: string): Promise<string | null> {
    if (typeof window === 'undefined') return null
    const api = window.electronAPI?.webFetchPage
    if (!api) return null

    try {
        const resposta = await api(url) as RespostaPaginaIpc
        if (resposta?.success) {
            return resposta.content || ''
        }
        if (resposta?.error) {
            return `[Erro ao buscar conteudo: ${resposta.error}]`
        }
    } catch (error: any) {
        return `[Erro ao buscar conteudo: ${error.message}]`
    }

    return null
}

/**
 * Search the web using DuckDuckGo
 * @param query - Search query
 * @param maxResults - Maximum number of results (default: 5)
 */
export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResponse> {
    console.log(`[WebSearch] Searching: "${query}"`)
    
    try {
        const respostaIpc = await buscarNaWebViaIpc(query, maxResults)
        if (respostaIpc) {
            console.log(`[WebSearch] IPC results: ${respostaIpc.results.length}`)
            return respostaIpc
        }

        // Use POST with form data for DuckDuckGo
        const formData = new URLSearchParams()
        formData.append('q', query)
        formData.append('b', '')
        formData.append('kl', 'br-pt') // Brazilian Portuguese
        
        const response = await fetch(DDG_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: formData.toString()
        })
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`)
        }
        
        const html = await response.text()
        const results = parseSearchResults(html, maxResults)
        
        console.log(`[WebSearch] Found ${results.length} results`)
        
        return {
            query,
            results,
            timestamp: Date.now()
        }
    } catch (error: any) {
        console.error('[WebSearch] Error:', error)
        return {
            query,
            results: [],
            timestamp: Date.now()
        }
    }
}

/**
 * Parse DuckDuckGo HTML response
 */
function parseSearchResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = []
    
    // Match result links - DuckDuckGo uses class="result__a" for links
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi
    
    // Extract URLs and titles
    const links: Array<{url: string, title: string}> = []
    let linkMatch
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
        let url = linkMatch[1]
        const title = decodeHtmlEntities(linkMatch[2].trim())
        
        // DuckDuckGo wraps URLs in redirect - extract actual URL
        if (url.includes('uddg=')) {
            const match = url.match(/uddg=([^&]+)/)
            if (match) {
                url = decodeURIComponent(match[1])
            }
        }
        
        if (url && title && !url.includes('duckduckgo.com')) {
            links.push({ url, title })
        }
    }
    
    // Extract snippets
    const snippets: string[] = []
    let snippetMatch
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        const snippet = decodeHtmlEntities(
            snippetMatch[1]
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ')    // Normalize whitespace
                .trim()
        )
        if (snippet) {
            snippets.push(snippet)
        }
    }
    
    // Combine links with snippets
    for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        results.push({
            title: links[i].title,
            url: links[i].url,
            snippet: snippets[i] || ''
        })
    }
    
    return results
}

/**
 * Decode HTML entities
 */
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
}

/**
 * Fetch and extract text content from a URL
 * @param url - URL to fetch
 * @param maxLength - Maximum text length (default: 2000)
 */
export async function fetchUrlContent(url: string, maxLength = 2000): Promise<string> {
    console.log(`[WebSearch] Fetching: ${url}`)
    
    try {
        const conteudoIpc = await buscarConteudoViaIpc(url)
        if (conteudoIpc !== null) {
            if (conteudoIpc.length > maxLength) {
                return conteudoIpc.substring(0, maxLength) + '...'
            }
            return conteudoIpc
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        })
        
        if (!response.ok) {
            return `[Erro ao acessar: ${response.status}]`
        }
        
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
            return `[Conteúdo não é texto: ${contentType}]`
        }
        
        const html = await response.text()
        const text = extractTextFromHtml(html)
        
        if (text.length > maxLength) {
            return text.substring(0, maxLength) + '...'
        }
        
        return text
    } catch (error: any) {
        console.error('[WebSearch] Fetch error:', error)
        return `[Erro ao buscar conteúdo: ${error.message}]`
    }
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHtml(html: string): string {
    // Remove scripts, styles, and other non-content elements
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
    
    // Extract main content if available
    const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                      text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                      text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    
    if (mainMatch) {
        text = mainMatch[1]
    }
    
    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Decode entities
    text = decodeHtmlEntities(text)
    
    // Normalize whitespace
    text = text
        .replace(/\s+/g, ' ')
        .trim()
    
    return text
}

/**
 * Format search results for AI consumption
 */
export function formatSearchResultsForAI(response: WebSearchResponse): string {
    if (response.results.length === 0) {
        return `[Busca na web: "${response.query}" - Nenhum resultado encontrado]`
    }
    
    // Extract domain names for sources
    const sources = response.results.map(r => {
        try {
            const url = new URL(r.url)
            return url.hostname.replace('www.', '').split('.')[0]
        } catch {
            return r.title.substring(0, 20)
        }
    }).map(s => s.charAt(0).toUpperCase() + s.slice(1))
    
    let formatted = `\n\n---\n📌 **INFORMAÇÕES DA WEB (Atualizadas)**\n\n`
    formatted += `**INSTRUÇÃO IMPORTANTE:** Ao usar informações dessas fontes, inclua a citação inline usando o formato \`[[fonte: Nome]]\` no final do parágrafo relevante.\n`
    formatted += `Fontes disponíveis: ${sources.join(', ')}\n\n`
    
    response.results.forEach((result, index) => {
        const sourceName = sources[index] || 'Web'
        formatted += `### Fonte ${index + 1}: ${sourceName}\n`
        formatted += `**Título:** ${result.title}\n`
        
        if (result.content && result.content.length > 50) {
            formatted += `**Conteúdo:**\n${result.content}\n`
        } else if (result.snippet) {
            formatted += `**Resumo:** ${result.snippet}\n`
        }
        
        formatted += `\n---\n\n`
    })
    
    formatted += `\n*Use [[fonte: NomeDaFonte]] ao final de cada afirmação baseada nestas fontes.*\n\n`
    
    return formatted
}

/**
 * Check if a message contains a web search request
 */
export function shouldSearchWeb(message: string): boolean {
    const searchPatterns = [
        /pesquis[ae]/i,
        /busc[ae]/i,
        /procur[ae]/i,
        /search/i,
        /find/i,
        /notícias/i,
        /news/i,
        /atualiz/i,
        /recent/i,
        /hoje/i,
        /ontem/i,
        /\d{4}/, // Years
        /preço/i,
        /cotação/i,
        /tempo\s+(em|de|para)/i,
        /clima/i,
        /\?$/,  // Questions often need search
    ]
    
    // Keywords that suggest needing current info
    const currentInfoKeywords = [
        'quem é',
        'o que é',
        'como está',
        'quanto custa',
        'qual o preço',
        'onde fica',
        'quando',
        'notícia',
        'última',
        'atual',
        'agora'
    ]
    
    // Check patterns
    for (const pattern of searchPatterns) {
        if (pattern.test(message)) {
            return true
        }
    }
    
    // Check keywords
    const lowerMessage = message.toLowerCase()
    for (const keyword of currentInfoKeywords) {
        if (lowerMessage.includes(keyword)) {
            return true
        }
    }
    
    return false
}

/**
 * Extract search query from user message
 */
export function extractSearchQuery(message: string): string {
    // Remove common prefixes
    let query = message
        .replace(/^(pesquise?|busque?|procure?|search|find)\s*(por|for|sobre|about)?\s*/i, '')
        .replace(/^(o que é|quem é|como|quando|onde|qual|quanto)\s*/i, '$1 ')
        .trim()
    
    // Limit query length
    if (query.length > 100) {
        query = query.substring(0, 100)
    }
    
    return query || message
}
