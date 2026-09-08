import { afterEach, describe, expect, test } from 'vitest'
import { OpenRouterProvider } from '../OpenRouterProvider'

const fetchOriginal = globalThis.fetch

describe('OpenRouterProvider - reasoning', () => {
    afterEach(() => {
        globalThis.fetch = fetchOriginal
        Reflect.deleteProperty(globalThis, 'window')
    })

    test('desliga a geração de reasoning em vez de apenas ocultar os tokens', async () => {
        let payloadEnviado: Record<string, unknown> | undefined

        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { location: { origin: 'http://localhost' } }
        })
        globalThis.fetch = async (_entrada, init) => {
            payloadEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>
            return new Response(JSON.stringify({
                id: 'teste',
                object: 'chat.completion',
                created: 1,
                model: 'qwen/qwen3.5-9b',
                choices: [{ index: 0, message: { role: 'assistant', content: 'Olá' }, finish_reason: 'stop' }]
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const provider = new OpenRouterProvider('sk-or-v1-chave-de-teste', 'qwen/qwen3.5-9b')
        await provider.chat([{ role: 'user', content: 'Olá' }], { reasoningAtivo: false })

        expect(payloadEnviado?.reasoning).toEqual({
            effort: 'none',
            exclude: true
        })
        expect(payloadEnviado?.provider).toEqual({
            sort: 'latency',
            require_parameters: true
        })
        expect(payloadEnviado).not.toHaveProperty('include_reasoning')
    })

    test('entrega conteúdo antes do encerramento do stream e publica diagnóstico', async () => {
        let payloadEnviado: Record<string, unknown> | undefined
        let streamEncerrado = false
        let recebeuAntesDoFim = false

        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { location: { origin: 'http://localhost' } }
        })
        globalThis.fetch = async (_entrada, init) => {
            payloadEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>
            const encoder = new TextEncoder()
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode(
                        'data: {"id":"teste","provider":"DeepInfra","choices":[{"index":0,"delta":{"content":"Olá"},"finish_reason":null}]}\n\n'
                    ))
                    setTimeout(() => {
                        streamEncerrado = true
                        controller.enqueue(encoder.encode(
                            'data: {"id":"teste","provider":"DeepInfra","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}\n\n'
                        ))
                        controller.enqueue(encoder.encode(
                            'data: {"id":"teste","provider":"DeepInfra","choices":[],"usage":{"completion_tokens_details":{"reasoning_tokens":0}}}\n\n'
                        ))
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                        controller.close()
                    }, 20)
                }
            })

            return new Response(body, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' }
            })
        }

        const provider = new OpenRouterProvider('sk-or-v1-chave-de-teste', 'qwen/qwen3.5-9b')
        const chunks: string[] = []
        let diagnostico: { provedorExecucao?: string; tokensRaciocinio?: number } | undefined

        await provider.streamChat([{ role: 'user', content: 'Olá' }], (chunk) => {
            recebeuAntesDoFim ||= !streamEncerrado
            chunks.push(chunk)
        }, {
            reasoningAtivo: false,
            perfilLatencia: 'equilibrado',
            onFimStream: (meta) => {
                diagnostico = meta
            }
        })

        expect(chunks).toEqual(['Olá', '!'])
        expect(recebeuAntesDoFim).toBe(true)
        expect(payloadEnviado?.stream).toBe(true)
        expect(diagnostico).toMatchObject({
            provedorExecucao: 'DeepInfra',
            tokensRaciocinio: 0
        })
    })
})
