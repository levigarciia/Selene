import type {
    AIToolCallRequest,
    ToolAutonomyDecision,
    ToolAttemptSummary,
    ToolCall,
    ToolDefinition,
} from '../../types/tools'

export interface OpcoesAutonomiaTool {
    modoAutonomia?: 'equilibrado'
    maxTentativasPorTarefa?: number
    maxRefinamentosPorErro?: number
}

export interface EntradaAutonomiaTool extends OpcoesAutonomiaTool {
    userMessage: string
    chamadasRodada: ToolCall[]
    chamadasTotais: ToolCall[]
    ferramentasDisponiveis: ToolDefinition[]
}

const MAX_TENTATIVAS_PADRAO = 4
const MAX_REFINAMENTOS_ERRO_PADRAO = 2
const FERRAMENTAS_DESTRUTIVAS = new Set(['builtin:delete_file'])

const PALAVRAS_IGNORADAS = new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou', 'para', 'por',
    'com', 'sem', 'sobre', 'me', 'explica', 'explique', 'busca', 'buscar', 'pesquisa', 'pesquisar', 'procura',
    'procure', 'quero', 'qual', 'quais', 'como', 'quando', 'onde', 'porque', 'por que', 'pode', 'counterar',
    'counter', 'ele', 'ela', 'isso', 'esse', 'essa', 'este', 'esta',
])

export function avaliarAutonomiaTool(entrada: EntradaAutonomiaTool): ToolAutonomyDecision {
    const chamadasTotais = entrada.chamadasTotais || []
    const chamadasRodada = entrada.chamadasRodada || []
    if (chamadasRodada.length === 0) {
        return { action: 'parar', reason: 'Nenhuma chamada recente para avaliar.' }
    }

    const maxTentativas = entrada.maxTentativasPorTarefa ?? MAX_TENTATIVAS_PADRAO
    const maxRefinamentos = entrada.maxRefinamentosPorErro ?? MAX_REFINAMENTOS_ERRO_PADRAO
    const tentativas = criarResumoTentativas(chamadasTotais)

    if (atingiuLimiteGeral(tentativas, maxTentativas)) {
        return { action: 'parar', reason: 'Limite de tentativas automáticas atingido.' }
    }

    for (const chamada of chamadasRodada) {
        if (FERRAMENTAS_DESTRUTIVAS.has(chamada.input.toolId)) {
            return { action: 'parar', reason: 'Ferramenta destrutiva não deve ser repetida automaticamente.' }
        }
    }

    for (const chamada of chamadasRodada) {
        const erro = obterErroChamada(chamada)

        if (erro && atingiuLimiteErro(chamadasTotais, erro, maxRefinamentos)) {
            continue
        }

        const recuperacaoPdf = criarRecuperacaoPdf(chamada, entrada)
        if (recuperacaoPdf) return recuperacaoPdf

        const recuperacaoWeb = criarRecuperacaoWeb(chamada)
        if (recuperacaoWeb) return recuperacaoWeb

        const recuperacaoArgumentos = criarRecuperacaoArgumentos(chamada, entrada)
        if (recuperacaoArgumentos) return recuperacaoArgumentos

        const recuperacaoMcp = criarRecuperacaoMcp(chamada, entrada)
        if (recuperacaoMcp) return recuperacaoMcp
    }

    if (chamadasRodada.some(chamadaTemResultadoUtil)) {
        const contemBuscaWeb = chamadasRodada.some(chamada => chamada.input.toolId.includes('web_search'))
        if (contemBuscaWeb && entrada.modoAutonomia === 'equilibrado') {
            // Em vez de finalizar imediatamente, deixa a IA avaliar os resultados da busca web
            // e decidir se precisa fazer novas buscas consecutivas com base no que descobriu.
            return { action: 'continuar', reason: 'Deixar a IA avaliar se precisa refinar ou continuar as buscas web.' }
        }
        return { action: 'responder', reason: 'Há resultados suficientes para sintetizar resposta.' }
    }

    return { action: 'parar', reason: 'Nenhuma recuperação segura disponível.' }
}

export function criarResumoTentativas(chamadas: ToolCall[]): ToolAttemptSummary[] {
    return chamadas.map((chamada) => ({
        toolId: chamada.input.toolId,
        arguments: chamada.input.arguments,
        status: chamada.status,
        error: obterErroChamada(chamada),
        signature: criarAssinatura(chamada.input.toolId, chamada.input.arguments),
    }))
}

