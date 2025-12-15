export type TipoDiff = 'igual' | 'adicao' | 'remocao'

export type ParteDiff = {
  tipo: TipoDiff
  valor: string
}

export type LinhaDiff = {
  tipo: TipoDiff
  conteudo: string
  linhaOriginal?: number
  linhaNova?: number
  partes?: ParteDiff[]
}

const construirMatrizLcs = (originais: string[], novas: string[]) => {
  const linhas = originais.length
  const colunas = novas.length
  const matriz = Array.from({ length: linhas + 1 }, () => Array(colunas + 1).fill(0))

  for (let i = linhas - 1; i >= 0; i--) {
    for (let j = colunas - 1; j >= 0; j--) {
      if (originais[i] === novas[j]) {
        matriz[i][j] = matriz[i + 1][j + 1] + 1
      } else {
        matriz[i][j] = Math.max(matriz[i + 1][j], matriz[i][j + 1])
      }
    }
  }

  return matriz
}

// Tokeniza mantendo pontuação e espaços como tokens separados para reconstrução fiel
const tokenizar = (texto: string): string[] => {
  return texto.split(/([^\w\záàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+)/).filter(Boolean)
}

const gerarDiffPalavras = (textoAntigo: string, textoNovo: string): ParteDiff[] => {
  const tokensA = tokenizar(textoAntigo)
  const tokensB = tokenizar(textoNovo)
  const matriz = construirMatrizLcs(tokensA, tokensB)

  const resultado: ParteDiff[] = []
  let i = 0
  let j = 0

  while (i < tokensA.length && j < tokensB.length) {
    if (tokensA[i] === tokensB[j]) {
      resultado.push({ tipo: 'igual', valor: tokensA[i] })
      i++
      j++
    } else if (matriz[i + 1][j] >= matriz[i][j + 1]) {
      resultado.push({ tipo: 'remocao', valor: tokensA[i] })
      i++
    } else {
      resultado.push({ tipo: 'adicao', valor: tokensB[j] })
      j++
    }
  }

  while (i < tokensA.length) {
    resultado.push({ tipo: 'remocao', valor: tokensA[i] })
    i++
  }
  while (j < tokensB.length) {
    resultado.push({ tipo: 'adicao', valor: tokensB[j] })
    j++
  }

  return resultado
}

export const gerarDiffPorLinhas = (textoOriginal: string, textoNovo: string): LinhaDiff[] => {
  const originais = textoOriginal.split('\n')
  const novas = textoNovo.split('\n')
  const lcs = construirMatrizLcs(originais, novas)

  const resultado: LinhaDiff[] = []
  let i = 0
  let j = 0
  let linhaOrig = 1
  let linhaNova = 1

  while (i < originais.length && j < novas.length) {
    if (originais[i] === novas[j]) {
      resultado.push({ tipo: 'igual', conteudo: originais[i], linhaOriginal: linhaOrig, linhaNova })
      i++
      j++
      linhaOrig++
      linhaNova++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      resultado.push({ tipo: 'remocao', conteudo: originais[i], linhaOriginal: linhaOrig })
      i++
      linhaOrig++
    } else {
      resultado.push({ tipo: 'adicao', conteudo: novas[j], linhaNova })
      j++
      linhaNova++
    }
  }

  while (i < originais.length) {
    resultado.push({ tipo: 'remocao', conteudo: originais[i], linhaOriginal: linhaOrig })
    i++
    linhaOrig++
  }

  while (j < novas.length) {
    resultado.push({ tipo: 'adicao', conteudo: novas[j], linhaNova })
    j++
    linhaNova++
  }

  // Pós-processamento para destacar diffs intra-linha em substituições
  // Procura pares de remoção/adição para mostrar diff palavra a palavra
  const remocoes: number[] = []
  const adicoes: number[] = []

  resultado.forEach((linha, idx) => {
    if (linha.tipo === 'remocao') remocoes.push(idx)
    if (linha.tipo === 'adicao') adicoes.push(idx)
  })

  // Emparelha remoções com adições na mesma ordem
  const pareados = new Set<number>()

  for (let r = 0; r < remocoes.length && r < adicoes.length; r++) {
    const idxRemocao = remocoes[r]
    const idxAdicao = adicoes[r]

    const linhaRemocao = resultado[idxRemocao]
    const linhaAdicao = resultado[idxAdicao]

    // Gerar diff por palavras entre as duas linhas
    const diffPalavras = gerarDiffPalavras(linhaRemocao.conteudo, linhaAdicao.conteudo)

    // Na linha removida, mostra partes iguais + removidas
    linhaRemocao.partes = diffPalavras.filter(p => p.tipo !== 'adicao')

    // Na linha adicionada, mostra partes iguais + adicionadas
    linhaAdicao.partes = diffPalavras.filter(p => p.tipo !== 'remocao')

    pareados.add(idxRemocao)
    pareados.add(idxAdicao)
  }

  return resultado
}
