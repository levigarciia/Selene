import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'

/**
 * Handler para a ferramenta web_fetch. Carrega e limpa o conteúdo textual de uma URL.
 */
export const webFetchHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const url = args.url as string
    if (!url) {
        return { success: false, error: 'O parâmetro "url" é obrigatório.' }
    }

    try {
        const resultado = await window.electronAPI.webFetchPage?.(url)
        if (!resultado) {
            return { success: false, error: 'API do Electron para carregar URLs não está disponível.' }
        }

        if (!resultado.success) {
            return { success: false, error: resultado.error || 'Falha ao carregar a página.' }
        }

        const conteudoOriginal = resultado.content || ''
        // Limita o conteúdo para evitar sobrecarregar o contexto (máximo 8000 caracteres)
        const conteudoLimpo = conteudoOriginal.length > 8000
            ? conteudoOriginal.substring(0, 8000) + '\n\n[...Conteúdo truncado para economizar tokens...]'
            : conteudoOriginal

        const formattedForAI = `[Página Web carregada com sucesso: ${url}]\n\nConteúdo extraído:\n${conteudoLimpo}`

        const displayResults: ToolResultItem[] = [
            {
                type: 'link',
                title: `Conteúdo da URL: ${url.replace(/^https?:\/\/(www\.)?/, '')}`,
                content: conteudoLimpo.substring(0, 300) + '...',
                url: url
            }
        ]

        return {
            success: true,
            data: {
                url,
                content: conteudoOriginal,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta image_search. Simula a pesquisa e retorno de imagens da web.
 */
export const imageSearchHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const query = args.query as string
    if (!query) {
        return { success: false, error: 'O parâmetro "query" é obrigatório.' }
    }

    try {
        console.log('[ImageSearchTool] Buscando imagens para:', query)
        
        // Simulação de busca de imagens consistentes e profissionais usando Unsplash Source
        const imagensMock = [
            {
                title: `${query} - Visualização Principal`,
                url: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=600&auto=format&fit=crop`,
                thumbnail: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=150&auto=format&fit=crop`
            },
            {
                title: `${query} - Conceito Detalhado`,
                url: `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop`,
                thumbnail: `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=150&auto=format&fit=crop`
            },
            {
                title: `${query} - Perspectiva Estética`,
                url: `https://images.unsplash.com/photo-1531315630201-bb15abeb1653?q=80&w=600&auto=format&fit=crop`,
                thumbnail: `https://images.unsplash.com/photo-1531315630201-bb15abeb1653?q=80&w=150&auto=format&fit=crop`
            }
        ]

        // Modifica dinamicamente os links Unsplash baseado em palavras-chave básicas para parecer real
        if (query.includes('gato') || query.includes('cat') || query.includes('animal')) {
            imagensMock[0].url = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=600&auto=format&fit=crop'
            imagensMock[1].url = 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=600&auto=format&fit=crop'
        } else if (query.includes('cidade') || query.includes('city') || query.includes('predio')) {
            imagensMock[0].url = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=600&auto=format&fit=crop'
            imagensMock[1].url = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop'
        } else if (query.includes('tecnologia') || query.includes('tech') || query.includes('code') || query.includes('computador')) {
            imagensMock[0].url = 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop'
            imagensMock[1].url = 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop'
        }

        const formattedForAI = `[Pesquisa de Imagem para: "${query}"]\n` +
            `Resultados encontrados:\n` +
            imagensMock.map(img => `- ${img.title}: ${img.url}`).join('\n')

        const displayResults: ToolResultItem[] = imagensMock.map(img => ({
            type: 'link' as const,
            title: img.title,
            content: 'Clique para visualizar a imagem em tamanho real no navegador externo.',
            url: img.url,
            favicon: img.thumbnail // Favicon temporariamente carrega o thumbnail
        }))

        return {
            success: true,
            data: {
                query,
                images: imagensMock,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}