function criarRecuperacaoPdf(chamada: ToolCall, entrada: EntradaAutonomiaTool): ToolAutonomyDecision | null {
    if (chamada.input.toolId !== 'builtin:view') return null

    const caminho = String(chamada.input.arguments.path || '')
    if (!/\.pdf$/i.test(caminho)) return null

    const textoResultado = obterTextoResultado(chamada)
    if (!/\b(sem matches|nenhum resultado|não retornou|nao retornou)\b/i.test(textoResultado)) return null

    const queryAtual = String(chamada.input.arguments.query || '')
    const queryAlternativa = escolherQueryAlternativa(
        entrada.userMessage,
        queryAtual,
        entrada.chamadasTotais,
        'builtin:view'
    )

    if (queryAlternativa) {
        const proxima: AIToolCallRequest = {
            tool: 'builtin:view',
            arguments: {
                path: caminho,
                query: queryAlternativa,
            },
            reasoning: 'A busca anterior no PDF não encontrou resultados; tentando termo mais específico.',
        }

        if (!chamadaJaFoiTentada(proxima, entrada.chamadasTotais)) {
            return {
                action: 'continuar',
                reason: 'Busca em PDF sem resultados pode ser refinada.',
                toolCalls: [proxima],
            }
        }
    }

    const pagina = extrairPagina(entrada.userMessage)
    if (pagina) {
        const proxima: AIToolCallRequest = {
            tool: 'builtin:view',
            arguments: {
                path: caminho,
                startLine: pagina,
                endLine: pagina,
            },
            reasoning: 'A busca textual no PDF falhou, mas há uma página candidata para leitura direta.',
        }

        if (!chamadaJaFoiTentada(proxima, entrada.chamadasTotais)) {
            return {
                action: 'continuar',
                reason: 'Leitura direta de página candidata no PDF.',
                toolCalls: [proxima],
            }
        }
    }

    return {
        action: 'perguntar',
        reason: 'Busca em PDF sem resultados e sem termo alternativo confiável.',
        question: 'Não encontrei esse trecho no PDF. Você sabe a página ou outro termo exato que aparece no documento?',
    }
}

function criarRecuperacaoWeb(chamada: ToolCall): ToolAutonomyDecision | null {
    if (!chamada.input.toolId.includes('web_search')) return null
    
    // Se a chamada de busca falhou por erro real de rede/bloqueio nos buscadores, interrompe imediatamente
    const erro = obterErroChamada(chamada)
    if (erro || chamada.status === 'failed') {
        if (erro && /\b(obrigat[oó]rio|required|missing|ausente)\b/i.test(erro)) {
            return null
        }
        console.warn(`[WebSearchAutonomy] Busca web falhou nos motores de busca: ${erro || 'Falha de execução'}. Interrompendo para evitar spam.`)
        return { action: 'parar', reason: `Busca web falhou nos buscadores com erro: ${erro || 'Falha de execução'}` }
    }
    
    if (!buscaWebSemResultados(chamada)) return null
    return {
        action: 'continuar',
        reason: 'Busca web sem resultados; deixar a IA decidir se tenta outra query ou responde.',
    }
}

function criarRecuperacaoArgumentos(chamada: ToolCall, entrada: EntradaAutonomiaTool): ToolAutonomyDecision | null {
    const erro = obterErroChamada(chamada)
    if (!erro || !/\b(obrigat[oó]rio|required|missing|ausente)\b/i.test(erro)) return null

    if (chamada.input.toolId.includes('web_search')) {
        return {
            action: 'parar',
            reason: 'web_search sem query planejada pela IA não deve ser recuperada por heurística.',
        }
    }

    const ferramenta = entrada.ferramentasDisponiveis.find((tool) => tool.id === chamada.input.toolId)
    if (!ferramenta) return null

    const argumentos = { ...chamada.input.arguments }
    for (const parametro of ferramenta.parameters.filter((item) => item.required)) {
        const valorAtual = argumentos[parametro.name]
        if (valorAtual !== undefined && valorAtual !== null && String(valorAtual).trim()) continue

        const valorInferido = inferirArgumentoObrigatorio(parametro.name, chamada.input.toolId, entrada.userMessage)
        if (valorInferido === undefined) {
            return {
                action: 'perguntar',
                reason: `Parâmetro obrigatório não inferível: ${parametro.name}.`,
                question: `Preciso do valor de "${parametro.name}" para usar ${ferramenta.name}.`,
            }
        }

        argumentos[parametro.name] = valorInferido
    }

    const proxima: AIToolCallRequest = {
        tool: chamada.input.toolId,
        arguments: argumentos,
        reasoning: 'A chamada anterior falhou por argumento ausente; reconstruindo parâmetros a partir do pedido.',
    }

    if (chamadaJaFoiTentada(proxima, entrada.chamadasTotais)) return null

    return {
        action: 'continuar',
        reason: 'Erro de parâmetro obrigatório recuperável.',
        toolCalls: [proxima],
    }
}

