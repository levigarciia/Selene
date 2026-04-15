export * from './ai/types'
import type { AIConfig, AcaoTexto, ConteudoMensagemChat, MensagemChat, MensagemHistoricoIA, ProvedorID, TomTexto } from './ai/types'
import type { AIProvider } from './ai/AIProvider'
import type { OpcoesRequisicaoIA } from './ai/AIProvider'
import { OpenAIProvider } from './ai/providers/OpenAIProvider'
import { GeminiProvider } from './ai/providers/GeminiProvider'
import { OpenRouterProvider } from './ai/providers/OpenRouterProvider'
import { LMStudioProvider } from './ai/providers/LMStudioProvider'
import { criarConteudoTextoComImagens } from './ai/historicoMultimodal'

class ExtratorRaciocinioThink {
  private readonly tagInicio = '<think>'
  private readonly tagFim = '</think>'
  private bufferPendente = ''
  private emRaciocinio = false

  processar(fragmento: string): { conteudo: string; raciocinio: string } {
    const textoEntrada = `${this.bufferPendente}${fragmento || ''}`
    this.bufferPendente = ''
    if (!textoEntrada) return { conteudo: '', raciocinio: '' }

    const textoLower = textoEntrada.toLowerCase()
    const partesConteudo: string[] = []
    const partesRaciocinio: string[] = []

    let cursor = 0
    while (cursor < textoEntrada.length) {
      if (this.emRaciocinio) {
        const idxFim = textoLower.indexOf(this.tagFim, cursor)
        if (idxFim === -1) {
          const restante = textoEntrada.slice(cursor)
          const { textoSeguro, sufixoPendente } = this.extrairSufixoPendente(restante, this.tagFim)
          if (textoSeguro) partesRaciocinio.push(textoSeguro)
          this.bufferPendente = sufixoPendente
          break
        }

        if (idxFim > cursor) {
          partesRaciocinio.push(textoEntrada.slice(cursor, idxFim))
        }
        cursor = idxFim + this.tagFim.length
        this.emRaciocinio = false
        continue
      }

      const idxInicio = textoLower.indexOf(this.tagInicio, cursor)
      if (idxInicio === -1) {
        const restante = textoEntrada.slice(cursor)
        const { textoSeguro, sufixoPendente } = this.extrairSufixoPendente(restante, this.tagInicio)
        if (textoSeguro) partesConteudo.push(textoSeguro)
        this.bufferPendente = sufixoPendente
        break
      }

      if (idxInicio > cursor) {
        partesConteudo.push(textoEntrada.slice(cursor, idxInicio))
      }
      cursor = idxInicio + this.tagInicio.length
      this.emRaciocinio = true
    }

    return {
      conteudo: partesConteudo.join(''),
      raciocinio: partesRaciocinio.join('')
    }
  }

  finalizar(): { conteudo: string; raciocinio: string } {
    if (!this.bufferPendente) {
      return { conteudo: '', raciocinio: '' }
    }

    const restante = this.bufferPendente
    this.bufferPendente = ''
    if (this.emRaciocinio) {
      return { conteudo: '', raciocinio: restante }
    }

    return { conteudo: restante, raciocinio: '' }
  }

  private extrairSufixoPendente(texto: string, tagCompleta: string): { textoSeguro: string; sufixoPendente: string } {
    const limite = Math.min(tagCompleta.length - 1, texto.length)
    const tagLower = tagCompleta.toLowerCase()

    for (let tamanho = limite; tamanho > 0; tamanho--) {
      const sufixo = texto.slice(-tamanho).toLowerCase()
      if (tagLower.startsWith(sufixo)) {
        return {
          textoSeguro: texto.slice(0, -tamanho),
          sufixoPendente: texto.slice(-tamanho)
        }
      }
    }

    return { textoSeguro: texto, sufixoPendente: '' }
  }
}

export class AIService {
  private providers: Record<ProvedorID, AIProvider>
  private activeProviderId: ProvedorID

  constructor(config: AIConfig) {
    this.providers = {
      openai: new OpenAIProvider(config.openai?.key, config.openai?.model),
      gemini: new GeminiProvider(config.gemini?.key),
      openrouter: new OpenRouterProvider(config.openRouter?.key, config.openRouter?.model),
      lmstudio: new LMStudioProvider(config.lmStudio?.baseUrl, config.lmStudio?.model)
    }

    this.activeProviderId = this.determinarProvedorAtivo(config)
  }

