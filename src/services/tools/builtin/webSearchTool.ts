/**
 * Web Search Tool Handler
 * 
 * Handles web search tool calls using the existing WebSearchService.
 */

import { searchWeb, fetchUrlContent, formatSearchResultsForAI } from '../../WebSearchService'
import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'

export const webSearchHandler: ToolHandler = async (args, context): Promise<ToolCallResult> => {
    const query = args.query as string
    
    if (!query || typeof query !== 'string') {
        return {
            success: false,
            error: 'Query parameter is required and must be a string'
        }
    }

    console.log('[WebSearchTool] Searching:', query)

    try {
        const searchResponse = await searchWeb(query, 5)
        
        if (searchResponse.results.length === 0) {
            return {
                success: true,
                data: {
                    query,
                    results: [],
                    formattedForAI: `[Nenhum resultado encontrado para: "${query}"]`,
                    displayResults: []
                }
            }
        }

        // Enrich top results with content
        const enrichedResults = await Promise.all(
            searchResponse.results.slice(0, 3).map(async (result) => {
                try {
                    if (result.content && result.content.length > 0) {
                        return result
                    }
                    const content = await fetchUrlContent(result.url, 1500)
                    return { ...result, content }
                } catch {
                    return result
                }
            })
        )
        searchResponse.results = enrichedResults

        // Format for AI context
        const formattedForAI = formatSearchResultsForAI(searchResponse)

        // Format for UI display
        const displayResults: ToolResultItem[] = searchResponse.results.map(r => ({
            type: 'link' as const,
            title: r.title,
            content: r.snippet || r.content?.substring(0, 150) || '',
            url: r.url,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.url).hostname}&sz=32`
        }))

        return {
            success: true,
            data: {
                query,
                results: searchResponse.results,
                formattedForAI,
                displayResults
            }
        }
    } catch (error: any) {
        console.error('[WebSearchTool] Error:', error)
        return {
            success: false,
            error: error.message || 'Web search failed'
        }
    }
}
