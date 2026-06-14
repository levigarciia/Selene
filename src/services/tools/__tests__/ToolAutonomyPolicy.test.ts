import { describe, expect, test } from 'vitest'
import { avaliarAutonomiaTool } from '../ToolAutonomyPolicy'
import type { ToolCall, ToolDefinition } from '../../../types/tools'

const ferramentas: ToolDefinition[] = [
    {
        id: 'builtin:web_search',
        name: 'Busca na Web',
        description: 'Pesquisa na web',
        category: 'search',
        enabled: true,
        source: { type: 'builtin' },
        parameters: [{ name: 'query', type: 'string', description: 'Query', required: true }],
    },
    {
        id: 'builtin:view',
        name: 'Visualizar Arquivo ou Pasta',
        description: 'Lê arquivos',
        category: 'file',
        enabled: true,
        source: { type: 'builtin' },
        parameters: [{ name: 'path', type: 'string', description: 'Caminho', required: true }],
    },
    {
        id: 'builtin:delete_file',
        name: 'Excluir Arquivo',
        description: 'Remove arquivo',
        category: 'file',
        enabled: true,
        source: { type: 'builtin' },
        parameters: [{ name: 'path', type: 'string', description: 'Caminho', required: true }],
    },
]

function chamada(
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

describe('ToolAutonomyPolicy', () => {
    test('deixa a IA decidir próximo passo quando busca web não retorna resultados', () => {
        const primeira = chamada('builtin:web_search', { query: 'banco master treta' }, { results: [] })

        const decisao = avaliarAutonomiaTool({
            userMessage: 'pesquisa banco master crise últimos dias',
            chamadasRodada: [primeira],
            chamadasTotais: [primeira],
            ferramentasDisponiveis: ferramentas,
        })

        expect(decisao.action).toBe('continuar')
        expect(decisao.toolCalls).toBeUndefined()
    })

    test('não gera query alternativa automática para busca web repetida', () => {
        const primeira = chamada('builtin:web_search', { query: 'banco master crise' }, { results: [] })
        const segunda = chamada('builtin:web_search', { query: 'banco master' }, { results: [] })

        const decisao = avaliarAutonomiaTool({
            userMessage: 'banco master',
            chamadasRodada: [segunda],
            chamadasTotais: [primeira, segunda],
            ferramentasDisponiveis: ferramentas,
        })

        expect(decisao.action).toBe('continuar')
        expect(decisao.toolCalls).toBeUndefined()
    })

    test('não repete ferramenta destrutiva automaticamente', () => {
        const deleteCall = chamada(
            'builtin:delete_file',
            { path: 'Downloads/teste.txt' },
            undefined,
            'failed',
            'Arquivo não encontrado'
        )

        const decisao = avaliarAutonomiaTool({
            userMessage: 'delete Downloads/teste.txt',
            chamadasRodada: [deleteCall],
            chamadasTotais: [deleteCall],
            ferramentasDisponiveis: ferramentas,
        })

        expect(decisao.action).toBe('parar')
    })
})
