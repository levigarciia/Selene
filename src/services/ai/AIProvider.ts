import type { MensagemChat } from './types'

export interface AIProvider {
    /**
     * Envia mensagens para o chat (texto -> texto).
     */
    chat(mensagens: MensagemChat[]): Promise<string>

    /**
     * Envia mensagens para o chat com streaming (texto -> texto progressivo).
     * @param mensagens - Array de mensagens do chat
     * @param onChunk - Callback chamado para cada chunk de texto recebido
     */
    streamChat(mensagens: MensagemChat[], onChunk: (chunk: string) => void): Promise<void>

    /**
     * Transcreve áudio (blob -> texto).
     * Retorna string vazia ou null se falhar/não suportado,
     * permitindo que o Service tente fallbacks se desejar.
     */
    transcribe(audioBlob: Blob): Promise<string | null>

    /**
     * Analisa imagem com pergunta (imagem + texto -> texto).
     */
    analisarImagem(pergunta: string, dataUrl: string): Promise<string>

    /**
     * Analisa imagem com streaming (imagem + texto -> texto progressivo).
     */
    streamAnalisarImagem?(pergunta: string, dataUrl: string, onChunk: (chunk: string) => void): Promise<void>

    /**
     * Verifica se o provedor está configurado e pronto para uso.
     */
    isReady(): boolean
}

