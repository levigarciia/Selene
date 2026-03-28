import { describe, expect, test } from 'vitest'
import { generateSearchPlanWithAI } from '../WebSearchService'

describe('generateSearchPlanWithAI', () => {
    test('deve transformar query conversacional em query válida de busca', async () => {
        const plano = await generateSearchPlanWithAI(
            'Me explica exatamente qual a treta do Banco Master nos últimos dias',
            [],
            async () => JSON.stringify({
                queryPrincipal: 'explica banco master crise últimos dias',
                queriesSecundarias: ['banco master explicação crise'],
                statusMessage: 'Vou buscar o contexto recente do Banco Master.'
            }),
            2500
        )

        expect(plano.planejamentoValido).toBe(true)
        expect(plano.origem).toBe('ia')
        expect(plano.queryPrincipal).toBe('banco master crise últimos dias')
        expect(plano.queryPrincipal).not.toContain('explica')
    })

    test('deve marcar timeout como falha de planejamento', async () => {
        const plano = await generateSearchPlanWithAI(
            'O que está rolando com o Banco Master?',
            [],
            async () => await new Promise<string>(() => {}),
            15
        )

        expect(plano.planejamentoValido).toBe(false)
        expect(plano.origem).toBe('falha')
        expect(plano.motivoFalha).toBe('timeout')
        expect(plano.queryPrincipal).toBe('')
    })

    test('deve marcar JSON inválido como falha de planejamento', async () => {
        const plano = await generateSearchPlanWithAI(
            'Me atualiza sobre o Banco Master',
            [],
            async () => 'resposta sem formato json',
            2500
        )

        expect(plano.planejamentoValido).toBe(false)
        expect(plano.motivoFalha).toBe('json_invalido')
    })

    test('deve rejeitar query igual ao prompt do usuário', async () => {
        const mensagemUsuario = 'banco master crise últimos dias'
        const plano = await generateSearchPlanWithAI(
            mensagemUsuario,
            [],
            async () => JSON.stringify({
                queryPrincipal: mensagemUsuario,
                queriesSecundarias: [],
                statusMessage: 'Vou buscar informações.'
            }),
            2500
        )

        expect(plano.planejamentoValido).toBe(false)
        expect(plano.motivoFalha).toBe('query_invalida')
    })

    test('deve aceitar resposta sem JSON quando a IA retornar query em texto simples', async () => {
        const plano = await generateSearchPlanWithAI(
            'Pesquisa na internet pra mim e me explica oq q ta rolando com o banco master',
            [],
            async () => 'banco master crise últimos dias',
            2500
        )

        expect(plano.planejamentoValido).toBe(true)
        expect(plano.queryPrincipal).toContain('banco master')
    })
})
