import { useCallback, useMemo, useState } from 'react'
import type { PerfilLatencia } from '../../../../services/ai/types'
import type { Project } from '../../../../types/project'
import type { Conversation } from '../types'
import type { MCPServerInfo } from './useChatUI'
import type {
    AbaShellChat,
    AcaoHomeChat,
    ItemHubContexto,
    ResumoContextoAtivo,
} from '../tiposShellChat'

interface UseChatShellParams {
    conversations: Conversation[]
    projects: Project[]
    activeConversationId: string | null
    currentProjectContextId: string | null
    mcpServers: MCPServerInfo[]
    pendingScreenshots: string[]
    webSearchEnabled: boolean
    investigateMode: boolean
    toolCallingAtivo: boolean
    provedorAtivo: string
    modeloAtivo: string
    perfilLatencia: PerfilLatencia
}

function normalizarRotuloProvedor(provedor: string): string {
    switch (provedor) {
        case 'openai':
            return 'OpenAI'
        case 'openrouter':
            return 'OpenRouter'
        case 'local':
            return 'Local'
        case 'gemini':
            return 'Gemini'
        default:
            return provedor
    }
}

function normalizarRotuloLatencia(perfil: PerfilLatencia): string {
    switch (perfil) {
        case 'rapido':
            return 'Rápido'
        case 'equilibrado':
            return 'Equilibrado'
        case 'completo':
            return 'Completo'
        default:
            return perfil
    }
}

function truncarTexto(texto: string, limite: number): string {
    if (texto.length <= limite) return texto
    return `${texto.slice(0, limite - 1)}…`
}