function criarRecuperacaoMcp(chamada: ToolCall, entrada: EntradaAutonomiaTool): ToolAutonomyDecision | null {
    if (!chamada.input.toolId.startsWith('mcp:')) return null

    const erro = obterErroChamada(chamada)
    if (!erro || !/\b(no handler|not found|indispon[ií]vel|unavailable|failed)\b/i.test(erro)) return null

    const texto = `${chamada.input.toolId} ${JSON.stringify(chamada.input.arguments)} ${entrada.userMessage}`.toLowerCase()
    const fallback = entrada.ferramentasDisponiveis.find((tool) => {
        if (texto.includes('web') || texto.includes('search') || texto.includes('busca')) {
            return tool.id === 'builtin:web_search'
        }
        if (texto.includes('file') || texto.includes('read') || texto.includes('arquivo')) {
            return tool.id === 'builtin:view'
        }
        return false
    })

    if (!fallback) return null
    if (fallback.id === 'builtin:web_search') return null

    const argumentos = { ...chamada.input.arguments }

    const proxima: AIToolCallRequest = {
        tool: fallback.id,
        arguments: argumentos,
        reasoning: 'A ferramenta MCP falhou; usando ferramenta nativa equivalente.',
    }

    if (chamadaJaFoiTentada(proxima, entrada.chamadasTotais)) return null

    return {
        action: 'continuar',
        reason: 'Fallback nativo disponível para falha de MCP.',
        toolCalls: [proxima],
    }
}

function inferirArgumentoObrigatorio(nome: string, toolId: string, userMessage: string): unknown {
    if (toolId.includes('web_search') && (nome === 'query' || nome === 'queryPrincipal')) return undefined
    if (nome === 'query') return criarQueryBusca(userMessage)
    if (nome === 'command') return undefined
    if (nome === 'path') return extrairCaminho(userMessage)
    if (nome === 'paths') {
        const caminho = extrairCaminho(userMessage)
        return caminho ? [caminho] : undefined
    }
    return undefined
}

function escolherQueryAlternativa(
    userMessage: string,
    queryAtual: string,
    chamadasTotais: ToolCall[],
    toolId: string
): string | null {
    const tentadas = new Set(
        chamadasTotais
            .filter((chamada) => chamada.input.toolId === toolId)
            .map((chamada) => String(chamada.input.arguments.queryPrincipal || chamada.input.arguments.query || ''))
            .map(normalizarTexto)
            .filter(Boolean)
    )

    const candidatos = [
        ...extrairTrechosEntreAspas(userMessage),
        ...extrairTrechosEntreAspas(queryAtual),
        ...extrairFrasesNomeadas(queryAtual),
        ...extrairFrasesNomeadas(userMessage),
        criarQueryBusca(queryAtual),
        criarQueryBusca(userMessage),
    ].filter((item): item is string => Boolean(item && item.trim()))

    for (const candidato of candidatos) {
        const limpo = limparQuery(candidato)
        if (limpo.length < 3) continue
        if (tentadas.has(normalizarTexto(limpo))) continue
        return limpo
    }

    return null
}

function chamadaTemResultadoUtil(chamada: ToolCall): boolean {
    if (chamada.status !== 'completed' || !chamada.result?.success) return false
    if (buscaWebSemResultados(chamada)) return false

    const texto = obterTextoResultado(chamada)
    if (!texto.trim()) return false
    return !/\b(sem matches|nenhum resultado|não retornou|nao retornou)\b/i.test(texto)
}

