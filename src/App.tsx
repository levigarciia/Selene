import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  ChatWindow,
  FloatingModal,
  OverlayProativoModal,
  BottomToolbar,
  AssistentesModal,
  ModalConfiguracoes,
  Toast,
  ScreenshotOverlay
} from './components'
import { ASSISTENTES_PADRAO } from './utils/assistentesPadrao'
import type { AssistenteConfig } from './utils/assistentesPadrao'
import { useAppConfig } from './hooks/useAppConfig'
import { useOverlayProativo } from './hooks/useOverlayProativo'
import { useWindowManagement } from './hooks/useWindowManagement'
import { useAutoDismiss } from './hooks/useAutoDismiss'
import type { ChatMessage } from './types/chat'
import { v4 as uuidv4 } from 'uuid'
import { initializeBuiltInTools } from './services/tools/builtin'
import { mcpToolBridge } from './services/tools/MCPToolBridge'
import { toolCallingService, type EstrategiaDecisaoTool } from './services/tools/ToolCallingService'
import { toolRegistry } from './services/tools/ToolRegistry'
import { obterConfiguracaoPerfilGeracao } from './services/ai/politicaGeracao'
import { prepararHistoricoMultimodalParaModelo } from './services/ai/historicoMultimodal'
import { criarMensagensExpansaoIntervencao } from './services/overlay/overlayProativo'
import { normalizarMensagemErroApi } from './utils/errosApi'

// Initialize built-in tools on app start
initializeBuiltInTools()

// Sync MCP tools from connected servers
mcpToolBridge.syncAllTools().catch(err => 
    console.warn('[App] Failed to sync MCP tools:', err)
)

function obterMensagemErro(erro: unknown, fallback: string): string {
  return normalizarMensagemErroApi(erro, fallback)
}

