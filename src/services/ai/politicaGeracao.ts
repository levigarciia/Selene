import type { OpcoesRequisicaoIA } from './AIProvider'

export type PerfilGeracao =
    | 'saudacao_ack'
    | 'pergunta_curta'
    | 'chat_normal'
    | 'complexa'
    | 'investigate'
    | 'imagem'

export interface ContextoPerfilGeracao {
    investigateMode?: boolean
    ehImagem?: boolean
    forcarPerfil?: PerfilGeracao
}

export interface ConfiguracaoPerfilGeracao {
    perfil: PerfilGeracao
    temperature: number
}

const TABELA_PERFIS: Record<PerfilGeracao, Omit<ConfiguracaoPerfilGeracao, 'perfil'>> = {
    saudacao_ack: { temperature: 0.4 },
    pergunta_curta: { temperature: 0.45 },
    chat_normal: { temperature: 0.5 },
    complexa: { temperature: 0.55 },
    investigate: { temperature: 0.5 },
    imagem: { temperature: 0.4 },
}

const PADROES_SAUDACAO = [
    /^(oi|ol[aá]|opa|e ai|e aí|bom dia|boa tarde|boa noite|obrigado|valeu|ok|blz|beleza)[!.\s]*$/i,
    /^(oi|ol[aá])\b/i,
]

const PADROES_COMPLEXIDADE = [
    /\b(detalh\w*|aprofund\w*|passo a passo|complet\w*|exaustiv\w*|compar\w*|arquitetur\w*|trade-?off|estrategi\w*)\b/i,
    /\b(implemente|refatore|otimize|investigue|analis\w* profundamente)\b/i,
    /\b(c[oó]digo|typescript|javascript|react|api|backend|frontend)\b/i,
]

function normalizarTexto(texto: string): string {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function ehSaudacaoOuAck(texto: string): boolean {
    const t = normalizarTexto(texto)
    if (!t) return true
    return PADROES_SAUDACAO.some((padrao) => padrao.test(t))
}

function ehPerguntaCurta(texto: string): boolean {
    const t = normalizarTexto(texto)
    if (!t) return false
    if (t.length > 45) return false
    if (ehSaudacaoOuAck(t)) return false
    const palavras = t.split(' ').filter(Boolean)
    if (palavras.length > 6) return false
    const iniciaInterrogativo = /^(o que|qual|quais|quem|quando|onde|como|por que|pq|q)\b/i.test(t)
    return t.endsWith('?') || (iniciaInterrogativo && palavras.length <= 5)
}

function ehPedidoComplexo(texto: string): boolean {
    const t = normalizarTexto(texto)
    if (!t) return false
    return PADROES_COMPLEXIDADE.some((padrao) => padrao.test(t))
}

function ehChatNormal(texto: string): boolean {
    const t = normalizarTexto(texto)
    if (!t) return false
    return !ehPerguntaCurta(t) && !ehSaudacaoOuAck(t)
}

export function selecionarPerfilGeracao(
    texto: string,
    contexto: ContextoPerfilGeracao = {}
): PerfilGeracao {
    if (contexto.forcarPerfil) return contexto.forcarPerfil
    if (contexto.ehImagem) return 'imagem'
    if (contexto.investigateMode) return 'investigate'
    if (ehPedidoComplexo(texto)) return 'complexa'
    if (ehChatNormal(texto)) return 'chat_normal'
    if (ehPerguntaCurta(texto)) return 'pergunta_curta'
    if (ehSaudacaoOuAck(texto)) return 'saudacao_ack'
    return 'chat_normal'
}

export function obterConfiguracaoPerfilGeracao(
    texto: string,
    contexto: ContextoPerfilGeracao = {}
): ConfiguracaoPerfilGeracao {
    const perfil = selecionarPerfilGeracao(texto, contexto)
    const base = TABELA_PERFIS[perfil]

    return {
        perfil,
        temperature: base.temperature,
    }
}

export function criarOpcoesRequisicaoPorPerfil(
    texto: string,
    contexto: ContextoPerfilGeracao = {},
    base: OpcoesRequisicaoIA = {}
): OpcoesRequisicaoIA & { perfilGeracao: PerfilGeracao } {
    const config = obterConfiguracaoPerfilGeracao(texto, contexto)
    return {
        ...base,
        temperature: config.temperature,
        perfilGeracao: config.perfil,
    }
}
