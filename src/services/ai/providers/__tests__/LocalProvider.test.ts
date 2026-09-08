import { afterEach, describe, expect, test } from 'vitest'
import { LocalProvider } from '../LocalProvider'

type EventoChunk = { reqId: string; data: string }
type EventoFim = { reqId: string; success: boolean; error?: string }

describe('LocalProvider - streaming', () => {
    afterEach(() => {
        Reflect.deleteProperty(globalThis, 'window')
    })

    test('entrega chunks progressivamente e aceita SSE sem espaço após data:', async () => {
        let receberChunk: ((evento: EventoChunk) => void) | undefined
        let receberFim: ((evento: EventoFim) => void) | undefined

        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                electronAPI: {
                    localLLM: {
                        onStreamChunk: (callback: (evento: EventoChunk) => void) => {
                            receberChunk = callback
                            return () => {
                                receberChunk = undefined
                            }
                        },
                        onStreamEnd: (callback: (evento: EventoFim) => void) => {
                            receberFim = callback
                            return () => {
                                receberFim = undefined
                            }
                        },
                        streamChat: async (reqId: string) => {
                            queueMicrotask(() => {
                                receberChunk?.({
                                    reqId,
                                    data: 'data:{"choices":[{"delta":{"content":"Olá"}}]}'
                                })
                                receberChunk?.({
                                    reqId,
                                    data: 'data: {"choices":[{"delta":{"content":" mundo"},"finish_reason":"stop"}]}'
                                })
                                receberFim?.({ reqId, success: true })
                            })
                            return { success: true }
                        },
                        cancelStreamChat: async () => ({ success: true })
                    }
                }
            }
        })

        const provider = new LocalProvider('qwen-local')
        const chunks: string[] = []
        let finalizacao = ''

        await provider.streamChat([], (chunk) => chunks.push(chunk), {
            onFimStream: (meta) => {
                finalizacao = meta.finishReason || ''
            }
        })

        expect(chunks).toEqual(['Olá', ' mundo'])
        expect(finalizacao).toBe('stop')
    })
})