function AppOverlay() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showPreview, setShowPreview] = useState(true)
  const [mostrarAssistentes, setMostrarAssistentes] = useState(false)
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false)
  const [toast, setToast] = useState<{ mensagem: string; tipo?: 'info' | 'erro'; posicao?: 'padrao' | 'toolbar' } | null>(null)
  const [debugInteractive, setDebugInteractive] = useState(false)

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [chatAberto, setChatAberto] = useState(false)
  const toastTimeoutRef = useRef<number | null>(null)
  const ultimoErroWhisperRef = useRef<string | null>(null)

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

  const exibirToast = useCallback((mensagem: string, tipo: 'info' | 'erro' = 'info', posicao: 'padrao' | 'toolbar' = 'padrao') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    setToast({ mensagem, tipo, posicao })
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  // State for Area Screenshot
  const [isAreaMode, setIsAreaMode] = useState(false)
  const perguntasPendentesRef = useRef<boolean>(false)

  // ============================================
  // Centralized Config Hook
  // ============================================
  
  const appConfig = useAppConfig({
    onTriggerGrammar: () => {},
    onTriggerScreenshot: () => perguntarComScreenshot(),
    exibirToast: (msg) => exibirToast(msg),
  })
  
  const {
    // API Keys & Provider
    apiKey, setApiKey,
    geminiKey, setGeminiKey,
    openRouterKey, setOpenRouterKey,
    modeloOpenRouter, setModeloOpenRouter,
    modeloLocal, setModeloLocal,
    modeloLmStudio,
    baseUrlLmStudio, setBaseUrlLmStudio,
    provedorAtivo, setProvedorAtivo,
    perfilLatencia, setPerfilLatencia,
    systemPrompt, setSystemPrompt,
    criarOuObterServico,
    
    // Shortcuts
    atalhoGramatical, setAtalhoGramatical,
    atalhoScreenshot, setAtalhoScreenshot,
    
    // Screenshots
    pendingScreenshots, setPendingScreenshots,
    
    // Profile & Memories
    profile, setProfile,
    memories, addMemory, removeMemory,
    getProfileContext,
    
    // Voice Input
    voiceInput,
    isRecording, transcription, transcriptionConfirmada, transcriptionParcial,
    ultimaAtualizacaoTranscricaoEm, ultimaParadaGravacaoEm,
    setTranscription, toggleRecording,
    overlayProativoConfig,
    setOverlayProativoHabilitado,
    setOverlayProativoNivelIntervencao,
    setOverlayProativoSonecaAte,
  } = appConfig

  const tentarEnviarParaChat = useCallback(async (dataUrl: string) => {
    try {
      const entregue = await window.electronAPI?.enviarScreenshotParaChat?.(dataUrl)
      if (entregue) {
        exibirToast('Screenshot enviada para o chat expandido.', 'info')
        setChatAberto(true)
        setToolbarCollapsed(true)
        return true
      }
    } catch (erro) {
      console.warn('Falha ao enviar screenshot para chat expandido', erro)
    }
    return false
  }, [exibirToast])

  const perguntarComScreenshot = useCallback(
    async () => {
      console.log('[screenshot] iniciar captura')
      
      if (!window.electronAPI?.capturarScreenshot) {
        exibirToast('Captura de tela indisponivel no preload.', 'erro')
        return
      }

      exibirToast('Capturando screenshot...')
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
          setToolbarCollapsed(true)
        }
      } catch (erro) {
        console.error('Erro ao capturar screenshot', erro)
        exibirToast('Falha ao capturar screenshot.', 'erro')
      }
    },
    [exibirToast, setPendingScreenshots, tentarEnviarParaChat]
  )

  useEffect(() => {
    if (!voiceInput.error) {
      ultimoErroWhisperRef.current = null
      return
    }
    if (voiceInput.error !== ultimoErroWhisperRef.current) {
      ultimoErroWhisperRef.current = voiceInput.error
      exibirToast(voiceInput.error, 'erro', 'toolbar')
    }
  }, [voiceInput.error, exibirToast])

  useEffect(() => {
    const chatFn = async (prompt: string, systemPrompt?: string): Promise<string> => {
      const servico = criarOuObterServico()
      if (!servico) throw new Error('No AI service available')

      const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { forcarPerfil: 'pergunta_curta' })
      let response = ''
      await servico.streamChat(
        prompt,
        (chunk: string) => { response += chunk },
        systemPrompt !== undefined ? systemPrompt : 'Você é um assistente de pesquisa. Responda de forma objetiva e estruturada.',
        [],
        {
          temperature: configGeracao.temperature,
        }
      )
      return response
    }

    toolCallingService.setChatFunction(chatFn)
  }, [criarOuObterServico])

  const contextoPerfilUsuario = getProfileContext()
  const overlayProativoPausado = chatAberto || isAreaMode || mostrarAssistentes || mostrarConfiguracoes
  const {
    intervencao: intervencaoOverlay,
    dispensarIntervencao,
    sonecarIntervencao,
    limparIntervencao,
  } = useOverlayProativo({
    configuracao: overlayProativoConfig,
    atualizarSonecaAte: setOverlayProativoSonecaAte,
    transcription,
    transcriptionConfirmada,
    transcriptionParcial,
    ultimaAtualizacaoTranscricaoEm,
    ultimaParadaGravacaoEm,
    isRecording,
    messages,
    pausadoExternamente: overlayProativoPausado,
    criarOuObterServico,
    perfilLatencia,
    contextoPerfilUsuario,
  })

  const abrirChatExpandido = useCallback((mensagens: ChatMessage[]) => {
    setChatAberto(true)
    setToolbarCollapsed(true)
    window.electronAPI?.openExpandedChat?.(mensagens)
  }, [])

  const adicionarMensagem = (role: 'user' | 'assistant', content: string, images?: string[]) => {
    setMessages(prev => [...prev, {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
      images
    }])
  }

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
      const fullDataUrl = await window.electronAPI?.capturarScreenshot?.()
      if (!fullDataUrl) {
        exibirToast('Falha na captura base.', 'erro')
        return
      }

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
          rect.x * scaleX, rect.y * scaleY, rect.width * scaleX, rect.height * scaleY,
          0, 0, canvas.width, canvas.height
        )
        
        const croppedUrl = canvas.toDataURL('image/png')
        const entregue = await tentarEnviarParaChat(croppedUrl)
        if (!entregue) {
          setPendingScreenshots((lista) => [...lista, croppedUrl])
          exibirToast('Area capturada!', 'info')
          setToolbarCollapsed(false)
        } else {
          setToolbarCollapsed(true)
        }
      }
      img.src = fullDataUrl

    } catch (erro) {
      console.error('Erro no crop', erro)
      exibirToast('Erro ao processar área.', 'erro')
    } finally {
      finalizarSelecaoArea()
    }
  }

  // Effect for Screenshot Area Shortcut
  useEffect(() => {
    if (!window.electronAPI?.onAtalhoScreenshotArea) return
    const cleanup = window.electronAPI.onAtalhoScreenshotArea(() => {
      if (isAreaMode) return
      console.log('[App] Atalho de area recebido')
      window.electronAPI?.setIgnoreMouseEvents(false)
      window.electronAPI?.requestWindowFocus?.()
      window.electronAPI?.setAreaSelectionMode?.(true)
      window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 30)
      window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 120)
      
      setToolbarCollapsed(true) 
      setIsAreaMode(true)
    })
    return cleanup
  }, [isAreaMode])

  const handleChat = async () => {
    const servico = criarOuObterServico()
    if (!servico) {
      exibirToast('Informe uma chave de API valida ou configure o host local.', 'erro')
      return
    }
    const texto = transcription.trim()
    limparIntervencao()

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
    
    if (pendingScreenshots.length > 0) {
      const prompt = texto || 'Descreva a imagem e responda em português.'
      const imagemUnica = await juntarScreenshots(pendingScreenshots)
      if (!imagemUnica) {
        exibirToast('Falha ao preparar imagens.', 'erro')
        return
      }
      adicionarMensagem('user', `[Screenshot] ${prompt}`, [...pendingScreenshots])
      setTranscription('')
      setPendingScreenshots([])
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
        const configGeracaoImagem = obterConfiguracaoPerfilGeracao(prompt, { ehImagem: true })
        const historicoImagem = prepararHistoricoMultimodalParaModelo(
          messages,
          provedorAtivo === 'local' && perfilLatencia === 'rapido' ? 420 : 500,
          {
            consultaAtual: prompt,
            perfilLatencia,
          }
        )
        const resposta = await servico.analisarImagem(prompt, imagemUnica, {
          temperature: configGeracaoImagem.temperature,
          perfilLatencia,
          historico: historicoImagem,
        })
        setMessages(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, content: resposta } : msg
        ))
        setShowPreview(true)
      } catch (erro) {
        const mensagemErro = obterMensagemErro(erro, 'Falha ao analisar imagem.')
        console.error('Erro ao analisar imagem', erro)
        exibirToast(mensagemErro, 'erro')
        setMessages(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, content: `⚠️ Erro: ${mensagemErro}` } : msg
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

    const aiMsgId = uuidv4()
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }])

    let streamedContent = ''

    try {
      let contextoFerramentas = ''
      const toolCallingAtivo = localStorage.getItem('selene_tool_calling') !== 'false'
      const historicoParaModelo = prepararHistoricoMultimodalParaModelo(
        messages,
        provedorAtivo === 'local' && perfilLatencia === 'rapido' ? 420 : 500,
        {
          consultaAtual: texto,
          perfilLatencia,
        }
      )

      if (toolCallingAtivo) {
        // Sincroniza em segundo plano para não bloquear a thread síncrona de envio (evita latência IPC e reduz TTFT)
        mcpToolBridge.syncAllTools().catch((error) => {
          console.warn('[App] Falha ao sincronizar MCP em segundo plano:', error)
        })

        const ferramentasDisponiveis = toolRegistry.getEnabled()

        if (ferramentasDisponiveis.length > 0) {
          // Determina as políticas de latência e decisão para a barra flutuante baseadas no perfil ativo
          let timeoutMs = 0
          let timeoutQueryMs = 0
          let maxBuscasWebPorMensagem = 2
          let estrategiaDecisao: EstrategiaDecisaoTool = 'ai_fallback'
          let pularPlanejamentoWebIA = false

          if (provedorAtivo === 'local' && perfilLatencia === 'rapido') {
            estrategiaDecisao = 'heuristic_only'
            timeoutMs = 0
            timeoutQueryMs = 0
            maxBuscasWebPorMensagem = 1
            pularPlanejamentoWebIA = true
          } else if (provedorAtivo === 'local' && perfilLatencia === 'equilibrado') {
            estrategiaDecisao = 'ai_fallback'
            timeoutMs = 1500
            timeoutQueryMs = 1200
            maxBuscasWebPorMensagem = 2
            pularPlanejamentoWebIA = false
          } else {
            // Perfil equilibrado ou nuvem
            estrategiaDecisao = 'ai_fallback'
            timeoutMs = 2500
            timeoutQueryMs = 1500
            maxBuscasWebPorMensagem = 2
            pularPlanejamentoWebIA = false
          }

          const decisao = await toolCallingService.decideToolUsage(
            texto,
            historicoParaModelo,
            ferramentasDisponiveis,
            {
              estrategiaDecisao,
              timeoutMs,
              timeoutQueryMs,
              maxBuscasWebPorMensagem,
              pularPlanejamentoWebIA,
            }
          )

          if (decisao.shouldUseTool && decisao.toolCalls.length > 0) {
            const statusMessage = await toolCallingService.generateStatusMessage(
              texto,
              decisao.toolCalls
            )

            if (statusMessage) {
              setMessages(prev => prev.map(msg =>
                msg.id === aiMsgId ? { ...msg, content: statusMessage } : msg
              ))
            }

            const calls = await toolCallingService.executeToolCalls(decisao)
            contextoFerramentas = toolCallingService.formatResultsForAI(calls)
          }
        }
      }

      const enhancedPrompt = systemPrompt + getProfileContext() + contextoFerramentas
      const configGeracaoChat = obterConfiguracaoPerfilGeracao(texto)
      
      await servico.streamChat(
        texto,
        (chunk: string) => {
          streamedContent += chunk
          setMessages(prev => prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, content: streamedContent } : msg
          ))
        },
        enhancedPrompt,
        historicoParaModelo,
        {
          temperature: configGeracaoChat.temperature,
          perfilLatencia,
        }
      )
    } catch (erro) {
      const mensagem = obterMensagemErro(erro, 'Falha ao enviar')
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

  const handleAnalyze = async () => {
    const servico = criarOuObterServico()
    if (!servico) {
      exibirToast('Informe uma chave de API valida ou configure o host local.', 'erro')
      return
    }
    const texto = transcription.trim()
    if (!texto) return
    limparIntervencao()

    adicionarMensagem('user', `[Analise] ${texto}`)
    setTranscription('')
    perguntasPendentesRef.current = true

    try {
      const result = await servico.analyze(texto)
      adicionarMensagem('assistant', result)
    } catch (erro) {
      const mensagem = obterMensagemErro(erro, 'Falha ao analisar')
      exibirToast(mensagem, 'erro')
      adicionarMensagem('assistant', `[Erro] ${mensagem}`)
    } finally {
      perguntasPendentesRef.current = false
    }
  }

  const houveInteracaoRecentemente = messages.length > 0
  const transcricaoTemConteudo = transcription.trim().length > 0

  const deveExibirModalFlutuante = isRecording || transcricaoTemConteudo || houveInteracaoRecentemente
  const deveExibirOverlayProativo = Boolean(
    intervencaoOverlay
    && !chatAberto
    && !isAreaMode
    && !mostrarAssistentes
    && !mostrarConfiguracoes
    && (intervencaoOverlay.status === 'respondendo' || intervencaoOverlay.status === 'pronto')
  )
  const algumaJanelaAberta = mostrarAssistentes || mostrarConfiguracoes

  const {
    modalRef,
    overlayProativoRef,
    toolbarRef,
    assistentesRef,
    configuracoesRef,
    menuDropdownRef
  } = useWindowManagement([
    mostrarAssistentes,
    mostrarConfiguracoes,
    deveExibirModalFlutuante,
    deveExibirOverlayProativo
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

  const expandirIntervencaoOverlay = useCallback(() => {
    if (!intervencaoOverlay) return

    const mensagensHidratadas = criarMensagensExpansaoIntervencao({
      messages,
      resumo: intervencaoOverlay.resumo,
      resposta: intervencaoOverlay.resposta,
      textoContexto: transcription.trim() || transcriptionParcial.trim() || transcriptionConfirmada.trim(),
    })

    limparIntervencao()
    abrirChatExpandido(mensagensHidratadas)
  }, [
    abrirChatExpandido,
    intervencaoOverlay,
    limparIntervencao,
    messages,
    transcription,
    transcriptionConfirmada,
    transcriptionParcial,
  ])

  return (
    <div className={`h-screen w-screen relative overflow-hidden transition-colors duration-200 ${debugInteractive ? 'bg-black/20' : 'bg-transparent'} pointer-events-none`}>
      {isAreaMode && (
        <ScreenshotOverlay
          isActive={isAreaMode}
          onComplete={handleAreaCaptureComplete}
          onCancel={() => {
            finalizarSelecaoArea()
          }}
        />
      )}
      
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

      <OverlayProativoModal
        ref={overlayProativoRef}
        intervencao={deveExibirOverlayProativo ? intervencaoOverlay : null}
        onExpandir={expandirIntervencaoOverlay}
        onDispensar={() => {
          dispensarIntervencao()
        }}
        onSonecar={() => {
          sonecarIntervencao()
          exibirToast('Overlay inteligente em soneca por 15 minutos.', 'info')
        }}
      />

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
            abrirChatExpandido(messages)
          }}
          aoExpandirToolbar={() => {
            setToolbarCollapsed(false)
          }}
          aoFecharAplicacao={fecharAplicacao}
          menuDropdownRef={menuDropdownRef}
          initialCollapsed={toolbarCollapsed}
          forceCollapse={toolbarCollapsed ? true : undefined}
          nivelAudio={voiceInput.nivelAudio}
          barrasAudio={voiceInput.barrasAudio}
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
        modeloLmStudio={modeloLocal || modeloLmStudio}
        baseUrlLmStudio={baseUrlLmStudio}
        perfilLatencia={perfilLatencia}
        aoAlterarApiKey={setApiKey}
        aoAlterarGeminiKey={setGeminiKey}
        openRouterKey={openRouterKey}
        aoAlterarOpenRouterKey={setOpenRouterKey}
        aoAlterarModeloOpenRouter={setModeloOpenRouter}
        aoAlterarModeloLmStudio={setModeloLocal}
        aoAlterarBaseUrlLmStudio={setBaseUrlLmStudio}
        aoAlterarPerfilLatencia={setPerfilLatencia}
        provedorAtivo={provedorAtivo}
        aoAlterarProvedorAtivo={setProvedorAtivo}
        overlayProativoConfig={overlayProativoConfig}
        aoAlterarOverlayProativoHabilitado={setOverlayProativoHabilitado}
        aoAlterarOverlayProativoNivel={setOverlayProativoNivelIntervencao}
        aoAlterarOverlayProativoSonecaAte={setOverlayProativoSonecaAte}
        atalhoGramatical={atalhoGramatical}
        atalhoScreenshot={atalhoScreenshot}
        aoAlterarAtalho={setAtalhoGramatical}
        aoAlterarAtalhoScreenshot={setAtalhoScreenshot}
        profile={profile}
        aoAlterarProfile={setProfile}
        memories={memories}
        aoAdicionarMemoria={addMemory}
        aoRemoverMemoria={removeMemory}
        voiceInput={voiceInput}
      />

      {toast && (
        <div className={`fixed ${toast.posicao === 'toolbar' ? 'bottom-24' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[90]`}>
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

function App() {
  const [isChatMode, setIsChatMode] = useState(window.location.hash === '#chat')

  useEffect(() => {
    const checkHash = () => setIsChatMode(window.location.hash === '#chat')
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  return isChatMode ? <ChatWindow /> : <AppOverlay />
}

export default App
