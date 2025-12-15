import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import FloatingModal from './components/FloatingModal'
import BottomToolbar from './components/BottomToolbar'
import AssistentesModal from './components/AssistentesModal'
import ModalConfiguracoes from './components/ModalConfiguracoes'
import Toast from './components/Toast'
import { ASSISTENTES_PADRAO } from './utils/assistentesPadrao'
import type { AssistenteConfig } from './utils/assistentesPadrao'
import { useAI } from './hooks/useAI'
import { useAudio } from './hooks/useAudio'
import { useShortcuts } from './hooks/useShortcuts'
import { useWindowManagement } from './hooks/useWindowManagement'
import { useAutoDismiss } from './hooks/useAutoDismiss'
import { useUserProfile } from './hooks/useUserProfile'
import type { ChatMessage } from './types/chat'
import { v4 as uuidv4 } from 'uuid'
import ChatWindow from './components/ChatWindow'

function App() {
  const [isChatMode, setIsChatMode] = useState(window.location.hash === '#chat')

  useEffect(() => {
    const checkHash = () => setIsChatMode(window.location.hash === '#chat')
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  if (isChatMode) {
    return <ChatWindow />
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showPreview, setShowPreview] = useState(true)
  const [mostrarAssistentes, setMostrarAssistentes] = useState(false)
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false)
  const [toast, setToast] = useState<{ mensagem: string; tipo?: 'info' | 'erro' } | null>(null)
  const [debugInteractive, setDebugInteractive] = useState(false)
  const [perguntaScreenshot, setPerguntaScreenshot] = useState('')
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const toastTimeoutRef = useRef<number | null>(null)

  const [assistentes, setAssistentes] = useState<AssistenteConfig[]>(() => {
    const salvo = localStorage.getItem('selene_assistentes')
    if (salvo) {
      try {
        return JSON.parse(salvo) as AssistenteConfig[]
      } catch {
        return ASSISTENTES_PADRAO
      }
    }
    return ASSISTENTES_PADRAO
  })

  const [assistenteSelecionadoId, setAssistenteSelecionadoId] = useState(
    () => localStorage.getItem('selene_assistente_ativo') || ASSISTENTES_PADRAO[0].id
  )

  const {
    apiKey, setApiKey,
    geminiKey, setGeminiKey,
    openRouterKey, setOpenRouterKey,
    modeloOpenRouter, setModeloOpenRouter,
    modeloLmStudio, setModeloLmStudio,
    baseUrlLmStudio, setBaseUrlLmStudio,
    provedorAtivo, setProvedorAtivo,
    systemPrompt, setSystemPrompt,
    aiService,
    criarOuObterServico
  } = useAI()

  const {
    profile, setProfile, memories,
    addMemory, removeMemory, getProfileContext
  } = useUserProfile()

  const {
    isRecording, transcription, setTranscription, toggleRecording
  } = useAudio(aiService)

  const exibirToast = useCallback((mensagem: string, tipo: 'info' | 'erro' = 'info') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    setToast({ mensagem, tipo })
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const adicionarMensagem = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now()
    }])
  }

  const perguntasPendentesRef = useRef<boolean>(false)

  const perguntarComScreenshot = useCallback(
    async (pergunta?: string) => {
      console.log('[screenshot] iniciar fluxo')
      const servico = criarOuObterServico()
      if (!servico) {
        exibirToast('Configure uma chave de API ou LM Studio para usar imagem.', 'erro')
        return
      }

      const promptPergunta =
        (pergunta || perguntaScreenshot || '').trim() || 'Descreva a imagem e responda em portugues.'

      if (!window.electronAPI?.capturarScreenshot) {
        exibirToast('Captura de tela indisponivel no preload.', 'erro')
        console.warn('[screenshot] electronAPI.capturarScreenshot ausente')
        return
      }

      exibirToast('Capturando screenshot...')
      setPerguntaScreenshot(promptPergunta)
      adicionarMensagem('user', `[Screenshot] ${promptPergunta}`)

      perguntasPendentesRef.current = true

      try {
        const dataUrl = await window.electronAPI?.capturarScreenshot?.()
        if (!dataUrl) {
          perguntasPendentesRef.current = false
          exibirToast('Nao consegui capturar a tela.', 'erro')
          return
        }
        const resposta = await servico.analisarImagem(promptPergunta, dataUrl)
        adicionarMensagem('assistant', resposta)
        perguntasPendentesRef.current = false
        setShowPreview(true)
      } catch (error: any) {
        console.error('Erro ao analisar imagem', error)
        perguntasPendentesRef.current = false
        exibirToast(error?.message || 'Falha ao analisar imagem.', 'erro')
      }
    },
    [exibirToast, perguntaScreenshot, criarOuObterServico]
  )

  const {
    atalhoGramatical, setAtalhoGramatical,
    atalhoScreenshot, setAtalhoScreenshot
  } = useShortcuts(
    () => { }, // A janela independente captura o evento agora
    () => perguntarComScreenshot(),
    (msg) => exibirToast(msg)
  )

  useEffect(() => {
    localStorage.setItem('selene_assistentes', JSON.stringify(assistentes))
  }, [assistentes])

  useEffect(() => {
    localStorage.setItem('selene_assistente_ativo', assistenteSelecionadoId)
  }, [assistenteSelecionadoId])

  const salvarAssistente = (assistente: AssistenteConfig) => {
    setAssistentes((lista) => lista.map((item) => (item.id === assistente.id ? assistente : item)))
  }

  const adicionarAssistente = (assistente: AssistenteConfig) => {
    setAssistentes((lista) => [...lista, assistente])
  }

  const removerAssistente = (assistenteId: string) => {
    setAssistentes((lista) => {
      const filtrados = lista.filter((item) => item.id !== assistenteId)
      if (!filtrados.length) {
        setAssistenteSelecionadoId(ASSISTENTES_PADRAO[0].id)
        setSystemPrompt(ASSISTENTES_PADRAO[0].prompt)
        return ASSISTENTES_PADRAO
      }
      if (assistenteSelecionadoId === assistenteId) {
        const novoSelecionado = filtrados[0]
        setAssistenteSelecionadoId(novoSelecionado.id)
        setSystemPrompt(novoSelecionado.prompt)
      }
      return filtrados
    })
  }

  const aplicarAssistenteNaSessao = (assistente: AssistenteConfig) => {
    setAssistenteSelecionadoId(assistente.id)
    setSystemPrompt(assistente.prompt)
  }

  const restaurarPadroes = () => {
    setAssistentes(ASSISTENTES_PADRAO)
    setAssistenteSelecionadoId(ASSISTENTES_PADRAO[0].id)
    setSystemPrompt(ASSISTENTES_PADRAO[0].prompt)
  }

  const handleChat = async () => {
    const servico = criarOuObterServico()
    if (!servico) {
      exibirToast('Informe uma chave de API valida (OpenAI, OpenRouter, Gemini ou LM Studio).', 'erro')
      return
    }
    const texto = transcription.trim()
    if (!texto) return

    adicionarMensagem('user', texto)
    setTranscription('')
    perguntasPendentesRef.current = true

    try {
      const enhancedPrompt = systemPrompt + getProfileContext()
      const result = await servico.chat(texto, enhancedPrompt, messages)
      adicionarMensagem('assistant', result)
    } catch (e: any) {
      const mensagem = e?.message || 'Falha ao enviar'
      exibirToast(mensagem, 'erro')
      adicionarMensagem('assistant', `⚠️ Erro: ${mensagem}`)
    } finally {
      perguntasPendentesRef.current = false
    }
  }

  const handleAnalyze = async () => {
    const servico = criarOuObterServico()
    if (!servico) {
      exibirToast('Informe uma chave de API valida (OpenAI, OpenRouter, Gemini ou LM Studio).', 'erro')
      return
    }
    const texto = transcription.trim()
    if (!texto) return

    adicionarMensagem('user', `[Analise] ${texto}`)
    setTranscription('')
    perguntasPendentesRef.current = true

    try {
      const result = await servico.analyze(texto)
      adicionarMensagem('assistant', result)
    } catch (e: any) {
      const mensagem = e?.message || 'Falha ao analisar'
      exibirToast(mensagem, 'erro')
      adicionarMensagem('assistant', `⚠️ Erro: ${mensagem}`)
    } finally {
      perguntasPendentesRef.current = false
    }
  }

  const houveInteracaoRecentemente = messages.length > 0
  const transcricaoTemConteudo = transcription.trim().length > 0

  const deveExibirModalFlutuante = isRecording || transcricaoTemConteudo || houveInteracaoRecentemente
  const algumaJanelaAberta = mostrarAssistentes || mostrarConfiguracoes

  const {
    modalRef,
    toolbarRef,
    assistentesRef,
    configuracoesRef,
    menuDropdownRef
  } = useWindowManagement([
    mostrarAssistentes,
    mostrarConfiguracoes,
    false,
    deveExibirModalFlutuante
  ])

  useEffect(() => {
    if (algumaJanelaAberta) {
      window.electronAPI?.setIgnoreMouseEvents(false)
    }
  }, [algumaJanelaAberta])

  useEffect(() => {
    window.electronAPI?.onDebugToggle(setDebugInteractive)
  }, [])

  useEffect(() => {
    const removeListener = window.electronAPI?.onCollapseToolbar?.(() => {
      setToolbarCollapsed(true)
    })
    return () => removeListener?.()
  }, [])

  const fecharAplicacao = () => window.close()

  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (transcricaoTemConteudo || perguntasPendentesRef.current) {
      setDismissed(false)
    }
  }, [transcricaoTemConteudo])

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'assistant') {
        setDismissed(false)
      }
    }
  }, [messages])

  useAutoDismiss(deveExibirModalFlutuante && !dismissed, 30000, () => {
    setDismissed(true)
  })

  return (
    <div className={`h-screen w-screen relative overflow-hidden transition-colors duration-200 ${debugInteractive ? 'bg-black/20' : 'bg-transparent'} pointer-events-none`}>
      <AnimatePresence>
        {deveExibirModalFlutuante && !dismissed && (
          <FloatingModal
            key="floating-modal"
            ref={modalRef}
            transcription={transcription}
            messages={messages}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            onClose={() => {
              setDismissed(true)
              setMessages([])
              setTranscription('')
            }}
          />
        )}
      </AnimatePresence>

      <BottomToolbar
        ref={toolbarRef}
        isRecording={isRecording}
        toggleRecording={toggleRecording}
        transcription={transcription}
        setTranscription={setTranscription}
        handleChat={handleChat}
        handleAnalyze={handleAnalyze}
        aoPerguntarScreenshot={() => perguntarComScreenshot()}
        aoAbrirAssistentes={() => setMostrarAssistentes(true)}
        aoAbrirAssistenteGramatical={() => window.electronAPI?.abrirAssistenteGramatical?.()}
        aoAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
        aoAbrirChatWindow={() => window.electronAPI?.openExpandedChat?.(messages)}
        aoFecharAplicacao={fecharAplicacao}
        menuDropdownRef={menuDropdownRef}
        initialCollapsed={toolbarCollapsed}
      />

      <AssistentesModal
        ref={assistentesRef}
        aberto={mostrarAssistentes}
        aoFechar={() => setMostrarAssistentes(false)}
        assistentes={assistentes}
        assistenteSelecionadoId={assistenteSelecionadoId}
        aoSelecionar={setAssistenteSelecionadoId}
        aoSalvar={salvarAssistente}
        aoAdicionar={adicionarAssistente}
        aoRemover={removerAssistente}
        aoAplicar={aplicarAssistenteNaSessao}
        aoRestaurarPadrao={restaurarPadroes}
      />

      <ModalConfiguracoes
        ref={configuracoesRef}
        aberto={mostrarConfiguracoes}
        aoFechar={() => setMostrarConfiguracoes(false)}
        apiKey={apiKey}
        geminiKey={geminiKey}
        modeloOpenRouter={modeloOpenRouter}
        modeloLmStudio={modeloLmStudio}
        baseUrlLmStudio={baseUrlLmStudio}
        aoAlterarApiKey={setApiKey}
        aoAlterarGeminiKey={setGeminiKey}
        openRouterKey={openRouterKey}
        aoAlterarOpenRouterKey={setOpenRouterKey}
        aoAlterarModeloOpenRouter={setModeloOpenRouter}
        aoAlterarModeloLmStudio={setModeloLmStudio}
        aoAlterarBaseUrlLmStudio={setBaseUrlLmStudio}
        provedorAtivo={provedorAtivo}
        aoAlterarProvedorAtivo={setProvedorAtivo}
        mostrarPreview={showPreview}
        aoAlternarPreview={setShowPreview}
        atalhoGramatical={atalhoGramatical}
        atalhoScreenshot={atalhoScreenshot}
        aoAlterarAtalho={setAtalhoGramatical}
        aoAlterarAtalhoScreenshot={setAtalhoScreenshot}
        profile={profile}
        aoAlterarProfile={setProfile}
        memories={memories}
        aoAdicionarMemoria={addMemory}
        aoRemoverMemoria={removeMemory}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80]">
          <Toast mensagem={toast.mensagem} tipo={toast.tipo} />
        </div>
      )}

      {debugInteractive && (
        <div className="fixed top-0 left-0 bg-red-600 text-white text-xs px-2 py-1 z-[100] pointer-events-none">
          DEBUG MODE: CLICK ANYWHERE
        </div>
      )}
    </div>
  )
}

export default App
