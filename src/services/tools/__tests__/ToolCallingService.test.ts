import { beforeAll, describe, expect, test } from 'vitest'
import { initializeBuiltInTools } from '../builtin'
import { toolRegistry } from '../ToolRegistry'
import { toolCallingService } from '../ToolCallingService'
import type { ToolCall, ToolDefinition } from '../../../types/tools'

function criarChamadaTool(
    toolId: string,
    args: Record<string, unknown>,
    data: unknown,
    status: ToolCall['status'] = 'completed',
    error?: string
): ToolCall {
    return {
        id: `${toolId}-${JSON.stringify(args)}`,
        input: { toolId, arguments: args },
        status,
        startedAt: 1,
        completedAt: 2,
        result: {
            success: status === 'completed' && !error,
            data,
            error,
            metadata: { durationMs: 1 },
        },
    }
}

describe('ToolCallingService - planejamento de query web', () => {
    beforeAll(() => {
        initializeBuiltInTools()
    })

    test('deve cancelar web_search quando o planejamento de query falha', async () => {
        toolCallingService.setChatFunction(async () => 'resposta sem json')
        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'na internet e me explica exatamente qual é a treta do banco master q ta rolando nesses ultimos dias',
            [],
            webSearchTool ? [webSearchTool] : [],
            {
                estrategiaDecisao: 'ai_fallback',
                timeoutQueryMs: 2500
            }
        )

        expect(decisao.shouldUseTool).toBe(false)
        expect(decisao.toolCalls).toHaveLength(0)
    })

    test('deve manter chamada web_search quando planejamento retorna query válida', async () => {
        toolCallingService.setChatFunction(async () => JSON.stringify({
            queryPrincipal: 'banco master crise últimos dias 2026',
            statusMessage: 'Vou buscar as últimas notícias sobre o Banco Master.'
        }))

        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'pesquisa na internet o que está rolando com banco master',
            [],
            webSearchTool ? [webSearchTool] : [],
            {
                estrategiaDecisao: 'ai_fallback',
                timeoutQueryMs: 2500
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].arguments.query).toBe('banco master crise últimos dias 2026')
    })

    test('deve parsear decisão quando o modelo retorna JSON com texto extra', async () => {
        toolCallingService.setChatFunction(async () => `{
  "a": "use_tools",
  "t": [
    {
      "tool": "builtin:memory_search",
      "arguments": { "query": "preferências do usuário" }
    }
  ]
}
Explicação adicional fora do JSON.`)

        const memorySearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:memory_search')
        expect(memorySearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'o que você lembra sobre minhas preferências?',
            [],
            memorySearchTool ? [memorySearchTool] : [],
            {
                estrategiaDecisao: 'ai_only',
                timeoutMs: 0,
                timeoutQueryMs: 0,
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].tool).toBe('builtin:memory_search')
        expect(String(decisao.toolCalls[0].arguments.query || '')).toContain('preferências')
    })

    test('deve forçar web_search quando pedido explícito de busca web for detectado', async () => {
        toolCallingService.setChatFunction(async () => JSON.stringify({
            queryPrincipal: 'banco master notícias recentes',
            statusMessage: 'Vou buscar as notícias mais recentes sobre o Banco Master.'
        }))

        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'pesquisa na internet e me explica o que está rolando com o banco master',
            [],
            webSearchTool ? [webSearchTool] : [],
            {
                estrategiaDecisao: 'ai_only',
                timeoutMs: 0,
                timeoutQueryMs: 0,
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].tool).toBe('builtin:web_search')
        expect(String(decisao.toolCalls[0].arguments.query || '')).toContain('banco master')
    })

    test('deve limitar web_search a uma query principal por decisão', async () => {
        toolCallingService.setChatFunction(async () => JSON.stringify({
            action: 'use_tools',
            tool_calls: [
                {
                    tool: 'builtin:web_search',
                    arguments: { query: 'presidente do Brasil atual 2026' }
                },
                {
                    tool: 'builtin:web_search',
                    arguments: { query: 'quem presidente Brasil hoje' }
                },
                {
                    tool: 'builtin:web_search',
                    arguments: { query: 'Brasil presidente atual' }
                }
            ]
        }))

        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'quem é o presidente do Brasil hoje?',
            [],
            webSearchTool ? [webSearchTool] : [],
            {
                estrategiaDecisao: 'ai_only',
                timeoutMs: 0,
                timeoutQueryMs: 0,
                pularPlanejamentoWebIA: true,
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].tool).toBe('builtin:web_search')
    })

    test('deve manter a ferramenta view quando a mensagem do usuário for um follow-up curto mas o histórico contiver palavras-chave de arquivo', async () => {
        toolCallingService.setChatFunction(async () => JSON.stringify({
            action: 'use_tools',
            tool_calls: [{
                tool: 'builtin:view',
                arguments: { path: 'downloads/livro.pdf', startLine: 132, endLine: 132 }
            }]
        }))

        const viewTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:view')
        expect(viewTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'e a página 132?',
            [
                { role: 'user', content: 'Me da um resumo da página 122 do livro.pdf em downloads' },
                { role: 'assistant', content: 'Aqui está...' }
            ],
            viewTool ? [viewTool] : [],
            {
                estrategiaDecisao: 'ai_only',
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].tool).toBe('builtin:view')
    })

    test('deve refinar automaticamente busca em PDF quando tentativa anterior não encontrou matches', async () => {
        toolCallingService.setChatFunction(async () => JSON.stringify({ action: 'respond' }))

        const viewTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:view')
        expect(viewTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'O Espirais da Perdição pode counterar ele?',
            [
                {
                    role: 'assistant',
                    content: 'Usando ferramentas: builtin:view({"path":"C:\\Users\\levig\\Downloads\\ordem-paranormal-rpg-v1-3.pdf","query":"Espirais da Perdição Deflagração de Energia counterar"})'
                },
                {
                    role: 'user',
                    content: '[Resultado das ferramentas]:\n[Busca de PDF]: Busca por "Espirais da Perdição Deflagração de Energia counterar" no arquivo C:\\Users\\levig\\Downloads\\ordem-paranormal-rpg-v1-3.pdf não retornou nenhum resultado.'
                }
            ],
            viewTool ? [viewTool] : [],
            {
                estrategiaDecisao: 'heuristic_only',
            }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls).toHaveLength(1)
        expect(decisao.toolCalls[0].tool).toBe('builtin:view')
        expect(decisao.toolCalls[0].arguments.path).toBe('C:\\Users\\levig\\Downloads\\ordem-paranormal-rpg-v1-3.pdf')
        expect(decisao.toolCalls[0].arguments.query).toBe('Espirais da Perdição')
    })

    test('deve deixar a IA decidir a próxima query quando web_search não retornar resultados', () => {
        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const primeiraBusca = criarChamadaTool('builtin:web_search', { query: 'banco master treta' }, { results: [] })
        const decisao = toolCallingService.avaliarAutonomia(
            'pesquisa banco master crise últimos dias',
            [primeiraBusca],
            [primeiraBusca],
            webSearchTool ? [webSearchTool] : []
        )

        expect(decisao.action).toBe('continuar')
        expect(decisao.toolCalls).toBeUndefined()
    })

    test('não deve reconstruir query obrigatória de web_search a partir do prompt', () => {
        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const falha = criarChamadaTool(
            'builtin:web_search',
            {},
            undefined,
            'failed',
            'O parâmetro "query" é obrigatório.'
        )

        const decisao = toolCallingService.avaliarAutonomia(
            'pesquise OpenAI modelos novos',
            [falha],
            [falha],
            webSearchTool ? [webSearchTool] : []
        )

        expect(decisao.action).toBe('parar')
    })

    test('deve impedir loop quando limite de tentativas for atingido', () => {
        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const chamadas = Array.from({ length: 4 }, () => {
            return criarChamadaTool('builtin:web_search', { query: 'banco master' }, { results: [] })
        })

        const decisao = toolCallingService.avaliarAutonomia(
            'banco master',
            [chamadas[3]],
            chamadas,
            webSearchTool ? [webSearchTool] : [],
            { maxTentativasPorTarefa: 4 }
        )

        expect(decisao.action).toBe('parar')
    })

    test('não deve repetir ação destrutiva automaticamente', () => {
        const deleteTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:delete_file')
        expect(deleteTool).toBeTruthy()

        const chamadaDelete = criarChamadaTool(
            'builtin:delete_file',
            { path: 'Downloads/teste.txt' },
            undefined,
            'failed',
            'Arquivo não encontrado'
        )

        const decisao = toolCallingService.avaliarAutonomia(
            'delete Downloads/teste.txt',
            [chamadaDelete],
            [chamadaDelete],
            deleteTool ? [deleteTool] : []
        )

        expect(decisao.action).toBe('parar')
    })

    test('deve filtrar muitas MCP tools e manter apenas a relevante no prompt', async () => {
        let promptCapturado = ''
        toolCallingService.setChatFunction(async (prompt) => {
            promptCapturado = prompt
            return JSON.stringify({
                action: 'use_tools',
                tool_calls: [{
                    tool: 'mcp:sheets:analisar_csv',
                    arguments: { csvPath: 'Downloads/relatorio.csv' }
                }]
            })
        })

        const ferramentas = [
            criarFerramentaMcp('mcp:sheets:analisar_csv', 'Analisar CSV', 'Analisa planilhas e arquivos CSV financeiros'),
            ...Array.from({ length: 20 }, (_, indice) => (
                criarFerramentaMcp(`mcp:irrelevante:ferramenta_${indice}`, `Irrelevante ${indice}`, 'Ferramenta para tarefas não relacionadas')
            )),
        ]

        const decisao = await toolCallingService.decideToolUsage(
            'analisa o csv financeiro em Downloads/relatorio.csv',
            [],
            ferramentas,
            { estrategiaDecisao: 'ai_only' }
        )

        expect(decisao.shouldUseTool).toBe(true)
        expect(decisao.toolCalls[0].tool).toBe('mcp:sheets:analisar_csv')
        expect(promptCapturado).toContain('mcp:sheets:analisar_csv')
        expect(promptCapturado).not.toContain('mcp:irrelevante:ferramenta_19')
    })
})

function criarFerramentaMcp(id: string, name: string, description: string): ToolDefinition {
    return {
        id,
        name,
        description,
        category: 'mcp',
        parameters: [
            { name: 'csvPath', type: 'string', description: 'Caminho do CSV', required: true },
        ],
        source: { type: 'mcp', mcpServerId: 'teste', mcpServerName: 'Teste MCP' },
        enabled: true,
        readOnly: true,
        supportsParallel: true,
        deferLoading: true,
        riskLevel: 'read',
    }
}
