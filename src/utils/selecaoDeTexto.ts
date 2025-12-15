export type SelecaoCapturada = {
  texto: string
  tipo: 'input' | 'contenteditable'
  restaurarFoco: () => void
  substituir: (novoTexto: string) => void
}

type ResultadoSelecaoSucesso = {
  sucesso: true
  selecao: SelecaoCapturada
}

type ResultadoSelecaoErro = {
  sucesso: false
  motivo: 'sem-selecao' | 'limite'
  mensagem: string
  tamanho?: number
}

export type ResultadoCapturaSelecao = ResultadoSelecaoSucesso | ResultadoSelecaoErro

const tiposPermitidos = ['text', 'search', 'url', 'tel', 'password', 'email', 'number']

const criarFragmentoTexto = (conteudo: string) => {
  const fragmento = document.createDocumentFragment()
  const partes = conteudo.split('\n')

  partes.forEach((parte, indice) => {
    fragmento.appendChild(document.createTextNode(parte))
    if (indice < partes.length - 1) {
      fragmento.appendChild(document.createElement('br'))
    }
  })

  return fragmento
}

const encontrarEditavel = (no: Node | null): HTMLElement | null => {
  let atual: Node | null = no
  while (atual) {
    if (atual instanceof HTMLElement && (atual.isContentEditable || atual.tagName === 'TEXTAREA' || atual.tagName === 'INPUT')) {
      return atual
    }
    atual = atual.parentNode
  }
  return null
}

export const capturarSelecaoAtual = (limiteCaracteres: number): ResultadoCapturaSelecao => {
  const alvo = document.activeElement

  if (alvo instanceof HTMLTextAreaElement || (alvo instanceof HTMLInputElement && tiposPermitidos.includes(alvo.type))) {
    const inicio = alvo.selectionStart ?? 0
    const fim = alvo.selectionEnd ?? 0

    if (inicio === fim) {
      return { sucesso: false, motivo: 'sem-selecao', mensagem: 'Selecione um trecho de texto primeiro.' }
    }

    const textoSelecionado = alvo.value.slice(inicio, fim)

    if (textoSelecionado.length > limiteCaracteres) {
      return {
        sucesso: false,
        motivo: 'limite',
        mensagem: `O limite é de ${limiteCaracteres.toLocaleString('pt-BR')} caracteres.`,
        tamanho: textoSelecionado.length
      }
    }

    const substituir = (novoTexto: string) => {
      const antes = alvo.value.slice(0, inicio)
      const depois = alvo.value.slice(fim)
      const proximo = `${antes}${novoTexto}${depois}`

      alvo.focus({ preventScroll: true })
      alvo.value = proximo

      const inicioSelecao = inicio
      const fimSelecao = inicio + novoTexto.length
      alvo.setSelectionRange(inicioSelecao, fimSelecao)
    }

    const restaurarFoco = () => alvo.focus({ preventScroll: true })

    return {
      sucesso: true,
      selecao: {
        texto: textoSelecionado,
        tipo: 'input',
        restaurarFoco,
        substituir
      }
    }
  }

  const selecao = window.getSelection()

  if (!selecao || selecao.rangeCount === 0) {
    return { sucesso: false, motivo: 'sem-selecao', mensagem: 'Selecione um texto antes de acionar o atalho.' }
  }

  const rangeOriginal = selecao.getRangeAt(0)

  if (rangeOriginal.collapsed) {
    return { sucesso: false, motivo: 'sem-selecao', mensagem: 'Selecione um texto antes de acionar o atalho.' }
  }

  const texto = selecao.toString()

  if (!texto.trim()) {
    return { sucesso: false, motivo: 'sem-selecao', mensagem: 'Selecione um texto antes de acionar o atalho.' }
  }

  if (texto.length > limiteCaracteres) {
    return {
      sucesso: false,
      motivo: 'limite',
      mensagem: `O limite é de ${limiteCaracteres.toLocaleString('pt-BR')} caracteres.`,
      tamanho: texto.length
    }
  }

  const rangeClonado = rangeOriginal.cloneRange()
  const alvoEditavel = encontrarEditavel(rangeOriginal.commonAncestorContainer)

  const substituir = (novoTexto: string) => {
    const selecaoAtual = window.getSelection()
    if (!selecaoAtual) return

    const rangeAplicacao = rangeClonado.cloneRange()
    rangeAplicacao.deleteContents()

    const fragmento = criarFragmentoTexto(novoTexto)
    const primeiro = fragmento.firstChild
    const ultimo = fragmento.lastChild
    rangeAplicacao.insertNode(fragmento)

    const novoRange = document.createRange()

    if (primeiro && ultimo) {
      novoRange.setStartBefore(primeiro)
      novoRange.setEndAfter(ultimo)
    } else if (rangeAplicacao.startContainer) {
      novoRange.selectNodeContents(rangeAplicacao.startContainer)
    }

    selecaoAtual.removeAllRanges()
    selecaoAtual.addRange(novoRange)

    alvoEditavel?.focus({ preventScroll: true })
  }

  const restaurarFoco = () => {
    alvoEditavel?.focus({ preventScroll: true })
  }

  return {
    sucesso: true,
    selecao: {
      texto,
      tipo: 'contenteditable',
      restaurarFoco,
      substituir
    }
  }
}
