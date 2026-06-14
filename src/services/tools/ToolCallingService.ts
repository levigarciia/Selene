/**
 * Tool Calling Service
 *
 * Bridges AI models with the tool execution system.
 * Handles decision making, execution, and result formatting.
 */

import { toolRegistry } from './ToolRegistry'
import { toolExecutor } from './ToolExecutor'
import { avaliarAutonomiaTool } from './ToolAutonomyPolicy'
import { generateSearchPlanWithAI, shouldSearchWeb } from '../WebSearchService'
import type {
    ToolDefinition,
    ToolCall,
    ToolCallInput,
    AIToolCallDecision,
    AIToolCallRequest,
    ToolCardData,
    ToolResultItem,
    ToolAutonomyDecision,
} from '../../types/tools'

type ChatFunction = (prompt: string, systemPrompt?: string) => Promise<string>
export type EstrategiaDecisaoTool = 'heuristic_only' | 'ai_fallback' | 'ai_first_fallback' | 'ai_only'
const LIMITE_RESULTADO_FERRAMENTA_IA = 12000
const AVISO_TRUNCAMENTO_FERRAMENTA = '\n\n[Resultado truncado pela Selene para preservar o contexto do modelo.]'

export interface OpcoesDecisaoTool {
    estrategiaDecisao?: EstrategiaDecisaoTool
    timeoutMs?: number
    timeoutQueryMs?: number
    maxBuscasWebPorMensagem?: number
    pularPlanejamentoWebIA?: boolean
    maxTentativasPorTarefa?: number
    modoAutonomia?: 'equilibrado'
    onDecisionStart?: (decision: AIToolCallDecision) => void
    webSearchEnabled?: boolean
}

class ToolCallingService {
    private chatFn: ChatFunction | null = null

    /**
     * Set the chat function to use for AI calls
     */
    setChatFunction(fn: ChatFunction): void {
        this.chatFn = fn
    }

    // ========================================================================
    // DECISION MAKING
    // ========================================================================

    /**
     * Ask AI if tools should be used for a given message
     * Now with fast heuristic mode to skip AI calls when possible
     */
    async decideToolUsage(
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        availableTools?: ToolDefinition[],
        opcoes: OpcoesDecisaoTool = {}
    ): Promise<AIToolCallDecision> {
        const estrategiaDecisao = opcoes.estrategiaDecisao || 'heuristic_only'
        const timeoutMs = opcoes.timeoutMs ?? 0
        const timeoutQueryMs = opcoes.timeoutQueryMs ?? 0
        const tools = availableTools || toolRegistry.getEnabled()
        if (tools.length === 0) {
            return { shouldUseTool: false, toolCalls: [] }
        }

        const decisaoRefinoBuscaPdf = this.criarDecisaoRefinoBuscaPdf(userMessage, chatHistory, tools)
        if (decisaoRefinoBuscaPdf) {
            console.log('[ToolCallingService] Busca em PDF sem matches detectada; refinando query automaticamente.')
            if (opcoes.onDecisionStart) {
                opcoes.onDecisionStart(decisaoRefinoBuscaPdf)
            }
            return decisaoRefinoBuscaPdf
        }

        const decisaoForcadaBusca = this.criarDecisaoBuscaWebExplicita(userMessage, tools, opcoes.webSearchEnabled)
        if (decisaoForcadaBusca) {
            console.log('[ToolCallingService] Pedido explícito de busca web detectado; forçando web_search com query planejada por IA.')
            if (opcoes.onDecisionStart) {
                opcoes.onDecisionStart(decisaoForcadaBusca)
            }
            return this.aprimorarQueryWebComIA(
                decisaoForcadaBusca,
                userMessage,
                chatHistory,
                timeoutQueryMs,
                !opcoes.pularPlanejamentoWebIA
            )
        }

        if (this.devePularToolCalling(userMessage)) {
            return { shouldUseTool: false, toolCalls: [] }
        }

        if (estrategiaDecisao === 'ai_only') {
            const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
            if (!decisaoIA) {
                return { shouldUseTool: false, toolCalls: [] }
            }

            const decisaoNormalizada = this.normalizarEValidarDecisao(
                decisaoIA,
                tools,
                true
            )
            if (!decisaoNormalizada) {
                return { shouldUseTool: false, toolCalls: [] }
            }

            if (decisaoNormalizada.shouldUseTool && decisaoNormalizada.toolCalls.length > 0) {
                if (opcoes.onDecisionStart) {
                    opcoes.onDecisionStart(decisaoNormalizada)
                }
            }

            return this.aprimorarQueryWebComIA(
                decisaoNormalizada,
                userMessage,
                chatHistory,
                timeoutQueryMs,
                !opcoes.pularPlanejamentoWebIA
            )
        }

        if (estrategiaDecisao === 'ai_first_fallback') {
            const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
            const decisaoNormalizadaIA = this.normalizarEValidarDecisao(decisaoIA, tools)
            if (decisaoNormalizadaIA?.shouldUseTool && decisaoNormalizadaIA.toolCalls.length > 0) {
                if (opcoes.onDecisionStart) {
                    opcoes.onDecisionStart(decisaoNormalizadaIA)
                }
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizadaIA,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    !opcoes.pularPlanejamentoWebIA
                )
            }

            // Segurança: se a IA não chamou ferramenta (ou retornou inválido), tenta heurística.
            // Isso evita alucinação em perguntas com sinais de atualidade.
            const decisaoHeuristica = this.tryFastHeuristic(userMessage, tools)
            const decisaoNormalizadaHeuristica = this.normalizarEValidarDecisao(decisaoHeuristica, tools)
            if (decisaoNormalizadaHeuristica?.shouldUseTool && decisaoNormalizadaHeuristica.toolCalls.length > 0) {
                if (opcoes.onDecisionStart) {
                    opcoes.onDecisionStart(decisaoNormalizadaHeuristica)
                }
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizadaHeuristica,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    !opcoes.pularPlanejamentoWebIA
                )
            }

            if (decisaoNormalizadaIA) {
                return decisaoNormalizadaIA
            }

