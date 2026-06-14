import { useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, ArquivoAnexo } from '../../../../types/chat'
import type { Conversation, WebSource } from '../types'
import type { ToolCall, ToolCardData } from '../../../../types/tools'
import type { Project } from '../../../../types/project'
import type { InvestigationTrace } from '../../../../services/investigate'
import type { EventoStreamIA, MetaFimStream } from '../../../../services/ai/AIProvider'
import type { PerfilLatencia } from '../../../../services/ai/types'
import type { AIService } from '../../../../services/AIService'
import { extractTextFromPdfBuffer, formatFileSize } from '../../../../services/DocumentService'

// Services
import {
    ORCAMENTO_PROMPT_PADRAO,
    aplicarOrcamentoPrompt,
    composePromptEfetivo,
    deveInjetarContextoPessoal,
    processUserMessageForMemory,
} from '../../../../services/PromptPipeline'
import {
    shouldSearchWeb,
} from '../../../../services/WebSearchService'
import { investigateService } from '../../../../services/investigate'
import { toolCallingService, type EstrategiaDecisaoTool } from '../../../../services/tools/ToolCallingService'
import { toolRegistry } from '../../../../services/tools/ToolRegistry'
import { toolExecutor } from '../../../../services/tools/ToolExecutor'
import { obterConfiguracaoPerfilGeracao } from '../../../../services/ai/politicaGeracao'
import {
    addProjectMemory,
    criarContextoArquivosProjeto,
    criarPromptSistemaProjeto,
    extractConversationMemory
} from '../../../../services/ProjectContextService'
import {
    criarConteudoHistoricoComResumoVisual,
    criarConteudoTextoComImagens,
    criarResumoImagemFallback,
    prepararHistoricoMultimodalParaModelo,
    selecionarMensagensComImagemParaHistorico,
} from '../../../../services/ai/historicoMultimodal'


import {
    atualizarMetadadoImagemMensagem,
    criarMetadadosImagensPendentes,
    normalizarMensagemChat,
} from '../../../../services/conversasPersistidas'
import { normalizarMensagemErroApi, obterMensagemErroApi, obterStatusErroApi } from '../../../../utils/errosApi'

interface FiltroContextoPerfil {
    consulta?: string
    permitirContextoPessoal?: boolean
    somenteIdentidadeBasica?: boolean
}

interface PoliticaLatencia {
    prestreamBudgetMs: number
    maxCharsMensagemHistorico: number
    toolDecisionTimeoutMs: number
    estrategiaTools: EstrategiaDecisaoTool
    timeoutCrossChatMs: number
    webSearchTimeoutMs: number
    webMaxPaginasEnriquecimento: number
    webFetchTimeoutMs: number
    webMaxConteudoChars: number
    webQueryPlanTimeoutMs: number
    maxBuscasWebPorMensagem: number
    pularPlanejamentoWebIA?: boolean
    maxTentativasPorTarefa?: number
    modoAutonomia?: 'equilibrado'
}

interface MetricasLatencia {
    tempoPreStream: number
    tempoPrompt: number
    tempoTools: number
    tempoWeb: number
    ttft: number | null
    tempoTotal: number
    timestamp: number
    conversationId: string
    modo: 'chat' | 'imagem' | 'investigate'
    provedor: string
    modelo: string
    perfilLatencia: PerfilLatencia
}

interface EntradaToolCallMarcador {
    tool?: unknown
    input?: {
        toolId?: unknown
    }
    toolId?: unknown
}

function construirConteudoComMarcadores(status: string, toolCalls: EntradaToolCallMarcador[]): string {
    if (!toolCalls || toolCalls.length === 0) return status || ''

    let resultado = status || ''
    
    const obterToolId = (tc: EntradaToolCallMarcador): string => {
        if (!tc) return ''
        if (typeof tc.tool === 'string') return tc.tool
        if (tc.input && typeof tc.input.toolId === 'string') return tc.input.toolId
        if (typeof tc.toolId === 'string') return tc.toolId
        return ''
    }

    const temBuscaWeb = toolCalls.some(tc => obterToolId(tc).includes('web_search'))
    if (temBuscaWeb) {
        resultado += '\n\n[tool:web_search]'
    }

    let otherIndex = 0
    toolCalls.forEach(tc => {
        const toolId = obterToolId(tc)
        if (toolId && !toolId.includes('web_search')) {
            resultado += `\n\n[tool:other:${otherIndex}]`
            otherIndex++
        }
    })

    return resultado
}

const POLITICA_LATENCIA_PADRAO: PoliticaLatencia = {
    prestreamBudgetMs: 450,
    maxCharsMensagemHistorico: 500,
    toolDecisionTimeoutMs: 0,
    estrategiaTools: 'ai_only',
    timeoutCrossChatMs: 220,
    webSearchTimeoutMs: 4500,
    webMaxPaginasEnriquecimento: 2,
    webFetchTimeoutMs: 2500,
    webMaxConteudoChars: 800,
    webQueryPlanTimeoutMs: 0,
    maxBuscasWebPorMensagem: 3,
    pularPlanejamentoWebIA: false,
    maxTentativasPorTarefa: 4,
    modoAutonomia: 'equilibrado',
}

const MAX_AUTO_CONTINUACOES = 2
const MAX_SOBREPOSICAO_DEDUP = 260

const ORCAMENTO_PROMPT_RAPIDO_LMSTUDIO = {
    systemBaseTokens: 220,
    perfilTokens: 120,
    autoMemoriasTokens: 80,
    crossChatTokens: 0,
    projetoTokens: 180,
    ferramentasWebTokens: 280,
}

interface UseSendMessageParams {
    // Conversation state
    conversations: Conversation[]
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
    activeConversationId: string | null
    setActiveConversationId: (id: string | null) => void
    messages: ChatMessage[]

    // Projects
    projects: Project[]

    // Input state
    input: string
    setInput: (value: string) => void
    pendingScreenshots: string[]
    setPendingScreenshots: React.Dispatch<React.SetStateAction<string[]>>
    pendingFiles: ArquivoAnexo[]
    setPendingFiles: React.Dispatch<React.SetStateAction<ArquivoAnexo[]>>
    pendingMessage: { text: string; screenshots: string[]; arquivos?: ArquivoAnexo[] } | null
    setPendingMessage: React.Dispatch<React.SetStateAction<{ text: string; screenshots: string[]; arquivos?: ArquivoAnexo[] } | null>>
    textareaRef: React.RefObject<HTMLTextAreaElement | null>

    // Generation state
    isGenerating: boolean
    setIsGenerating: (value: boolean) => void
    isAnalyzingImage: boolean
    setIsAnalyzingImage: (value: boolean) => void
    abortControllerRef: React.RefObject<AbortController | null>
    generationIdRef: React.RefObject<string | null>

    // Features
    webSearchEnabled: boolean
    toolCallingAtivo: boolean
    investigateMode: boolean
    reasoningAtivo: boolean
    setIsInvestigating: (value: boolean) => void
    setCurrentTrace: (trace: InvestigationTrace | null) => void

    // Sources/Cards
    setMessageSources: React.Dispatch<React.SetStateAction<Record<string, WebSource[]>>>
    setMessageSearchCards: React.Dispatch<React.SetStateAction<Record<string, ToolCardData[]>>>

    // Config
    promptBase: string
    getProfileContext: (filtro?: FiltroContextoPerfil) => string
    criarOuObterServico: () => AIService | null
    provedorAtivo: string
    modeloAtivo: string
    perfilLatencia: PerfilLatencia

    // Latency policy
    politicaLatencia?: Partial<PoliticaLatencia>
}

function mergePoliticaLatencia(politica?: Partial<PoliticaLatencia>): PoliticaLatencia {
    return {
        ...POLITICA_LATENCIA_PADRAO,
        ...politica,
    }
}

function aplicarPerfilLatencia(
    politica: PoliticaLatencia,
    provedorAtivo: string,
    perfilLatencia: PerfilLatencia
): PoliticaLatencia {
    if (provedorAtivo === 'local' && perfilLatencia === 'rapido') {
        return {
            ...politica,
            prestreamBudgetMs: 220,
            maxCharsMensagemHistorico: 420,
            estrategiaTools: 'heuristic_only',
            toolDecisionTimeoutMs: 0,
            timeoutCrossChatMs: 0,
            webSearchTimeoutMs: 4500,
            webMaxPaginasEnriquecimento: 1,
            webFetchTimeoutMs: 1200,
            webMaxConteudoChars: 480,
            webQueryPlanTimeoutMs: 0,
            maxBuscasWebPorMensagem: 1,
            pularPlanejamentoWebIA: true,
        }
    }

    if (provedorAtivo === 'local' && perfilLatencia === 'equilibrado') {
        return {
            ...politica,
            estrategiaTools: 'ai_fallback',
            timeoutCrossChatMs: Math.min(politica.timeoutCrossChatMs, 120),
            maxCharsMensagemHistorico: Math.min(politica.maxCharsMensagemHistorico, 460),
        }
    }

    return politica
}

function obterOpcoesContextoProjeto(provedorAtivo: string, perfilLatencia: PerfilLatencia) {
    if (provedorAtivo === 'local' && perfilLatencia === 'rapido') {
        return {
            maxCaracteresTotais: 900,
            maxArquivosInventario: 6,
            maxTrechos: 2,
        }
    }

    if (provedorAtivo === 'local' && perfilLatencia === 'equilibrado') {
        return {
            maxCaracteresTotais: 1400,
            maxArquivosInventario: 8,
            maxTrechos: 3,
        }
    }

    return {
        maxCaracteresTotais: Math.max(1200, ORCAMENTO_PROMPT_PADRAO.projetoTokens * 4),
        maxArquivosInventario: 12,
        maxTrechos: 4,
    }
}

function obterOrcamentoPromptEfetivo(provedorAtivo: string, perfilLatencia: PerfilLatencia) {
    if (provedorAtivo === 'local' && perfilLatencia === 'rapido') {
        return ORCAMENTO_PROMPT_RAPIDO_LMSTUDIO
    }

    return ORCAMENTO_PROMPT_PADRAO
}

function truncarTexto(texto: string, maxChars: number): string {
    if (texto.length <= maxChars) return texto
    return texto.slice(0, maxChars).trimEnd() + '...'
}

