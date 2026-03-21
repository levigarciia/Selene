export * from './ai/types'
import type { AIConfig, AcaoTexto, MensagemChat, ProvedorID, TomTexto } from './ai/types'
import type { AIProvider } from './ai/AIProvider'
import type { OpcoesRequisicaoIA } from './ai/AIProvider'
import { OpenAIProvider } from './ai/providers/OpenAIProvider'
import { GeminiProvider } from './ai/providers/GeminiProvider'
import { OpenRouterProvider } from './ai/providers/OpenRouterProvider'
import { LMStudioProvider } from './ai/providers/LMStudioProvider'

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

  async chat(
    texto: string,
    systemPrompt: string = 'Você é uma assistente útil chamada Selene.',
    history: { role: 'user' | 'assistant', content: string }[] = [],
    opcoes: OpcoesRequisicaoIA = {}
  ): Promise<string> {
    const mensagens: MensagemChat[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: texto }
    ]
    return this.activeProvider.chat(mensagens, opcoes)
  }

  async streamChat(
    texto: string,
    onChunk: (chunk: string) => void,
    systemPrompt: string = 'Você é uma assistente útil chamada Selene.',
    history: { role: 'user' | 'assistant', content: string }[] = [],
    opcoes: OpcoesRequisicaoIA = {}
  ): Promise<void> {
    const mensagens: MensagemChat[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: texto }
    ]
    return this.activeProvider.streamChat(mensagens, onChunk, opcoes)
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
    
    // Check if active provider supports streaming
    const provider = this.activeProvider
    if (typeof provider.streamAnalisarImagem === 'function') {
      console.log('[AIService] Using streaming for image analysis')
      return provider.streamAnalisarImagem(pergunta, dataUrl, onChunk, opcoes)
    }
    
    // Fallback to non-streaming
    console.log('[AIService] Fallback to non-streaming image analysis')
    const result = await provider.analisarImagem(pergunta, dataUrl, opcoes)
    onChunk(result)
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
