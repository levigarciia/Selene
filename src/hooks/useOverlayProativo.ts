import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { AIService } from '../services/AIService'
import type { PerfilLatencia } from '../services/ai/types'
import type { ChatMessage } from '../types/chat'
import type {
    ConfiguracaoOverlayProativo,
    ContextoOverlayProativo,
    IntervencaoOverlay,
} from '../types/overlayProativo'
import {
    criarAssinaturaContextoOverlay,
    criarContextoOverlayProativo,
    criarPromptDeteccaoOverlay,
    criarPromptRespostaOverlay,
    deveAgendarAvaliacaoOverlay,
    deveExecutarIntervencaoOverlay,
    obterTextoPrincipalContextoOverlay,
    parsearDecisaoDeteccaoOverlay,
    PROMPT_SISTEMA_DETECCAO_OVERLAY,
    PROMPT_SISTEMA_RESPOSTA_OVERLAY,
    SONECA_PADRAO_OVERLAY_MS,
} from '../services/overlay/overlayProativo'

interface UseOverlayProativoParams {
    configuracao: ConfiguracaoOverlayProativo
    atualizarSonecaAte: (timestamp: number | null) => void
    transcription: string
    transcriptionConfirmada: string
    transcriptionParcial: string
    ultimaAtualizacaoTranscricaoEm: number
    ultimaParadaGravacaoEm: number | null
    isRecording: boolean
    messages: ChatMessage[]
    pausadoExternamente: boolean
    criarOuObterServico: () => AIService | null
    perfilLatencia: PerfilLatencia
    contextoPerfilUsuario?: string
}

interface UseOverlayProativoReturn {
    intervencao: IntervencaoOverlay | null
    dispensarIntervencao: () => void
    sonecarIntervencao: () => void
    limparIntervencao: () => void
    isSonecaAtiva: boolean
}

function obterMotivoAbort(erro: unknown) {
    if (erro instanceof Error) {
        return erro.name === 'AbortError' || erro.message.toLowerCase().includes('abort')
    }
    return false
}

function logOverlay(...args: unknown[]) {
    console.info('[overlay-proativo]', ...args)
}

