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

export interface SearchPlan {
    query: string
    queryPrincipal: string
    statusMessage: string
    motivoEscalonamento?: string
    planejamentoValido: boolean
    origem: 'ia' | 'falha'
    motivoFalha?: 'timeout' | 'json_invalido' | 'query_invalida' | 'erro_ia'
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
            throw new Error(resposta.error)
        }
    } catch (error: unknown) {
        console.warn('[WebSearch] IPC error:', error)
        throw error
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
    } catch (error: unknown) {
        return `[Erro ao buscar conteudo: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`
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
    } catch (error: unknown) {
        console.error('[WebSearch] Error:', error)
        if (error instanceof Error && error.message.includes('Busca web cancelada')) {
            throw error
        }
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
export async function fetchUrlContent(url: string, maxLength = 2000, timeoutMs = 10000): Promise<string> {
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
            signal: AbortSignal.timeout(timeoutMs)
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
    } catch (error: unknown) {
        console.error('[WebSearch] Fetch error:', error)
        return `[Erro ao buscar conteúdo: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`
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

export function mensagemBuscaPareceAmbigua(message: string): boolean {
    const texto = message.trim().toLowerCase()
    if (!texto) return false

    if (texto.length < 24) return true

    const termosGenericos = [
        'isso',
        'sobre isso',
        'detalhes',
        'novidades',
        'pesquise',
        'busque'
    ]

    return termosGenericos.some((termo) => texto === termo || texto.endsWith(` ${termo}`))
}

function normalizarTextoComparacaoBusca(texto: string): string {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function ehQueryMuitoParecidaAoPrompt(query: string, promptOriginal: string): boolean {
    const queryNormalizada = normalizarTextoComparacaoBusca(query)
    const promptNormalizado = normalizarTextoComparacaoBusca(promptOriginal)
    if (!queryNormalizada || !promptNormalizado) return true
    if (queryNormalizada === promptNormalizado) return true
    if (queryNormalizada.length >= promptNormalizado.length * 0.8 && promptNormalizado.includes(queryNormalizada)) {
        return true
    }
    return false
}

export function queryPlanejadaEhValida(query: string, userMessage: string): boolean {
    const queryNormalizada = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (!queryNormalizada || queryNormalizada.length < 3) return false
    if (ehQueryMuitoParecidaAoPrompt(queryNormalizada, userMessage)) return false
    return true
}

function limparMarkdownJson(texto: string): string {
    return (texto || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
}

function extrairValorCampo(texto: string, campos: string[]): string {
    for (const campo of campos) {
        const regexJson = new RegExp(`"${campo}"\\s*:\\s*"([^"]+)"`, 'i')
        const matchJson = texto.match(regexJson)
        if (matchJson?.[1]) return matchJson[1].trim()

        const regexLinha = new RegExp(`^\\s*${campo}\\s*[:=-]\\s*(.+)$`, 'im')
        const matchLinha = texto.match(regexLinha)
        if (matchLinha?.[1]) {
            return matchLinha[1]
                .replace(/^["'`]/, '')
                .replace(/["'`]$/, '')
                .trim()
        }
    }
    return ''
}

function tokenizarTermosRelevantes(texto: string): string[] {
    const stopwords = new Set([
        'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'em', 'na', 'no', 'nas', 'nos',
        'e', 'ou', 'que', 'pra', 'para', 'por', 'com', 'me', 'minha', 'meu', 'mim',
        'internet', 'web', 'pesquisa', 'pesquisar', 'busca', 'buscar', 'explica', 'explicar',
        'rolando', 'acontecendo', 'sobre', 'qual', 'quais', 'como', 'quando', 'onde',
    ])

    return normalizarTextoComparacaoBusca(texto)
        .split(' ')
        .map((item) => item.trim())
        .filter((item) => item.length >= 3)
        .filter((item) => !stopwords.has(item))
}

function extrairPlanoBuscaFallback(
    respostaBruta: string,
    userMessage: string
): { queryPrincipal: string; statusMessage: string } | null {
    const texto = limparMarkdownJson(respostaBruta)
    if (!texto) return null

    let queryPrincipal = extrairValorCampo(texto, ['queryPrincipal', 'query'])
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)

    if (!queryPrincipal) {
        const termosUsuario = new Set(tokenizarTermosRelevantes(userMessage))
        const primeiraLinhaUtil = texto
            .split('\n')
            .map((linha) => linha.trim())
            .find((linha) =>
                linha.length >= 6 &&
                linha.length <= 100 &&
                !linha.startsWith('{') &&
                !linha.startsWith('}') &&
                !linha.startsWith('[') &&
                !linha.startsWith(']') &&
                !linha.toLowerCase().startsWith('statusmessage') &&
                tokenizarTermosRelevantes(linha).filter((termo) => termosUsuario.has(termo)).length >= 2
            )
        queryPrincipal = String(primeiraLinhaUtil || '').replace(/\s+/g, ' ').trim().slice(0, 100)
    }

    if (!queryPlanejadaEhValida(queryPrincipal, userMessage)) {
        return null
    }

    const statusMessage = extrairValorCampo(texto, ['statusMessage']) || `Vou buscar informações sobre ${queryPrincipal}.`

    return {
        queryPrincipal,
        statusMessage: statusMessage.trim(),
    }
}

/**
 * Generate optimized search query and status message using AI
 * Now considers the full chat history for better context
 */
export async function generateSearchPlanWithAI(
    userMessage: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    chatFn: (prompt: string) => Promise<string>,
    timeoutMs: number = 0
): Promise<SearchPlan> {
    const criarFalha = (
        motivoFalha: SearchPlan['motivoFalha'],
        statusMessage: string = ''
    ): SearchPlan => ({
        query: '',
        queryPrincipal: '',
        statusMessage,
        planejamentoValido: false,
        origem: 'falha',
        motivoFalha,
    })

    // Build conversation context
    const conversationContext = chatHistory.length > 0
        ? chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content.substring(0, 200)}`).join('\n')
        : ''

    const systemPrompt = `Você é um assistente que gera uma query otimizada para busca na web.

${conversationContext ? `**Contexto da conversa:**\n${conversationContext}\n\n` : ''}**Mensagem atual do usuário:** "${userMessage}"

Responda EXATAMENTE no formato JSON:
{
  "queryPrincipal": "query de busca otimizada para DuckDuckGo/Brave em português",
  "statusMessage": "uma frase natural explicando o que você vai buscar (sem emojis)"
}

Exemplos de statusMessage BOM:
- "Vou buscar informações sobre as atividades recentes do presidente Lula."
- "Deixa eu procurar as últimas cotações do Bitcoin."
- "Vou pesquisar sobre os vencedores do Oscar 2024."

Exemplos de statusMessage RUIM (não use):
- "Pesquisando..." ❌
- "🔍 Buscando na web..." ❌
- "Buscando cotação atual do Bitcoin..." ❌

REGRAS:
1. A queryPrincipal deve ser curta e otimizada para buscadores: use no máximo 3 palavras-chave principais
2. Gere exatamente UMA query: apenas queryPrincipal. Nunca gere listas, alternativas, queries secundárias ou múltiplas buscas.
3. A statusMessage deve ser uma frase natural em primeira pessoa, como se você estivesse conversando
4. Considere o contexto da conversa ao gerar a query
5. A queryPrincipal deve ser decidida por você; não copie comandos conversacionais do usuário
6. Quando houver pedido temporal (ex.: "últimos dias", "esta semana"), preserve esse recorte na query
7. NÃO copie o prompt do usuário literalmente
8. Responda APENAS o JSON, nada mais`

    try {
        const response = timeoutMs > 0
            ? await Promise.race([
                chatFn(systemPrompt),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`Search plan timeout (${timeoutMs}ms)`)), timeoutMs))
            ])
            : await chatFn(systemPrompt)
        
        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]) as Partial<SearchPlan> & { query?: string }
                const queryPrincipal = String(parsed.queryPrincipal || parsed.query || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 100)

                if (!queryPlanejadaEhValida(queryPrincipal, userMessage)) {
                    return criarFalha('query_invalida')
                }

                return {
                    query: queryPrincipal,
                    queryPrincipal,
                    statusMessage: (parsed.statusMessage || `Vou buscar informações sobre ${queryPrincipal}.`).trim(),
                    motivoEscalonamento: parsed.motivoEscalonamento || undefined,
                    planejamentoValido: true,
                    origem: 'ia',
                }
            } catch {
                // tenta extração tolerante abaixo
            }
        }

        const planoFallback = extrairPlanoBuscaFallback(response, userMessage)
        if (planoFallback) {
            return {
                query: planoFallback.queryPrincipal,
                queryPrincipal: planoFallback.queryPrincipal,
                statusMessage: planoFallback.statusMessage,
                planejamentoValido: true,
                origem: 'ia',
            }
        }

        if (!jsonMatch) return criarFalha('json_invalido')
        return criarFalha('query_invalida')
    } catch (error) {
        const mensagemErro = String((error as Error)?.message || '').toLowerCase()
        if (mensagemErro.includes('timeout')) {
            console.info('[WebSearch] Search plan timeout; usando fallback do chamador.')
            return criarFalha('timeout')
        }
        console.warn('[WebSearch] Failed to generate search plan with AI:', error)
        return criarFalha('erro_ia')
    }
}