function respostaPareceIncompleta(texto: string): boolean {
    const t = (texto || '').trim()
    if (!t) return true
    if (/[.!?…)"'\]]$/.test(t)) return false
    if (t.length < 12) return true
    return /\b(e|ou|mas|porque|que|com|para|de|do|da|no|na|seja|como|se)\s*$/i.test(t)
}

function respostaPareceTruncadaForte(texto: string): boolean {
    const t = (texto || '').trim()
    if (!t) return false
    if (!respostaPareceIncompleta(t)) return false

    const longa = t.length >= 240
    const pareceListaIncompleta = /(^|\n)(\d+\.|[-*])\s+[^\n]{0,120}$/.test(t)

    return longa || pareceListaIncompleta
}

function ehFinishReasonLength(meta: MetaFimStream | null): boolean {
    return meta?.finishReason === 'length'
}

function mesclarComDeduplicacao(base: string, adicional: string): string {
    const textoBase = base || ''
    const textoAdicional = adicional || ''
    if (!textoBase) return textoAdicional
    if (!textoAdicional) return textoBase

    const maxSobreposicao = Math.min(MAX_SOBREPOSICAO_DEDUP, textoBase.length, textoAdicional.length)

    for (let tamanho = maxSobreposicao; tamanho >= 20; tamanho--) {
        const sufixo = textoBase.slice(-tamanho).toLowerCase()
        const prefixo = textoAdicional.slice(0, tamanho).toLowerCase()
        if (sufixo === prefixo) {
            return textoBase + textoAdicional.slice(tamanho)
        }
    }

    const precisaQuebra = !textoBase.endsWith('\n') && !textoAdicional.startsWith('\n')
    return precisaQuebra ? `${textoBase}\n${textoAdicional}` : `${textoBase}${textoAdicional}`
}

function prepararHistoricoParaModelo(
    mensagens: ChatMessage[],
    maxCharsPorMensagem: number,
    opcoes: {
        consultaAtual?: string
        perfilLatencia?: PerfilLatencia
        emProjeto?: boolean
    } = {}
) {
    return prepararHistoricoMultimodalParaModelo(mensagens, maxCharsPorMensagem, opcoes)
}

function publicarMetricasLatencia(metricas: MetricasLatencia): void {
    if (typeof window === 'undefined') return

    const janelaComDebug = window as Window & { __SELENE_LATENCIA__?: MetricasLatencia[] }
    const historico = janelaComDebug.__SELENE_LATENCIA__ || []
    janelaComDebug.__SELENE_LATENCIA__ = [...historico.slice(-29), metricas]

    window.dispatchEvent(new CustomEvent('selene:metricas-latencia', { detail: metricas }))
    console.log('[Latencia]', metricas)
}

const PROMPT_SISTEMA_INVESTIGACAO = 'Você é um assistente de pesquisa. Responda de forma objetiva e estruturada.'
const PROMPT_SISTEMA_TOOLS = 'Você é um assistente de decisão de ferramentas. Seja extremamente conciso.'
const PROMPT_SISTEMA_RESUMO_IMAGEM = 'Você resume imagens para contexto de chat. Responda em português do Brasil com uma frase curta, factual e estável. Foque no tipo de tela, documento ou app e nos principais elementos visíveis. Não faça OCR completo, não interprete além do que é visível e não use bullets.'

function ehAbortError(erro: unknown): boolean {
    return erro instanceof Error && erro.name === 'AbortError'
}

function criarPromptSistemaImagem(systemPrompt: string): string {
    return systemPrompt.trim()
}

function obterTituloAutomaticoConversa(content: string): string {
    const conteudoNormalizado = (content || '').trim()
    if (!conteudoNormalizado) return 'Nova conversa'
    return conteudoNormalizado.slice(0, 30) + (conteudoNormalizado.length > 30 ? '...' : '')
}

function criarPromptResumoImagem(textoMensagem: string, indiceImagem: number, totalImagens: number): string {
    const contexto = truncarTexto(textoMensagem.trim(), 160)
    const prefixoIndice = totalImagens > 1
        ? `Imagem ${indiceImagem + 1} de ${totalImagens}.`
        : 'Imagem única anexada.'

    return [
        prefixoIndice,
        contexto
            ? `Contexto textual da mensagem do usuário: ${contexto}`
            : 'A mensagem do usuário não tem texto adicional relevante.',
        'Descreva a imagem em no máximo 18 palavras. Retorne apenas o resumo final.',
    ].join('\n')
}

function detectarPaginasSolicitadas(texto: string): { inicio: number; fim: number } | null {
    const faixa = texto.match(/\bp[áa]g(?:ina|inas)?\.?\s*(\d+)\s*(?:a|at[eé]|-)\s*(\d+)\b/i)
    if (faixa) {
        const inicio = Number(faixa[1])
        const fim = Number(faixa[2])
        if (Number.isInteger(inicio) && Number.isInteger(fim) && inicio > 0 && fim >= inicio) {
            return { inicio, fim }
        }
    }

    const unica = texto.match(/\bp[áa]g(?:ina)?\.?\s*(\d+)\b/i)
    if (!unica) return null

    const pagina = Number(unica[1])
    return Number.isInteger(pagina) && pagina > 0 ? { inicio: pagina, fim: pagina } : null
}

async function prepararArquivosAnexadosParaMensagem(
    arquivos: ArquivoAnexo[],
    textoMensagem: string
): Promise<ArquivoAnexo[]> {
    const paginasSolicitadas = detectarPaginasSolicitadas(textoMensagem)
    if (!paginasSolicitadas) {
        return arquivos.map(removerArquivoOriginal)
    }

    const preparados: ArquivoAnexo[] = []
    for (const arquivo of arquivos) {
        if (arquivo.type !== 'pdf' || !arquivo.arquivoOriginal) {
            preparados.push(removerArquivoOriginal(arquivo))
            continue
        }

        const buffer = await arquivo.arquivoOriginal.arrayBuffer()
        const conteudoPagina = await extractTextFromPdfBuffer(
            buffer,
            paginasSolicitadas.inicio,
            paginasSolicitadas.fim
        )
        const paginaLabel = paginasSolicitadas.inicio === paginasSolicitadas.fim
            ? `Página ${paginasSolicitadas.inicio}`
            : `Páginas ${paginasSolicitadas.inicio} a ${paginasSolicitadas.fim}`

        preparados.push({
            ...arquivo,
            arquivoOriginal: undefined,
            content: `[Extração específica do PDF: ${arquivo.name}]\n${paginaLabel}:\n\n${conteudoPagina}`,
            status: 'concluido',
        })
    }

    return preparados
}

function removerArquivoOriginal(arquivo: ArquivoAnexo): ArquivoAnexo {
    return {
        id: arquivo.id,
        name: arquivo.name,
        type: arquivo.type,
        size: arquivo.size,
        content: arquivo.content,
        status: arquivo.status,
    }
}

function deveBuscarArquivosDoProjeto(texto: string, project: Project | null): boolean {
    if (!project || project.files.length === 0) return false

    const normalizado = texto.toLowerCase()
    if (/^(oi|ol[aá]|ok|obrigad[oa]|valeu)\b/i.test(normalizado.trim())) return false

    const citaArquivo = project.files.some((file) => {
        const nomeBase = file.name.replace(/\.[^.]+$/, '').toLowerCase()
        return normalizado.includes(file.name.toLowerCase()) || normalizado.includes(nomeBase)
    })
    if (citaArquivo) return true

    return /\b(o que é|oq é|explique|explica|resuma|resumo|onde fala|procure|busque|no pdf|nos arquivos|do projeto)\b/i
        .test(normalizado) || /["“”][^"“”]{3,80}["“”]/.test(texto)
}

function detectarArquivoProjetoCitado(texto: string, project: Project | null): string | undefined {
    if (!project) return undefined

    const normalizado = texto.toLowerCase()
    const arquivo = project.files.find((file) => {
        const nome = file.name.toLowerCase()
        const nomeBase = nome.replace(/\.[^.]+$/, '')
        return normalizado.includes(nome) || normalizado.includes(nomeBase)
    })

    return arquivo?.name
}

function atualizarMensagemNaConversa(
    conversas: Conversation[],
    convId: string,
    msgId: string,
    atualizador: (mensagem: ChatMessage) => ChatMessage
): Conversation[] {
    return conversas.map((conversation) => {
        if (conversation.id !== convId) return conversation

        return {
            ...conversation,
            messages: conversation.messages.map((mensagem) => (
                mensagem.id === msgId ? atualizador(mensagem) : mensagem
            )),
            updatedAt: Date.now(),
        }
    })
}

function criarAgendadorAtualizacaoMensagem(
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>,
    convId: string,
    msgId: string
) {
    let quadroPendente: number | null = null
    let timeoutPendente: ReturnType<typeof setTimeout> | null = null
    let conteudoPendente = ''
    let raciocinioPendente: string | undefined
    let conteudoAplicado = ''
    let raciocinioAplicado: string | undefined

    const limparAgendamento = () => {
        if (quadroPendente !== null && typeof window !== 'undefined') {
            window.cancelAnimationFrame(quadroPendente)
        }
        if (timeoutPendente !== null) {
            clearTimeout(timeoutPendente)
        }
        quadroPendente = null
        timeoutPendente = null
    }

    const aplicar = () => {
        limparAgendamento()

        if (conteudoPendente === conteudoAplicado && raciocinioPendente === raciocinioAplicado) {
            return
        }

        conteudoAplicado = conteudoPendente
        raciocinioAplicado = raciocinioPendente

        setConversations((prev) => prev.map((conversation) => {
            if (conversation.id !== convId) return conversation

            return {
                ...conversation,
                messages: conversation.messages.map((mensagem) => (
                    mensagem.id === msgId
                        ? { ...mensagem, content: conteudoAplicado, raciocinio: raciocinioAplicado }
                        : mensagem
                )),
            }
        }))
    }

    const agendar = (conteudo: string, raciocinio?: string) => {
        conteudoPendente = conteudo
        raciocinioPendente = raciocinio?.trim() || undefined

        if (quadroPendente !== null || timeoutPendente !== null) {
            return
        }

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            quadroPendente = window.requestAnimationFrame(() => {
                quadroPendente = null
                aplicar()
            })
            return
        }

        timeoutPendente = setTimeout(() => {
            timeoutPendente = null
            aplicar()
        }, 16)
    }

    const atualizarAgora = (conteudo: string, raciocinio?: string) => {
        conteudoPendente = conteudo
        raciocinioPendente = raciocinio?.trim() || undefined
        aplicar()
    }

    const cancelar = () => {
        limparAgendamento()
    }

    return {
        agendar,
        atualizarAgora,
        flush: aplicar,
        cancelar,
    }
}



function anexarBlocosNaMensagem(mensagem: string, blocos: string[]): string {
    const blocosValidos = blocos.map((bloco) => bloco.trim()).filter(Boolean)
    if (blocosValidos.length === 0) return mensagem
    return [
        ...blocosValidos,
        '',
        mensagem,
    ].join('\n\n')
}

function criarChatFnInvestigacao(
    servico: AIService,
    systemPrompt: string
): (prompt: string, systemPromptOverride?: string) => Promise<string> {
    return async (prompt: string, systemPromptOverride?: string): Promise<string> => {
        const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { investigateMode: true })
        let response = ''
        await servico.streamChat(
            prompt,
            (chunk: string) => { response += chunk },
            systemPromptOverride !== undefined ? systemPromptOverride : systemPrompt,
            [],
            {
                temperature: configGeracao.temperature,
                reasoningAtivo: false,
            }
        )
        return response
    }
}