            return { shouldUseTool: false, toolCalls: [], directResponse: decisaoIA?.directResponse }
        }

        // FAST HEURISTIC: Skip AI call for simple messages ou decisões óbvias
        const decisaoHeuristica = this.tryFastHeuristic(userMessage, tools)
        if (decisaoHeuristica) {
            const decisaoNormalizada = this.normalizarEValidarDecisao(decisaoHeuristica, tools)
            console.log('[ToolCallingService] Fast heuristic decision:', decisaoNormalizada?.shouldUseTool ? 'use tool' : 'respond')
            if (decisaoNormalizada) {
                if (decisaoNormalizada.shouldUseTool && decisaoNormalizada.toolCalls.length > 0) {
                    if (opcoes.onDecisionStart) {
                        opcoes.onDecisionStart(decisaoNormalizada)
                    }
                }
                return this.aprimorarQueryWebComIA(
                    decisaoNormalizada,
                    userMessage,
                    chatHistory,
                    timeoutQueryMs,
                    !opcoes.pularPlanejamentoWebIA
                )
            }
        }
        if (estrategiaDecisao === 'heuristic_only') {
            return { shouldUseTool: false, toolCalls: [] }
        }

        const decisaoIA = await this.decidirComIA(userMessage, chatHistory, tools, timeoutMs)
        if (!decisaoIA) return { shouldUseTool: false, toolCalls: [] }
        const decisaoNormalizada = this.normalizarEValidarDecisao(decisaoIA, tools)
        if (!decisaoNormalizada) return { shouldUseTool: false, toolCalls: [] }

        if (decisaoNormalizada.shouldUseTool && decisaoNormalizada.toolCalls.length > 0) {
            if (opcoes.onDecisionStart) {
                opcoes.onDecisionStart(decisaoNormalizada)
            }
        }

        return this.aprimorarQueryWebComIA(
            decisaoNormalizada,
            userMessage,
            chatHistory,
            timeoutQueryMs,
            !opcoes.pularPlanejamentoWebIA
        )
    }

    private async decidirComIA(
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        tools: ToolDefinition[],
        timeoutMs: number
    ): Promise<AIToolCallDecision | null> {
        if (!this.chatFn) {
            console.warn('[ToolCallingService] No chat function set')
            return null
        }

        // Buscar arquivo ativo no histórico completo da conversa
        let arquivoAtivoNoHistorico = ''
        const regexArquivo = /(?:[a-zA-Z]:[\\/])?(?:[a-zA-Z0-9_\-\s]+[\\/])*[a-zA-Z0-9_\-\s.]+\.(pdf|docx|txt|md)/i
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            const match = chatHistory[i].content.match(regexArquivo)
            if (match) {
                arquivoAtivoNoHistorico = match[0].trim()
                break
            }
        }

        const matchAtual = userMessage.match(regexArquivo)
        if (matchAtual) {
            arquivoAtivoNoHistorico = matchAtual[0].trim()
        }

        // Histórico expandido (últimas 6 mensagens com truncamento de 400 caracteres)
        const historyContext = chatHistory.length > 0
            ? chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content.substring(0, 400)}`).join('\n')
            : ''

        const prompt = this.buildDecisionPrompt(userMessage, tools, historyContext, arquivoAtivoNoHistorico)

        try {
            const respostaComTimeout = this.executarComTimeout(this.chatFn(prompt), timeoutMs)
            const response = await respostaComTimeout
            return this.parseDecisionResponse(response)
        } catch (error) {
            console.warn('[ToolCallingService] Decision timeout/failure:', error)
            return null
        }
    }

    private devePularToolCalling(userMessage: string): boolean {
        const msg = userMessage.toLowerCase().trim()

        if (msg.length < 10) return true

        const saudacoes = ['oi', 'olá', 'ola', 'hi', 'hello', 'obrigado', 'valeu', 'ok', 'entendi', 'bom dia', 'boa tarde', 'boa noite']
        if (saudacoes.some((saudacao) => msg === saudacao || msg.startsWith(saudacao + ' ') || msg.startsWith(saudacao + ','))) {
            return true
        }

        return /^(resuma|traduza|reescreva|corrija|formate)/i.test(msg)
    }

    private criarDecisaoRefinoBuscaPdf(
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        tools: ToolDefinition[]
    ): AIToolCallDecision | null {
        const viewTool = tools.find((tool) => tool.id === 'builtin:view')
        if (!viewTool || chatHistory.length === 0) return null

        const historicoRecente = chatHistory.slice(-8).map((item) => item.content).join('\n')
        const houveBuscaPdfSemMatch = /\b(?:pdf sem matches|sem matches|nenhum resultado encontrado no pdf|não retornou nenhum resultado|nao retornou nenhum resultado)\b/i
            .test(historicoRecente)
        if (!houveBuscaPdfSemMatch) return null

        const caminho = this.extrairUltimoCaminhoPdf(historicoRecente)
        if (!caminho) return null

        const queriesTentadas = this.extrairQueriesPdfTentadas(historicoRecente)
        if (queriesTentadas.length >= 4) return null

        const proximaQuery = this.escolherProximaQueryPdf(userMessage, historicoRecente, queriesTentadas)
        if (!proximaQuery) return null

        return {
            shouldUseTool: true,
            toolCalls: [
                {
                    tool: viewTool.id,
                    arguments: {
                        path: caminho,
                        query: proximaQuery
                    },
                    reasoning: 'A busca anterior no PDF não encontrou resultados; tentando uma query mais curta e específica.'
                }
            ]
        }
    }

    private extrairUltimoCaminhoPdf(texto: string): string | null {
        const regexCaminhoPdf = /(?:[a-zA-Z]:[\\/][^\n\r"'`]+?\.pdf|(?:~|\.{1,2})?[\\/][^\n\r"'`]+?\.pdf|[\w.-]+(?:[\\/][\w .-]+)+\.pdf)/gi
        const matches = Array.from(texto.matchAll(regexCaminhoPdf))
        const ultimo = matches.at(-1)?.[0]?.trim()
        return ultimo || null
    }

    private extrairQueriesPdfTentadas(texto: string): string[] {
        const padroes = [
            /termo de busca:\s*"([^"]+)"/gi,
            /busca por\s*"([^"]+)"/gi,
            /matches para\s*"([^"]+)"/gi,
            /match para\s*"([^"]+)"/gi
        ]

        const queries: string[] = []
        for (const padrao of padroes) {
            for (const match of texto.matchAll(padrao)) {
                const query = match[1]?.trim()
                if (query && !queries.includes(query)) {
                    queries.push(query)
                }
            }
        }

        return queries
    }

    private escolherProximaQueryPdf(userMessage: string, historicoRecente: string, queriesTentadas: string[]): string | null {
        const candidatos = this.gerarCandidatosBuscaPdf(userMessage, historicoRecente, queriesTentadas)
        const tentadasNormalizadas = new Set(queriesTentadas.map((query) => this.normalizarTextoComparacao(query)))

        return candidatos.find((candidato) => {
            const normalizado = this.normalizarTextoComparacao(candidato)
            return normalizado.length >= 3 && !tentadasNormalizadas.has(normalizado)
        }) || null
    }

    private gerarCandidatosBuscaPdf(userMessage: string, historicoRecente: string, queriesTentadas: string[]): string[] {
        const candidatos: string[] = []
        const termosTecnicosIgnorados = new Set(['path', 'query', 'tool', 'arguments', 'reasoning', 'builtin:view'])
        const adicionar = (valor: string) => {
            const limpo = valor
                .replace(/\s+/g, ' ')
                .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
                .trim()
            if (limpo.length < 3 || limpo.length > 80) return
            if (/\.(?:pdf|docx|txt|md)\b/i.test(limpo) || /[\\/]/.test(limpo)) return
            if (termosTecnicosIgnorados.has(limpo.toLowerCase())) return
            const jaExiste = candidatos.some((item) => {
                return this.normalizarTextoComparacao(item) === this.normalizarTextoComparacao(limpo)
            })
            if (!jaExiste) candidatos.push(limpo)
        }

        const fontes = [userMessage, ...queriesTentadas, historicoRecente]
        for (const fonte of fontes) {
            for (const match of fonte.matchAll(/["'“”]([^"'“”]{3,80})["'“”]/g)) {
                adicionar(match[1])
            }
        }

        for (const query of queriesTentadas) {
            const semRuido = query
                .replace(/\b(pode|consegue|counterar|counter|contornar|contra|ele|ela|isso|esse|essa|este|esta|ritual|habilidade)\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            this.extrairFrasesNomeadasBuscaPdf(semRuido).forEach(adicionar)

            for (const match of semRuido.matchAll(/\b[\p{Lu}ÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+(?:\s+(?:d[aeo]s?|e|a|o|os|as|[\p{Lu}ÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+)){0,4}/gu)) {
                adicionar(match[0])
            }

            semRuido
                .split(/\s+(?:e|ou|contra|com|para|por|de|do|da|dos|das)\s+/i)
                .forEach(adicionar)
        }

        return candidatos
    }

    private extrairFrasesNomeadasBuscaPdf(texto: string): string[] {
        const conectores = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os'])
        const tokens = texto.match(/[\p{L}\p{N}]+/gu) || []
        const frases: string[] = []
        let atual: string[] = []
        let temConector = false

        const finalizar = () => {
            if (atual.length > 0) {
                frases.push(atual.join(' '))
            }
            atual = []
            temConector = false
        }

        for (const token of tokens) {
            const tokenNormalizado = this.normalizarTextoComparacao(token)
            const ehConector = conectores.has(tokenNormalizado)
            const ehNome = /^\p{Lu}/u.test(token) || ehConector

            if (!ehNome) {
                finalizar()
                continue
            }

            if (/^\p{Lu}/u.test(token) && atual.length >= 3 && temConector) {
                finalizar()
            }

            atual.push(token)
            if (ehConector) {
                temConector = true
            }
        }

        finalizar()
        return frases.filter((frase) => frase.length >= 3)
    }

    private criarDecisaoBuscaWebExplicita(
        userMessage: string,
        tools: ToolDefinition[],
        webSearchEnabled?: boolean
    ): AIToolCallDecision | null {
        const mensagem = (userMessage || '').toLowerCase().trim()
        if (!mensagem) return null

        const padroesExplicitos = [
            /\b(pesquis|pesquisa|busca|busque|procura|procure)\b.*\b(internet|web|google)\b/i,
            /\bna internet\b/i,
            /\bpesquisa na internet\b/i,
            /\bbusca na web\b/i,
            /\b(pesquise|pesquisar|pesquisar?|pesquise[im])\b/i,
            /\b(busque|buscar|busque[im])\b/i,
            /\b(procure|procurar|procure[im])\b/i,
            /\b(googlar|googleie|googla)\b/i,
            /\b(duckduckgo|duckduck|ddg)\b/i,
        ]

        const temGatilhoTexto = padroesExplicitos.some((padrao) => padrao.test(mensagem))

        if (!webSearchEnabled && !temGatilhoTexto) {
            return null
        }

        const webSearchTool = tools.find((tool) => tool.id.includes('web_search'))
        if (!webSearchTool) return null

        return {
            shouldUseTool: true,
            toolCalls: [
                {
                    tool: webSearchTool.id,
                    arguments: { query: '' },
                    reasoning: webSearchEnabled 
                        ? 'Busca na web habilitada pelo usuário' 
                        : 'Pedido explícito do usuário para pesquisar na web'
                }
            ]
        }
    }

    /**
     * Fast heuristic to decide tool usage without AI call
     * Returns null if AI call is needed
     */
    private tryFastHeuristic(userMessage: string, tools: ToolDefinition[]): AIToolCallDecision | null {
        const msg = userMessage.toLowerCase().trim()

        // 1. Detecção de leitura de arquivos locais (PDF, DOCX, TXT, MD)
        const viewTool = tools.find(t => t.id === 'builtin:view')
        if (viewTool) {
            // Regex para capturar caminhos de documentos com extensões suportadas
            const regexArquivo = /(?:[a-zA-Z]:[\\/])?(?:[a-zA-Z0-9_\-\s]+[\\/])*[a-zA-Z0-9_\-\s.]+\.(pdf|docx|txt|md)/i
            const matchArquivo = msg.match(regexArquivo)

            // Termos comuns que indicam leitura, visualização ou resumo de arquivo
            const termosLeitura = [
                'ler', 'leia', 'veja', 'ver', 'visualizar', 'abra', 'abrir', 'resumo', 'resuma', 'conteudo', 'conteúdo',
                'página', 'pagina', 'pág', 'pag', 'page', 'pages', 'linhas', 'linha', 'mostra', 'mostre'
            ]
            const contemIntencaoLeitura = termosLeitura.some(termo => msg.includes(termo))

            if (matchArquivo && contemIntencaoLeitura) {
                const caminhoDetectado = matchArquivo[0].trim()

                // Tenta capturar número de página única (ex: "pagina 139")
                const regexPagina = /\bp[áa]g(?:ina)?\.?\s*(\d+)\b/i
                const matchPagina = msg.match(regexPagina)
                let startLine: number | undefined
                let endLine: number | undefined

                if (matchPagina) {
                    const numero = Number(matchPagina[1])
                    if (Number.isInteger(numero) && numero > 0) {
                        startLine = numero
                        endLine = numero
                    }
                }

                // Tenta capturar faixa de páginas (ex: "páginas 10 a 20")
                const regexFaixaPaginas = /\bp[áa]g(?:inas)?\.?\s*(\d+)\s*(?:a|at[eé]|-)\s*(\d+)\b/i
                const matchFaixa = msg.match(regexFaixaPaginas)
                if (matchFaixa) {
                    const inicio = Number(matchFaixa[1])
                    const fim = Number(matchFaixa[2])
                    if (Number.isInteger(inicio) && Number.isInteger(fim) && inicio > 0 && fim >= inicio) {
                        startLine = inicio
                        endLine = fim
                    }
                }

                return {
                    shouldUseTool: true,
                    toolCalls: [{
                        tool: viewTool.id,
                        arguments: {
                            path: caminhoDetectado,
                            startLine,
                            endLine
                        },
                        reasoning: 'Leitura de arquivo detectada por heurística rápida.'
                    }]
                }
            }
        }

        // 2. Direct web search request
        const webSearchPatterns = [
            /^(pesquis|busc|procur).*(na web|na internet|no google)/i,
            /^(qual|quanto|quem|onde|quando).*(atual|hoje|agora|2024|2025)/i,
            /^(preço|cotação|valor).*(atual|hoje|do|da)/i
        ]

        const webSearchTool = tools.find(t => t.id.includes('web_search'))
        if (webSearchTool) {
            for (const pattern of webSearchPatterns) {
                if (pattern.test(msg)) {
                    return {
                        shouldUseTool: true,
                        toolCalls: [{
                            tool: webSearchTool.id,
                            arguments: { query: '' },
                            reasoning: 'Direct search request detected'
                        }]
                    }
                }
            }

            const sinaisAtualidade = this.detectarSinaisAtualidade(msg)
            if (sinaisAtualidade || shouldSearchWeb(userMessage)) {
                return {
                    shouldUseTool: true,
                    toolCalls: [{
                        tool: webSearchTool.id,
                        arguments: { query: '' },
                        reasoning: 'Consulta com sinais de atualidade detectada; priorizar busca web'
                    }]
                }
            }
        }

        // If no heuristic matched, let AI decide
        return null
    }

    private buildDecisionPrompt(
        userMessage: string,
        tools: ToolDefinition[],
        historyContext: string,
        arquivoAtivo: string = ''
    ): string {
        // Pré-filtrar ferramentas relevantes para economizar tokens.
        const relevantTools = this.preFilterTools(userMessage, tools, historyContext + ' ' + arquivoAtivo)

        if (relevantTools.length === 0) {
            // Se não há ferramentas relevantes, responder diretamente sem chamar IA
            return `{"action":"respond"}`
        }

        // Formato descritivo e completo contendo parâmetros e tipos
        let prompt = `Ferramentas Disponíveis:`
        relevantTools.forEach((tool, i) => {
            prompt += `\n${i + 1}. **${tool.id}** (${tool.name}): ${tool.description}`
            if (tool.parameters.length > 0) {
                prompt += `\n   Parâmetros:`
                tool.parameters.forEach(p => {
                    const req = p.required ? 'obrigatório' : 'opcional'
                    prompt += `\n     - \`${p.name}\` (${p.type}, ${req}): ${p.description}`
                })
            }
        })

        if (arquivoAtivo) {
            prompt += `\n\n[CONTEXTO] Existe um arquivo local ativo nesta conversa: "${arquivoAtivo}"`
        }

        prompt += `\n\nMensagem do Usuário: "${userMessage}"`

        // Adiciona contexto histórico se aplicável
        if (historyContext) {
            prompt += `\n\nHistórico Recente:\n${historyContext}`
        }

        prompt += `\n\nInstruções de Decisão:
1. Analise se o pedido do usuário pode ser resolvido ou se beneficia do uso de alguma ferramenta disponível acima.
2. IMPORTANTE: Você está executando LOCALMENTE na máquina do usuário através do aplicativo desktop Selene. Você TEM permissão total para criar, ler, editar arquivos e pastas locais e executar comandos no terminal do usuário. Sempre que o pedido corresponder a uma ferramenta, opte por 'use_tools' em vez de 'respond'.
3. TRATAMENTO DE CAMINHOS: Se o usuário pedir para salvar, ler ou criar um arquivo em uma pasta comum (como Downloads, Documentos, Área de Trabalho/Desktop, ou na pasta de usuário), você PODE usar caminhos simples ou relativos como 'poema.txt', 'Downloads/poema.txt', '~/Desktop/poema.txt', etc. O sistema resolverá e salvará automaticamente no diretório correto correspondente do sistema operacional do usuário.
4. Se nenhuma ferramenta for de fato aplicável (ex: apenas uma conversa informal ou pedido de resumo simples), responda com action "respond".
5. FORMATO DA QUERY DE BUSCA: Ao pesquisar termos em arquivos/PDFs com a ferramenta 'builtin:view' usando o parâmetro 'query', utilize termos de busca curtos, focados e específicos (de 1 a 3 palavras), como nomes de habilidades, rituais, ou conceitos chave (ex: "Espirais da Perdição", "Deflagração de Energia"). NUNCA crie queries com frases de conversação longas, verbos de ligação ou perguntas completas (evite "ritual Espirais da Perdição pode counterar ele", "counterar contra").
6. WEB SEARCH RÁPIDO: Para 'builtin:web_search', gere exatamente UMA chamada e UMA query principal no campo "query". Não crie múltiplas chamadas web_search, não gere lista de queries, não gere queries secundárias e não tente cobrir variações na mesma decisão.
7. HISTÓRICO DE TENTATIVAS E PESQUISA CONSECUTIVA (MULTI-TURN): Se o histórico contiver o resultado de chamadas de ferramentas anteriores (como 'builtin:web_search' ou 'builtin:view') e você perceber que a informação obtida ainda é incompleta, ambígua ou que necessita de mais detalhes para responder à pergunta original do usuário, você NÃO deve responder com 'respond' imediatamente. Em vez disso, faça UMA NOVA chamada de ferramenta com UMA query principal refinada com base nos resultados recém-descobertos. Só decida responder com 'respond' quando de fato encontrar todos os dados necessários ou se concluir que nenhuma busca adicional ajudará.
8. AUTONOMIA EQUILIBRADA: Falhas recuperáveis de ferramenta devem virar nova chamada de ferramenta antes de virar resposta final. Exemplos: query sem resultado, argumento obrigatório ausente que pode ser inferido, ferramenta MCP indisponível quando há ferramenta nativa equivalente. Não repita ações destrutivas automaticamente.
9. DESCOBERTA SOB DEMANDA: As ferramentas listadas já foram filtradas por relevância. Prefira escolher entre elas; não invente IDs de ferramentas não listados.
10. PARALELISMO SEGURO: Quando houver múltiplas leituras independentes, você pode retornar várias chamadas na mesma decisão. A Selene só paraleliza ferramentas marcadas como seguras. Essa regra NÃO se aplica a 'builtin:web_search', que deve ter no máximo uma chamada por decisão.
11. Mantenha os argumentos em português do Brasil sempre que apropriado.
12. RESPONDA APENAS COM O JSON VÁLIDO. NENHUM OUTRO TEXTO É PERMITIDO.`

        prompt += `\n\nFormato JSON de Resposta:
- Para usar ferramentas: {"action":"use_tools","tool_calls":[{"tool":"tool_id","arguments":{"parametro":"valor"},"reasoning":"Sua justificativa aqui"}]}
- Para busca web: {"action":"use_tools","tool_calls":[{"tool":"builtin:web_search","arguments":{"query":"uma única query principal"},"reasoning":"Sua justificativa aqui"}]}
- Para responder diretamente: {"action":"respond"}`

        return prompt
    }

    /**
     * Pré-filtra ferramentas baseado em palavras-chave da mensagem
     * Garante que ferramentas corretas sejam incluídas sem estourar o limite de tokens
     */
    private preFilterTools(userMessage: string, allTools: ToolDefinition[], historyContext: string = ''): ToolDefinition[] {
        const msg = (userMessage + ' ' + historyContext).toLowerCase()
        const relevantTools: ToolDefinition[] = []
        const maxTools = 8
        const adicionar = (tool: ToolDefinition | undefined) => {
            if (tool && !relevantTools.includes(tool)) {
                relevantTools.push(tool)
            }
        }

        // Patterns detalhados para correspondência de palavras-chave
        const patterns: { keywords: string[]; toolPatterns: string[] }[] = [
            // Web search & Fetch
            {
                keywords: ['busca', 'pesquis', 'procur', 'search', 'internet', 'web', 'google', 'notícia', 'news',
                          'atual', 'recent', 'recente', 'hoje', 'ontem', 'agora', '2024', '2025', '2026',
                          'preço', 'cotação', 'acontecendo', 'aconteceu', 'ultimos dias', 'últimos dias', 'fetch', 'url', 'site', 'link'],
                toolPatterns: ['web_search', 'search', 'busca', 'web_fetch', 'fetch']
            },
            // Memory
            {
                keywords: ['lembr', 'memória', 'memory', 'salvar', 'guardar', 'preferência', 'você sabe', 'já te disse', 'perfil', 'gravar preferência'],
                toolPatterns: ['memory', 'remember', 'store', 'memory_user_edits']
            },
            // File operations & Commands
            {
                keywords: ['arquivo', 'file', 'ler', 'read', 'escrever', 'write', 'pasta', 'folder', 'diretório', 'diretorio',
                          'salvar', 'gravar', 'criar', 'substituir', 'editar', 'conteúdo', 'caminho', 'path', 'downloads',
                          'documentos', 'desktop', 'txt', 'docx', 'pdf', 'xlsx', 'csv', 'revelar', 'abrir pasta',
                          'página', 'pagina', 'pág', 'pag', 'page', 'pages', 'linha', 'linhas', 'projeto'],
                toolPatterns: ['file', 'read', 'write', 'folder', 'filesystem', 'view', 'replace', 'create', 'present', 'project_file_search']
            },
            // Code/execution & Commands
            {
                keywords: ['código', 'code', 'executar', 'run', 'python', 'javascript', 'terminal', 'comando', 'rodar',
                          'bash', 'cmd', 'powershell', 'shell', 'npm', 'bun', 'node', 'git'],
                toolPatterns: ['code', 'execute', 'run', 'terminal', 'command', 'bash']
            },
            // Interactive UI & Drafts
            {
                keywords: ['receita', 'comida', 'cozinhar', 'ingredientes', 'porções', 'mensagem', 'compose', 'escrever e-mail',
                          'rascunho', 'opções', 'escolha', 'pergunta rápida', 'email', 'slack', 'sms', 'enviar mensagem'],
                toolPatterns: ['recipe', 'compose', 'user_input', 'ask_user_input']
            },
            // Info (Clima, Esportes, Lugares, Mapas)
            {
                keywords: ['clima', 'tempo', 'previsão', 'temperatura', 'chuva', 'sol', 'esporte', 'esportes', 'jogo',
                          'jogos', 'placar', 'tabela', 'brasileirao', 'classificação', 'futebol', 'champions', 'premier',
                          'local', 'locais', 'endereço', 'rua', 'mapa', 'plotar', 'coordenadas', 'latitude', 'longitude'],
                toolPatterns: ['weather', 'sports', 'places_search', 'places_map_display']
            },
            // MCP & Registry
            {
                keywords: ['mcp', 'conector', 'conectores', 'app conectado', 'registry', 'sugerir conector'],
                toolPatterns: ['mcp', 'registry', 'connectors']
            },
            // Widgets & UI dynamic rendering
            {
                keywords: ['gráfico', 'chart', 'widget', 'visualizar', 'svg', 'diagrama', 'dashboard', 'desenhar grafico'],
                toolPatterns: ['visualize', 'widget']
            }
        ]

        // Adicionar ferramentas correspondentes
        for (const pattern of patterns) {
            const hasKeyword = pattern.keywords.some(k => msg.includes(k))
            if (hasKeyword) {
                for (const tool of allTools) {
                    const toolLower = (tool.id + ' ' + tool.name + ' ' + tool.description).toLowerCase()
                    const matches = pattern.toolPatterns.some(p => toolLower.includes(p))
                    if (matches) adicionar(tool)
                }
            }
        }

        for (const tool of toolRegistry.searchTools(`${userMessage} ${historyContext}`, maxTools, allTools)) {
            adicionar(tool)
        }

        // Se a mensagem é uma pergunta genérica, pode precisar de web search
        if (msg.endsWith('?') && relevantTools.length === 0) {
            const webSearchTool = allTools.find(t => t.id.includes('web_search'))
            adicionar(webSearchTool)
        }

        if (shouldSearchWeb(userMessage)) {
            const webSearchTool = allTools.find(t => t.id.includes('web_search'))
            adicionar(webSearchTool)
        }

        for (const idCritico of ['builtin:web_search', 'builtin:view', 'builtin:memory_search']) {
            const tool = allTools.find((item) => item.id === idCritico)
            if (tool && relevantTools.some((item) => item.category === tool.category)) {
                adicionar(tool)
            }
        }

        // Limitar número de ferramentas
        return relevantTools.slice(0, maxTools)
    }

    private detectarSinaisAtualidade(msg: string): boolean {
        const padroesAtualidade = [
            /\b(agora|hoje|ontem|amanh[ãa]|recent(e|es)|atual|atualmente)\b/i,
            /\b(ultim[oa]s?\s+dias|esta\s+semana|esse\s+m[eê]s|nos\s+ultimos?\s+dias)\b/i,
            /\b(acontecendo|aconteceu|rolando|em andamento)\b/i,
            /\b(not[ií]cia|not[ií]cias|novidades|crise|treta|esc[âa]ndalo)\b/i,
            /\b(cota[cç][aã]o|pre[cç]o|d[oó]lar|bitcoin|ibovespa|selic|juros)\b/i
        ]

        return padroesAtualidade.some((padrao) => padrao.test(msg))
    }

    private extrairPrimeiroJsonValido(texto: string): Record<string, unknown> | null {
        const conteudo = (texto || '')
            .replace(/```json/gi, '```')
            .replace(/```/g, '')

        let inicio = -1
        let profundidade = 0
        let emString = false
        let escapando = false

        for (let i = 0; i < conteudo.length; i++) {
            const char = conteudo[i]

            if (escapando) {
                escapando = false
                continue
            }

            if (char === '\\' && emString) {
                escapando = true
                continue
            }

            if (char === '"') {
                emString = !emString
                continue
            }

            if (emString) continue

            if (char === '{') {
                if (profundidade === 0) {
                    inicio = i
                }
                profundidade++
                continue
            }

            if (char === '}' && profundidade > 0) {
                profundidade--
                if (profundidade === 0 && inicio >= 0) {
                    const candidato = conteudo.slice(inicio, i + 1)
                    try {
                        const parsed = JSON.parse(candidato) as unknown
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            return parsed as Record<string, unknown>
                        }
                    } catch {
                        // continua procurando próximo bloco JSON válido
                    }
                    inicio = -1
                }
            }
        }

        return null
    }

    private parseDecisionResponse(response: string): AIToolCallDecision | null {
        try {
            const parsed = this.extrairPrimeiroJsonValido(response)
            if (!parsed) {
                console.warn('[ToolCallingService] No JSON in response')
                return null
            }

            // Support both compact format (a/t) and full format (action/tool_calls)
            const action = parsed.action || parsed.a
            const toolCalls = parsed.tool_calls || parsed.t

            if ((action === 'use_tools') && Array.isArray(toolCalls)) {
                return {
                    shouldUseTool: true,
                    toolCalls: toolCalls
                        .filter((tc): tc is Record<string, unknown> => !!tc && typeof tc === 'object')
                        .map((tc) => ({
                            tool: String(tc.tool || ''),
                            arguments: (tc.arguments || tc.args || {}) as Record<string, unknown>,
                            reasoning: typeof tc.reasoning === 'string' ? tc.reasoning : undefined
                        }))
                        .filter((tc) => tc.tool.trim().length > 0)
                }
            }

            if (action === 'respond') {
                const respostaDireta = typeof parsed.response === 'string'
                    ? parsed.response
                    : (typeof parsed.r === 'string' ? parsed.r : undefined)
                return {
                    shouldUseTool: false,
                    toolCalls: [],
                    directResponse: respostaDireta
                }
            }

            // Fallback
            return null
        } catch (error) {
            console.error('[ToolCallingService] Parse error:', error)
            return null
        }
    }

    private async aprimorarQueryWebComIA(
        decisao: AIToolCallDecision,
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
        timeoutQueryMs: number,
        usarIA: boolean
    ): Promise<AIToolCallDecision> {
        if (!decisao.shouldUseTool || decisao.toolCalls.length === 0) {
            return decisao
        }

        const chamadas = decisao.toolCalls.map((call) => ({
            ...call,
            arguments: { ...call.arguments }
        }))
        const chamadasAprovadas: AIToolCallRequest[] = []

        for (const call of chamadas) {
            const ferramenta = this.resolverFerramenta(call.tool)
            if (!ferramenta) {
                chamadasAprovadas.push(call)
                continue
            }

            if (!ferramenta.id.includes('web_search')) {
                chamadasAprovadas.push(call)
                continue
            }

            const queryAtual = typeof call.arguments.queryPrincipal === 'string'
                ? call.arguments.queryPrincipal
                : (typeof call.arguments.query === 'string' ? call.arguments.query : '')

            if (usarIA) {
                if (!this.chatFn) {
                    continue
                }
                try {
                    const plano = await generateSearchPlanWithAI(
                        userMessage,
                        chatHistory,
                        (promptText) => this.chatFn!(promptText, 'Você é um assistente que gera queries otimizadas para busca na web.'),
                        timeoutQueryMs
                    )
                    if (plano.planejamentoValido) {
                        const queryPrincipal = this.derivarQueryFinalWeb(plano.queryPrincipal || plano.query)
                        call.arguments.query = queryPrincipal
                        call.arguments.queryPrincipal = queryPrincipal
                        call.arguments.statusMessage = this.normalizarStatusBusca(plano.statusMessage, queryPrincipal)
                        if (plano.motivoEscalonamento) {
                            call.arguments.motivoEscalonamento = plano.motivoEscalonamento
                        }
                        chamadasAprovadas.push(call)
                        continue
                    } else {
                        console.log('[ToolCallingService] Planejamento de busca inválido; cancelando web_search sem query da IA.')
                    }
                } catch (erro) {
                    console.warn('[ToolCallingService] Falha ao planejar query web com IA; cancelando web_search sem query da IA:', erro)
                }
            }

            const queryPrincipal = this.derivarQueryFinalWeb(queryAtual)
            if (!queryPrincipal) {
                continue
            }
            call.arguments.query = queryPrincipal
            call.arguments.queryPrincipal = queryPrincipal
            call.arguments.statusMessage = this.normalizarStatusBusca(
                typeof call.arguments.statusMessage === 'string' ? call.arguments.statusMessage : '',
                queryPrincipal
            )
            chamadasAprovadas.push(call)
        }

        if (chamadasAprovadas.length === 0) {
            return {
                shouldUseTool: false,
                toolCalls: [],
                directResponse: decisao.directResponse
            }
        }

        return {
            ...decisao,
            shouldUseTool: true,
            toolCalls: chamadasAprovadas
        }
    }

    private normalizarTextoComparacao(texto: string): string {
        return (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    private normalizarEValidarDecisao(
        decisao: AIToolCallDecision | null | undefined,
        toolsDisponiveis: ToolDefinition[],
        exigirQueryIAWeb: boolean = false
    ): AIToolCallDecision | null {
        if (!decisao) return null

        if (!decisao.shouldUseTool || decisao.toolCalls.length === 0) {
            return { shouldUseTool: false, toolCalls: [], directResponse: decisao.directResponse }
        }

        const toolIdsPermitidos = new Set(toolsDisponiveis.map((tool) => tool.id))
        const chamadasNormalizadas: AIToolCallRequest[] = []
        let jaIncluiuBuscaWeb = false

        for (const chamada of decisao.toolCalls) {
            const ferramenta = this.resolverFerramenta(chamada.tool) ||
                this.resolverFerramentaNaLista(chamada.tool, toolsDisponiveis)
            if (!ferramenta) continue
            if (!toolIdsPermitidos.has(ferramenta.id)) continue

            const argumentos = (chamada.arguments && typeof chamada.arguments === 'object')
                ? { ...chamada.arguments }
                : {}

            if (ferramenta.id.includes('web_search')) {
                if (jaIncluiuBuscaWeb) {
                    continue
                }

                const queryIA = typeof argumentos.query === 'string' ? argumentos.query : ''
                const queryPrincipalIA = typeof argumentos.queryPrincipal === 'string' ? argumentos.queryPrincipal : ''
                const queryFonte = queryIA || queryPrincipalIA

                if (exigirQueryIAWeb && !queryFonte.trim()) {
                    continue
                }

                const queryPrincipal = exigirQueryIAWeb
                    ? this.normalizarQueryWeb(queryFonte).slice(0, 100)
                    : this.derivarQueryFinalWeb(queryFonte)

                if (!queryPrincipal) {
                    continue
                }
                argumentos.query = queryPrincipal
                argumentos.queryPrincipal = queryPrincipal
                if (typeof argumentos.statusMessage === 'string') {
                    argumentos.statusMessage = this.normalizarStatusBusca(argumentos.statusMessage, queryPrincipal)
                }
                jaIncluiuBuscaWeb = true
            }

            const faltandoObrigatorio = ferramenta.parameters
                .filter((parametro) => parametro.required)
                .some((parametro) => {
                    const valor = argumentos[parametro.name]
                    if (typeof valor === 'string') return !valor.trim()
                    return valor === undefined || valor === null
                })

            if (faltandoObrigatorio) continue

            chamadasNormalizadas.push({
                tool: ferramenta.id,
                arguments: argumentos,
                reasoning: chamada.reasoning
            })
        }

        if (chamadasNormalizadas.length === 0) {
            return { shouldUseTool: false, toolCalls: [], directResponse: decisao.directResponse }
        }

        return {
            shouldUseTool: true,
            toolCalls: chamadasNormalizadas
        }
    }

    // ========================================================================
    // EXECUTION
    // ========================================================================

    /**
     * Execute tool calls from an AI decision
     */
    async executeToolCalls(
        decision: AIToolCallDecision,
        onToolStart?: (toolId: string, query: string) => void,
        onToolComplete?: (call: ToolCall) => void,
        context?: { conversationId?: string; projectId?: string; userQuery?: string; messageId?: string }
    ): Promise<ToolCall[]> {
        if (!decision.shouldUseTool || decision.toolCalls.length === 0) {
            return []
        }

        const results: ToolCall[] = []
        let loteParalelo: ToolCallInput[] = []
        let jaExecutouBuscaWeb = false

        const executarLoteParalelo = async () => {
            if (loteParalelo.length === 0) return

            const chamadas = await Promise.all(loteParalelo.map((input) => toolExecutor.execute(input)))
            for (const chamada of chamadas) {
                results.push(chamada)
                onToolComplete?.(chamada)
            }
            loteParalelo = []
        }

        for (const tc of decision.toolCalls) {
            const ferramenta = this.resolverFerramenta(tc.tool)
            const toolId = ferramenta?.id || tc.tool
            const args = { ...tc.arguments }

            if (toolId.includes('web_search')) {
                if (jaExecutouBuscaWeb) {
                    continue
                }
                jaExecutouBuscaWeb = true

                const queryOriginal =
                    (typeof args.queryPrincipal === 'string' && args.queryPrincipal.trim())
                        ? String(args.queryPrincipal)
                        : (typeof args.query === 'string' && args.query.trim())
                        ? String(args.query)
                        : ''
                const queryPrincipal = this.derivarQueryFinalWeb(queryOriginal)
                if (!queryPrincipal) {
                    continue
                }
                args.query = queryPrincipal
                args.queryPrincipal = queryPrincipal
                args.statusMessage = this.normalizarStatusBusca(
                    typeof args.statusMessage === 'string' ? args.statusMessage : '',
                    queryPrincipal
                )
            }

            // Find query for display
            const query = (args.query as string) || (args.path as string) || tc.reasoning || toolId

            onToolStart?.(toolId, query)

            const input: ToolCallInput = {
                toolId,
                arguments: args,
                context: context ? {
                    conversationId: context.conversationId,
                    messageId: context.messageId,
                    projectId: context.projectId,
                    userQuery: context.userQuery || query
                } : undefined
            }

            if (this.podeExecutarEmParalelo(ferramenta)) {
                loteParalelo.push(input)
                continue
            }

            await executarLoteParalelo()
            const result = await toolExecutor.execute(input)
            results.push(result)
            onToolComplete?.(result)
        }

        await executarLoteParalelo()

        return results
    }

    private podeExecutarEmParalelo(ferramenta?: ToolDefinition): boolean {
        if (!ferramenta) return false
        if (ferramenta.riskLevel === 'destructive' || ferramenta.riskLevel === 'write') return false
        return ferramenta.readOnly === true && ferramenta.supportsParallel === true
    }

    avaliarAutonomia(
        userMessage: string,
        chamadasRodada: ToolCall[],
        chamadasTotais: ToolCall[],
        ferramentasDisponiveis: ToolDefinition[],
        opcoes: Pick<OpcoesDecisaoTool, 'maxTentativasPorTarefa' | 'modoAutonomia'> = {}
    ): ToolAutonomyDecision {
        return avaliarAutonomiaTool({
            userMessage,
            chamadasRodada,
            chamadasTotais,
            ferramentasDisponiveis,
            modoAutonomia: opcoes.modoAutonomia || 'equilibrado',
            maxTentativasPorTarefa: opcoes.maxTentativasPorTarefa ?? 4,
            maxRefinamentosPorErro: 2,
        })
    }

    // ========================================================================
    // RESULT FORMATTING
    // ========================================================================

    /**
     * Format tool results for AI context
     */
    formatResultsForAI(calls: ToolCall[]): string {
        if (calls.length === 0) return ''

        let formatted = '\n\n---\n📌 **RESULTADOS DAS FERRAMENTAS**\n\n'

        calls.forEach((call, index) => {
            const toolDef = toolRegistry.getById(call.input.toolId)
            const toolName = toolDef?.name || call.input.toolId

            formatted += `### ${index + 1}. ${toolName}\n`

            if (call.status === 'failed') {
                formatted += `❌ Erro: ${call.result?.error || 'Falha desconhecida'}\n\n`
                return
            }

            if (call.result?.data) {
                const data = call.result.data as Record<string, unknown>

                // Check if it has formatted content
                if (data.formattedForAI) {
                    formatted += this.truncarResultadoParaIA(String(data.formattedForAI)) + '\n'
                } else if (typeof data === 'string') {
                    formatted += this.truncarResultadoParaIA(data) + '\n'
                } else {
                    formatted += '```json\n' + this.truncarResultadoParaIA(JSON.stringify(data, null, 2)) + '\n```\n'
                }
            }

            formatted += '\n'
        })

        return formatted
    }

    /**
     * Cria ToolCardData com status 'pending' a partir das requisições decididas pela IA.
     * Permite exibir o card na UI imediatamente, antes da execução começar.
     */
    toolRequestsToCardDataPendente(requests: AIToolCallRequest[], statusText?: string): ToolCardData[] {
        return requests.map((tc, index) => {
            const ferramenta = this.resolverFerramenta(tc.tool) || toolRegistry.getById(tc.tool)
            const toolId = ferramenta?.id || tc.tool
            const query = (tc.arguments.queryPrincipal as string) ||
                         (tc.arguments.query as string) ||
                         (tc.arguments.path as string) ||
                         toolId

            return {
                callId: `pending-${index}-${toolId}`,
                toolId,
                toolName: ferramenta?.name || toolId,
                toolIcon: ferramenta?.icon || 'Plug',
                query,
                status: 'pending',
                resultCount: 0,
                results: [],
                statusText: index === 0 ? statusText : undefined,
            }
        })
    }

    /**
     * Convert tool calls to ToolCardData for UI display
     * @param statusText Optional status message to show in the first card
     */
    toolCallsToCardData(calls: ToolCall[], statusText?: string): ToolCardData[] {
        return calls.map((call, index) => {
            const toolDef = toolRegistry.getById(call.input.toolId)
            const data = call.result?.data as Record<string, unknown> | undefined

            // Extract results for display
            let displayResults: ToolResultItem[] = []
            if (Array.isArray(data?.displayResults)) {
                displayResults = data.displayResults as ToolResultItem[]
            }

            const query = (call.input.arguments.queryPrincipal as string) ||
                         (call.input.arguments.query as string) ||
                         (call.input.arguments.path as string) ||
                         call.input.toolId

            return {
                callId: call.id,
                toolId: call.input.toolId,
                toolName: toolDef?.name || call.input.toolId,
                toolIcon: toolDef?.icon || 'Plug',
                query,
                status: call.status,
                resultCount: displayResults.length || (Array.isArray(data?.results) ? data.results.length : 0),
                results: displayResults,
                durationMs: call.result?.metadata?.durationMs,
                error: call.result?.error,
                // Usa o status de progresso intermediário específico da chamada se disponível, senão o global no primeiro card
                statusText: call.progressStatus || (index === 0 ? statusText : undefined)
            }
        })
    }

    // ========================================================================
    // STATUS MESSAGE GENERATION
    // ========================================================================

    /**
     * Generate a natural status message for tool usage
     */
    obterMensagemStatusHeuristica(
        toolCalls: AIToolCallRequest[]
    ): string {
        if (toolCalls.length === 0) return ''

        // Simple heuristic-based message generation
        const firstTool = toolCalls[0]
        const toolDef = this.resolverFerramenta(firstTool.tool) || toolRegistry.getById(firstTool.tool)
        const idResolvido = toolDef?.id || firstTool.tool

        if (idResolvido.includes('web_search')) {
            const statusPlanejado = typeof firstTool.arguments.statusMessage === 'string'
                ? firstTool.arguments.statusMessage.trim()
                : ''
            if (statusPlanejado) {
                return statusPlanejado.length > 120 ? `${statusPlanejado.slice(0, 117)}...` : statusPlanejado
            }
            return `Vou pesquisar sobre isso na internet...`
        }

        if (idResolvido.includes('project_file_search')) {
            return 'Vou buscar nos arquivos do projeto...'
        }

        if (idResolvido.includes('memory')) {
            return 'Deixa eu verificar o que sei sobre você...'
        }

        if (idResolvido.includes('file') || idResolvido.includes('read')) {
            const path = firstTool.arguments.path as string || 'arquivo'
            return `Vou ler o ${path.split('/').pop()}...`
        }

        if (toolDef) {
            return `Usando ${toolDef.name}...`
        }

        return 'Procurando informações...'
    }

    async generateStatusMessage(
        _userMessage: string,
        toolCalls: AIToolCallRequest[]
    ): Promise<string> {
        return this.obterMensagemStatusHeuristica(toolCalls)
    }

    private summarizeQuery(query: string): string {
        // Shorten long queries
        if (query.length > 50) {
            return query.substring(0, 47) + '...'
        }
        return query
    }

    private truncarResultadoParaIA(texto: string): string {
        if (texto.length <= LIMITE_RESULTADO_FERRAMENTA_IA) return texto
        return texto.slice(0, LIMITE_RESULTADO_FERRAMENTA_IA).trimEnd() + AVISO_TRUNCAMENTO_FERRAMENTA
    }

    private normalizarQueryWeb(query: string): string {
        const base = (query || '').trim()
        if (!base) return ''
        return base.replace(/\s+/g, ' ')
    }

    private derivarQueryFinalWeb(queryIA: string): string {
        const queryIAFinal = this.normalizarQueryWeb(queryIA || '')
        if (queryIAFinal) return queryIAFinal.slice(0, 100)
        return ''
    }

    private normalizarStatusBusca(statusMessage: string, queryPrincipal: string): string {
        const status = (statusMessage || '').trim()
        if (!status) {
            return `Vou buscar informações sobre ${this.summarizeQuery(queryPrincipal)}.`
        }
        return status.length > 120 ? `${status.slice(0, 117)}...` : status
    }

    private async executarComTimeout<T>(promessa: Promise<T>, timeoutMs: number): Promise<T> {
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            return promessa
        }
        let timer: ReturnType<typeof setTimeout> | null = null
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Tool decision timeout (${timeoutMs}ms)`))
            }, timeoutMs)
        })

        try {
            return await Promise.race([promessa, timeout])
        } finally {
            if (timer) clearTimeout(timer)
        }
    }

    private resolverFerramenta(toolIdOuNome: string): ToolDefinition | undefined {
        const idOriginal = toolIdOuNome?.trim()
        if (!idOriginal) return undefined

        const direto = toolRegistry.getById(idOriginal)
        if (direto?.enabled) return direto

        const normalizado = idOriginal.toLowerCase()
        const ferramentas = toolRegistry.getEnabled()
        const correspondentes = ferramentas.filter((tool) => {
            const nome = tool.name?.trim().toLowerCase()
            const id = tool.id.toLowerCase()
            return id === normalizado || nome === normalizado || id.endsWith(`:${normalizado}`)
        })

        if (correspondentes.length > 1) {
            console.warn('[ToolCallingService] Ferramenta ambigua:', idOriginal, correspondentes.map(t => t.id))
        }

        return correspondentes[0]
    }

    private resolverFerramentaNaLista(toolIdOuNome: string, ferramentas: ToolDefinition[]): ToolDefinition | undefined {
        const idOriginal = toolIdOuNome?.trim()
        if (!idOriginal) return undefined

        const normalizado = idOriginal.toLowerCase()
        return ferramentas.find((tool) => {
            const nome = tool.name?.trim().toLowerCase()
            const id = tool.id.toLowerCase()
            return id === normalizado || nome === normalizado || id.endsWith(`:${normalizado}`)
        })
    }
}

// Singleton instance
export const toolCallingService = new ToolCallingService()
export default toolCallingService