function buscaWebSemResultados(chamada: ToolCall): boolean {
    if (!chamada.input.toolId.includes('web_search')) return false
    const data = chamada.result?.data as { results?: unknown[] } | undefined
    if (Array.isArray(data?.results)) return data.results.length === 0
    const texto = obterTextoResultado(chamada)
    return /\b(0 resultados|nenhum resultado|sem resultados|no results)\b/i.test(texto)
}

function chamadaJaFoiTentada(chamada: AIToolCallRequest, chamadasTotais: ToolCall[]): boolean {
    const assinatura = criarAssinatura(chamada.tool, chamada.arguments)
    return chamadasTotais.some((tentativa) => criarAssinatura(tentativa.input.toolId, tentativa.input.arguments) === assinatura)
}

function atingiuLimiteGeral(tentativas: ToolAttemptSummary[], maxTentativas: number): boolean {
    const contagem = new Map<string, number>()
    for (const tentativa of tentativas) {
        const chave = `${tentativa.toolId}:${normalizarTexto(String(tentativa.arguments.path || tentativa.arguments.query || tentativa.arguments.queryPrincipal || ''))}`
        contagem.set(chave, (contagem.get(chave) || 0) + 1)
        if ((contagem.get(chave) || 0) >= maxTentativas) return true
    }
    return false
}

function atingiuLimiteErro(chamadas: ToolCall[], erro: string, maxRefinamentos: number): boolean {
    const erroNormalizado = normalizarTexto(erro).slice(0, 80)
    const total = chamadas.filter((chamada) => normalizarTexto(obterErroChamada(chamada) || '').slice(0, 80) === erroNormalizado).length
    return total > maxRefinamentos
}

function criarAssinatura(toolId: string, args: Record<string, unknown>): string {
    const ordenado = Object.keys(args || {})
        .sort()
        .reduce<Record<string, unknown>>((acc, chave) => {
            acc[chave] = args[chave]
            return acc
        }, {})
    return `${toolId}:${JSON.stringify(ordenado)}`
}

function obterErroChamada(chamada: ToolCall): string | undefined {
    if (chamada.status === 'failed') return chamada.result?.error || 'Falha desconhecida'
    if (!chamada.result?.success && chamada.result?.error) return chamada.result.error
    return undefined
}

function obterTextoResultado(chamada: ToolCall): string {
    const data = chamada.result?.data as Record<string, unknown> | undefined
    const partes = [
        chamada.result?.error,
        typeof data?.formattedForAI === 'string' ? data.formattedForAI : '',
        typeof data?.content === 'string' ? data.content : '',
        JSON.stringify(data || {}),
    ]
    return partes.filter(Boolean).join('\n')
}

function criarQueryBusca(texto: string): string {
    return limparQuery(
        texto
            .replace(/^(pesquise?|busque?|procure?)\s*(por|sobre)?\s*/i, '')
            .split(/\s+/)
            .filter((palavra) => !PALAVRAS_IGNORADAS.has(normalizarTexto(palavra)))
            .slice(0, 8)
            .join(' ')
    )
}

function limparQuery(texto: string): string {
    return (texto || '')
        .replace(/\.(pdf|docx|txt|md)\b/gi, ' ')
        .replace(/[\\/]/g, ' ')
        .replace(/[?!.;,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
}

function extrairTrechosEntreAspas(texto: string): string[] {
    return Array.from((texto || '').matchAll(/["'“”]([^"'“”]{3,80})["'“”]/g)).map((match) => match[1].trim())
}

function extrairFrasesNomeadas(texto: string): string[] {
    const matches = Array.from((texto || '').matchAll(/\b[\p{Lu}ÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+(?:\s+(?:d[aeo]s?|e|a|o|os|as|[\p{Lu}ÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+)){0,4}/gu))
    return matches.map((match) => limparQuery(match[0])).filter((item) => item.length >= 3)
}

function extrairPagina(texto: string): number | null {
    const match = (texto || '').match(/\bp[áa]g(?:ina)?\.?\s*(\d+)\b/i)
    if (!match) return null
    const pagina = Number(match[1])
    return Number.isInteger(pagina) && pagina > 0 ? pagina : null
}

function extrairCaminho(texto: string): string | undefined {
    const match = (texto || '').match(/(?:[a-zA-Z]:[\\/])?(?:[\w .-]+[\\/])*[\w .-]+\.(?:pdf|docx|txt|md|csv|json|ts|tsx|js|jsx)/i)
    return match?.[0]?.trim()
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
