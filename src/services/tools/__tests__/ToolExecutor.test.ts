import { afterEach, describe, expect, test } from 'vitest'
import { toolExecutor } from '../ToolExecutor'
import { toolRegistry } from '../ToolRegistry'
import type { ToolDefinition } from '../../../types/tools'

const idsCriados: string[] = []

function esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function registrarFerramenta(tool: ToolDefinition): void {
    idsCriados.push(tool.id)
    toolRegistry.register(tool)
}

afterEach(() => {
    for (const id of idsCriados.splice(0)) {
        toolExecutor.unregisterHandler(id)
        toolRegistry.unregister(id)
    }
})

describe('ToolExecutor.executeMultipleSafe', () => {
    test('executa duas ferramentas read-only em paralelo', async () => {
        registrarFerramenta(criarDefinicao('test:executor:read-a', 'read'))
        registrarFerramenta(criarDefinicao('test:executor:read-b', 'read'))
        toolExecutor.registerHandler('test:executor:read-a', async () => {
            await esperar(80)
            return { success: true, data: 'a' }
        })
        toolExecutor.registerHandler('test:executor:read-b', async () => {
            await esperar(80)
            return { success: true, data: 'b' }
        })

        const inicio = performance.now()
        const resultados = await toolExecutor.executeMultipleSafe([
            { toolId: 'test:executor:read-a', arguments: {} },
            { toolId: 'test:executor:read-b', arguments: {} },
        ])

        expect(performance.now() - inicio).toBeLessThan(140)
        expect(resultados.map((resultado) => resultado.status)).toEqual(['completed', 'completed'])
    })

    test('ferramenta destrutiva não entra no lote paralelo', async () => {
        const inicios: Record<string, number> = {}
        registrarFerramenta(criarDefinicao('test:executor:read-before', 'read'))
        registrarFerramenta(criarDefinicao('test:executor:delete', 'destructive'))
        registrarFerramenta(criarDefinicao('test:executor:read-after', 'read'))

        for (const id of ['test:executor:read-before', 'test:executor:delete', 'test:executor:read-after']) {
            toolExecutor.registerHandler(id, async () => {
                inicios[id] = performance.now()
                await esperar(40)
                return { success: true, data: id }
            })
        }

        await toolExecutor.executeMultipleSafe([
            { toolId: 'test:executor:read-before', arguments: {} },
            { toolId: 'test:executor:delete', arguments: {} },
            { toolId: 'test:executor:read-after', arguments: {} },
        ])

        expect(inicios['test:executor:delete']).toBeGreaterThanOrEqual(inicios['test:executor:read-before'] + 35)
        expect(inicios['test:executor:read-after']).toBeGreaterThanOrEqual(inicios['test:executor:delete'] + 35)
    })

    test('falha em ferramenta paralela não cancela resultado útil das outras', async () => {
        registrarFerramenta(criarDefinicao('test:executor:ok', 'read'))
        registrarFerramenta(criarDefinicao('test:executor:falha', 'read'))
        toolExecutor.registerHandler('test:executor:ok', async () => ({ success: true, data: 'ok' }))
        toolExecutor.registerHandler('test:executor:falha', async () => ({ success: false, error: 'falhou' }))

        const resultados = await toolExecutor.executeMultipleSafe([
            { toolId: 'test:executor:ok', arguments: {} },
            { toolId: 'test:executor:falha', arguments: {} },
        ])

        expect(resultados.map((resultado) => resultado.status)).toEqual(['completed', 'failed'])
    })
})

function criarDefinicao(id: string, riskLevel: ToolDefinition['riskLevel']): ToolDefinition {
    const readOnly = riskLevel === 'read'
    return {
        id,
        name: id,
        description: id,
        category: 'system',
        parameters: [],
        source: { type: 'builtin' },
        enabled: true,
        readOnly,
        supportsParallel: readOnly,
        riskLevel,
    }
}
