import type { ChatMessage } from '../../types/chat'
import type {
    ConfiguracaoOverlayProativo,
    ContextoOverlayProativo,
    DecisaoDeteccaoOverlay,
    MensagemContextoOverlay,
    NivelIntervencaoOverlay,
} from '../../types/overlayProativo'

export const COOL_DOWN_PADRAO_OVERLAY_MS = 25_000
export const SONECA_PADRAO_OVERLAY_MS = 15 * 60 * 1000

const THRESHOLDS_INTERVENCAO: Record<NivelIntervencaoOverlay, number> = {
    conservador: 0.84,
    equilibrado: 0.7,
    agressivo: 0.58,
}

export const PROMPT_SISTEMA_DETECCAO_OVERLAY = `Você é o detector do overlay inteligente da Selene.

Sua tarefa é decidir se vale interromper o usuário com um pitaco proativo.

Critérios:
- Intervenha pouco.
- Só intervenha quando houver utilidade real e imediata.
- Priorize: dúvida explícita, hesitação forte, contradição, erro provável ou oportunidade objetiva de ajuda.
- Não intervenha por conversa casual, continuação natural de raciocínio, brainstorming solto ou contexto fraco.
- Nunca mencione política interna, score interno ou que você está avaliando heurísticas.

Responda SOMENTE em JSON válido, sem markdown e sem texto extra, no formato:
{"intervir":true,"motivo":"...","confianca":0.0,"resumo":"..."}

Regras do JSON:
- "intervir" deve ser boolean.
- "motivo" deve ser curto e específico.
- "confianca" deve ficar entre 0 e 1.
- "resumo" deve ser uma frase curta explicando o pitaco proposto.
- Se não valer interromper, use "intervir": false e deixe "resumo" vazio.`

export const PROMPT_SISTEMA_RESPOSTA_OVERLAY = `Você é a persona dedicada do overlay inteligente da Selene.

Objetivo:
- intervir pouco
- ser clara
- ajudar imediatamente
- responder em português do Brasil

Regras:
- Entregue uma resposta textual completa, mas enxuta.
- Vá direto ao ponto e organize em poucas frases ou bullets curtos quando isso ajudar.
- Não diga que foi acionada automaticamente.
- Não peça desculpas por interromper.
- Não invente contexto além do que foi fornecido.`

function clamp(valor: number, min: number, max: number) {
    return Math.min(max, Math.max(min, valor))
}