  private determinarProvedorAtivo(config: AIConfig): ProvedorID {
    if (config.activeProvider && this.providers[config.activeProvider].isReady()) {
      return config.activeProvider
    }

    // Auto-detect priority
    if (this.providers.lmstudio.isReady()) return 'lmstudio'
    if (this.providers.openai.isReady()) return 'openai'
    if (this.providers.openrouter.isReady()) return 'openrouter'
    if (this.providers.gemini.isReady()) return 'gemini'

    return 'openai' // Default fallback
  }

  private get activeProvider(): AIProvider {
    return this.providers[this.activeProviderId]
  }

  private construirMensagensChat(
    texto: ConteudoMensagemChat,
    systemPrompt: string,
    history: MensagemHistoricoIA[] = []
  ): MensagemChat[] {
    const mensagens: MensagemChat[] = []
    const systemNormalizado = (systemPrompt || '').trim()

    if (systemNormalizado) {
      mensagens.push({ role: 'system', content: systemNormalizado })
    }

    mensagens.push(
      ...history.map(m => ({
        role: m.role,
        content: m.role === 'user' && m.images?.length
          ? criarConteudoTextoComImagens(m.content, m.images)
          : m.content
      })),
      { role: 'user', content: texto }
    )

    return mensagens
  }

  async chat(
    texto: ConteudoMensagemChat,
    systemPrompt: string = 'Você é uma assistente útil chamada Selene.',
    history: MensagemHistoricoIA[] = [],
    opcoes: OpcoesRequisicaoIA = {}
  ): Promise<string> {
    const mensagens = this.construirMensagensChat(texto, systemPrompt, history)
    return this.activeProvider.chat(mensagens, opcoes)
  }

  async streamChat(
    texto: ConteudoMensagemChat,
    onChunk: (chunk: string) => void,
    systemPrompt: string = 'Você é uma assistente útil chamada Selene.',
    history: MensagemHistoricoIA[] = [],
    opcoes: OpcoesRequisicaoIA = {}
  ): Promise<void> {
    const mensagens = this.construirMensagensChat(texto, systemPrompt, history)

    const extratorThink = new ExtratorRaciocinioThink()

    const emitirConteudo = (conteudo: string, origem: 'delta_conteudo' | 'tag_think' = 'delta_conteudo') => {
      if (!conteudo) return
      onChunk(conteudo)
      opcoes.onEventoStream?.({ tipo: 'conteudo', texto: conteudo, origem })
    }

    const emitirRaciocinio = (raciocinio: string, origem: 'delta_raciocinio' | 'tag_think' = 'tag_think') => {
      if (!raciocinio) return
      opcoes.onEventoStream?.({ tipo: 'raciocinio', texto: raciocinio, origem })
    }

    const processarFragmentoConteudo = (fragmento: string, origem: 'delta_conteudo' | 'tag_think' = 'delta_conteudo') => {
      if (!fragmento) return
      const { conteudo, raciocinio } = extratorThink.processar(fragmento)
      if (raciocinio) emitirRaciocinio(raciocinio, 'tag_think')
      if (conteudo) emitirConteudo(conteudo, origem)
    }

    const opcoesAdaptadas: OpcoesRequisicaoIA = {
      ...opcoes,
      onEventoStream: (evento) => {
        if (!evento?.texto) return
        if (evento.tipo === 'raciocinio') {
          emitirRaciocinio(evento.texto, evento.origem || 'delta_raciocinio')
          return
        }
        const origemConteudo = evento.origem === 'tag_think' ? 'tag_think' : 'delta_conteudo'
        processarFragmentoConteudo(evento.texto, origemConteudo)
      }
    }

    await this.activeProvider.streamChat(
      mensagens,
      (chunk) => processarFragmentoConteudo(chunk, 'delta_conteudo'),
      opcoesAdaptadas
    )

    const restante = extratorThink.finalizar()
    if (restante.raciocinio) emitirRaciocinio(restante.raciocinio, 'tag_think')
    if (restante.conteudo) emitirConteudo(restante.conteudo, 'delta_conteudo')
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    // 1. Try active provider
    let result = await this.activeProvider.transcribe(audioBlob)
    if (result) return result

    // 2. Smart Fallbacks (Audio-capable providers)
    // If active failed or returned null (e.g. OpenAI chat model doesn't support audio, but we have a client)
    // We try specifically providers known to be good at audio if they are configured.

    const fallbacks: ProvedorID[] = ['gemini', 'openrouter', 'openai']
    for (const uid of fallbacks) {
      if (uid === this.activeProviderId) continue // Already tried
      if (this.providers[uid].isReady()) {
        try {
          result = await this.providers[uid].transcribe(audioBlob)
          if (result) return result
        } catch (e) {
          console.warn(`Fallback transcription failed on ${uid}`, e)
        }
      }
    }

    return ''
  }

