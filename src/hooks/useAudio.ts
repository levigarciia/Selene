import { useState, useRef, useEffect, useCallback } from 'react'
import { AudioService } from '../services/AudioService'
import type { AIService } from '../services/AIService'

export function useAudio(aiService: AIService | null) {
    const [isRecording, setIsRecording] = useState(false)
    const [transcription, setTranscription] = useState('')
    const serviceRef = useRef<AIService | null>(aiService)

    // Mantém a ref atualizada com o serviço mais recente
    useEffect(() => {
        serviceRef.current = aiService
    }, [aiService])

    // Instancia o serviço de áudio apenas uma vez
    const [audioService] = useState(() => new AudioService(async (blob: Blob) => {
        // Se não tiver serviço de AI pronto, tentamos usar a ref (que pode ter sido atualizada)
        if (!serviceRef.current) {
            console.warn('AIService não disponível para transcrição')
            return
        }

        try {
            const text = await serviceRef.current.transcribe(blob)
            if (text) {
                setTranscription((prev) => {
                    const novo = prev ? prev + ' ' + text : text
                    return novo
                })
            }
        } catch (err) {
            console.error('Erro na transcrição:', err)
        }
    }))

    const toggleRecording = useCallback(async () => {
        if (!isRecording) {
            // Verifica se temos capacidade de transcrever antes de começar
            // Nota: A verificação de chaves especificas fica na camada de UI/App se quiser dar feedback visual antes
            // Aqui só impedimos se realmente não tiver serviço (ou poderia iniciar e falhar depois, mas melhor prevenir)
            // Mas como a ref pode ser null se as chaves foram apagadas...
            // Vamos permitir tentar, o callback trata o erro se não tiver serviço.
            // Resetamos a transcrição ao iniciar nova gravação? Geralmente sim.
            setTranscription('')

            try {
                await audioService.start()
                setIsRecording(true)
            } catch (e) {
                console.error(e)
                throw new Error('Permissão de microfone negada ou erro ao iniciar.')
            }
        } else {
            audioService.stop()
            setIsRecording(false)
        }
    }, [isRecording, audioService])

    return {
        isRecording,
        transcription,
        setTranscription,
        toggleRecording
    }
}