export function useChatShell({
    conversations,
    projects,
    activeConversationId,
    currentProjectContextId,
    mcpServers,
    pendingScreenshots,
    webSearchEnabled,
    investigateMode,
    toolCallingAtivo,
    provedorAtivo,
    modeloAtivo,
    perfilLatencia,
}: UseChatShellParams) {
    const [overlayAtivo, setOverlayAtivo] = useState<AbaShellChat | null>(null)
    const [buscaSidebar, setBuscaSidebar] = useState('')

    const fecharOverlays = useCallback(() => {
        setOverlayAtivo(null)
    }, [])

    const alternarOverlay = useCallback((aba: AbaShellChat) => {
        setOverlayAtivo((atual) => (atual === aba ? null : aba))
    }, [])

    const conversasRecentes = useMemo(() => (
        [...conversations]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 6)
    ), [conversations])

    const conversasSidebar = useMemo(() => (
        [...conversations]
            .filter((conversation) => !conversation.projectId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
    ), [conversations])

    const projetosRecentes = useMemo(() => (
        [...projects]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 6)
    ), [projects])

    const projetoContextoAtual = useMemo(() => (
        currentProjectContextId
            ? projects.find((project) => project.id === currentProjectContextId) || null
            : null
    ), [currentProjectContextId, projects])

    const conversaAtiva = useMemo(() => (
        activeConversationId
            ? conversations.find((conversation) => conversation.id === activeConversationId) || null
            : null
    ), [activeConversationId, conversations])

    const servidoresConectados = useMemo(() => (
        mcpServers.filter((server) => server.status === 'connected')
    ), [mcpServers])

    const termoBuscaSidebar = buscaSidebar.trim().toLocaleLowerCase('pt-BR')

    const resultadosProjetosFiltrados = useMemo(() => {
        if (!termoBuscaSidebar) {
            return [...projects].sort((a, b) => b.updatedAt - a.updatedAt)
        }

        return [...projects]
            .filter((project) => {
                const nomeProjeto = project.name.toLocaleLowerCase('pt-BR')
                const instrucoesProjeto = (project.instructions || '').toLocaleLowerCase('pt-BR')
                return nomeProjeto.includes(termoBuscaSidebar) || instrucoesProjeto.includes(termoBuscaSidebar)
            })
            .sort((a, b) => b.updatedAt - a.updatedAt)
    }, [projects, termoBuscaSidebar])

    const resultadosConversasFiltradas = useMemo(() => {
        if (!termoBuscaSidebar) {
            return conversasSidebar
        }

        return conversasSidebar.filter((conversation) => (
            conversation.title.toLocaleLowerCase('pt-BR').includes(termoBuscaSidebar)
        ))
    }, [conversasSidebar, termoBuscaSidebar])

    const itensHubContexto = useMemo<ItemHubContexto[]>(() => {
        // Apenas projetos recentes no hub de contexto
        const itensProjetos = projetosRecentes.slice(0, 5).map((project) => ({
            id: `projeto-${project.id}`,
            tipo: 'projeto' as const,
            titulo: project.name,
            descricao: project.instructions
                ? truncarTexto(project.instructions, 58)
                : `${project.files.length} arquivo(s) anexado(s)`,
            badge: 'Projeto',
            ativo: projetoContextoAtual?.id === project.id,
            projectId: project.id,
        }))

        return itensProjetos
    }, [projetosRecentes, projetoContextoAtual])

    const resumoContextoAtivo = useMemo<ResumoContextoAtivo>(() => {
        const itens = [
            {
                id: 'projeto',
                titulo: 'Projeto',
                descricao: projetoContextoAtual?.name || 'Sem contexto de projeto',
                quantidade: projetoContextoAtual ? 1 : 0,
                ativo: Boolean(projetoContextoAtual),
            },
            {
                id: 'imagens',
                titulo: 'Imagens',
                descricao: pendingScreenshots.length > 0
                    ? `${pendingScreenshots.length} anexo(s) prontos para envio`
                    : 'Nenhuma imagem anexada',
                quantidade: pendingScreenshots.length,
                ativo: pendingScreenshots.length > 0,
            },
            {
                id: 'apps',
                titulo: 'Apps MCP',
                descricao: servidoresConectados.length > 0
                    ? servidoresConectados.map((server) => server.name).join(', ')
                    : 'Nenhum app conectado',
                quantidade: servidoresConectados.length,
                ativo: servidoresConectados.length > 0,
            },
        ]

        return {
            contadorTotal: itens.reduce((total, item) => total + (item.quantidade || 0), 0),
            itens,
            provedor: normalizarRotuloProvedor(provedorAtivo),
            modelo: modeloAtivo || 'Não configurado',
            perfilLatencia: normalizarRotuloLatencia(perfilLatencia),
            toolCallingAtivo,
            webSearchEnabled,
            investigateMode,
        }
    }, [
        investigateMode,
        modeloAtivo,
        pendingScreenshots.length,
        perfilLatencia,
        projetoContextoAtual,
        provedorAtivo,
        servidoresConectados,
        toolCallingAtivo,
        webSearchEnabled,
    ])

    const acoesHome = useMemo<AcaoHomeChat[]>(() => {
        const acaoInicio: AcaoHomeChat = {
            id: 'acao-inicio',
            titulo: 'Começar uma conversa',
            descricao: 'Inicie com uma pergunta ou tarefa qualquer.',
            prompt: 'Quero um teste rápido da Selene. Responda em português com uma tarefa curta, objetiva e útil.',
            tipo: 'geral',
            selos: [
                { texto: 'Selene', tom: 'roxo' },
                { texto: 'Start', tom: 'neutro' },
            ],
        }

        const projetoRecente = projetosRecentes[0]
        const acaoProjeto: AcaoHomeChat = projetoRecente
            ? {
                id: 'acao-projeto',
                titulo: projetoRecente.name,
                descricao: 'Abrir um rascunho com o contexto do projeto recente.',
                prompt: `Com base no projeto "${projetoRecente.name}", proponha próximos passos objetivos, riscos e uma primeira tarefa prática.`,
                tipo: 'projeto',
                projectId: projetoRecente.id,
                selos: [
                    { texto: 'Projeto', tom: 'dourado' },
                    { texto: `${projetoRecente.files.length} arq`, tom: 'neutro' },
                ],
            }
            : {
                id: 'acao-projeto',
                titulo: 'Organizar um projeto',
                descricao: 'Criar um prompt inicial orientado a contexto.',
                prompt: 'Ajude a estruturar um novo projeto: objetivo, escopo inicial, entregáveis e primeira ação.',
                tipo: 'geral',
                selos: [
                    { texto: 'Planejar', tom: 'dourado' },
                    { texto: 'Projeto', tom: 'neutro' },
                ],
            }

        const primeiroApp = servidoresConectados[0]
        const acaoMcp: AcaoHomeChat = primeiroApp
            ? {
                id: 'acao-mcp',
                titulo: primeiroApp.name,
                descricao: 'Explorar os apps conectados em uma tarefa prática.',
                prompt: `Use os apps MCP conectados para resolver uma tarefa prática. Comece avaliando se "${primeiroApp.name}" é útil para esta solicitação e siga com a melhor estratégia.`,
                tipo: 'mcp',
                ativarToolCalling: true,
                selos: [
                    { texto: 'Apps', tom: 'verde' },
                    { texto: `${servidoresConectados.length}`, tom: 'neutro' },
                ],
            }
            : {
                id: 'acao-mcp',
                titulo: 'Conectar apps',
                descricao: 'Preparar uma tarefa que use ferramentas quando elas estiverem ativas.',
                prompt: 'Quero preparar um fluxo que use apps e ferramentas externas. Sugira que integrações MCP seriam úteis para meu caso.',
                tipo: 'geral',
                selos: [
                    { texto: 'MCP', tom: 'verde' },
                    { texto: 'Setup', tom: 'neutro' },
                ],
            }

        const acaoInvestigacao: AcaoHomeChat = {
            id: 'acao-investigacao',
            titulo: 'Pesquisa guiada',
            descricao: 'Montar uma análise com investigação e web search.',
            prompt: 'Faça uma investigação guiada em português. Primeiro delimite a pergunta, depois responda com síntese, fontes e próximos passos.',
            tipo: 'investigacao',
            ativarInvestigacao: true,
            ativarWeb: true,
            selos: [
                { texto: 'Web', tom: 'azul' },
                { texto: 'Investigar', tom: 'roxo' },
            ],
        }

        return [acaoInicio, acaoProjeto, acaoMcp, acaoInvestigacao]
    }, [projetosRecentes, servidoresConectados])

    const promptsRapidos = useMemo<AcaoHomeChat[]>(() => {
        const itens: AcaoHomeChat[] = []

        if (projetosRecentes[0]) {
            itens.push({
                id: 'prompt-projeto',
                titulo: truncarTexto(projetosRecentes[0].name, 24),
                descricao: 'Entrar em contexto com o projeto recente.',
                prompt: `Com base no projeto "${projetosRecentes[0].name}", gere a próxima tarefa prioritária e como executá-la.`,
                tipo: 'projeto',
                projectId: projetosRecentes[0].id,
                selos: [{ texto: 'Projeto', tom: 'dourado' }],
            })
        }

        if (servidoresConectados[0]) {
            itens.push({
                id: 'prompt-mcp',
                titulo: `Usar ${truncarTexto(servidoresConectados[0].name, 18)}`,
                descricao: 'Montar um pedido pronto para apps MCP.',
                prompt: `Verifique se os apps MCP conectados podem ajudar nesta tarefa e use-os se fizer sentido.`,
                tipo: 'mcp',
                ativarToolCalling: true,
                selos: [{ texto: 'Apps', tom: 'verde' }],
            })
        }

        if (conversasRecentes[0]) {
            itens.push({
                id: 'prompt-conversa',
                titulo: truncarTexto(conversasRecentes[0].title, 24),
                descricao: 'Retomar o tema da conversa recente.',
                prompt: `Retome o tema da conversa "${conversasRecentes[0].title}" com continuidade prática e objetiva.`,
                tipo: 'conversa',
                conversationId: conversasRecentes[0].id,
                selos: [{ texto: 'Histórico', tom: 'neutro' }],
            })
        }

        itens.push(
            {
                id: 'prompt-web',
                titulo: 'Buscar referências',
                descricao: 'Preparar uma resposta com pesquisa web.',
                prompt: 'Pesquise este tema na web e responda em português com síntese, fontes e recomendações.',
                tipo: 'web',
                ativarWeb: true,
                selos: [{ texto: 'Web', tom: 'azul' }],
            },
            {
                id: 'prompt-planejamento',
                titulo: 'Planejar execução',
                descricao: 'Transformar um objetivo em plano acionável.',
                prompt: 'Transforme meu objetivo em um plano claro com etapas, riscos e critérios de sucesso.',
                tipo: 'geral',
                selos: [{ texto: 'Plano', tom: 'neutro' }],
            }
        )

        return itens.slice(0, 6)
    }, [conversasRecentes, projetosRecentes, servidoresConectados])

    return {
        overlayAtivo,
        seletorProjetosAberto: overlayAtivo === 'seletor-projetos',
        perfilAberto: overlayAtivo === 'perfil',
        resumoContextoAberto: overlayAtivo === 'resumo-contexto',
        buscaSidebar,
        setBuscaSidebar,
        fecharOverlays,
        alternarOverlay,
        conversasRecentes,
        projetosRecentes,
        conversaAtiva,
        projetoContextoAtual,
        servidoresConectados,
        resultadosProjetosFiltrados,
        resultadosConversasFiltradas,
        itensHubContexto,
        resumoContextoAtivo,
        acoesHome,
        promptsRapidos,
    }
}
