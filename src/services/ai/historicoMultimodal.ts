import type { ChatMessage, ImagemMensagemChat } from '../../types/chat'
import type { ConteudoMensagemChat, ConteudoMultimodal, MensagemHistoricoIA, PerfilLatencia } from './types'

const LIMITES_IMAGENS_HISTORICO: Record<PerfilLatencia, number> = {
    rapido: 1,
    equilibrado: 2,
    completo: 2,
}

const PADROES_REFERENCIA_IMAGEM = [
    /\b(imagem|foto|print|screenshot|anexo|anexada)\b/i,
    /\b(essa|esse|esta|este|isso|isto|aquilo|aqui)\b/i,
    /\b(ela|ele)\b/i,
]

function truncarTexto(texto: string, maxCaracteres: number): string {
    if (texto.length <= maxCaracteres) return texto
    return texto.slice(0, maxCaracteres).trimEnd() + '...'
}

function normalizarTexto(texto: string): string {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function tokenizarTexto(texto: string): string[] {
    return normalizarTexto(texto)
        .split(' ')
        .filter((token) => token.length > 2)
}

function calcularSimilaridadeTexto(a: string, b: string): number {
    const tokensA = new Set(tokenizarTexto(a))
    const tokensB = new Set(tokenizarTexto(b))
    if (tokensA.size === 0 || tokensB.size === 0) return 0

    let intersecao = 0
    for (const token of tokensA) {
        if (tokensB.has(token)) intersecao += 1
    }

    return intersecao / Math.max(tokensA.size, tokensB.size)
}

function consultaMencionaImagem(consulta: string): boolean {
    const textoNormalizado = normalizarTexto(consulta)
    if (!textoNormalizado) return false
    return PADROES_REFERENCIA_IMAGEM.some((padrao) => padrao.test(textoNormalizado))
}

function obterMetadadosImagens(mensagem: ChatMessage): ImagemMensagemChat[] {
    if (Array.isArray(mensagem.imagensContexto) && mensagem.imagensContexto.length > 0) {
        return mensagem.imagensContexto
    }

    return (mensagem.images || []).map((src) => ({
        src,
        statusResumo: 'pendente',
    }))
}

function mensagemTemContextoVisual(mensagem: ChatMessage): boolean {
    return mensagem.role === 'user' && obterMetadadosImagens(mensagem).length > 0
}

function pontuarMensagemComImagem(
    mensagem: ChatMessage,
    indice: number,
    totalMensagens: number,
    consulta: string,
    emProjeto: boolean
): number {
    if (!mensagemTemContextoVisual(mensagem)) return 0

    const distanciaDoFim = Math.max(0, totalMensagens - indice - 1)
    const similaridade = calcularSimilaridadeTexto(consulta, mensagem.content || '')
    const consultaMenciona = consultaMencionaImagem(consulta)
    const consultaNormalizada = normalizarTexto(consulta)

    let pontuacao = 0

    if (consultaMenciona) {
        pontuacao += distanciaDoFim <= 3 ? 4 : 2
    }

    if (distanciaDoFim <= 2) pontuacao += 2.5
    else if (distanciaDoFim <= 5) pontuacao += 1

    if (similaridade >= 0.45) pontuacao += 3
    else if (similaridade >= 0.25) pontuacao += 2
    else if (similaridade >= 0.14) pontuacao += 1

    if (emProjeto && similaridade >= 0.18) {
        pontuacao += 1
    }

    if (/(aqui|isso|essa|esse|ela|ele|anexo)/i.test(consultaNormalizada) && distanciaDoFim <= 3) {
        pontuacao += 1.5
    }

    return pontuacao
}

export function criarConteudoTextoComImagens(texto: string, imagens?: string[]): ConteudoMensagemChat {
    if (!Array.isArray(imagens) || imagens.length === 0) {
        return texto
    }

    const conteudo: ConteudoMultimodal[] = []
    if (texto.trim()) {
        conteudo.push({ type: 'text', text: texto })
    }

    for (const imagem of imagens) {
        conteudo.push({
            type: 'image_url',
            image_url: { url: imagem }
        })
    }

    if (conteudo.length === 0) {
        conteudo.push({ type: 'text', text: texto })
    }

    return conteudo
}

export function selecionarMensagensComImagemParaHistorico(
    mensagens: ChatMessage[],
    opcoes: {
        consultaAtual?: string
        perfilLatencia?: PerfilLatencia
        emProjeto?: boolean
    } = {}
): ChatMessage[] {
    const consultaAtual = opcoes.consultaAtual || ''
    const perfilLatencia = opcoes.perfilLatencia || 'equilibrado'
    const emProjeto = Boolean(opcoes.emProjeto)
    const limiteImagens = LIMITES_IMAGENS_HISTORICO[perfilLatencia]

    return mensagens
        .map((mensagem, indice) => ({
            mensagem,
            pontuacao: pontuarMensagemComImagem(mensagem, indice, mensagens.length, consultaAtual, emProjeto),
        }))
        .filter((item) => item.pontuacao >= 2)
        .sort((a, b) => b.pontuacao - a.pontuacao)
        .slice(0, limiteImagens)
        .map((item) => item.mensagem)
}

export function criarResumoImagemFallback(
    textoMensagem: string,
    indiceImagem: number,
    totalImagens: number
): string {
    const contexto = truncarTexto((textoMensagem || '').replace(/\s+/g, ' ').trim(), 80)
    const prefixoIndice = totalImagens > 1 ? `imagem ${indiceImagem + 1} anexada` : 'imagem anexada'

    if (!contexto) {
        return prefixoIndice
    }

    return `${prefixoIndice} relacionada a: ${contexto}`
}

function criarBlocoResumoImagens(
    mensagem: ChatMessage,
    maxCaracteresResumo: number
): string {
    const metadados = obterMetadadosImagens(mensagem)
    if (metadados.length === 0) return ''

    const linhas = metadados
        .map((imagem, indice) => imagem.resumo?.trim()
            ? truncarTexto(imagem.resumo.trim(), maxCaracteresResumo)
            : criarResumoImagemFallback(mensagem.content, indice, metadados.length))
        .filter(Boolean)

    if (linhas.length === 0) return ''

    if (linhas.length === 1) {
        return `[resumo_imagem_anterior]\n${linhas[0]}`
    }

    return [
        '[resumo_imagem_anterior]',
        ...linhas.map((linha, indice) => `- Imagem ${indice + 1}: ${linha}`),
    ].join('\n')
}

export function criarConteudoHistoricoComResumoVisual(
    mensagem: ChatMessage,
    maxCaracteresPorMensagem: number,
    opcoes: {
        incluirResumoVisual?: boolean
        maxCaracteresResumoImagem?: number
    } = {}
): string {
    const incluirResumoVisual = opcoes.incluirResumoVisual ?? true
    const partes: string[] = []
    const conteudoBase = (mensagem.content || '').trim()

    if (conteudoBase) {
        partes.push(conteudoBase)
    }

    if (incluirResumoVisual) {
        const blocoResumo = criarBlocoResumoImagens(
            mensagem,
            opcoes.maxCaracteresResumoImagem ?? 120
        )
        if (blocoResumo) {
            partes.push(blocoResumo)
        }
    }

    const conteudoFinal = partes.join('\n\n').trim()
    return truncarTexto(conteudoFinal, maxCaracteresPorMensagem)
}

export function prepararHistoricoMultimodalParaModelo(
    mensagens: ChatMessage[],
    maxCaracteresPorMensagem: number,
    opcoes: {
        consultaAtual?: string
        perfilLatencia?: PerfilLatencia
        emProjeto?: boolean
    } = {}
): MensagemHistoricoIA[] {
    const selecionadasComImagem = selecionarMensagensComImagemParaHistorico(mensagens, opcoes)
    const idsComResumoVisual = new Set(selecionadasComImagem.map((mensagem) => mensagem.id))

    return mensagens
        .filter((mensagem) => (
            mensagem.role === 'user' || mensagem.role === 'assistant'
        ) && (
            mensagem.content.trim() || mensagemTemContextoVisual(mensagem)
        ))
        .map((mensagem) => ({
            role: mensagem.role,
            content: criarConteudoHistoricoComResumoVisual(mensagem, maxCaracteresPorMensagem, {
                incluirResumoVisual: idsComResumoVisual.has(mensagem.id),
            }),
        }))
        .filter((mensagem) => mensagem.content.trim())
}