  async analisarImagem(pergunta: string, dataUrl: string, opcoes: OpcoesRequisicaoIA = {}): Promise<string> {
    return this.activeProvider.analisarImagem(pergunta, dataUrl, opcoes)
  }

  async streamAnalisarImagem(
    pergunta: string,
    dataUrl: string,
    onChunk: (chunk: string) => void,
    opcoes: OpcoesRequisicaoIA = {}
  ): Promise<void> {
    console.log('[AIService] streamAnalisarImagem called, provider:', this.activeProviderId)

    const extratorThink = new ExtratorRaciocinioThink()
    const emitirConteudo = (conteudo: string, origem: 'delta_conteudo' | 'tag_think' = 'delta_conteudo') => {
      if (!conteudo) return
      onChunk(conteudo)
      opcoes.onEventoStream?.({ tipo: 'conteudo', texto: conteudo, origem })
    }
    const emitirRaciocinio = (raciocinio: string, origem: 'delta_raciocinio' | 'tag_think' = 'tag_think') => {
      if (!raciocinio) return
      opcoes.onEventoStream?.({ tipo: 'raciocinio', texto: raciocinio, origem })
    }
    const processarConteudo = (fragmento: string) => {
      if (!fragmento) return
      const { conteudo, raciocinio } = extratorThink.processar(fragmento)
      if (raciocinio) emitirRaciocinio(raciocinio, 'tag_think')
      if (conteudo) emitirConteudo(conteudo, 'delta_conteudo')
    }

    // Check if active provider supports streaming
    const provider = this.activeProvider
    if (typeof provider.streamAnalisarImagem === 'function') {
      console.log('[AIService] Using streaming for image analysis')
      await provider.streamAnalisarImagem(
        pergunta,
        dataUrl,
        (chunk) => processarConteudo(chunk),
        {
          ...opcoes,
          onEventoStream: (evento) => {
            if (!evento?.texto) return
            if (evento.tipo === 'raciocinio') {
              emitirRaciocinio(evento.texto, evento.origem || 'delta_raciocinio')
              return
            }
            processarConteudo(evento.texto)
          }
        }
      )

      const restante = extratorThink.finalizar()
      if (restante.raciocinio) emitirRaciocinio(restante.raciocinio, 'tag_think')
      if (restante.conteudo) emitirConteudo(restante.conteudo, 'delta_conteudo')
      return
    }

    // Fallback to non-streaming
    console.log('[AIService] Fallback to non-streaming image analysis')
    const result = await provider.analisarImagem(pergunta, dataUrl, opcoes)
    processarConteudo(result)
    const restante = extratorThink.finalizar()
    if (restante.raciocinio) emitirRaciocinio(restante.raciocinio, 'tag_think')
    if (restante.conteudo) emitirConteudo(restante.conteudo, 'delta_conteudo')
  }

  async analyze(texto: string): Promise<string> {
    const mensagens: MensagemChat[] = [
      { role: 'system', content: 'Você é uma assistente clara. Resuma a transcrição a seguir em português.' },
      { role: 'user', content: texto }
    ]
    return this.activeProvider.chat(mensagens)
  }

  async transformarTexto(texto: string, acao: AcaoTexto, tom: TomTexto = 'formal'): Promise<string> {
    const descricao = {
      corrigir: 'Corrija gramática, ortografia e pontuação, mantendo o tom original.',
      markdown: 'Reescreva aplicando Markdown sem alterar o sentido.',
      resumir: 'Resuma o texto em frases curtas e claras.',
      detalhar: 'Detalhe o texto, expandindo ideias sem divagar.',
      reescrever: `Reescreva o texto com tom ${tom}, preservando intenção.`
    }

    const mensagens: MensagemChat[] = [
      { role: 'system', content: 'Você é um assistente de revisão. Retorne apenas o texto final.' },
      { role: 'user', content: `Ação: ${descricao[acao]}\n\nTexto:\n${texto}` }
    ]

    return this.activeProvider.chat(mensagens)
  }
}
