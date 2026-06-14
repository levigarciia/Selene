import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'

/**
 * Handler para a ferramenta visualize:show_widget. Renderiza gráficos, diagramas SVG ou dashboards interativos.
 */
export const visualizeShowWidgetHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const tipoWidget = args.widgetType as 'chart' | 'svg' | 'diagram' | 'dashboard'
    const titulo = args.title as string || 'Visualização Interativa'
    const conteudoSvg = args.svgContent as string || ''
    const dados = args.data as Record<string, unknown> || {}

    if (!tipoWidget) {
        return { success: false, error: 'O parâmetro "widgetType" é obrigatório.' }
    }

    const formattedForAI = `[Widget Visualizado com Sucesso]:\n` +
        `Tipo: ${tipoWidget}\n` +
        `Título: ${titulo}\n` +
        (conteudoSvg ? `Contém SVG inline (${conteudoSvg.length} caracteres).\n` : '') +
        `Dados: ${JSON.stringify(dados)}`

    const displayResults: ToolResultItem[] = [
        {
            type: 'json',
            title: `Visualização: ${titulo}`,
            content: JSON.stringify({
                tipoWidget: 'widget-render',
                tipoWidgetVisual: tipoWidget,
                titulo,
                conteudoSvg,
                dados
            }, null, 2)
        }
    ]

    return {
        success: true,
        data: {
            tipoWidget,
            titulo,
            conteudoSvg,
            dados,
            formattedForAI,
            displayResults
        }
    }
}

/**
 * Handler para a ferramenta visualize:read_me. Retorna guias e módulos de design para criação de widgets.
 */
export const visualizeReadMeHandler: ToolHandler = async (): Promise<ToolCallResult> => {
    const diretrizes = `## Módulos de Visualização e Design de Widgets (Selene)

1. **Gráficos (Chart)**:
   - Use gráficos simples (barras, linhas, rosca) com cores do tema (Roxo #9333ea, Azul #2563eb, Esmeralda #059669).
   - Use tooltips translúcidos e eixos com fontes de tamanho reduzido (10px).

2. **Diagramas SVG**:
   - Utilize a tag viewBox de forma responsiva (\`viewBox="0 0 800 600" width="100%" height="auto"\`).
   - Aplique gradientes lineares suaves para o preenchimento de formas principais.
   - Use fontes integradas do sistema para rótulos de texto, evitando fontes serifadas.

3. **Cores Recomendadas (HSL)**:
   - Fundo do Widget: \`hsl(240, 10%, 10%)\`
   - Destaque Roxo: \`hsl(270, 76%, 60%)\`
   - Destaque Azul: \`hsl(220, 90%, 56%)\`
   - Bordas: \`hsla(0, 0%, 100%, 0.08)\``

    const formattedForAI = `[Diretrizes do visualize:read_me carregadas]:\n\n${diretrizes}`

    return {
        success: true,
        data: {
            diretrizes,
            formattedForAI,
            displayResults: [{ type: 'text', title: 'Módulos de Design de Visualização', content: diretrizes }]
        }
    }
}

/**
 * Handler para a ferramenta search_mcp_registry. Busca conectores de apps cadastrados.
 */
export const searchMcpRegistryHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const busca = args.query as string || ''

    try {
        console.log('[MCPRegistryTool] Buscando no registro MCP por:', busca)
        let servidores: Array<{ config?: { name?: string }; status?: string; toolCount?: number }> = []

        if (window.electronAPI.mcp?.getServers) {
            servidores = await window.electronAPI.mcp.getServers()
        }

        const conectoresDisponiveis = [
            { id: 'notion', name: 'Notion Connector', category: 'produtividade', description: 'Permite buscar e editar páginas no Notion.' },
            { id: 'github', name: 'GitHub Integration', category: 'desenvolvimento', description: 'Gerencia issues, PRs e commits de repositórios.' },
            { id: 'slack', name: 'Slack Messaging', category: 'comunicação', description: 'Envia mensagens e pesquisa canais no Slack workspace.' },
            { id: 'jira', name: 'Jira Software', category: 'gerenciamento', description: 'Cria e atualiza tarefas em sprints.' }
        ]

        // Filtra se houver busca
        const filtrados = busca 
            ? conectoresDisponiveis.filter(c => c.name.toLowerCase().includes(busca.toLowerCase()) || c.description.toLowerCase().includes(busca.toLowerCase()))
            : conectoresDisponiveis

        const formattedForAI = `[Registro MCP consultado]:\n` +
            `Conectores encontrados:\n` +
            filtrados.map(c => `- ${c.name} (${c.id}) | Categoria: ${c.category} | ${c.description}`).join('\n')

        return {
            success: true,
            data: {
                query: busca,
                conectores: filtrados,
                servidoresAtivos: servidores,
                formattedForAI,
                displayResults: [{
                    type: 'json',
                    title: 'Conectores Encontrados',
                    content: JSON.stringify({ filtrados, servidores }, null, 2)
                }]
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
 * Handler para a ferramenta suggest_connectors. Sugere conectores baseados no fluxo de trabalho.
 */
export const suggestConnectorsHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const workflow = args.workflow as string || 'desenvolvimento'

    console.log('[MCPRegistryTool] Sugerindo conectores para fluxo:', workflow)

    const sugestoes: Record<string, Array<{ name: string; id: string; motivo: string }>> = {
        'desenvolvimento': [
            { name: 'GitHub Integration', id: 'github', motivo: 'Sincronizar commits e acompanhar pull requests diretamente no overlay.' },
            { name: 'Terminal Local', id: 'terminal', motivo: 'Executar scripts de build e testes locais com automação.' }
        ],
        'produtividade': [
            { name: 'Notion Connector', id: 'notion', motivo: 'Buscar notas rápidas e estruturar relatórios.' },
            { name: 'Google Calendar', id: 'calendar', motivo: 'Acompanhar reuniões e compromissos do dia.' }
        ],
        'comunicacao': [
            { name: 'Slack Messaging', id: 'slack', motivo: 'Enviar mensagens automáticas para canais da equipe.' },
            { name: 'Discord Webhook', id: 'discord', motivo: 'Postar alertas de deploy e logs de erro.' }
        ]
    }

    const chave = workflow.toLowerCase().includes('des') || workflow.toLowerCase().includes('code')
        ? 'desenvolvimento'
        : workflow.toLowerCase().includes('prod') || workflow.toLowerCase().includes('organi')
        ? 'produtividade'
        : 'comunicacao'

    const listaSugestoes = sugestoes[chave] || sugestoes['produtividade']

    const formattedForAI = `[Conectores Sugeridos para Fluxo "${workflow}"]:\n` +
        listaSugestoes.map(s => `- **${s.name}** (\`${s.id}\`): ${s.motivo}`).join('\n')

    return {
        success: true,
        data: {
            workflow,
            sugestoes: listaSugestoes,
            formattedForAI,
            displayResults: [{
                type: 'json',
                title: `Sugestões para ${workflow}`,
                content: JSON.stringify(listaSugestoes, null, 2)
            }]
        }
    }
}
