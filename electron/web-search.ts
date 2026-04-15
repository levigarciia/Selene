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
function fetchUrl(url: string, timeout = 10000): Promise<string> {
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
                // Handle redirects
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    fetchUrl(res.headers.location, timeout).then(resolve).catch(reject)
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
function parseHtmlDuckDuckGo(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = []
    
    // html.duckduckgo.com uses different structure
    // Look for result__a class for links
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([^<]+)/gi
    
    let match
    const links: Array<{url: string, title: string}> = []
    
    while ((match = resultPattern.exec(html)) !== null && links.length < maxResults) {
        let url = match[1]
        const title = decodeHtmlEntities(match[2].trim())
        
        // Handle DDG redirect
        if (url.includes('uddg=')) {
            const uddgMatch = url.match(/uddg=([^&]+)/)
            if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1])
            }
        }
        
        if (url.includes('duckduckgo.com')) continue
        
        links.push({ url, title })
    }
    
    // Get snippets
    const snippets: string[] = []
    while ((match = snippetPattern.exec(html)) !== null) {
        snippets.push(decodeHtmlEntities(match[1].trim()))
    }
    
    // Combine
    for (let i = 0; i < links.length; i++) {
        results.push({
            url: links[i].url,
            title: links[i].title,
            snippet: snippets[i] || ''
        })
    }
    
    // If no results, try fallback pattern
    if (results.length === 0) {
        console.log('[WebSearch] No results with primary pattern, trying fallback...')
        
        // Fallback: any link that looks like a result
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
 * Search using DuckDuckGo HTML and optionally fetch page contents
 */
async function searchDuckDuckGo(query: string, maxResults = 3, fetchContents = true): Promise<WebSearchResponse> {
    console.log(`[WebSearch] Searching: "${query}" (fetchContents: ${fetchContents})`)
    
    try {
        const encodedQuery = encodeURIComponent(query)
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`
        
        console.log('[WebSearch] Fetching:', searchUrl)
        const html = await fetchUrl(searchUrl)
        console.log('[WebSearch] Got HTML response, length:', html.length)
        
        const results = parseHtmlDuckDuckGo(html, maxResults)
        console.log(`[WebSearch] Found ${results.length} results`)
        
        // Fetch content for top results
        if (fetchContents && results.length > 0) {
            console.log('[WebSearch] Fetching page contents...')
            
            // Fetch contents in parallel (limit to 2 to be fast)
            const contentPromises = results.slice(0, 2).map(async (result) => {
                try {
                    const content = await fetchPageContent(result.url)
                    return { ...result, content }
                } catch {
                    return result
                }
            })
            
            const resultsWithContent = await Promise.all(contentPromises)
            
            // Merge back
            for (let i = 0; i < resultsWithContent.length; i++) {
                results[i] = resultsWithContent[i]
            }
            
            console.log('[WebSearch] Content fetch complete')
        }
        
        return {
            query,
            results,
            timestamp: Date.now()
        }
    } catch (error: unknown) {
        console.error('[WebSearch] Search failed:', obterMensagemErro(error))
        return {
            query,
            results: [],
            timestamp: Date.now()
        }
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