function criarChatFnFerramentas(servico: AIService): (prompt: string, systemPrompt?: string) => Promise<string> {
    return async (prompt: string, systemPrompt?: string): Promise<string> => {
        const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { forcarPerfil: 'pergunta_curta' })
        let response = ''
        await servico.streamChat(
            prompt,
            (chunk: string) => { response += chunk },
            systemPrompt !== undefined ? systemPrompt : PROMPT_SISTEMA_TOOLS,
            [],
            {
                temperature: configGeracao.temperature,
                reasoningAtivo: false,
            }
        )
        return response
    }
}

export function useSendMessage({
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    projects,
    input,
    setInput,
    pendingScreenshots,
    setPendingScreenshots,
    pendingFiles,
    setPendingFiles,
    pendingMessage,
    setPendingMessage,
    textareaRef,
    isGenerating,
    setIsGenerating,
    setIsAnalyzingImage,
    abortControllerRef,
    generationIdRef,
    webSearchEnabled,
    toolCallingAtivo,
    investigateMode,
    reasoningAtivo,
    setIsInvestigating,
    setCurrentTrace,
    setMessageSources,
    setMessageSearchCards,
    promptBase,
    getProfileContext,
    criarOuObterServico,
    provedorAtivo,
    modeloAtivo,
    perfilLatencia,
    politicaLatencia,
}: UseSendMessageParams) {
    const politica = aplicarPerfilLatencia(
        mergePoliticaLatencia(politicaLatencia),
        provedorAtivo,
        perfilLatencia
    )

    // Helper to update conversation messages
    const updateConversationMessages = useCallback((convId: string, newMessages: ChatMessage[]) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convId) {
                const primeiraMensagemUsuarioAnterior = c.messages.find((mensagem) => mensagem.role === 'user')
                const primeiraMensagemUsuarioNova = newMessages.find((mensagem) => mensagem.role === 'user')
                const tituloAutomaticoAnterior = primeiraMensagemUsuarioAnterior
                    ? obterTituloAutomaticoConversa(primeiraMensagemUsuarioAnterior.content)
                    : 'Nova conversa'
                const tituloAutomaticoNovo = primeiraMensagemUsuarioNova
                    ? obterTituloAutomaticoConversa(primeiraMensagemUsuarioNova.content)
                    : 'Nova conversa'
                const deveAtualizarTituloAutomatico = c.title === 'Nova conversa' || c.title === tituloAutomaticoAnterior

                return {
                    ...c,
                    messages: newMessages,
                    title: deveAtualizarTituloAutomatico ? tituloAutomaticoNovo : c.title,
                    updatedAt: Date.now()
                }
            }
            return c
        }))
    }, [setConversations])

    const atualizarMensagemEspecifica = useCallback((
        convId: string,
        msgId: string,
        atualizador: (mensagem: ChatMessage) => ChatMessage
    ) => {
        setConversations((prev) => atualizarMensagemNaConversa(prev, convId, msgId, atualizador))
    }, [setConversations])

    const gerarResumoVisualImagem = useCallback(async (
        servico: AIService,
        mensagem: ChatMessage,
        src: string,
        indiceImagem: number,
        totalImagens: number,
        signal?: AbortSignal
    ): Promise<string> => {
        try {
            const resposta = await servico.analisarImagem(
                criarPromptResumoImagem(mensagem.content, indiceImagem, totalImagens),
                src,
                {
                    signal,
                    temperature: 0.2,
                    perfilLatencia,
                    systemPromptOverride: PROMPT_SISTEMA_RESUMO_IMAGEM,
                }
            )

            const resumo = resposta.trim().replace(/\s+/g, ' ')
            if (resumo) {
                return truncarTexto(resumo, 160)
            }
        } catch (erro) {
            if (ehAbortError(erro)) {
                throw erro
            }
            console.warn('[useSendMessage] Falha ao gerar resumo da imagem, usando fallback:', erro)
        }

        return criarResumoImagemFallback(mensagem.content, indiceImagem, totalImagens)
    }, [perfilLatencia])

    const garantirResumosImagensMensagem = useCallback(async (
        convId: string,
        mensagem: ChatMessage,
        servico: AIService,
        signal?: AbortSignal
    ): Promise<ChatMessage> => {
        let mensagemAtual = normalizarMensagemChat(mensagem) || mensagem
        const metadados = mensagemAtual.imagensContexto || []

        if (metadados.length === 0) return mensagemAtual

        for (let indice = 0; indice < metadados.length; indice += 1) {
            if (signal?.aborted) {
                const erroAbortado = new Error('Abortado pelo usuário')
                ;(erroAbortado as Error & { name?: string }).name = 'AbortError'
                throw erroAbortado
            }

            const imagem = metadados[indice]
            if (imagem.resumo?.trim()) continue

            atualizarMensagemEspecifica(convId, mensagemAtual.id, (mensagemAtualizada) => (
                atualizarMetadadoImagemMensagem(mensagemAtualizada, imagem.src, {
                    statusResumo: 'gerando',
                })
            ))

            const resumo = await gerarResumoVisualImagem(
                servico,
                mensagemAtual,
                imagem.src,
                indice,
                metadados.length,
                signal
            )

            mensagemAtual = atualizarMetadadoImagemMensagem(mensagemAtual, imagem.src, {
                resumo,
                statusResumo: 'concluido',
            })

            atualizarMensagemEspecifica(convId, mensagemAtual.id, (mensagemAtualizada) => (
                atualizarMetadadoImagemMensagem(mensagemAtualizada, imagem.src, {
                    resumo,
                    statusResumo: 'concluido',
                })
            ))
        }

        return mensagemAtual
    }, [atualizarMensagemEspecifica, gerarResumoVisualImagem])

    const garantirResumosImagensHistoricas = useCallback(async (
        convId: string,
        mensagensBase: ChatMessage[],
        consultaAtual: string,
        servico: AIService,
        signal?: AbortSignal,
        opcoes: { emProjeto?: boolean } = {}
    ): Promise<ChatMessage[]> => {
        const selecionadas = selecionarMensagensComImagemParaHistorico(mensagensBase, {
            consultaAtual,
            perfilLatencia,
            emProjeto: opcoes.emProjeto,
        })

        if (selecionadas.length === 0) return mensagensBase

        const idsSelecionados = new Set(selecionadas.map((mensagem) => mensagem.id))
        const mapaAtualizado = new Map<string, ChatMessage>()

        for (const mensagem of mensagensBase) {
            if (!idsSelecionados.has(mensagem.id)) {
                mapaAtualizado.set(mensagem.id, mensagem)
                continue
            }

            const atualizada = await garantirResumosImagensMensagem(convId, mensagem, servico, signal)
            mapaAtualizado.set(mensagem.id, atualizada)
        }

        return mensagensBase.map((mensagem) => mapaAtualizado.get(mensagem.id) || mensagem)
    }, [garantirResumosImagensMensagem, perfilLatencia])

    // Run investigation (message already created, just updates trace)
    const runInvestigation = useCallback(async (
        question: string,
        convId: string,
        opcoes?: {
            chatFn?: (prompt: string) => Promise<string>
            historico?: Array<{ role: 'user' | 'assistant'; content: string }>
            conversationId?: string
            projectId?: string
            restaurarChatFn?: (prompt: string) => Promise<string>
        }
    ) => {
        setIsInvestigating(true)
        setCurrentTrace(null)

        if (opcoes?.chatFn) {
            investigateService.setChatFunction(opcoes.chatFn)
        }
        investigateService.setHistoricoChat(opcoes?.historico || [])
        investigateService.setContextoExecucao({
            conversationId: opcoes?.conversationId || convId,
            projectId: opcoes?.projectId,
        })

        // Subscribe to updates for real-time progress
        const unsubscribe = investigateService.subscribe((update) => {
            setCurrentTrace(update.trace)

            // Update the existing message with progress
            if (update.message && update.type !== 'completed') {
                setConversations(prev => prev.map(c => {
                    if (c.id === convId) {
                        const lastAiMsg = [...c.messages].reverse().find(m => m.role === 'assistant')
                        if (lastAiMsg) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === lastAiMsg.id
                                        ? { ...m, content: `🔍 *${update.message}*` }
                                        : m
                                )
                            }
                        }
                    }
                    return c
                }))
            }
        })

        try {
            const trace = await investigateService.investigate(question)
            setCurrentTrace(trace)

            // NOTE: Final answer is set by the calling code, NOT here
            // This prevents duplicate messages

        } catch (error) {
            console.error('[useSendMessage] Investigation error:', error)
        } finally {
            unsubscribe()
            if (opcoes?.restaurarChatFn) {
                investigateService.setChatFunction(opcoes.restaurarChatFn)
            }
            const servicoRestauracao = criarOuObterServico()
            if (servicoRestauracao) {
                toolCallingService.setChatFunction(criarChatFnFerramentas(servicoRestauracao))
            }
            setIsInvestigating(false)
        }
    }, [criarOuObterServico, setConversations, setIsInvestigating, setCurrentTrace])

    // Join multiple screenshots into one
    const juntarScreenshots = async (imagens: string[]) => {
        if (imagens.length === 1) return imagens[0]
        const carregadas = await Promise.all(imagens.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image()
            im.onload = () => resolve(im)
            im.onerror = (e) => reject(e)
            im.src = src
        })))
        const largura = Math.max(...carregadas.map(im => im.width))
        const altura = carregadas.reduce((acc, im) => acc + im.height, 0)
        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        let offsetY = 0
        carregadas.forEach((im) => {
            ctx.drawImage(im, 0, offsetY, im.width, im.height)
            offsetY += im.height
        })
        return canvas.toDataURL('image/png')
    }

    // Main send function
    const handleSend = useCallback(async () => {
        const hasTexto = input.trim().length > 0
        const hasArquivos = pendingFiles.length > 0
        if (!hasTexto && pendingScreenshots.length === 0 && !hasArquivos) return

        // If currently generating, queue the message
        if (isGenerating) {
            console.log('[useSendMessage] Queueing message for later processing')
            setPendingMessage({
                text: input.trim(),
                screenshots: [...pendingScreenshots],
                arquivos: [...pendingFiles]
            })
            setInput('')
            setPendingScreenshots([])
            setPendingFiles([])
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
            return
        }

        const servico = criarOuObterServico()
        if (!servico) {
            console.error('[useSendMessage] No AI service available')
            return
        }

        // Create conversation if none active
        let convId = activeConversationId
        if (!convId) {
            const titulo = hasTexto ? input.trim().slice(0, 30) : 'Screenshots'
            const newConv: Conversation = {
                id: uuidv4(),
                title: titulo + (hasTexto && input.trim().length > 30 ? '...' : ''),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            setConversations(prev => [newConv, ...prev])
            setActiveConversationId(newConv.id)
            convId = newConv.id
        }

        const promptImagem = pendingScreenshots.length > 0 ? (hasTexto ? input.trim() : 'Descreva a imagem e responda em português.') : null
        const userContent = promptImagem ?? input.trim()
        const configGeracaoChat = obterConfiguracaoPerfilGeracao(userContent, { investigateMode })
        const arquivosPreparados = pendingFiles.length > 0
            ? await prepararArquivosAnexadosParaMensagem(pendingFiles, userContent)
            : []

        let userMsg = normalizarMensagemChat({
            id: uuidv4(),
            role: 'user',
            content: userContent,
            timestamp: Date.now(),
            images: pendingScreenshots.length > 0 ? [...pendingScreenshots] : undefined,
            imagensContexto: criarMetadadosImagensPendentes(pendingScreenshots),
            arquivos: arquivosPreparados.length > 0 ? arquivosPreparados : undefined,
        }) as ChatMessage

        const aiMsgId = uuidv4()
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }

        const currentMessages = [...messages, userMsg, aiMsg]
        updateConversationMessages(convId, currentMessages)
        setInput('')
        setPendingScreenshots([])
        setPendingFiles([])
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
        setIsGenerating(true)

        const currentGenerationId = aiMsgId
        ;(generationIdRef as React.MutableRefObject<string | null>).current = currentGenerationId
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = new AbortController()
        let streamedContent = ''
        let streamedRaciocinio = ''

        const isGenerationActive = () => generationIdRef.current === currentGenerationId
        const agendadorMensagemAssistente = criarAgendadorAtualizacaoMensagem(setConversations, convId, aiMsgId)
        const atualizarMensagemAssistente = (
            conteudo: string,
            raciocinio: string = streamedRaciocinio,
            imediato = false
        ) => {
            if (imediato) {
                agendadorMensagemAssistente.atualizarAgora(conteudo, raciocinio)
                return
            }

            agendadorMensagemAssistente.agendar(conteudo, raciocinio)
        }
        const signal = (abortControllerRef as React.MutableRefObject<AbortController | null>).current?.signal
        const inicioTotal = performance.now()
        const inicioPreStream = performance.now()
        let tempoPrompt = 0
        let tempoTools = 0
        const tempoWeb = 0
        let ttft: number | null = null
        let modoMetricas: MetricasLatencia['modo'] = 'chat'
        const currentConv = conversations.find(c => c.id === convId)
        const currentProject = currentConv?.projectId
            ? projects.find(project => project.id === currentConv.projectId) || null
            : null
        const opcoesContextoProjeto = obterOpcoesContextoProjeto(provedorAtivo, perfilLatencia)
        const orcamentoPromptEfetivo = obterOrcamentoPromptEfetivo(provedorAtivo, perfilLatencia)

        try {
            if (userMsg.images?.length) {
                userMsg = await garantirResumosImagensMensagem(convId, userMsg, servico, signal)
            }

            if (pendingScreenshots.length > 0 && promptImagem) {
                modoMetricas = 'imagem'
                setIsAnalyzingImage(true)

                const imagemUnica = await juntarScreenshots(pendingScreenshots)
                if (!imagemUnica) throw new Error('Falha ao preparar imagens')
                const configGeracaoImagem = obterConfiguracaoPerfilGeracao(promptImagem, { ehImagem: true })
                const mensagensHistoricasResolvidas = await garantirResumosImagensHistoricas(
                    convId,
                    messages,
                    promptImagem,
                    servico,
                    signal,
                    { emProjeto: Boolean(currentProject) }
                )
                const historicoImagem = prepararHistoricoParaModelo(
                    mensagensHistoricasResolvidas,
                    politica.maxCharsMensagemHistorico,
                    {
                        consultaAtual: promptImagem,
                        perfilLatencia,
                        emProjeto: Boolean(currentProject),
                    }
                )
                let systemPromptOverride: string | undefined
                const promptImagemComContexto = promptImagem
                if (currentProject) {
                    const promptSistemaImagemBase = criarPromptSistemaProjeto(currentProject).promptSistemaProjeto
                    const contextoArquivosProjeto = criarContextoArquivosProjeto(currentProject, promptImagem, {
                        ...opcoesContextoProjeto,
                    }).blocoContexto
                    // Contexto dos arquivos vai no system prompt, não na mensagem do usuário
                    const partesSistema = [criarPromptSistemaImagem(promptSistemaImagemBase)]
                    if (contextoArquivosProjeto) {
                        partesSistema.push(`[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`)
                    }
                    systemPromptOverride = partesSistema.filter(Boolean).join('\n\n')
                }

                const promptSistemaImagemEfetivo = systemPromptOverride || 'Analise a imagem e responda em português do Brasil.'
                let firstChunkReceived = false
                let metaFimImagem: MetaFimStream | null = null
                await servico.streamAnalisarImagem(
                    promptImagemComContexto,
                    imagemUnica,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (!firstChunkReceived) {
                            firstChunkReceived = true
                            if (ttft === null) {
                                ttft = performance.now() - inicioTotal
                            }
                            setIsAnalyzingImage(false)
                        }

                        streamedContent += chunk
                        atualizarMensagemAssistente(streamedContent, '')
                    },
                    {
                        signal,
                        temperature: configGeracaoImagem.temperature,
                        perfilLatencia,
                        reasoningAtivo,
                        historico: historicoImagem,
                        systemPromptOverride,
                        onFimStream: (meta: MetaFimStream) => {
                            metaFimImagem = meta
                        },
                    }
                )

                agendadorMensagemAssistente.flush()
                setIsAnalyzingImage(false)

                let continuacoesImagemExecutadas = 0
                let truncamentoImagemPersistente =
                    ehFinishReasonLength(metaFimImagem) ||
                    respostaPareceTruncadaForte(streamedContent)

                while (isGenerationActive() && truncamentoImagemPersistente && continuacoesImagemExecutadas < MAX_AUTO_CONTINUACOES) {
                    continuacoesImagemExecutadas += 1
                    const conteudoAntesContinuacao = streamedContent
                    let bufferContinuacaoImagem = ''
                    let metaFimContinuacaoImagem: MetaFimStream | null = null

                    const historicoContinuacaoImagem = [
                        ...historicoImagem,
                        {
                            role: 'user' as const,
                            content: criarConteudoHistoricoComResumoVisual(userMsg, 1800),
                        },
                        {
                            role: 'assistant' as const,
                            content: truncarTexto(conteudoAntesContinuacao, 1800),
                        },
                    ]

                    await servico.streamChat(
                        'Continue exatamente de onde a análise anterior parou. Não repita o que já foi dito. Considere a mesma imagem e finalize a resposta por completo.',
                        (chunk: string) => {
                            if (!isGenerationActive()) return

                            if (ttft === null) {
                                ttft = performance.now() - inicioTotal
                            }

                            bufferContinuacaoImagem += chunk
                            streamedContent += chunk
                            atualizarMensagemAssistente(streamedContent, '')
                        },
                        promptSistemaImagemEfetivo,
                        historicoContinuacaoImagem,
                        {
                            signal,
                            temperature: configGeracaoImagem.temperature,
                            perfilLatencia,
                            reasoningAtivo,
                            onFimStream: (meta: MetaFimStream) => {
                                metaFimContinuacaoImagem = meta
                            },
                        }
                    )

                    if (bufferContinuacaoImagem.trim()) {
                        const conteudoSemDuplicacao = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacaoImagem)
                        if (conteudoSemDuplicacao !== streamedContent) {
                            streamedContent = conteudoSemDuplicacao
                            atualizarMensagemAssistente(streamedContent, '', true)
                        }
                    }

                    truncamentoImagemPersistente =
                        ehFinishReasonLength(metaFimContinuacaoImagem) ||
                        respostaPareceTruncadaForte(bufferContinuacaoImagem || streamedContent)
                }

                if (isGenerationActive() && truncamentoImagemPersistente) {
                    streamedContent = `${streamedContent.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
                    atualizarMensagemAssistente(streamedContent, '', true)
                }

                const respostaImagemIncompleta = !streamedContent.trim() || respostaPareceIncompleta(streamedContent)
                if (isGenerationActive() && respostaImagemIncompleta) {
                    try {
                        const respostaReparoImagem = await servico.analisarImagem(
                            `${promptImagemComContexto}\n\nResponda novamente de forma completa em português do Brasil, sem cortar a frase final.`,
                            imagemUnica,
                            {
                                signal,
                                temperature: configGeracaoImagem.temperature,
                                perfilLatencia,
                                historico: historicoImagem,
                                systemPromptOverride,
                            }
                        )

                        if (respostaReparoImagem?.trim()) {
                            streamedContent = respostaReparoImagem.trim()
                            atualizarMensagemAssistente(streamedContent, '', true)
                        }
                    } catch (erroReparoImagem) {
                        console.warn('[useSendMessage] Falha no reparo da resposta de imagem:', erroReparoImagem)
                    }
                }
            } else if (investigateMode && hasTexto) {
                modoMetricas = 'investigate'
                console.log('[useSendMessage] Starting investigation for:', userContent)

                atualizarMensagemAssistente('🔍 *Iniciando investigação...*', '', true)
                const historicoInvestigacao = prepararHistoricoParaModelo(
                    messages,
                    politica.maxCharsMensagemHistorico,
                    {
                        consultaAtual: userContent,
                        perfilLatencia,
                        emProjeto: Boolean(currentProject),
                    }
                )
                const contextoArquivosProjeto = currentProject
                    ? criarContextoArquivosProjeto(currentProject, userContent, {
                        ...opcoesContextoProjeto,
                    }).blocoContexto
                    : ''
                // Contexto dos arquivos vai no system prompt da investigação
                const promptSistemaInvestigacaoBase = currentProject
                    ? criarPromptSistemaProjeto(currentProject).promptSistemaProjeto
                    : PROMPT_SISTEMA_INVESTIGACAO
                const promptSistemaInvestigacao = contextoArquivosProjeto
                    ? [promptSistemaInvestigacaoBase, `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`].filter(Boolean).join('\n\n')
                    : promptSistemaInvestigacaoBase
                const chatFnInvestigacao = criarChatFnInvestigacao(servico, promptSistemaInvestigacao)
                const chatFnRestauracao = criarChatFnInvestigacao(servico, PROMPT_SISTEMA_INVESTIGACAO)
                const chatFnFerramentas = criarChatFnFerramentas(servico)

                await runInvestigation(userContent, convId!, {
                    chatFn: chatFnInvestigacao,
                    historico: historicoInvestigacao,
                    conversationId: convId,
                    projectId: currentProject?.id,
                    restaurarChatFn: chatFnRestauracao,
                })
                toolCallingService.setChatFunction(chatFnFerramentas)

                const trace = investigateService.getCurrentTrace()
                if (trace?.finalAnswer) {
                    // Simular streaming da resposta final
                    const fullAnswer = trace.finalAnswer
                    let displayedContent = ''
                    const chunkSize = 20 // caracteres por chunk
                    const delay = 15 // ms entre chunks

                    for (let i = 0; i < fullAnswer.length; i += chunkSize) {
                        displayedContent = fullAnswer.slice(0, i + chunkSize)

                        if (ttft === null) {
                            ttft = performance.now() - inicioTotal
                        }

                        atualizarMensagemAssistente(displayedContent, '')

                        // Pequeno delay para criar efeito de streaming
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }

                    // Garantir que a resposta final completa está lá
                    setConversations(prev => prev.map(c => {
                        if (c.id === convId) {
                            return {
                                ...c,
                                messages: c.messages.map(m =>
                                    m.id === aiMsgId ? { ...m, content: fullAnswer, raciocinio: undefined } : m
                                ),
                                updatedAt: Date.now()
                            }
                        }
                        return c
                    }))
                }
            } else {
                const webSearchContext = ''
                const searchSources: WebSource[] = []
                let contextoFerramentas = ''
                let cartoesFerramentas: ToolCardData[] = []
                let houveBuscaWeb = false
                let buscaWebComResultados = false
                const buscaWebExpirou = false

                const tempoRestantePreStream = () => Math.max(0, politica.prestreamBudgetMs - (performance.now() - inicioPreStream))

                if (toolCallingAtivo) {
                    const inicioTools = performance.now()
                    try {
                        // No fluxo de tool calling, a IA decide se/como usar web_search de forma autônoma.
                        const ferramentasDisponiveis = toolRegistry.getEnabled()

                        if (ferramentasDisponiveis.length > 0) {
                            const historicoChat = prepararHistoricoParaModelo(
                                messages,
                                politica.maxCharsMensagemHistorico,
                                {
                                    consultaAtual: userMsg.content,
                                    perfilLatencia,
                                    emProjeto: Boolean(currentProject),
                                }
                            )

                            const historicoDecisaoTemporario = [...historicoChat]
                            const allCalls: ToolCall[] = []
                            let progressContentAcumulado = ''

                            // Define um status inicial e gera a frase bonita de forma síncrona antes do tool calling
                            const deveExibirStatusBuscaWeb = shouldSearchWeb(userMsg.content)
                            if (deveExibirStatusBuscaWeb) {
                                progressContentAcumulado = 'Pesquisando na web...'
                                setConversations(prev => prev.map(c => {
                                    if (c.id === convId) {
                                        return {
                                            ...c,
                                            messages: c.messages.map(m =>
                                                m.id === aiMsgId ? { ...m, content: progressContentAcumulado, raciocinio: undefined } : m
                                            )
                                        }
                                    }
                                    return c
                                }))

                                if (servico) {
                                    try {
                                        const promptFrase = `Instrução: Com base na pergunta do usuário, crie uma frase muito curta (máximo 12 palavras), direta e natural em português, iniciando com "Vou buscar...", "Vou pesquisar..." ou similar, descrevendo de forma concisa o que você vai procurar na internet.
Exemplos:
Pergunta: "Qual foi o resultado da copa hoje? Pesquise" -> Resposta: "Vou pesquisar os resultados da Copa hoje."
Pergunta: "Quem ganhou o jogo do Palmeiras ontem?" -> Resposta: "Vou buscar o resultado do jogo do Palmeiras de ontem."
Pergunta: "${userMsg.content}" -> Resposta:`

                                        const fraseGerada = await servico.chat(
                                            promptFrase,
                                            'Você é um assistente conciso que gera status de busca. Responda apenas a frase final, sem raciocínio.',
                                            [],
                                            {
                                                temperature: 0.2,
                                                reasoningAtivo: false,
                                            }
                                        )
                                        const fraseLimpa = fraseGerada
                                            .replace(/<think>[\s\S]*?<\/think>/gi, '')
                                            .replace(/<\/?think>/gi, '')
                                            .split('\n')
                                            .map((linha) => linha.trim())
                                            .find(Boolean)
                                            ?.replace(/^["']|["']$/g, '')
                                            .slice(0, 120)
                                            .trim() || ''
                                        if (fraseLimpa && fraseLimpa.length > 3) {
                                            progressContentAcumulado = fraseLimpa
                                            setConversations(prev => prev.map(c => {
                                                if (c.id === convId) {
                                                    return {
                                                        ...c,
                                                        messages: c.messages.map(m =>
                                                            m.id === aiMsgId ? { ...m, content: progressContentAcumulado, raciocinio: undefined } : m
                                                        )
                                                    }
                                                }
                                                return c
                                            }))
                                        }
                                    } catch (err) {
                                        console.warn('Erro ao gerar status inicial via IA:', err)
                                    }
                                }
                            }

                            let rodadasToolCalling = 0
                            const projectFileSearchTool = ferramentasDisponiveis.find(
                                (tool) => tool.id === 'builtin:project_file_search'
                            )
                            const arquivoProjetoCitado = detectarArquivoProjetoCitado(userMsg.content, currentProject)
                            let decisaoRecuperacaoPendente: Awaited<ReturnType<typeof toolCallingService.decideToolUsage>> | null =
                                projectFileSearchTool && deveBuscarArquivosDoProjeto(userMsg.content, currentProject)
                                    ? {
                                        shouldUseTool: true,
                                        toolCalls: [{
                                            tool: projectFileSearchTool.id,
                                            arguments: arquivoProjetoCitado
                                                ? { query: userMsg.content, fileName: arquivoProjetoCitado }
                                                : { query: userMsg.content },
                                            reasoning: 'A pergunta depende dos arquivos anexados ao projeto ativo.',
                                        }],
                                    }
                                    : null
                            const atualizarCartoesFerramenta = (cartoesNovos: ToolCardData[]) => {
                                if (cartoesNovos.length === 0) return

                                setMessageSearchCards(prev => {
                                    const existentes = prev[aiMsgId] || []
                                    const porId = new Map<string, ToolCardData>()

                                    existentes.forEach((cartao, indice) => {
                                        porId.set(cartao.callId || `existente-${indice}`, cartao)
                                    })
                                    cartoesNovos.forEach((cartao, indice) => {
                                        // Remove card pendente do mesmo toolId ao receber o card real
                                        if (cartao.callId && !cartao.callId.startsWith('pending-')) {
                                            for (const chave of porId.keys()) {
                                                if (chave.startsWith(`pending-`) && chave.endsWith(cartao.toolId)) {
                                                    porId.delete(chave)
                                                    break
                                                }
                                            }
                                        }
                                        porId.set(cartao.callId || `novo-${indice}-${cartao.toolId}`, cartao)
                                    })
                                    return {
                                        ...prev,
                                        [aiMsgId]: Array.from(porId.values()),
                                    }
                                })
                            }

                            // Salvaguarda ampla para evitar loops infinitos em caso de comportamento anômalo da IA
                            const maxRodadasSeguranca = 15

                            while (rodadasToolCalling < maxRodadasSeguranca) {
                                const decisao = decisaoRecuperacaoPendente || (
                                    await toolCallingService.decideToolUsage(
                                        userMsg.content,
                                        historicoDecisaoTemporario,
                                        ferramentasDisponiveis,
                                        {
                                            estrategiaDecisao: politica.estrategiaTools,
                                            timeoutMs: politica.toolDecisionTimeoutMs,
                                            timeoutQueryMs: politica.webQueryPlanTimeoutMs,
                                            maxBuscasWebPorMensagem: politica.maxBuscasWebPorMensagem,
                                            pularPlanejamentoWebIA: politica.pularPlanejamentoWebIA,
                                            maxTentativasPorTarefa: politica.maxTentativasPorTarefa,
                                            modoAutonomia: politica.modoAutonomia,
                                            webSearchEnabled,
                                            onDecisionStart: (decisaoPreliminar) => {
                                                if (decisaoPreliminar.shouldUseTool && decisaoPreliminar.toolCalls.length > 0) {
                                                    const statusMessage = toolCallingService.obterMensagemStatusHeuristica(
                                                        decisaoPreliminar.toolCalls
                                                    )
                                                    const cartoesPendentes = toolCallingService.toolRequestsToCardDataPendente(
                                                        decisaoPreliminar.toolCalls,
                                                        statusMessage || 'Preparando busca...'
                                                    )
                                                    atualizarCartoesFerramenta(cartoesPendentes)

                                                    if (statusMessage) {
                                                        if (!progressContentAcumulado) {
                                                            progressContentAcumulado = statusMessage
                                                        }

                                                        setConversations(prev => prev.map(c => {
                                                            if (c.id === convId) {
                                                                return {
                                                                    ...c,
                                                                    messages: c.messages.map(m =>
                                                                        m.id === aiMsgId ? { ...m, content: construirConteudoComMarcadores(progressContentAcumulado, decisaoPreliminar.toolCalls), raciocinio: undefined } : m
                                                                    )
                                                                }
                                                            }
                                                            return c
                                                        }))
                                                    }
                                                }
                                            }
                                        }
                                    )
                                )
                                decisaoRecuperacaoPendente = null

                                if (decisao.shouldUseTool && decisao.toolCalls.length > 0) {
                                    const statusMessage = await toolCallingService.generateStatusMessage(
                                        userMsg.content,
                                        decisao.toolCalls
                                    )

                                    const progressContent = statusMessage || ''
                                    if (progressContent) {
                                        const temBuscaWeb = decisao.toolCalls.some(tc => tc.tool.includes('web_search'))
                                        // Se for outra ferramenta ou se ainda não temos progressContentAcumulado
                                        if (!progressContentAcumulado || !temBuscaWeb) {
                                            if (!progressContentAcumulado.includes(progressContent)) {
                                                progressContentAcumulado = progressContentAcumulado
                                                    ? `${progressContentAcumulado}\n${progressContent}`
                                                    : progressContent

                                                setConversations(prev => prev.map(c => {
                                                    if (c.id === convId) {
                                                        return {
                                                            ...c,
                                                            messages: c.messages.map(m =>
                                                                m.id === aiMsgId ? { ...m, content: construirConteudoComMarcadores(progressContentAcumulado, decisao.toolCalls), raciocinio: undefined } : m
                                                            )
                                                        }
                                                    }
                                                    return c
                                                }))
                                            }
                                        }
                                    }

                                    const convForContext = conversations.find(c => c.id === convId)
                                    const projectIdForTools = convForContext?.projectId || currentProject?.id

                                    // Exibe o card imediatamente com status 'pending' para feedback instantâneo (com os parâmetros finais refinados se houver)
                                    const cartoesPendentes = toolCallingService.toolRequestsToCardDataPendente(
                                        decisao.toolCalls,
                                        progressContentAcumulado
                                    )
                                    atualizarCartoesFerramenta(cartoesPendentes)

                                    const cancelarAssinaturaTool = toolExecutor.subscribe((call) => {
                                        if (call.input.context?.messageId !== aiMsgId) {
                                            return
                                        }
                                        atualizarCartoesFerramenta(
                                            toolCallingService.toolCallsToCardData([call], progressContentAcumulado)
                                        )
                                    })

                                    let calls: ToolCall[] = []
                                    try {
                                        calls = await toolCallingService.executeToolCalls(
                                            decisao,
                                            undefined,
                                            undefined,
                                            {
                                                conversationId: convId!,
                                                messageId: aiMsgId,
                                                projectId: projectIdForTools,
                                                userQuery: userMsg.content
                                            }
                                        )
                                    } finally {
                                        cancelarAssinaturaTool()
                                    }

                                    allCalls.push(...calls)

                                    // Analisar se houve buscas web
                                    const chamadasWeb = calls.filter((call) => call.input.toolId.includes('web_search'))
                                    if (chamadasWeb.length > 0) {
                                        houveBuscaWeb = true
                                        const encontrouResultadoWeb = chamadasWeb.some((call) => {
                                            const data = call.result?.data as { results?: unknown[] } | undefined
                                            return Array.isArray(data?.results) && data.results.length > 0
                                        })
                                        if (encontrouResultadoWeb) {
                                            buscaWebComResultados = true
                                        }
                                    }

                                    // Formatar resultados para a próxima iteração
                                    const toolCallsSummary = decisao.toolCalls.map(tc => `${tc.tool}(${JSON.stringify(tc.arguments)})`).join(', ')
                                    const toolResultsSummary = toolCallingService.formatResultsForAI(calls)

                                    historicoDecisaoTemporario.push({
                                        role: 'assistant',
                                        content: `Usando ferramentas: ${toolCallsSummary}`
                                    })
                                    historicoDecisaoTemporario.push({
                                        role: 'user',
                                        content: `[Resultado das ferramentas]:\n${toolResultsSummary}`
                                    })

                                    const decisaoAutonomia = toolCallingService.avaliarAutonomia(
                                        userMsg.content,
                                        calls,
                                        allCalls,
                                        ferramentasDisponiveis,
                                        {
                                            maxTentativasPorTarefa: politica.maxTentativasPorTarefa,
                                            modoAutonomia: politica.modoAutonomia,
                                        }
                                    )

                                    if (decisaoAutonomia.action === 'continuar' && decisaoAutonomia.toolCalls?.length) {
                                        // Autonomia quer continuar com mais ferramentas
                                        decisaoRecuperacaoPendente = {
                                            shouldUseTool: true,
                                            toolCalls: decisaoAutonomia.toolCalls,
                                        }
                                        rodadasToolCalling++
                                    } else if (decisaoAutonomia.action === 'continuar') {
                                        // Autonomia quer continuar, mas deixa a IA decidir recursivamente a próxima query
                                        decisaoRecuperacaoPendente = null
                                        rodadasToolCalling++
                                    } else if (decisaoAutonomia.action === 'perguntar' && decisaoAutonomia.question) {
                                        // Autonomia quer perguntar algo ao usuário antes de continuar
                                        streamedContent = decisaoAutonomia.question
                                        atualizarMensagemAssistente(streamedContent, '', true)
                                        break
                                    } else {
                                        // Autonomia decidiu 'responder' ou 'parar': sai imediatamente
                                        // sem fazer nova chamada de decisão à LLM
                                        break
                                    }
                                } else {
                                    // A IA decidiu responder diretamente ou não usar mais ferramentas nesta rodada
                                    break
                                }
                            }

                            if (allCalls.length > 0) {
                                const blocoToolsAplicado = aplicarOrcamentoPrompt(
                                    toolCallingService.formatResultsForAI(allCalls),
                                    ORCAMENTO_PROMPT_PADRAO.ferramentasWebTokens
                                )
                                contextoFerramentas = blocoToolsAplicado.texto
                                cartoesFerramentas = toolCallingService.toolCallsToCardData(allCalls, progressContentAcumulado)

                                if (cartoesFerramentas.length > 0) {
                                    setMessageSearchCards(prev => {
                                        const existentes = prev[aiMsgId] || []
                                        const porId = new Map<string, ToolCardData>()
                                        existentes.forEach((cartao, indice) => {
                                            // Mantém apenas cards que não são pendentes (já substituídos)
                                            const chave = cartao.callId || `existente-${indice}`
                                            porId.set(chave, cartao)
                                        })
                                        cartoesFerramentas.forEach((cartao, indice) => {
                                            // Remove card pendente do mesmo toolId
                                            for (const chave of porId.keys()) {
                                                if (chave.startsWith('pending-') && chave.endsWith(cartao.toolId)) {
                                                    porId.delete(chave)
                                                    break
                                                }
                                            }
                                            porId.set(cartao.callId || `final-${indice}-${cartao.toolId}`, cartao)
                                        })
                                        return {
                                            ...prev,
                                            [aiMsgId]: Array.from(porId.values())
                                        }
                                    })

                                    const conteudoComMarcadores = construirConteudoComMarcadores(progressContentAcumulado, allCalls)
                                    setConversations(prev => prev.map(c => {
                                        if (c.id === convId) {
                                            return {
                                                ...c,
                                                messages: c.messages.map(m =>
                                                    m.id === aiMsgId ? { ...m, content: conteudoComMarcadores, raciocinio: undefined } : m
                                                )
                                            }
                                        }
                                        return c
                                    }))
                                    streamedContent = conteudoComMarcadores + '\n\n'
                                }
                            }
                        }
                    } finally {
                        tempoTools = performance.now() - inicioTools
                    }
                }

                const inicioPrompt = performance.now()
                const permitirContextoPessoal = currentProject ? false : deveInjetarContextoPessoal(userMsg.content, true)
                const { systemPrompt: composedPrompt, metadata: promptMetadata } = await composePromptEfetivo(
                    {
                        systemPrompt: promptBase,
                        userProfileContext: currentProject ? '' : getProfileContext({
                            consulta: userMsg.content,
                            permitirContextoPessoal,
                            somenteIdentidadeBasica: false,
                        }),
                        currentConversationId: convId,
                        currentProjectId: currentProject?.id,
                        currentProject,
                        currentUserMessage: userMsg.content,
                        permitirContextoPessoal,
                        permitirMemoriaPerfil: !currentProject,
                        permitirMemoriasAuto: !currentProject,
                        permitirCrossChat: !currentProject,
                    },
                    {
                        orcamento: orcamentoPromptEfetivo,
                        incluirDataHora: currentProject ? false : 'auto',
                        timeoutCrossChatMs: currentProject
                            ? 0
                            : Math.min(
                                politica.timeoutCrossChatMs,
                                Math.max(80, Math.floor(tempoRestantePreStream()))
                            ),
                    }
                )
                tempoPrompt = performance.now() - inicioPrompt

                console.log('[useSendMessage] Prompt mode:', {
                    mode: promptMetadata.mode,
                    totalArquivosProjeto: promptMetadata.totalArquivosProjeto || 0,
                    trechosProjetoIncluidos: promptMetadata.trechosProjetoIncluidos || 0,
                    webSearchContextChars: webSearchContext.length,
                    contextoFerramentasChars: contextoFerramentas.length,
                })
                const contextoArquivosProjeto = currentProject
                    ? criarContextoArquivosProjeto(currentProject, userMsg.content, {
                        ...opcoesContextoProjeto,
                    }).blocoContexto
                    : ''
                // Contextos dinâmicos ficam junto da mensagem do usuário para evitar que provedores
                // locais ignorem ou resumam demais o system prompt.
                let contextArquivosAnexados = ''
                if (userMsg.arquivos && userMsg.arquivos.length > 0) {
                    contextArquivosAnexados = userMsg.arquivos
                        .filter(file => file.content && file.content.trim())
                        .map(file => {
                            return `[Documento Anexado: ${file.name} (${formatFileSize(file.size)})]\n--- Conteúdo do Documento ---\n${file.content}\n--- Fim do Documento ---`
                        })
                        .join('\n\n')
                }

                const mensagemUsuarioComContexto = anexarBlocosNaMensagem(userMsg.content, [
                    contextArquivosAnexados,
                    webSearchContext,
                    contextoFerramentas,
                ])
                const mensagemUsuarioParaModelo = userMsg.images?.length
                    ? criarConteudoTextoComImagens(mensagemUsuarioComContexto, userMsg.images)
                    : mensagemUsuarioComContexto

                const instrucaoRespostaCurta = (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    ? '[formato_resposta]\nResponda de forma curta e completa em português do Brasil, finalizando a última frase.'
                    : ''
                const solicitouBuscaWeb = shouldSearchWeb(userMsg.content)
                const instrucaoSemFonteConfiavel = (houveBuscaWeb && !buscaWebComResultados && !buscaWebExpirou)
                    ? '[confiabilidade_web]\nA busca na web não retornou fontes confiáveis suficientes. Informe a incerteza de forma explícita, não invente fatos e sugira refinar a busca.'
                    : ''
                const instrucaoFalhaBuscaWeb = ((solicitouBuscaWeb && !houveBuscaWeb) || buscaWebExpirou)
                    ? '[busca_web_indisponivel]\nO usuário pediu pesquisa na web, mas a coleta não foi concluída nesta rodada. Não diga que você nunca tem internet. Informe falha temporária de busca e peça para tentar novamente.'
                    : ''

                // Arquivos do projeto como seção no system, não na mensagem do usuário
                const secaoArquivosProjeto = contextoArquivosProjeto
                    ? `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`
                    : ''

                const finalPrompt = [
                    composedPrompt,
                    secaoArquivosProjeto,
                    instrucaoRespostaCurta,
                    instrucaoSemFonteConfiavel,
                    instrucaoFalhaBuscaWeb,
                ].filter(Boolean).join('\n\n')

                const historicoParaModelo = prepararHistoricoParaModelo(
                    await garantirResumosImagensHistoricas(
                        convId,
                        messages,
                        userMsg.content,
                        servico,
                        signal,
                        { emProjeto: Boolean(currentProject) }
                    ),
                    politica.maxCharsMensagemHistorico,
                    {
                        consultaAtual: userMsg.content,
                        perfilLatencia,
                        emProjeto: Boolean(currentProject),
                    }
                )

                let metaFimPrincipal: MetaFimStream | null = null
                await servico.streamChat(
                    mensagemUsuarioParaModelo,
                    (chunk: string) => {
                        if (!isGenerationActive()) return

                        if (ttft === null) {
                            ttft = performance.now() - inicioTotal
                        }

                        streamedContent += chunk
                        atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                    },
                    finalPrompt,
                    historicoParaModelo,
                    {
                        signal,
                        temperature: configGeracaoChat.temperature,
                        perfilLatencia,
                        reasoningAtivo,
                        onEventoStream: (evento: EventoStreamIA) => {
                            if (!isGenerationActive()) return
                            if (evento.tipo !== 'raciocinio' || !evento.texto) return
                            streamedRaciocinio += evento.texto
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                        },
                        onFimStream: (meta: MetaFimStream) => {
                            metaFimPrincipal = meta
                        },
                    }
                )

                agendadorMensagemAssistente.flush()
                let continuacoesExecutadas = 0
                let truncamentoPersistente =
                    ehFinishReasonLength(metaFimPrincipal) ||
                    respostaPareceTruncadaForte(streamedContent)

                while (isGenerationActive() && truncamentoPersistente && continuacoesExecutadas < MAX_AUTO_CONTINUACOES) {
                    continuacoesExecutadas += 1
                    const conteudoAntesContinuacao = streamedContent
                    let bufferContinuacao = ''
                    let metaFimContinuacao: MetaFimStream | null = null

                    const instrucaoContinuacao = [
                        'Continue exatamente de onde a resposta anterior parou.',
                        'Não repita conteúdo já escrito.',
                        'Finalize a explicação com fechamento completo.',
                    ].join(' ')

                    const historicoContinuacao = [
                        ...historicoParaModelo,
                        { role: 'user' as const, content: criarConteudoHistoricoComResumoVisual(userMsg, 1800) },
                        {
                            role: 'assistant' as const,
                            content: truncarTexto(conteudoAntesContinuacao, 1800),
                        },
                    ]

                    await servico.streamChat(
                        instrucaoContinuacao,
                        (chunk: string) => {
                            if (!isGenerationActive()) return
                            bufferContinuacao += chunk
                            streamedContent += chunk
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                        },
                        finalPrompt,
                        historicoContinuacao,
                        {
                            signal,
                            temperature: configGeracaoChat.temperature,
                            perfilLatencia,
                            reasoningAtivo,
                            onEventoStream: (evento: EventoStreamIA) => {
                                if (!isGenerationActive()) return
                                if (evento.tipo !== 'raciocinio' || !evento.texto) return
                                streamedRaciocinio += evento.texto
                                atualizarMensagemAssistente(streamedContent, streamedRaciocinio)
                            },
                            onFimStream: (meta: MetaFimStream) => {
                                metaFimContinuacao = meta
                            },
                        }
                    )

                    if (bufferContinuacao.trim()) {
                        const conteudoSemDuplicacao = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacao)
                        if (conteudoSemDuplicacao !== streamedContent) {
                            streamedContent = conteudoSemDuplicacao
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio, true)
                        }
                    }

                    truncamentoPersistente =
                        ehFinishReasonLength(metaFimContinuacao) ||
                        respostaPareceTruncadaForte(bufferContinuacao || streamedContent)
                }

                if (isGenerationActive() && truncamentoPersistente) {
                    streamedContent = `${streamedContent.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
                    atualizarMensagemAssistente(streamedContent, streamedRaciocinio, true)
                }

                const respostaVazia = !streamedContent.trim()
                const respostaCurtaIncompleta =
                    (configGeracaoChat.perfil === 'saudacao_ack' || configGeracaoChat.perfil === 'pergunta_curta')
                    && respostaPareceIncompleta(streamedContent)

                if (isGenerationActive() && (respostaVazia || respostaCurtaIncompleta)) {
                    try {
                        const promptReparo = respostaVazia
                            ? mensagemUsuarioParaModelo
                            : `${mensagemUsuarioParaModelo}\n\nResponda novamente de forma curta e completa, sem cortar a frase final.`

                        const respostaReparo = await servico.chat(
                            promptReparo,
                            finalPrompt,
                            historicoParaModelo,
                            {
                                signal,
                                temperature: configGeracaoChat.temperature,
                                perfilLatencia,
                            }
                        )

                        if (respostaReparo?.trim()) {
                            streamedContent = respostaReparo.trim()
                            atualizarMensagemAssistente(streamedContent, streamedRaciocinio, true)
                        }
                    } catch (erroReparo) {
                        console.warn('[useSendMessage] Falha no reparo de resposta curta:', erroReparo)
                    }
                }

                if (searchSources.length > 0) {
                    setMessageSources(prev => ({
                        ...prev,
                        [aiMsgId]: searchSources
                    }))
                }
            }

            processUserMessageForMemory(
                userMsg.id,
                convId,
                userMsg.content,
                userMsg.timestamp,
                conversations.find(c => c.id === convId)?.projectId
            ).catch(err => console.warn('[useSendMessage] Memory processing failed:', err))

            const currentConv = conversations.find(c => c.id === convId)
            if (currentConv?.projectId && streamedContent) {
                const aiResponse = streamedContent
                const extractedMemories = extractConversationMemory([userMsg, {
                    id: aiMsgId,
                    role: 'assistant' as const,
                    content: aiResponse,
                    timestamp: Date.now()
                }])

                for (const memoryText of extractedMemories) {
                    addProjectMemory(currentConv.projectId, memoryText, 'extracted')
                    console.log('[useSendMessage] Added project memory:', memoryText.slice(0, 50) + '...')
                }
            }

        } catch (error: unknown) {
            agendadorMensagemAssistente.cancelar()
            if (!isGenerationActive()) {
                console.log('[useSendMessage] Generation was cancelled, ignoring error')
                return
            }

            if (ehAbortError(error)) {
                console.log('[useSendMessage] Generation stopped by user')
            } else {
                console.error('[useSendMessage] Chat error:', error)

                const mensagemErroNormalizada = normalizarMensagemErroApi(
                    error,
                    'Falha ao processar mensagem. Verifique sua conexão ou chaves de API.'
                )
                const errorMessage = obterMensagemErroApi(error, '').toLowerCase()
                const isContextOverflow =
                    errorMessage.includes('context') ||
                    errorMessage.includes('token') ||
                    errorMessage.includes('limit') ||
                    errorMessage.includes('maximum') ||
                    errorMessage.includes('too long') ||
                    obterStatusErroApi(error) === 400

                let errorContent = mensagemErroNormalizada

                if (isContextOverflow) {
                    errorContent = '⚠️ **Limite de contexto atingido**\n\nPor favor:\n- Inicie uma nova conversa\n- Ou apague mensagens antigas manualmente\n\n_Dica: Clique em "+" para iniciar nova conversa._'
                }

                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: errorContent,
                    timestamp: Date.now()
                }
                updateConversationMessages(convId, [...messages, userMsg, errorMsg])
            }
        } finally {
            agendadorMensagemAssistente.flush()
            const tempoTotal = performance.now() - inicioTotal
            const tempoPreStream = performance.now() - inicioPreStream
            publicarMetricasLatencia({
                tempoPreStream,
                tempoPrompt,
                tempoTools,
                tempoWeb,
                ttft,
                tempoTotal,
                timestamp: Date.now(),
                conversationId: convId,
                modo: modoMetricas,
                provedor: provedorAtivo,
                modelo: modeloAtivo,
                perfilLatencia,
            })

            if (isGenerationActive()) {
                setIsGenerating(false)
                setIsAnalyzingImage(false)
                ;(generationIdRef as React.MutableRefObject<string | null>).current = null
            }
            ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = null
        }
    }, [
        input, pendingScreenshots, pendingFiles, isGenerating, activeConversationId, messages,
        conversations, projects, webSearchEnabled, toolCallingAtivo, investigateMode,
        promptBase, getProfileContext, criarOuObterServico, updateConversationMessages,
        runInvestigation, setConversations, setActiveConversationId, setInput,
        setPendingScreenshots, setPendingFiles, setPendingMessage, setIsGenerating, setIsAnalyzingImage,
        setMessageSources, setMessageSearchCards, textareaRef, generationIdRef, abortControllerRef,
        politica.maxCharsMensagemHistorico, politica.prestreamBudgetMs,
        politica.timeoutCrossChatMs, politica.estrategiaTools, politica.toolDecisionTimeoutMs,
        politica.webQueryPlanTimeoutMs, politica.maxBuscasWebPorMensagem, politica.maxTentativasPorTarefa,
        politica.modoAutonomia, politica.pularPlanejamentoWebIA, perfilLatencia,
        provedorAtivo, modeloAtivo, reasoningAtivo, garantirResumosImagensMensagem, garantirResumosImagensHistoricas,
    ])

    // Stop generation
    const stopGeneration = useCallback(() => {
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current?.abort()
        setIsGenerating(false)
        setPendingMessage(null)
    }, [setIsGenerating, setPendingMessage, abortControllerRef])

    // Process queued message when generation finishes
    useEffect(() => {
        if (!isGenerating && pendingMessage) {
            console.log('[useSendMessage] Processing queued message')
            const { text, screenshots, arquivos } = pendingMessage
            setPendingMessage(null)

            setTimeout(() => {
                setInput(text)
                setPendingScreenshots(screenshots)
                if (arquivos) {
                    setPendingFiles(arquivos)
                }
                setTimeout(() => {
                    const sendBtn = document.querySelector('[data-send-button]') as HTMLButtonElement
                    sendBtn?.click()
                }, 50)
            }, 100)
        }
    }, [isGenerating, pendingMessage, setInput, setPendingScreenshots, setPendingFiles, setPendingMessage])

    // Regenerate last response
    const regenerateLastResponse = useCallback(async () => {
        if (!activeConversationId || messages.length === 0 || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) return

        const lastUserMsgIndex = messages.map(m => m.role).lastIndexOf('user')
        if (lastUserMsgIndex === -1) return

        const messagesUpToUser = messages.slice(0, lastUserMsgIndex + 1)
        const mensagensOriginais = messages
        let ultimaMensagemUsuario = messages[lastUserMsgIndex]
        const userContent = ultimaMensagemUsuario.content
        const aiMsgId = uuidv4()
        const placeholderResposta: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }

        updateConversationMessages(activeConversationId, [...messagesUpToUser, placeholderResposta])
        setIsGenerating(true)
        ;(generationIdRef as React.MutableRefObject<string | null>).current = aiMsgId
        ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = new AbortController()
        const signal = (abortControllerRef as React.MutableRefObject<AbortController | null>).current?.signal
        let response = ''
        let responseRaciocinio = ''
        const agendadorRespostaRegenerada = criarAgendadorAtualizacaoMensagem(
            setConversations,
            activeConversationId,
            aiMsgId
        )

        const atualizarRespostaRegenerada = (
            conteudo: string,
            raciocinio: string = responseRaciocinio,
            imediato = false
        ) => {
            if (imediato) {
                agendadorRespostaRegenerada.atualizarAgora(conteudo, raciocinio)
                return
            }

            agendadorRespostaRegenerada.agendar(conteudo, raciocinio)
        }

        try {
            const currentConv = conversations.find(c => c.id === activeConversationId)
            const currentProject = currentConv?.projectId
                ? projects.find(project => project.id === currentConv.projectId) || null
                : null
            const opcoesContextoProjeto = obterOpcoesContextoProjeto(provedorAtivo, perfilLatencia)
            const orcamentoPromptEfetivo = obterOrcamentoPromptEfetivo(provedorAtivo, perfilLatencia)
            if (ultimaMensagemUsuario.images?.length) {
                ultimaMensagemUsuario = await garantirResumosImagensMensagem(
                    activeConversationId,
                    ultimaMensagemUsuario,
                    servico,
                    signal
                )
            }
            const permitirContextoPessoal = currentProject ? false : deveInjetarContextoPessoal(userContent, true)

            const { systemPrompt: composedPrompt, metadata: promptMetadata } = await composePromptEfetivo(
                {
                    systemPrompt: promptBase,
                    userProfileContext: currentProject ? '' : getProfileContext({
                        consulta: userContent,
                        permitirContextoPessoal,
                        somenteIdentidadeBasica: false,
                    }),
                    currentConversationId: activeConversationId,
                    currentProjectId: currentProject?.id,
                    currentProject,
                    currentUserMessage: userContent,
                    permitirContextoPessoal,
                    permitirMemoriaPerfil: !currentProject,
                    permitirMemoriasAuto: !currentProject,
                    permitirCrossChat: !currentProject,
                },
                {
                    orcamento: orcamentoPromptEfetivo,
                    incluirDataHora: currentProject ? false : 'auto',
                    timeoutCrossChatMs: currentProject ? 0 : politica.timeoutCrossChatMs,
                }
            )

            console.log('[useSendMessage] Prompt mode regenerate:', {
                mode: promptMetadata.mode,
                totalArquivosProjeto: promptMetadata.totalArquivosProjeto || 0,
                trechosProjetoIncluidos: promptMetadata.trechosProjetoIncluidos || 0,
            })
            const contextoArquivosProjeto = currentProject
                ? criarContextoArquivosProjeto(currentProject, userContent, {
                    ...opcoesContextoProjeto,
                }).blocoContexto
                : ''
            // Contexto dos arquivos vai no system prompt, não na mensagem do usuário
            const secaoArquivosProjeto = contextoArquivosProjeto
                ? `[contexto_projeto_arquivos]\n${contextoArquivosProjeto}`
                : ''
            let contextArquivosAnexadosRegen = ''
            if (ultimaMensagemUsuario.arquivos && ultimaMensagemUsuario.arquivos.length > 0) {
                contextArquivosAnexadosRegen = ultimaMensagemUsuario.arquivos
                    .filter(file => file.content && file.content.trim())
                    .map(file => {
                        return `[Documento Anexado: ${file.name} (${formatFileSize(file.size)})]\n--- Conteúdo do Documento ---\n${file.content}\n--- Fim do Documento ---`
                    })
                    .join('\n\n')
            }
            const mensagemUsuarioComContextoRegen = anexarBlocosNaMensagem(userContent, [
                contextArquivosAnexadosRegen,
            ])
            const mensagemUsuarioParaModelo = ultimaMensagemUsuario.images?.length
                ? criarConteudoTextoComImagens(mensagemUsuarioComContextoRegen, ultimaMensagemUsuario.images)
                : mensagemUsuarioComContextoRegen
            const finalPromptRegen = secaoArquivosProjeto
                ? [composedPrompt, secaoArquivosProjeto].filter(Boolean).join('\n\n')
                : composedPrompt

            const historicoParaModelo = prepararHistoricoParaModelo(
                await garantirResumosImagensHistoricas(
                    activeConversationId,
                    messagesUpToUser.slice(0, -1),
                    userContent,
                    servico,
                    signal,
                    { emProjeto: Boolean(currentProject) }
                ),
                politica.maxCharsMensagemHistorico,
                {
                    consultaAtual: userContent,
                    perfilLatencia,
                    emProjeto: Boolean(currentProject),
                }
            )

            const configGeracaoRegen = obterConfiguracaoPerfilGeracao(userContent, { investigateMode })
            let metaFimPrincipal: MetaFimStream | null = null
            await servico.streamChat(
                mensagemUsuarioParaModelo,
                (chunk: string) => {
                    response += chunk
                    atualizarRespostaRegenerada(response, responseRaciocinio)
                },
                finalPromptRegen,
                historicoParaModelo,
                {
                    signal,
                    temperature: configGeracaoRegen.temperature,
                    perfilLatencia,
                    reasoningAtivo,
                    onEventoStream: (evento: EventoStreamIA) => {
                        if (evento.tipo === 'raciocinio' && evento.texto) {
                            responseRaciocinio += evento.texto
                            atualizarRespostaRegenerada(response, responseRaciocinio)
                        }
                    },
                    onFimStream: (meta: MetaFimStream) => {
                        metaFimPrincipal = meta
                    },
                }
            )

            agendadorRespostaRegenerada.flush()
            let continuacoesExecutadas = 0
            let truncamentoPersistente =
                ehFinishReasonLength(metaFimPrincipal) ||
                respostaPareceTruncadaForte(response)

            while (truncamentoPersistente && continuacoesExecutadas < MAX_AUTO_CONTINUACOES) {
                continuacoesExecutadas += 1
                const conteudoAntesContinuacao = response
                let bufferContinuacao = ''
                let metaFimContinuacao: MetaFimStream | null = null

                const instrucaoContinuacao = [
                    'Continue exatamente de onde a resposta anterior parou.',
                    'Não repita conteúdo já escrito.',
                    'Finalize a explicação com fechamento completo.',
                ].join(' ')

                const historicoContinuacao = [
                    ...historicoParaModelo,
                    {
                        role: 'user' as const,
                        content: criarConteudoHistoricoComResumoVisual(ultimaMensagemUsuario, 1800),
                    },
                    {
                        role: 'assistant' as const,
                        content: truncarTexto(conteudoAntesContinuacao, 1800),
                    },
                ]

                await servico.streamChat(
                    instrucaoContinuacao,
                    (chunk: string) => {
                        bufferContinuacao += chunk
                        response = conteudoAntesContinuacao + bufferContinuacao
                        atualizarRespostaRegenerada(response, responseRaciocinio)
                    },
                    finalPromptRegen,
                    historicoContinuacao,
                    {
                        signal,
                        temperature: configGeracaoRegen.temperature,
                        perfilLatencia,
                        reasoningAtivo,
                        onEventoStream: (evento: EventoStreamIA) => {
                            if (evento.tipo === 'raciocinio' && evento.texto) {
                                responseRaciocinio += evento.texto
                                atualizarRespostaRegenerada(response, responseRaciocinio)
                            }
                        },
                        onFimStream: (meta: MetaFimStream) => {
                            metaFimContinuacao = meta
                        },
                    }
                )

                response = mesclarComDeduplicacao(conteudoAntesContinuacao, bufferContinuacao)
                truncamentoPersistente =
                    ehFinishReasonLength(metaFimContinuacao) ||
                    respostaPareceTruncadaForte(bufferContinuacao || response)
            }

            if (truncamentoPersistente) {
                response = `${response.trimEnd()}\n\n[Resposta interrompida por limite do modelo.]`
            }

            atualizarRespostaRegenerada(response, responseRaciocinio, true)
        } catch (error: unknown) {
            agendadorRespostaRegenerada.cancelar()
            if (ehAbortError(error)) {
                console.log('[useSendMessage] Regenerate stopped by user')
                if (!response.trim() && !responseRaciocinio.trim()) {
                    updateConversationMessages(activeConversationId, mensagensOriginais)
                }
                return
            }
            console.error('[useSendMessage] Regenerate error:', error)
            if (!response.trim() && !responseRaciocinio.trim()) {
                updateConversationMessages(activeConversationId, mensagensOriginais)
            }
        } finally {
            agendadorRespostaRegenerada.flush()
            ;(generationIdRef as React.MutableRefObject<string | null>).current = null
            ;(abortControllerRef as React.MutableRefObject<AbortController | null>).current = null
            setIsGenerating(false)
        }
    }, [
        activeConversationId, messages, isGenerating, investigateMode, promptBase, getProfileContext,
        criarOuObterServico, updateConversationMessages, setConversations, setIsGenerating, abortControllerRef,
        generationIdRef, politica.maxCharsMensagemHistorico,
        politica.timeoutCrossChatMs,
        perfilLatencia, projects, conversations, provedorAtivo, reasoningAtivo, garantirResumosImagensMensagem,
        garantirResumosImagensHistoricas,
    ])

    // Efeito para escutar o envio de mensagens do chat vindo de componentes externos (ex: botões de escolhas rápidas)
    useEffect(() => {
        const tratarMensagemExterna = (e: Event) => {
            const ev = e as CustomEvent<{ text: string }>
            if (ev.detail && ev.detail.text) {
                setInput(ev.detail.text)
                setTimeout(() => {
                    void handleSend()
                }, 60)
            }
        }
        window.addEventListener('selene:send-chat-message', tratarMensagemExterna)
        return () => window.removeEventListener('selene:send-chat-message', tratarMensagemExterna)
    }, [setInput, handleSend])

    return {
        handleSend,
        stopGeneration,
        regenerateLastResponse,
    }
}