export function useOverlayProativo({
    configuracao,
    atualizarSonecaAte,
    transcription,
    transcriptionConfirmada,
    transcriptionParcial,
    ultimaAtualizacaoTranscricaoEm,
    ultimaParadaGravacaoEm,
    isRecording,
    messages,
    pausadoExternamente,
    criarOuObterServico,
    perfilLatencia,
    contextoPerfilUsuario = '',
}: UseOverlayProativoParams): UseOverlayProativoReturn {
    const [intervencao, setIntervencao] = useState<IntervencaoOverlay | null>(null)
    const [cooldownAte, setCooldownAte] = useState(0)

    const assinaturaEmProcessamentoRef = useRef<string | null>(null)
    const ultimaAssinaturaProcessadaRef = useRef<string | null>(null)
    const timeoutAvaliacaoRef = useRef<number | null>(null)
    const abortDetectRef = useRef<AbortController | null>(null)
    const abortRespostaRef = useRef<AbortController | null>(null)
    const intervencaoAtualRef = useRef<IntervencaoOverlay | null>(null)

    const contexto = useMemo<ContextoOverlayProativo>(() => criarContextoOverlayProativo({
        transcription,
        transcriptionConfirmada,
        transcriptionParcial,
        messages,
    }), [messages, transcription, transcriptionConfirmada, transcriptionParcial])

    const assinaturaContexto = useMemo(
        () => criarAssinaturaContextoOverlay(contexto),
        [contexto],
    )

    const textoPrincipal = useMemo(
        () => obterTextoPrincipalContextoOverlay(contexto),
        [contexto],
    )

    const cancelarPipelines = useCallback((motivo: string, limparIntervencao = false) => {
        if (timeoutAvaliacaoRef.current) {
            window.clearTimeout(timeoutAvaliacaoRef.current)
            timeoutAvaliacaoRef.current = null
        }

        abortDetectRef.current?.abort()
        abortDetectRef.current = null
        abortRespostaRef.current?.abort()
        abortRespostaRef.current = null
        assinaturaEmProcessamentoRef.current = null

        if (limparIntervencao) {
            if (intervencaoAtualRef.current) {
                logOverlay('pipeline cancelado', { motivo, intervencaoId: intervencaoAtualRef.current.id })
            }
            intervencaoAtualRef.current = null
            setIntervencao(null)
        }
    }, [])

    useEffect(() => {
        intervencaoAtualRef.current = intervencao
    }, [intervencao])

    const limparIntervencao = useCallback(() => {
        cancelarPipelines('limpeza_manual', true)
    }, [cancelarPipelines])

    const dispensarIntervencao = useCallback(() => {
        setCooldownAte(Date.now() + configuracao.cooldownMs)
        setIntervencao((atual) => atual ? { ...atual, status: 'dispensado' } : null)
        window.setTimeout(() => {
            intervencaoAtualRef.current = null
            setIntervencao(null)
        }, 120)
        cancelarPipelines('dispensada_usuario')
    }, [cancelarPipelines, configuracao.cooldownMs])

    const sonecarIntervencao = useCallback(() => {
        const proximoTimestamp = Date.now() + SONECA_PADRAO_OVERLAY_MS
        atualizarSonecaAte(proximoTimestamp)
        setCooldownAte(proximoTimestamp)
        setIntervencao((atual) => atual ? { ...atual, status: 'dispensado' } : null)
        window.setTimeout(() => {
            intervencaoAtualRef.current = null
            setIntervencao(null)
        }, 120)
        cancelarPipelines('soneca_ativada')
    }, [atualizarSonecaAte, cancelarPipelines])

    useEffect(() => {
        if (!intervencaoAtualRef.current) return
        if (!assinaturaContexto.trim()) return

        const assinaturaAtual = assinaturaContexto
        const assinaturaAnterior = assinaturaEmProcessamentoRef.current || ultimaAssinaturaProcessadaRef.current
        if (!assinaturaAnterior || assinaturaAnterior === assinaturaAtual) return

        cancelarPipelines('novo_contexto_detectado', true)
    }, [assinaturaContexto, cancelarPipelines])

    const executarAvaliacao = useCallback(async (assinatura: string, contextoAtual: ContextoOverlayProativo) => {
        const servico = criarOuObterServico()
        if (!servico) return

        const inicio = Date.now()
        assinaturaEmProcessamentoRef.current = assinatura

        const intervencaoInicial: IntervencaoOverlay = {
            id: uuidv4(),
            gatilho: 'avaliando',
            confianca: 0,
            resposta: '',
            resumo: '',
            status: 'avaliando',
            createdAt: inicio,
        }
        setIntervencao(intervencaoInicial)

        try {
            const detectorAbort = new AbortController()
            abortDetectRef.current = detectorAbort

            const promptDeteccao = criarPromptDeteccaoOverlay(contextoAtual, configuracao.nivelIntervencao)
            const respostaDeteccao = await servico.chat(
                promptDeteccao,
                PROMPT_SISTEMA_DETECCAO_OVERLAY,
                [],
                {
                    signal: detectorAbort.signal,
                    temperature: 0.15,
                    perfilLatencia,
                },
            )

            if (detectorAbort.signal.aborted) {
                return
            }

            const decisao = parsearDecisaoDeteccaoOverlay(respostaDeteccao)
            ultimaAssinaturaProcessadaRef.current = assinatura

            if (!deveExecutarIntervencaoOverlay(decisao, configuracao.nivelIntervencao)) {
                logOverlay('intervenção descartada', { decisao, assinatura })
                setIntervencao(null)
                assinaturaEmProcessamentoRef.current = null
                return
            }

            const intervencaoId = intervencaoInicial.id
            setIntervencao({
                id: intervencaoId,
                gatilho: decisao?.motivo || 'ajuda_contextual',
                confianca: decisao?.confianca || 0,
                resposta: '',
                resumo: decisao?.resumo || '',
                status: 'respondendo',
                createdAt: inicio,
            })

            const respostaAbort = new AbortController()
            abortRespostaRef.current = respostaAbort

            const promptResposta = criarPromptRespostaOverlay(contextoAtual, decisao!)
            const promptSistemaResposta = `${PROMPT_SISTEMA_RESPOSTA_OVERLAY}\n\n${contextoPerfilUsuario}`
            let respostaCompleta = ''

            await servico.streamChat(
                promptResposta,
                (chunk) => {
                    respostaCompleta += chunk
                    setIntervencao((atual) => {
                        if (!atual || atual.id !== intervencaoId) return atual
                        return {
                            ...atual,
                            resposta: respostaCompleta,
                            status: 'respondendo',
                        }
                    })
                },
                promptSistemaResposta,
                [],
                {
                    signal: respostaAbort.signal,
                    temperature: 0.35,
                    perfilLatencia,
                },
            )

            if (respostaAbort.signal.aborted) {
                return
            }

            setCooldownAte(Date.now() + configuracao.cooldownMs)
            setIntervencao((atual) => {
                if (!atual || atual.id !== intervencaoId) return atual
                return {
                    ...atual,
                    resposta: respostaCompleta.trim(),
                    status: 'pronto',
                }
            })

            logOverlay('intervenção pronta', {
                id: intervencaoId,
                assinatura,
                duracaoMs: Date.now() - inicio,
                confianca: decisao?.confianca,
                gatilho: decisao?.motivo,
            })
        } catch (erro) {
            if (obterMotivoAbort(erro)) {
                logOverlay('pipeline abortado', { assinatura })
                return
            }

            console.warn('[overlay-proativo] falha ao gerar intervenção', erro)
            ultimaAssinaturaProcessadaRef.current = assinatura
            setIntervencao(null)
        } finally {
            abortDetectRef.current = null
            abortRespostaRef.current = null
            assinaturaEmProcessamentoRef.current = null
        }
    }, [configuracao.cooldownMs, configuracao.nivelIntervencao, contextoPerfilUsuario, criarOuObterServico, perfilLatencia])

    useEffect(() => {
        const agora = Date.now()
        const deveAgendar = deveAgendarAvaliacaoOverlay({
            configuracao,
            pausadoExternamente,
            cooldownAte,
            assinaturaAtual: assinaturaContexto,
            ultimaAssinaturaProcessada: ultimaAssinaturaProcessadaRef.current,
            agora,
            textoPrincipal,
        })

        if (!deveAgendar) {
            if (pausadoExternamente || !configuracao.habilitado) {
                cancelarPipelines('overlay_pausado', true)
            }
            return
        }

        const contextoAtual = contexto
        const assinaturaAtual = assinaturaContexto
        const delayMs = isRecording ? 1200 : 800
        const referenciaTempo = isRecording
            ? ultimaAtualizacaoTranscricaoEm
            : (ultimaParadaGravacaoEm || ultimaAtualizacaoTranscricaoEm)

        if (timeoutAvaliacaoRef.current) {
            window.clearTimeout(timeoutAvaliacaoRef.current)
        }

        timeoutAvaliacaoRef.current = window.setTimeout(() => {
            const agoraExecucao = Date.now()
            if (referenciaTempo && agoraExecucao - referenciaTempo < delayMs - 20) {
                return
            }
            void executarAvaliacao(assinaturaAtual, contextoAtual)
        }, delayMs)

        return () => {
            if (timeoutAvaliacaoRef.current) {
                window.clearTimeout(timeoutAvaliacaoRef.current)
                timeoutAvaliacaoRef.current = null
            }
        }
    }, [
        assinaturaContexto,
        cancelarPipelines,
        configuracao,
        contexto,
        cooldownAte,
        executarAvaliacao,
        isRecording,
        pausadoExternamente,
        textoPrincipal,
        ultimaAtualizacaoTranscricaoEm,
        ultimaParadaGravacaoEm,
    ])

    useEffect(() => {
        return () => {
            cancelarPipelines('unmount_hook')
        }
    }, [cancelarPipelines])

    return {
        intervencao,
        dispensarIntervencao,
        sonecarIntervencao,
        limparIntervencao,
        isSonecaAtiva: Boolean(configuracao.sonecaAte && configuracao.sonecaAte > Date.now()),
    }
}
