import type { ChatMessage, ImagemMensagemChat, StatusResumoImagem } from '../types/chat'

const CHAVE_STORAGE_CONVERSAS = 'selene_conversations'

interface ConversaPersistidaLike {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
    projectId?: string
}

function ehStatusResumoValido(valor: unknown): valor is StatusResumoImagem {
    return valor === 'pendente' || valor === 'gerando' || valor === 'concluido' || valor === 'falhou'
}

function normalizarListaImagens(valor: unknown): string[] {
    if (!Array.isArray(valor)) return []

    return valor
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
}

function normalizarResumo(valor: unknown): string | undefined {
    if (typeof valor !== 'string') return undefined
    const resumo = valor.trim()
    return resumo || undefined
}

function normalizarMetadadoImagem(
    valor: unknown,
    srcFallback?: string
): ImagemMensagemChat | null {
    if (typeof valor === 'string') {
        const src = valor.trim()
        if (!src) return null
        return { src, statusResumo: 'pendente' }
    }

    if (!valor || typeof valor !== 'object') {
        if (!srcFallback) return null
        return { src: srcFallback, statusResumo: 'pendente' }
    }

    const registro = valor as Partial<ImagemMensagemChat>
    const src = typeof registro.src === 'string' && registro.src.trim()
        ? registro.src.trim()
        : (srcFallback || '').trim()

    if (!src) return null

    const resumo = normalizarResumo(registro.resumo)
    const statusResumo = ehStatusResumoValido(registro.statusResumo)
        ? registro.statusResumo
        : resumo
            ? 'concluido'
            : 'pendente'

    return {
        src,
        resumo,
        statusResumo: resumo ? 'concluido' : statusResumo,
    }
}

export function normalizarMensagemChat(valor: unknown): ChatMessage | null {
    if (!valor || typeof valor !== 'object') return null

    const registro = valor as Partial<ChatMessage>
    const id = typeof registro.id === 'string' && registro.id.trim() ? registro.id : null
    const role = registro.role === 'assistant' || registro.role === 'user' ? registro.role : null

    if (!id || !role) return null

    const metadadosBrutos = Array.isArray(registro.imagensContexto) ? registro.imagensContexto : []
    const imagensBrutas = normalizarListaImagens(registro.images)
    const imagensDerivadasDosMetadados = metadadosBrutos
        .map((item) => normalizarMetadadoImagem(item))
        .filter((item): item is ImagemMensagemChat => Boolean(item))
        .map((item) => item.src)

    const imagens = Array.from(new Set([...imagensBrutas, ...imagensDerivadasDosMetadados]))
    const metadadosPorSrc = new Map<string, ImagemMensagemChat>()

    for (const src of imagens) {
        metadadosPorSrc.set(src, {
            src,
            statusResumo: 'pendente',
        })
    }

    for (const item of metadadosBrutos) {
        const normalizado = normalizarMetadadoImagem(item)
        if (!normalizado) continue

        const atual = metadadosPorSrc.get(normalizado.src)
        metadadosPorSrc.set(normalizado.src, {
            src: normalizado.src,
            resumo: normalizado.resumo ?? atual?.resumo,
            statusResumo: normalizado.resumo
                ? 'concluido'
                : normalizado.statusResumo ?? atual?.statusResumo ?? 'pendente',
        })
    }

    const imagensContexto = Array.from(metadadosPorSrc.values())

    return {
        id,
        role,
        content: typeof registro.content === 'string' ? registro.content : '',
        raciocinio: typeof registro.raciocinio === 'string' && registro.raciocinio.trim()
            ? registro.raciocinio
            : undefined,
        timestamp: typeof registro.timestamp === 'number' && Number.isFinite(registro.timestamp)
            ? registro.timestamp
            : Date.now(),
        images: imagens.length > 0 ? imagens : undefined,
        imagensContexto: imagensContexto.length > 0 ? imagensContexto : undefined,
    }
}

export function normalizarMensagensChat(valores: unknown[]): ChatMessage[] {
    if (!Array.isArray(valores)) return []
    return valores
        .map((valor) => normalizarMensagemChat(valor))
        .filter((mensagem): mensagem is ChatMessage => Boolean(mensagem))
}

export function atualizarMetadadoImagemMensagem(
    mensagem: ChatMessage,
    src: string,
    atualizacao: Partial<ImagemMensagemChat>
): ChatMessage {
    const mensagemNormalizada = normalizarMensagemChat(mensagem) || mensagem
    const imagens = Array.from(new Set([...(mensagemNormalizada.images || []), src]))
    const mapa = new Map<string, ImagemMensagemChat>()

    for (const imagem of imagens) {
        mapa.set(imagem, {
            src: imagem,
            statusResumo: 'pendente',
        })
    }

    for (const item of mensagemNormalizada.imagensContexto || []) {
        mapa.set(item.src, {
            ...item,
            statusResumo: item.resumo ? 'concluido' : (item.statusResumo || 'pendente'),
        })
    }

    const anterior = mapa.get(src) || { src, statusResumo: 'pendente' as StatusResumoImagem }
    const resumoNormalizado = atualizacao.resumo === undefined
        ? anterior.resumo
        : normalizarResumo(atualizacao.resumo)
    const statusResumo = resumoNormalizado
        ? 'concluido'
        : (atualizacao.statusResumo || anterior.statusResumo || 'pendente')

    mapa.set(src, {
        src,
        resumo: resumoNormalizado,
        statusResumo,
    })

    return {
        ...mensagemNormalizada,
        images: imagens.length > 0 ? imagens : undefined,
        imagensContexto: Array.from(mapa.values()),
    }
}

export function criarMetadadosImagensPendentes(imagens?: string[]): ImagemMensagemChat[] | undefined {
    const lista = normalizarListaImagens(imagens)
    if (lista.length === 0) return undefined

    return lista.map((src) => ({
        src,
        statusResumo: 'pendente',
    }))
}

export function normalizarConversaPersistida(valor: unknown): ConversaPersistidaLike | null {
    if (!valor || typeof valor !== 'object') return null

    const registro = valor as Partial<ConversaPersistidaLike>
    if (typeof registro.id !== 'string' || typeof registro.title !== 'string') {
        return null
    }

    return {
        id: registro.id,
        title: registro.title,
        messages: normalizarMensagensChat(Array.isArray(registro.messages) ? registro.messages : []),
        createdAt: typeof registro.createdAt === 'number' && Number.isFinite(registro.createdAt)
            ? registro.createdAt
            : Date.now(),
        updatedAt: typeof registro.updatedAt === 'number' && Number.isFinite(registro.updatedAt)
            ? registro.updatedAt
            : Date.now(),
        projectId: typeof registro.projectId === 'string' && registro.projectId.trim()
            ? registro.projectId
            : undefined,
    }
}

export function carregarConversasPersistidas(): ConversaPersistidaLike[] {
    try {
        const salvo = localStorage.getItem(CHAVE_STORAGE_CONVERSAS)
        if (!salvo) return []

        const parsed = JSON.parse(salvo)
        if (!Array.isArray(parsed)) return []

        return parsed
            .map((item) => normalizarConversaPersistida(item))
            .filter((conversa): conversa is ConversaPersistidaLike => Boolean(conversa))
    } catch {
        return []
    }
}

export function carregarMapaProjetosPorConversa(): Map<string, string> {
    const mapa = new Map<string, string>()

    for (const conversa of carregarConversasPersistidas()) {
        if (conversa.projectId) {
            mapa.set(conversa.id, conversa.projectId)
        }
    }

    return mapa
}
