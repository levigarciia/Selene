type RegistroGenerico = Record<string, unknown>

function ehRegistro(valor: unknown): valor is RegistroGenerico {
    return typeof valor === 'object' && valor !== null
}

function obterCampoTexto(registro: RegistroGenerico, chave: string): string {
    const valor = registro[chave]
    return typeof valor === 'string' ? valor.trim() : ''
}

function obterCampoNumero(registro: RegistroGenerico, chave: string): number | null {
    const valor = registro[chave]
    return typeof valor === 'number' ? valor : null
}

function coletarTextoDeJson(valor: string): string[] {
    const texto = valor.trim()
    if (!texto.startsWith('{') && !texto.startsWith('[')) return []

    try {
        return coletarMensagens(JSON.parse(texto))
    } catch {
        return []
    }
}

function obterNomeErro(erro: unknown): string {
    if (erro instanceof Error && typeof erro.name === 'string') {
        return erro.name.trim()
    }
    if (!ehRegistro(erro)) return ''
    return obterCampoTexto(erro, 'name')
}

function coletarMensagens(erro: unknown): string[] {
    if (typeof erro === 'string') {
        return erro.trim() ? [erro.trim()] : []
    }

    if (!ehRegistro(erro)) return []

    const mensagens = [
        obterCampoTexto(erro, 'message'),
        obterCampoTexto(erro, 'msg'),
        obterCampoTexto(erro, 'detail'),
    ].filter(Boolean)

    const erroInterno = erro.error
    if (ehRegistro(erroInterno)) {
        mensagens.push(...coletarMensagens(erroInterno))
    }

    const resposta = erro.response
    if (ehRegistro(resposta)) {
        mensagens.push(...coletarMensagens(resposta))
        const dados = resposta.data
        if (ehRegistro(dados)) {
            mensagens.push(...coletarMensagens(dados))
        }
    }

    const causa = erro.cause
    if (ehRegistro(causa)) {
        mensagens.push(...coletarMensagens(causa))
    }

    const metadata = erro.metadata
    if (ehRegistro(metadata)) {
        mensagens.push(...coletarMensagens(metadata))
        const raw = obterCampoTexto(metadata, 'raw')
        if (raw) mensagens.push(...coletarTextoDeJson(raw))
    }

    return mensagens.filter(Boolean)
}

export function obterMensagemErroApi(erro: unknown, fallback: string): string {
    if (erro instanceof Error && erro.message.trim()) {
        return erro.message.trim()
    }

    const mensagem = coletarMensagens(erro).find(Boolean)
    return mensagem || fallback
}

export function obterStatusErroApi(erro: unknown): number | null {
    if (!ehRegistro(erro)) return null

    const statusDireto = obterCampoNumero(erro, 'status') ?? obterCampoNumero(erro, 'statusCode')
    if (statusDireto) return statusDireto

    const resposta = erro.response
    if (ehRegistro(resposta)) {
        const statusResposta = obterCampoNumero(resposta, 'status') ?? obterCampoNumero(resposta, 'statusCode')
        if (statusResposta) return statusResposta
    }

    const erroInterno = erro.error
    if (ehRegistro(erroInterno)) {
        const statusInterno = obterCampoNumero(erroInterno, 'status') ?? obterCampoNumero(erroInterno, 'code')
        if (statusInterno) return statusInterno
    }

    return null
}

export function normalizarMensagemErroApi(erro: unknown, fallback: string): string {
    const status = obterStatusErroApi(erro)
    const mensagemOriginal = obterMensagemErroApi(erro, fallback)
    const mensagem = mensagemOriginal.toLowerCase()
    const nomeErro = obterNomeErro(erro).toLowerCase()
    const mensagemSemPrefixoHttp = mensagemOriginal.replace(/^\d{3}\s+/i, '').trim()
    const mensagemSemPrefixoProvider = mensagemSemPrefixoHttp
        .replace(/^provider returned error\s*:?\s*/i, '')
        .trim()

    if (status === 401 || status === 403 || mensagem.includes('invalid api key') || mensagem.includes('unauthorized')) {
        if (mensagemSemPrefixoProvider) {
            return `Chave de API inválida ou sem permissão para esse provedor. Detalhe: ${mensagemSemPrefixoProvider}`
        }
        return 'Chave de API inválida ou sem permissão para esse provedor.'
    }

    if (
        status === 402 ||
        mensagem.includes('insufficient credits')
    ) {
        return 'Créditos insuficientes na conta ou na chave da OpenRouter.'
    }

    if (
        status === 429 ||
        nomeErro === 'ratelimiterror' ||
        mensagem.includes('rate limit')
    ) {
        if (mensagemSemPrefixoProvider) {
            return `OpenRouter bloqueou temporariamente a requisição por rate limit (429). Detalhe: ${mensagemSemPrefixoProvider}`
        }
        return 'OpenRouter bloqueou temporariamente a requisição por rate limit (429).'
    }

    if (
        mensagem.includes('no such model') ||
        mensagem.includes('model not found') ||
        mensagem.includes('unknown model') ||
        mensagem.includes('does not exist') ||
        mensagem.includes('model') && mensagem.includes('not available')
    ) {
        return 'Modelo inválido ou indisponível no provedor selecionado.'
    }

    if (
        status === 404 &&
        (
            mensagem.includes('no endpoints found') ||
            mensagem.includes('provider returned error') ||
            mensagem.includes('not found')
        )
    ) {
        if (mensagemSemPrefixoProvider) {
            return `OpenRouter não encontrou um endpoint disponível para esse modelo. Detalhe: ${mensagemSemPrefixoProvider}`
        }
        return 'OpenRouter não encontrou um endpoint disponível para esse modelo. Confira o modelo selecionado.'
    }

    if (mensagem.includes('provider returned error')) {
        return mensagemSemPrefixoProvider || fallback
    }

    return mensagemOriginal || fallback
}