export function normalizarTextoOverlay(texto: string): string {
    return (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

export function extrairMensagensRecentesOverlay(messages: ChatMessage[], limite = 4): MensagemContextoOverlay[] {
    return messages
        .filter((mensagem) => {
            if (!mensagem.content?.trim()) return false
            if (mensagem.images?.length) return false
            if (mensagem.imagensContexto?.length) return false
            return true
        })
        .slice(-limite)
        .map((mensagem) => ({
            role: mensagem.role,
            content: mensagem.content.trim(),
        }))
}

export function criarContextoOverlayProativo(params: {
    transcription: string
    transcriptionConfirmada: string
    transcriptionParcial: string
    messages: ChatMessage[]
}): ContextoOverlayProativo {
    return {
        rascunhoAtual: params.transcription.trim(),
        transcricaoConfirmada: params.transcriptionConfirmada.trim(),
        transcricaoParcial: params.transcriptionParcial.trim(),
        mensagensRecentes: extrairMensagensRecentesOverlay(params.messages),
    }
}

export function criarAssinaturaContextoOverlay(contexto: ContextoOverlayProativo): string {
    const mensagens = contexto.mensagensRecentes
        .map((mensagem) => `${mensagem.role}:${normalizarTextoOverlay(mensagem.content)}`)
        .join('|')

    return [
        normalizarTextoOverlay(contexto.rascunhoAtual),
        normalizarTextoOverlay(contexto.transcricaoConfirmada),
        normalizarTextoOverlay(contexto.transcricaoParcial),
        mensagens,
    ].join('::')
}

export function obterTextoPrincipalContextoOverlay(contexto: ContextoOverlayProativo): string {
    return (
        contexto.rascunhoAtual.trim()
        || contexto.transcricaoParcial.trim()
        || contexto.transcricaoConfirmada.trim()
    )
}

export function ehTextoSuficientementeRelevanteParaOverlay(texto: string): boolean {
    const textoNormalizado = texto.trim()
    if (!textoNormalizado) return false
    if (textoNormalizado.length >= 18) return true
    if (textoNormalizado.includes('?')) return true

    return /\b(como|por que|porque|pq|qual|quais|onde|quando|trav(ei|ou)|duvida|dúvida|erro|nao entendi|não entendi|me ajuda|ajuda)\b/i.test(textoNormalizado)
}

export function criarPromptDeteccaoOverlay(contexto: ContextoOverlayProativo, nivel: NivelIntervencaoOverlay): string {
    const mensagensRecentes = contexto.mensagensRecentes.length > 0
        ? contexto.mensagensRecentes
            .map((mensagem) => `- ${mensagem.role === 'user' ? 'Usuário' : 'Assistente'}: ${mensagem.content}`)
            .join('\n')
        : '- Nenhuma mensagem relevante'

    return [
        `Nível de intervenção: ${nivel}.`,
        '',
        'Contexto atual do overlay:',
        `- Rascunho atual: ${contexto.rascunhoAtual || '(vazio)'}`,
        `- Transcrição confirmada: ${contexto.transcricaoConfirmada || '(vazia)'}`,
        `- Transcrição parcial: ${contexto.transcricaoParcial || '(vazia)'}`,
        '',
        'Mensagens recentes do chat:',
        mensagensRecentes,
        '',
        'Decida se vale interromper agora.',
    ].join('\n')
}

export function criarPromptRespostaOverlay(contexto: ContextoOverlayProativo, decisao: DecisaoDeteccaoOverlay): string {
    const mensagensRecentes = contexto.mensagensRecentes.length > 0
        ? contexto.mensagensRecentes
            .map((mensagem) => `- ${mensagem.role === 'user' ? 'Usuário' : 'Assistente'}: ${mensagem.content}`)
            .join('\n')
        : '- Nenhuma mensagem relevante'

    return [
        `Motivo da intervenção: ${decisao.motivo || 'Ajuda contextual detectada'}.`,
        `Resumo do pitaco: ${decisao.resumo || 'Ofereça ajuda imediata e objetiva.'}`,
        '',
        'Contexto atual:',
        `- Rascunho atual: ${contexto.rascunhoAtual || '(vazio)'}`,
        `- Transcrição confirmada: ${contexto.transcricaoConfirmada || '(vazia)'}`,
        `- Transcrição parcial: ${contexto.transcricaoParcial || '(vazia)'}`,
        '',
        'Mensagens recentes:',
        mensagensRecentes,
        '',
        'Entregue o pitaco final agora.',
    ].join('\n')
}

export function parsearDecisaoDeteccaoOverlay(respostaBruta: string): DecisaoDeteccaoOverlay | null {
    const texto = (respostaBruta || '').trim()
    if (!texto) return null

    const textoSemBloco = texto
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

    const inicioJson = textoSemBloco.indexOf('{')
    const fimJson = textoSemBloco.lastIndexOf('}')
    const jsonTexto = inicioJson >= 0 && fimJson > inicioJson
        ? textoSemBloco.slice(inicioJson, fimJson + 1)
        : textoSemBloco

    try {
        const valor = JSON.parse(jsonTexto) as Record<string, unknown>
        const confiancaBruta = valor.confianca
        const confiancaNumero = typeof confiancaBruta === 'string'
            ? Number.parseFloat(confiancaBruta.replace('%', '')) / (confiancaBruta.includes('%') ? 100 : 1)
            : Number(confiancaBruta ?? 0)
        const intervirBruto = valor.intervir
        const intervir = intervirBruto === true || String(intervirBruto).trim().toLowerCase() === 'true'

        return {
            intervir,
            motivo: String(valor.motivo || '').trim(),
            resumo: String(valor.resumo || '').trim(),
            confianca: Number.isFinite(confiancaNumero) ? clamp(confiancaNumero, 0, 1) : 0,
        }
    } catch {
        return null
    }
}

export function deveExecutarIntervencaoOverlay(
    decisao: DecisaoDeteccaoOverlay | null,
    nivel: NivelIntervencaoOverlay,
): boolean {
    if (!decisao?.intervir) return false
    if (!decisao.resumo.trim() && !decisao.motivo.trim()) return false
    return decisao.confianca >= THRESHOLDS_INTERVENCAO[nivel]
}

export function deveAgendarAvaliacaoOverlay(params: {
    configuracao: ConfiguracaoOverlayProativo
    pausadoExternamente: boolean
    cooldownAte: number
    assinaturaAtual: string
    ultimaAssinaturaProcessada: string | null
    agora: number
    textoPrincipal: string
}): boolean {
    const { configuracao, pausadoExternamente, cooldownAte, assinaturaAtual, ultimaAssinaturaProcessada, agora, textoPrincipal } = params
    if (!configuracao.habilitado) return false
    if (pausadoExternamente) return false
    if (configuracao.sonecaAte && configuracao.sonecaAte > agora) return false
    if (cooldownAte > agora) return false
    if (!assinaturaAtual.trim()) return false
    if (ultimaAssinaturaProcessada === assinaturaAtual) return false
    return ehTextoSuficientementeRelevanteParaOverlay(textoPrincipal)
}

export function criarMensagensExpansaoIntervencao(params: {
    messages: ChatMessage[]
    resumo: string
    resposta: string
    textoContexto: string
    timestampBase?: number
}): ChatMessage[] {
    const timestampBase = params.timestampBase ?? Date.now()
    const mensagensBase = params.messages.slice(-6)
    const mensagemContexto = params.textoContexto.trim() || params.resumo.trim() || 'Contexto observado pelo overlay inteligente.'

    return [
        ...mensagensBase,
        {
            id: `overlay-user-${timestampBase}`,
            role: 'user',
            content: `[Overlay inteligente] ${mensagemContexto}`,
            timestamp: timestampBase,
        },
        {
            id: `overlay-assistant-${timestampBase + 1}`,
            role: 'assistant',
            content: params.resposta.trim(),
            timestamp: timestampBase + 1,
        },
    ]
}
