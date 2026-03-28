import { beforeAll, describe, expect, test } from 'vitest'
import { initializeBuiltInTools } from '../builtin'
import { toolRegistry } from '../ToolRegistry'
import { toolCallingService } from '../ToolCallingService'

describe('ToolCallingService - planejamento de query web', () => {
    beforeAll(() => {
        initializeBuiltInTools()
    })

    test('deve remover web_search quando planejamento falha sem fallback heurístico', async () => {
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
            queriesSecundarias: ['banco master comunicado oficial'],
            statusMessage: 'Vou buscar as últimas notícias sobre o Banco Master.'
        }))

        const webSearchTool = toolRegistry.getEnabled().find((tool) => tool.id === 'builtin:web_search')
        expect(webSearchTool).toBeTruthy()

        const decisao = await toolCallingService.decideToolUsage(
            'me explica o que está rolando com banco master',
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
            queriesSecundarias: [],
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
})
