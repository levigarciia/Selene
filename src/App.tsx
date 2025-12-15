import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  ChatWindow,
  FloatingModal,
  BottomToolbar,
  AssistentesModal,
  ModalConfiguracoes,
  Toast,
  ScreenshotOverlay
} from './components'
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

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [chatAberto, setChatAberto] = useState(false)
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

  const [pendingScreenshots, setPendingScreenshots] = useState<string[]>([])
  const perguntasPendentesRef = useRef<boolean>(false)

  // State for Area Screenshot
  const [isAreaMode, setIsAreaMode] = useState(false)

  const tentarEnviarParaChat = useCallback(async (dataUrl: string) => {
    try {
      const entregue = await window.electronAPI?.enviarScreenshotParaChat?.(dataUrl)
      if (entregue) {
        exibirToast('Screenshot enviada para o chat expandido.', 'info')
        setChatAberto(true)
        setToolbarCollapsed(true)
        return true
      }
    } catch (e) {
      console.warn('Falha ao enviar screenshot para chat expandido', e)
    }
    return false
  }, [exibirToast])

  const finalizarSelecaoArea = useCallback(() => {
    setIsAreaMode(false)
    setToolbarCollapsed(false)
    window.electronAPI?.setAreaSelectionMode?.(false)
  }, [])

  const handleAreaCaptureComplete = async (rect: { x: number; y: number; width: number; height: number } | null) => {
    finalizarSelecaoArea()
    if (!rect) return
    
    exibirToast('Capturando e recortando...')
    
    try {
        // 1. Capture Full Screen
        const fullDataUrl = await window.electronAPI?.capturarScreenshot?.()
        if (!fullDataUrl) {
            exibirToast('Falha na captura base.', 'erro')
            return
        }

        // 2. Crop using Canvas
        const img = new Image()
        img.onload = async () => {
            const canvas = document.createElement('canvas')
            
            const scaleX = img.width / window.innerWidth
            const scaleY = img.height / window.innerHeight
            
            canvas.width = rect.width * scaleX
            canvas.height = rect.height * scaleY
            
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            
            ctx.drawImage(
                img,
                rect.x * scaleX, rect.y * scaleY, rect.width * scaleX, rect.height * scaleY, // Source
                0, 0, canvas.width, canvas.height // Dest
            )
            
            const croppedUrl = canvas.toDataURL('image/png')
            const entregue = await tentarEnviarParaChat(croppedUrl)
            if (!entregue) {
              setPendingScreenshots((lista) => [...lista, croppedUrl])
              exibirToast('Area capturada!', 'info')
              setToolbarCollapsed(false)
            } else {
              // Se já foi direto para o chat expandido, mantém a toolbar recolhida
              setToolbarCollapsed(true)
            }
        }
        img.src = fullDataUrl

    } catch (e: any) {
        console.error('Erro no crop', e)
        exibirToast('Erro ao processar área.', 'erro')
    } finally {
        // Reforça a saída do modo área mesmo em caso de erro
        finalizarSelecaoArea()
    }
  }


  // Effect for Screenshot Area Shortcut
  useEffect(() => {
    if (!window.electronAPI?.onAtalhoScreenshotArea) return
    const cleanup = window.electronAPI.onAtalhoScreenshotArea(() => {
        if (isAreaMode) return // Evita reentrância
        console.log('[App] Atalho de area recebido')
        // Force window to be interactive
        window.electronAPI?.setIgnoreMouseEvents(false)
        window.electronAPI?.requestWindowFocus?.()
        window.electronAPI?.setAreaSelectionMode?.(true)
        // Reforços para evitar voltar ao pass-through
        window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 30)
        window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 120)
        
        setToolbarCollapsed(true) 
        setIsAreaMode(true)
    })
    return cleanup
  }, [isAreaMode])

  const perguntarComScreenshot = useCallback(
    async () => {
      console.log('[screenshot] iniciar captura')
      
      if (!window.electronAPI?.capturarScreenshot) {
        exibirToast('Captura de tela indisponivel no preload.', 'erro')
        return
      }

      exibirToast('Capturando screenshot...')
      // Ensure UI is visible
      setToolbarCollapsed(false) 

      try {
        const dataUrl = await window.electronAPI.capturarScreenshot()
        if (!dataUrl) {
            exibirToast('Nao consegui capturar a tela.', 'erro')
          return
        }
        const entregue = await tentarEnviarParaChat(dataUrl)
        if (!entregue) {
          setPendingScreenshots((lista) => [...lista, dataUrl])
          exibirToast('Screenshot capturado! Digite sua pergunta.', 'info')
          setToolbarCollapsed(false)
        } else {
          // Enviou direto pro chat expandido, mantemos a toolbar recolhida
          setToolbarCollapsed(true)
        }
      } catch (error: any) {
        console.error('Erro ao capturar screenshot', error)
        exibirToast('Falha ao capturar screenshot.', 'erro')
      }
    },
    [exibirToast, tentarEnviarParaChat]
  )

  const handleChat = async () => {
    const servico = criarOuObterServico()
    if (!servico) {
      exibirToast('Informe uma chave de API valida (OpenAI, OpenRouter, Gemini ou LM Studio).', 'erro')
      return
    }
    const texto = transcription.trim()

    const juntarScreenshots = async (imagens: string[]) => {
      if (imagens.length === 1) return imagens[0]
      const carregadas = await Promise.all(imagens.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = (e) => reject(e)
        im.src = src
      })))
      const largura = Math.max(...carregadas.map(im => im.width))
      const altura = carregadas.reduce((acc, im) => acc + im.height, 0)
      const canvas = document.createElement('canvas')
      canvas.width = largura
      canvas.height = altura
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      let offsetY = 0
      carregadas.forEach((im) => {
        ctx.drawImage(im, 0, offsetY, im.width, im.height)
        offsetY += im.height
      })
      return canvas.toDataURL('image/png')
    }
    
    // Se temos screenshots, permitimos texto vazio (usa prompt default) ou texto informado
    if (pendingScreenshots.length > 0) {
       const prompt = texto || 'Descreva a imagem e responda em português.'
       const imagemUnica = await juntarScreenshots(pendingScreenshots)
       if (!imagemUnica) {
        exibirToast('Falha ao preparar imagens.', 'erro')
        return
       }
       adicionarMensagem('user', `[Screenshot] ${prompt}`)
       setTranscription('')
       setPendingScreenshots([]) // Limpa pendências locais
       perguntasPendentesRef.current = true
       setIsGenerating(true)

       const aiMsgId = uuidv4()
       setMessages(prev => [...prev, {
         id: aiMsgId,
         role: 'assistant',
         content: '',
         timestamp: Date.now()
       }])

       try {
           const resposta = await servico.analisarImagem(prompt, imagemUnica)
           setMessages(prev => prev.map(msg => 
               msg.id === aiMsgId ? { ...msg, content: resposta } : msg
           ))
           setShowPreview(true)
       } catch (error: any) {
           console.error('Erro ao analisar imagem', error)
           exibirToast(error?.message || 'Falha ao analisar imagem.', 'erro')
           setMessages(prev => prev.map(msg => 
               msg.id === aiMsgId ? { ...msg, content: `⚠️ Erro: ${error?.message}` } : msg
           ))
       } finally {
           perguntasPendentesRef.current = false
           setIsGenerating(false)
       }
       return
    }

    if (!texto) return

    adicionarMensagem('user', texto)
    setTranscription('')
    perguntasPendentesRef.current = true
    setIsGenerating(true)

    // Placeholder message for streaming
    const aiMsgId = uuidv4()
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }])

    let streamedContent = ''

    try {
      const enhancedPrompt = systemPrompt + getProfileContext()
      
      await servico.streamChat(
        texto,
        (chunk: string) => {
          streamedContent += chunk
          setMessages(prev => prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, content: streamedContent } : msg
          ))
        },
        enhancedPrompt,
        messages
      )
    } catch (e: any) {
      const mensagem = e?.message || 'Falha ao enviar'
      exibirToast(mensagem, 'erro')
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, content: `⚠️ Erro: ${mensagem}` } : msg
      ))
    } finally {
      perguntasPendentesRef.current = false
      setIsGenerating(false)
    }
  }

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

  const {
    atalhoGramatical, setAtalhoGramatical,
    atalhoScreenshot, setAtalhoScreenshot
  } = useShortcuts(
    () => { },
    () => perguntarComScreenshot(),
    (msg) => exibirToast(msg)
  )

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
      adicionarMensagem('assistant', `[Erro] ${mensagem}`)
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
      setChatAberto(false)
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
      <ScreenshotOverlay
        isActive={isAreaMode}
        onComplete={handleAreaCaptureComplete}
        onCancel={() => {
            finalizarSelecaoArea()
        }}
      />
      
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
            isGenerating={isGenerating}
          />
        )}
      </AnimatePresence>

      {!isAreaMode && !chatAberto && (
        <BottomToolbar
          ref={toolbarRef}
          isRecording={isRecording}
          toggleRecording={toggleRecording}
          transcription={transcription}
          setTranscription={setTranscription}
          handleChat={handleChat}
          handleAnalyze={handleAnalyze}
          aoPerguntarScreenshot={() => perguntarComScreenshot()}
          pendingScreenshots={pendingScreenshots}
          onDeleteScreenshot={(idx) => setPendingScreenshots((lista) => lista.filter((_, i) => i !== idx))}
          aoAbrirAssistentes={() => setMostrarAssistentes(true)}
          aoAbrirAssistenteGramatical={() => window.electronAPI?.abrirAssistenteGramatical?.()}
          aoAbrirConfiguracoes={() => setMostrarConfiguracoes(true)}
          aoAbrirChatWindow={() => {
            setChatAberto(true)
            setToolbarCollapsed(true)
            window.electronAPI?.openExpandedChat?.(messages)
          }}
          aoFecharAplicacao={fecharAplicacao}
          menuDropdownRef={menuDropdownRef}
          initialCollapsed={toolbarCollapsed}
          forceCollapse={toolbarCollapsed}
        />
      )}

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
