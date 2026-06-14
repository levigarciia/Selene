import { afterEach, describe, expect, test } from 'vitest'
import { toolRegistry } from '../ToolRegistry'
import type { ToolDefinition } from '../../../types/tools'

const idsCriados: string[] = []

function registrar(tool: ToolDefinition): void {
    idsCriados.push(tool.id)
    toolRegistry.register(tool)
}

afterEach(() => {
    for (const id of idsCriados.splice(0)) {
        toolRegistry.unregister(id)
    }
})

describe('ToolRegistry.searchTools', () => {
    test('busca por nome, descrição, categoria e parâmetro', () => {
        registrar({
            id: 'test:registry:planilhas',
            name: 'Planilhas',
            description: 'Analisa arquivos CSV e tabelas financeiras',
            category: 'mcp',
            parameters: [
                { name: 'csvPath', type: 'string', description: 'Caminho do CSV', required: true },
            ],
            source: { type: 'mcp', mcpServerId: 'sheets', mcpServerName: 'Sheets MCP' },
            enabled: true,
            readOnly: true,
            supportsParallel: true,
            deferLoading: true,
            riskLevel: 'read',
        })

        const resultados = toolRegistry.searchTools('analisar csv financeiro', 3)

        expect(resultados[0]?.id).toBe('test:registry:planilhas')
    })

    test('prioriza built-ins quando a pontuação é equivalente', () => {
        registrar({
            id: 'test:registry:builtin-search',
            name: 'Busca Local',
            description: 'Pesquisa documentos',
            category: 'search',
            parameters: [],
            source: { type: 'builtin' },
            enabled: true,
            readOnly: true,
            supportsParallel: true,
            riskLevel: 'read',
        })
        registrar({
            id: 'test:registry:mcp-search',
            name: 'Busca Local',
            description: 'Pesquisa documentos',
            category: 'search',
            parameters: [],
            source: { type: 'mcp', mcpServerId: 'docs', mcpServerName: 'Docs' },
            enabled: true,
            readOnly: true,
            supportsParallel: true,
            deferLoading: true,
            riskLevel: 'read',
        })

        const resultados = toolRegistry.searchTools('pesquisa documentos', 2)

        expect(resultados[0]?.id).toBe('test:registry:builtin-search')
    })
})
