import { describe, expect, test } from 'vitest'
import type { ChatMessage } from '../../../types/chat'
import type { ConfiguracaoOverlayProativo } from '../../../types/overlayProativo'
import {
    COOL_DOWN_PADRAO_OVERLAY_MS,
    criarContextoOverlayProativo,
    criarPromptDeteccaoOverlay,
    deveAgendarAvaliacaoOverlay,
    deveExecutarIntervencaoOverlay,
    parsearDecisaoDeteccaoOverlay,
} from '../overlayProativo'

function criarMensagem(parcial?: Partial<ChatMessage>): ChatMessage {
    return {
        id: parcial?.id || crypto.randomUUID(),
        role: parcial?.role || 'user',
        content: parcial?.content || '',
        timestamp: parcial?.timestamp || Date.now(),
        images: parcial?.images,
        imagensContexto: parcial?.imagensContexto,
    }
}

function criarConfiguracao(parcial?: Partial<ConfiguracaoOverlayProativo>): ConfiguracaoOverlayProativo {
    return {
        habilitado: true,
        nivelIntervencao: 'equilibrado',
        cooldownMs: COOL_DOWN_PADRAO_OVERLAY_MS,
        sonecaAte: null,
        ...parcial,
    }
}

describe('parsearDecisaoDeteccaoOverlay', () => {
    test('deve parsear json puro do detector', () => {
        const decisao = parsearDecisaoDeteccaoOverlay('{"intervir":true,"motivo":"duvida","confianca":0.81,"resumo":"Explique o próximo passo."}')

        expect(decisao).toEqual({
            intervir: true,
            motivo: 'duvida',
            confianca: 0.81,
            resumo: 'Explique o próximo passo.',
        })
    })

    test('deve parsear json cercado por markdown e confiança em porcentagem', () => {
        const decisao = parsearDecisaoDeteccaoOverlay('```json\n{"intervir":"true","motivo":"erro provável","confianca":"78%","resumo":"Corrija a ordem do comando."}\n```')

        expect(decisao).toEqual({
            intervir: true,
            motivo: 'erro provável',
            confianca: 0.78,
            resumo: 'Corrija a ordem do comando.',
        })
    })

    test('deve retornar null quando o detector não entregar json válido', () => {
        expect(parsearDecisaoDeteccaoOverlay('sem formato')).toBeNull()
    })
})

describe('overlay proativo - critérios de execução', () => {
    test('deve respeitar threshold do modo equilibrado', () => {
        expect(deveExecutarIntervencaoOverlay({
            intervir: true,
            motivo: 'dúvida explícita',
            confianca: 0.7,
            resumo: 'Mostre o comando correto.',
        }, 'equilibrado')).toBe(true)

        expect(deveExecutarIntervencaoOverlay({
            intervir: true,
            motivo: 'contexto fraco',
            confianca: 0.69,
            resumo: 'Sugestão vaga',
        }, 'equilibrado')).toBe(false)
    })

    test('não deve executar intervenção sem motivo nem resumo útil', () => {
        expect(deveExecutarIntervencaoOverlay({
            intervir: true,
            motivo: '  ',
            confianca: 0.95,
            resumo: ' ',
        }, 'conservador')).toBe(false)
    })
})

describe('overlay proativo - agendamento e contexto', () => {
    test('deve bloquear agendamento por cooldown, soneca e assinatura duplicada', () => {
        const agora = Date.now()
        const base = {
            configuracao: criarConfiguracao(),
            pausadoExternamente: false,
            assinaturaAtual: 'assinatura-1',
            textoPrincipal: 'como corrijo esse comando?',
            agora,
        }

        expect(deveAgendarAvaliacaoOverlay({
            ...base,
            cooldownAte: agora + 1_000,
            ultimaAssinaturaProcessada: null,
        })).toBe(false)

        expect(deveAgendarAvaliacaoOverlay({
            ...base,
            configuracao: criarConfiguracao({ sonecaAte: agora + 1_000 }),
            cooldownAte: 0,
            ultimaAssinaturaProcessada: null,
        })).toBe(false)

        expect(deveAgendarAvaliacaoOverlay({
            ...base,
            cooldownAte: 0,
            ultimaAssinaturaProcessada: 'assinatura-1',
        })).toBe(false)
    })

    test('deve aceitar contexto textual relevante e excluir mensagens com screenshot', () => {
        const contexto = criarContextoOverlayProativo({
            transcription: 'como eu resolvo isso?',
            transcriptionConfirmada: 'como eu resolvo isso?',
            transcriptionParcial: '',
            messages: [
                criarMensagem({ role: 'user', content: 'Analisa esse erro da migration' }),
                criarMensagem({
                    role: 'user',
                    content: 'Veja essa captura',
                    images: ['base64'],
                }),
                criarMensagem({
                    role: 'assistant',
                    content: 'Posso ajudar com o comando.',
                }),
            ],
        })

        expect(contexto.mensagensRecentes).toHaveLength(2)
        expect(contexto.mensagensRecentes.some((mensagem) => mensagem.content.includes('captura'))).toBe(false)

        const prompt = criarPromptDeteccaoOverlay(contexto, 'equilibrado')
        expect(prompt).toContain('Analisa esse erro da migration')
        expect(prompt).not.toContain('Veja essa captura')

        expect(deveAgendarAvaliacaoOverlay({
            configuracao: criarConfiguracao(),
            pausadoExternamente: false,
            cooldownAte: 0,
            assinaturaAtual: 'assinatura-nova',
            ultimaAssinaturaProcessada: null,
            agora: Date.now(),
            textoPrincipal: contexto.transcricaoConfirmada,
        })).toBe(true)
    })
})
