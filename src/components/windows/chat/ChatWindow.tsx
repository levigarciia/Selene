import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'

// Types
import type { Conversation } from './types'
import type { ChatMessage } from '../../../types/chat'
import type { AssistantConfig } from '../../../utils/assistentesPadrao'

// Hooks
import { useAppConfig } from '../../../hooks/useAppConfig'
import { verificarSuporteReasoningOpenRouter } from './components/SeletorModeloOpenRouter'
import { useCrossChatContext } from '../../../hooks/useCrossChatContext'
import { useMemoryAutopilot } from '../../../hooks/useMemoryAutopilot'
import { useAssistants } from '../../../hooks/useAssistants'
import { useChatUI, useChatShell } from './hooks'
import { useSendMessage } from './hooks'

// Components
import {
    Sidebar,
    ProjectView,
    MessageList,
    InputArea,
    ClarificationCard,
    BarraSuperiorChat,
    RailChat,
    PainelInicialChat,
    HubContextoChat,
    SeletorProjetosChat,
} from './components'
import { SettingsPanel } from '../../config/SettingsPanel'
import type { SecaoConfiguracoes } from '../../config/SettingsPanel'
import { AssistantsPanel } from './AssistantsPanel'
import { AssistantEditor } from './AssistantEditor'
import { MCPPanel } from '../../config/MCPPanel'
import { ReasoningTrailModal } from '../../modals/ReasoningTrailModal'

// Services
import { investigateService } from '../../../services/investigate'
import { toolCallingService } from '../../../services/tools/ToolCallingService'
import { mcpToolBridge } from '../../../services/tools/MCPToolBridge'
import { obterConfiguracaoPerfilGeracao } from '../../../services/ai/politicaGeracao'
import { processFileForProject, isFileSupported, formatFileSize, obterLimiteMaximoArquivo, getFileType, extractTextFromFile } from '../../../services/DocumentService'
import { indexProjectFile, removeFileEmbeddings } from '../../../services/ProjectContextService'
import { carregarConversasPersistidas, normalizarMensagensChat } from '../../../services/conversasPersistidas'
import type { Project } from '../../../types/project'
import { createProject } from '../../../types/project'
import {
    setProjectFilesSearchCallback,
    clearProjectFilesSearchCallback,
    setProjectUpdateCallback,
    clearProjectUpdateCallback,
} from '../../../services/tools/builtin'
import type { AcaoHomeChat } from './tiposShellChat'

const MENSAGENS_VAZIAS: ChatMessage[] = []

function obterTituloAutomaticoConversa(content: string) {
    const conteudoNormalizado = content.trim()
    if (!conteudoNormalizado) return 'Nova conversa'
    return conteudoNormalizado.slice(0, 30) + (conteudoNormalizado.length > 30 ? '...' : '')
}

async function lerArquivosComoBase64(files: File[]) {
    const leituras = files.map((file) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (evento) => resolve(evento.target?.result as string)
        reader.onerror = () => reject(reader.error ?? new Error(`Falha ao ler ${file.name}`))
        reader.readAsDataURL(file)
    }))

    return Promise.all(leituras)
}

const ChatWindow: React.FC = () => {
    // ============================================
    // Config and External Hooks
    // ============================================
    const {
        profile,
        setProfile,
        memories,
        addMemory,
        removeMemory,
        getProfileContext,
        apiKey, setApiKey,
        geminiKey, setGeminiKey,
        openRouterKey, setOpenRouterKey,
        modeloOpenRouter, setModeloOpenRouter,
        modeloLocal, setModeloLocal,
        modeloLmStudio, setModeloLmStudio,
        baseUrlLmStudio, setBaseUrlLmStudio,
        provedorAtivo, setProvedorAtivo,
        perfilLatencia, setPerfilLatencia,
        modeloAtivo,
        systemPrompt,
        criarOuObterServico,
        voiceInput,
        overlayProativoConfig,
        setOverlayProativoHabilitado,
        setOverlayProativoNivelIntervencao,
        setOverlayProativoSonecaAte,
    } = useAppConfig()

    const crossChat = useCrossChatContext()
    const memoryAutopilot = useMemoryAutopilot()
    const assistants = useAssistants()

    // ============================================
    // UI State (from hook)
    // ============================================
    const chatUI = useChatUI()
    const {
        sidebarExpandida, setSidebarExpandida,
        showSettings, setShowSettings,
        showAssistantsPanel, setShowAssistantsPanel,
        showAssistantEditor, setShowAssistantEditor,
        showMCPPanel, setShowMCPPanel,
        showReasoningTrail, setShowReasoningTrail,
        input, setInput,
        inputMenuOpen, setInputMenuOpen,
        pendingScreenshots, setPendingScreenshots,
        pendingFiles, setPendingFiles,
        pendingMessage, setPendingMessage,
        textareaRef,
        isGenerating, setIsGenerating,
        isInvestigating, setIsInvestigating,
        isAnalyzingImage, setIsAnalyzingImage,
        abortControllerRef,
        generationIdRef,
        copiedMessageId, setCopiedMessageId,
        expandedSources, setExpandedSources,
        messageSources, setMessageSources,
        messageSearchCards, setMessageSearchCards,
        webSearchEnabled, setWebSearchEnabled,
        investigateMode, setInvestigateMode,
        toolCallingAtivo, setToolCallingAtivo,
        reasoningAtivo, setReasoningAtivo,
        currentTrace, setCurrentTrace,
        mcpServers, setMcpServers,
        isCreatingProject, setIsCreatingProject,
        newProjectName, setNewProjectName,
        newProjectInputRef,
        projectChatInput, setProjectChatInput,
        projectPendingScreenshots, setProjectPendingScreenshots,
        projectChatInputRef,
        messagesEndRef,
        messagesContainerRef,
    } = chatUI

    // ============================================
    // Conversation State
    // ============================================
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        return carregarConversasPersistidas()
    })
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const ultimaTranscricaoSincronizadaRef = useRef('')

    const activeConversation = conversations.find(c => c.id === activeConversationId) || null
    const messages = activeConversation?.messages ?? MENSAGENS_VAZIAS

    // ============================================
    // Projects State
    // ============================================
    const [projects, setProjects] = useState<Project[]>(() => {
        const saved = localStorage.getItem('selene_projects')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return []
            }
        }
        return []
    })
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
    const [editingAssistant, setEditingAssistant] = useState<AssistantConfig | null>(null)
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
    const shouldAutoScrollRef = useRef(true)
    const autoScrollTravadoManualmenteRef = useRef(false)
    const ultimoScrollTopRef = useRef(0)
    const toqueScrollYRef = useRef<number | null>(null)
    // Rastreia se o usuário está selecionando texto para evitar scroll/re-render
    const selecionandoTextoRef = useRef(false)
    const [janelaMaximizada, setJanelaMaximizada] = useState(false)
    const [secaoConfiguracoesAtiva, setSecaoConfiguracoesAtiva] = useState<SecaoConfiguracoes>('configuracao')
    const [origemEditorAssistente, setOrigemEditorAssistente] = useState<'assistentes' | 'configuracoes'>('assistentes')
    const [conversaPendenteRegeneracaoPosEdicao, setConversaPendenteRegeneracaoPosEdicao] = useState<string | null>(null)
    const currentProjectContextId = activeProjectId || activeConversation?.projectId || null


    const shell = useChatShell({
        conversations,
        projects,
        activeConversationId,
        currentProjectContextId,
        assistants,
        mcpServers,
        pendingScreenshots,
        webSearchEnabled,
        investigateMode,
        toolCallingAtivo,
        provedorAtivo,
        modeloAtivo,
        perfilLatencia,
    })

    // ============================================
    // Send Message Hook
    // ============================================
    const { handleSend, stopGeneration, regenerateLastResponse } = useSendMessage({
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
        messages,
        projects,
        input,
        setInput,
        pendingScreenshots,
        setPendingScreenshots,
        pendingFiles,
        setPendingFiles,
        pendingMessage,
        setPendingMessage,
        textareaRef,
        isGenerating,
        setIsGenerating,
        isAnalyzingImage,
        setIsAnalyzingImage,
        abortControllerRef,
        generationIdRef,
        webSearchEnabled,
        toolCallingAtivo,
        investigateMode,
        reasoningAtivo,
        setIsInvestigating,
        setCurrentTrace,
        setMessageSources,
        setMessageSearchCards,
        promptBase: assistants.effectiveSystemPrompt || systemPrompt,
        getProfileContext,
        criarOuObterServico,
        provedorAtivo,
        modeloAtivo,
        perfilLatencia,
    })

    // ============================================
    // Persistence Effects
    // ============================================
    useEffect(() => {
        const atrasoPersistencia = isGenerating ? 1200 : 250
        const timeoutId = window.setTimeout(() => {
            localStorage.setItem('selene_conversations', JSON.stringify(conversations))
        }, atrasoPersistencia)

        return () => window.clearTimeout(timeoutId)
    }, [conversations, isGenerating])

    useEffect(() => {
        localStorage.setItem('selene_projects', JSON.stringify(projects))
    }, [projects])

    useEffect(() => {
        if (isCreatingProject && newProjectInputRef.current) {
            newProjectInputRef.current.focus()
        }
    }, [isCreatingProject, newProjectInputRef])

    useEffect(() => {
        if (!activeProjectId || !projectChatInputRef.current) return

        const timeoutId = window.setTimeout(() => {
            projectChatInputRef.current?.focus()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [activeProjectId, projectChatInputRef])

    // ============================================
    // Electron Events
    // ============================================
    useEffect(() => {
        const removeListener = window.electronAPI?.onHydrateChat?.((msgs: ChatMessage[]) => {
            const mensagensNormalizadas = normalizarMensagensChat(msgs)
            console.log('[ChatWindow] Hydrating with', mensagensNormalizadas.length, 'messages')
            if (mensagensNormalizadas.length > 0) {
                const newConv: Conversation = {
                    id: uuidv4(),
                    title: mensagensNormalizadas[0].content.slice(0, 30) + (mensagensNormalizadas[0].content.length > 30 ? '...' : ''),
                    messages: mensagensNormalizadas,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
                setConversations(prev => [newConv, ...prev])
                setActiveConversationId(newConv.id)
            }
        })
        return () => removeListener?.()
    }, [])

    useEffect(() => {
        const remover = window.electronAPI?.onScreenshotChat?.((dataUrl: string) => {
            setPendingScreenshots((lista) => [...lista, dataUrl])
            setShowSettings(false)
            setInput('')
        })
        return () => remover?.()
    }, [setPendingScreenshots, setShowSettings, setInput])

    useEffect(() => {
        window.electronAPI?.isWindowMaximized?.().then((maximizada) => {
            setJanelaMaximizada(!!maximizada)
        }).catch((erro) => {
            console.warn('[ChatWindow] Falha ao ler estado da janela:', erro)
        })

        const remover = window.electronAPI?.onWindowMaximizedChange?.((maximizada) => {
            setJanelaMaximizada(maximizada)
        })

        return () => remover?.()
    }, [])

    // ============================================
    // Scroll Handling
    // ============================================
    useEffect(() => {
        shouldAutoScrollRef.current = shouldAutoScroll
    }, [shouldAutoScroll])

    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return

        const definirAutoScroll = (ativo: boolean) => {
            shouldAutoScrollRef.current = ativo
            setShouldAutoScroll((valorAtual) => (valorAtual === ativo ? valorAtual : ativo))
        }

        const estaNoBottomAbsoluto = () => {
            const distanciaDoFim = container.scrollHeight - container.scrollTop - container.clientHeight
            return Math.abs(distanciaDoFim) <= 1
        }

        const atualizarAutoScroll = () => {
            // Não atualizar estado durante seleção de texto para evitar re-render
            if (selecionandoTextoRef.current) return

            if (estaNoBottomAbsoluto()) {
                autoScrollTravadoManualmenteRef.current = false
                definirAutoScroll(true)
                return
            }

            if (autoScrollTravadoManualmenteRef.current) {
                definirAutoScroll(false)
                return
            }

            definirAutoScroll(false)
        }

        const interromperAutoScroll = () => {
            autoScrollTravadoManualmenteRef.current = true

            if (!shouldAutoScrollRef.current) return

            definirAutoScroll(false)

            // Interrompe qualquer smooth scroll em andamento assim que o usuário tenta subir.
            if (!selecionandoTextoRef.current) {
                container.scrollTo({ top: container.scrollTop, behavior: 'auto' })
            }
        }

        const handleScroll = () => {
            if (container.scrollTop < ultimoScrollTopRef.current - 1) {
                interromperAutoScroll()
            }

            ultimoScrollTopRef.current = container.scrollTop
            atualizarAutoScroll()
        }

        const handleWheel = (event: WheelEvent) => {
            if (event.deltaY < 0) {
                interromperAutoScroll()
            }
        }

        // Detecta início de seleção de texto dentro das mensagens
        const handlePointerDown = (event: PointerEvent) => {
            const alvo = event.target as HTMLElement | null
            const dentroDeBloco = Boolean(
                alvo?.closest('[data-bloco-mensagem="true"]') ||
                alvo?.closest('.select-text')
            )

            if (dentroDeBloco) {
                selecionandoTextoRef.current = true
                autoScrollTravadoManualmenteRef.current = true
                shouldAutoScrollRef.current = false
                return
            }

            if (isGenerating) {
                interromperAutoScroll()
            }
        }

        // Finaliza rastreamento de seleção de texto
        const handlePointerUp = () => {
            if (selecionandoTextoRef.current) {
                selecionandoTextoRef.current = false
            }
        }

        const handleTouchStart = (event: TouchEvent) => {
            toqueScrollYRef.current = event.touches[0]?.clientY ?? null
        }

        const handleTouchMove = (event: TouchEvent) => {
            const toqueAtual = event.touches[0]?.clientY
            const toqueAnterior = toqueScrollYRef.current

            if (toqueAtual == null || toqueAnterior == null) return

            if (toqueAtual > toqueAnterior) {
                interromperAutoScroll()
            }

            toqueScrollYRef.current = toqueAtual
        }

        const handleTouchEnd = () => {
            toqueScrollYRef.current = null
        }

        ultimoScrollTopRef.current = container.scrollTop
        atualizarAutoScroll()
        container.addEventListener('scroll', handleScroll)
        container.addEventListener('wheel', handleWheel, { passive: true })
        container.addEventListener('pointerdown', handlePointerDown, { passive: true })
        container.addEventListener('pointerup', handlePointerUp, { passive: true })
        container.addEventListener('touchstart', handleTouchStart, { passive: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: true })
        container.addEventListener('touchend', handleTouchEnd, { passive: true })

        return () => {
            container.removeEventListener('scroll', handleScroll)
            container.removeEventListener('wheel', handleWheel)
            container.removeEventListener('pointerdown', handlePointerDown)
            container.removeEventListener('pointerup', handlePointerUp)
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isGenerating, messagesContainerRef])

    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container || !shouldAutoScrollRef.current) return

        // Não scrollar durante seleção de texto para preservar o destaque
        if (selecionandoTextoRef.current) return

        // Verificar se há seleção ativa dentro do container
        const selecaoAtiva = window.getSelection()
        if (selecaoAtiva && !selecaoAtiva.isCollapsed) {
            const selecaoDentroContainer = container.contains(selecaoAtiva.anchorNode)
            if (selecaoDentroContainer) return
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: isGenerating ? 'auto' : 'smooth',
        })
    }, [isGenerating, messages, messagesContainerRef])

    // ============================================
    // Service Configuration
    // ============================================
    useEffect(() => {
        const chatFnInvestigacao = async (prompt: string, systemPrompt?: string): Promise<string> => {
            const servico = criarOuObterServico()
            if (!servico) throw new Error('No AI service available')

            const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { investigateMode: true })
            let response = ''
            await servico.streamChat(
                prompt,
                (chunk: string) => { response += chunk },
                systemPrompt !== undefined ? systemPrompt : 'Você é um assistente de pesquisa. Responda de forma objetiva e estruturada.',
                [],
                {
                    temperature: configGeracao.temperature,
                    reasoningAtivo: false,
                }
            )
            return response
        }

        const chatFnTools = async (prompt: string, systemPrompt?: string): Promise<string> => {
            const servico = criarOuObterServico()
            if (!servico) throw new Error('No AI service available')

            const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { forcarPerfil: 'pergunta_curta' })
            let response = ''
            await servico.streamChat(
                prompt,
                (chunk: string) => { response += chunk },
                systemPrompt !== undefined ? systemPrompt : 'Você é um assistente de decisão de ferramentas. Seja extremamente conciso.',
                [],
                {
                    temperature: configGeracao.temperature,
                    reasoningAtivo: false,
                }
            )
            return response
        }

        investigateService.setChatFunction(chatFnInvestigacao)
        toolCallingService.setChatFunction(chatFnTools)
    }, [criarOuObterServico])

    // ============================================
    // MCP Servers Loading
    // ============================================
    useEffect(() => {
        if (!inputMenuOpen) return

        const carregarServidoresMcp = async () => {
            try {
                const servers = await window.electronAPI?.mcp?.getServers()
                if (servers) {
                    setMcpServers(servers.map(s => ({
                        id: s.config.id,
                        name: s.config.name,
                        status: s.status,
                        icon: s.config.icon,
                        toolCount: s.toolCount
                    })))
                }
            } catch (err) {
                console.warn('[ChatWindow] Falha ao carregar servidores MCP:', err)
            }
        }

        carregarServidoresMcp()
        mcpToolBridge.syncAllTools().catch(err => {
            console.warn('[ChatWindow] Falha ao sincronizar MCP:', err)
        })
    }, [inputMenuOpen, setMcpServers])

    // ============================================
    // Conversation Actions
    // ============================================
    const createNewConversation = useCallback(() => {
        ultimaTranscricaoSincronizadaRef.current = ''
        voiceInput.setTranscription('')
        autoScrollTravadoManualmenteRef.current = false
        shouldAutoScrollRef.current = true
        setShouldAutoScroll(true)
        setActiveConversationId(null)
        setInput('')
    }, [setInput, voiceInput])

    const deleteConversation = useCallback((convId: string) => {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (activeConversationId === convId) {
            setActiveConversationId(null)
        }
        import('../../../services/crosschat/EmbeddingIndex').then(({ removeConversation }) => {
            const removed = removeConversation(convId)
            console.log(`[ChatWindow] Removed ${removed} messages from embedding index`)
        }).catch(err => console.warn('[ChatWindow] Failed to clean embedding index:', err))
    }, [activeConversationId])

    const renameConversation = useCallback((convId: string, newTitle: string) => {
        setConversations(prev => prev.map(c =>
            c.id === convId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
        ))
    }, [])

    const moveConversationToProject = useCallback((convId: string, projectId: string | undefined) => {
        setConversations(prev => prev.map(c =>
            c.id === convId ? { ...c, projectId, updatedAt: Date.now() } : c
        ))
    }, [])

    // ============================================
    // Project Actions
    // ============================================
    const addProject = useCallback((name: string) => {
        const newProject = createProject(name)
        setProjects(prev => [...prev, newProject])
        setActiveProjectId(newProject.id)
        return newProject.id
    }, [])

    const deleteProject = useCallback((projectId: string) => {
        setConversations(prev => prev.map(c =>
            c.projectId === projectId ? { ...c, projectId: undefined } : c
        ))
        setProjects(prev => prev.filter(p => p.id !== projectId))
        if (activeProjectId === projectId) {
            setActiveProjectId(null)
        }
    }, [activeProjectId])

    const renameProject = useCallback((projectId: string, newName: string) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p
        ))
    }, [])

    const updateProject = useCallback((projectId: string, updates: Partial<Project>) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
        ))
    }, [])

    const renameProjectFile = useCallback((projectId: string, fileId: string, newName: string) => {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p

            return {
                ...p,
                files: p.files.map((file) => (
                    file.id === fileId ? { ...file, name: newName } : file
                )),
                updatedAt: Date.now(),
            }
        }))
    }, [])

    const removeFileFromProject = useCallback((projectId: string, fileId: string) => {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p

            return {
                ...p,
                files: p.files.filter((file) => file.id !== fileId),
                updatedAt: Date.now(),
            }
        }))
        removeFileEmbeddings(fileId)
    }, [])

    // Register project update callback for AI tool
    useEffect(() => {
        const handleToolUpdate = (projectId: string, updates: { instructions?: string }) => {
            // Handle append action
            if (updates.instructions?.startsWith('__APPEND__')) {
                const toAppend = updates.instructions.slice(10)
                setProjects(prev => prev.map(p => {
                    if (p.id === projectId) {
                        const current = p.instructions || ''
                        const newInstructions = current ? `${current}\n\n${toAppend}` : toAppend
                        return { ...p, instructions: newInstructions, updatedAt: Date.now() }
                    }
                    return p
                }))
            } else {
                // Regular update
                updateProject(projectId, updates)
            }
        }
        
        setProjectUpdateCallback(handleToolUpdate)
        return () => clearProjectUpdateCallback()
    }, [updateProject])

    useEffect(() => {
        setProjectFilesSearchCallback((projectId) => {
            const projeto = projects.find((item) => item.id === projectId)
            return projeto ? { id: projeto.id, files: projeto.files } : null
        })

        return () => clearProjectFilesSearchCallback()
    }, [projects])

    const addFileToProject = useCallback(async (projectId: string, file: File) => {
        if (!isFileSupported(file)) {
            alert(`Tipo de arquivo não suportado: ${file.name}\n\nFormatos aceitos: PDF, DOCX, TXT, MD`)
            return
        }
        const limiteMaximo = obterLimiteMaximoArquivo(file)
        if (file.size > limiteMaximo) {
            const tipoArquivo = getFileType(file).toUpperCase()
            alert(`Arquivo muito grande: ${formatFileSize(file.size)}\n\nTamanho máximo para ${tipoArquivo}: ${formatFileSize(limiteMaximo)}`)
            return
        }

        try {
            const projectFile = await processFileForProject(file)
            indexProjectFile(projectId, projectFile)
            setProjects(prev => prev.map(p =>
                p.id === projectId
                    ? { ...p, files: [...p.files, projectFile], updatedAt: Date.now() }
                    : p
            ))
            console.log(`[Projects] Added and indexed file "${file.name}" to project ${projectId}`)
        } catch (error) {
            console.error('[Projects] Failed to add file:', error)
            alert(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
    }, [])

    const handleProjectFileUpload = useCallback((projectId: string) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.pdf,.docx,.txt,.md'
        input.multiple = true
        input.onchange = async (e: Event) => {
            const files = (e.target as HTMLInputElement).files
            if (files) {
                for (const file of Array.from(files)) {
                    await addFileToProject(projectId, file)
                }
            }
        }
        input.click()
    }, [addFileToProject])

    const createNewConversationInProject = useCallback((projectId: string, initialMessage?: string, initialImages: string[] = []) => {
        const newConv: Conversation = {
            id: uuidv4(),
            title: initialMessage?.slice(0, 30) || 'Nova conversa',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectId
        }
        setConversations(prev => [newConv, ...prev])
        autoScrollTravadoManualmenteRef.current = false
        shouldAutoScrollRef.current = true
        setShouldAutoScroll(true)
        setActiveConversationId(newConv.id)
        setActiveProjectId(null)
        setPendingScreenshots(initialImages)
        setInput(initialMessage || '')

        if (initialMessage || initialImages.length > 0) {
            setTimeout(() => {
                const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement
                sendButton?.click()
            }, 100)
        }

        return newConv.id
    }, [setInput, setPendingScreenshots])

    const abrirProjeto = useCallback((projectId: string) => {
        shell.fecharOverlays()
        setActiveConversationId(null)
        setActiveProjectId(projectId)
        setShowSettings(false)
        setShowAssistantsPanel(false)
        setShowAssistantEditor(false)
        setShowMCPPanel(false)
        setEditingAssistant(null)
    }, [setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    // ============================================
    // Message Actions
    // ============================================
    const copyMessage = useCallback((msgId: string, content: string) => {
        navigator.clipboard.writeText(content)
        setCopiedMessageId(msgId)
        setTimeout(() => setCopiedMessageId(null), 2000)
    }, [setCopiedMessageId])

    const limparMetadadosMensagens = useCallback((messageIds: string[]) => {
        if (messageIds.length === 0) return

        const ids = new Set(messageIds)
        setMessageSources((prev) => Object.fromEntries(
            Object.entries(prev).filter(([messageId]) => !ids.has(messageId))
        ))
        setMessageSearchCards((prev) => Object.fromEntries(
            Object.entries(prev).filter(([messageId]) => !ids.has(messageId))
        ))

        if (expandedSources && ids.has(expandedSources)) {
            setExpandedSources(null)
        }

        if (copiedMessageId && ids.has(copiedMessageId)) {
            setCopiedMessageId(null)
        }
    }, [
        copiedMessageId,
        expandedSources,
        setCopiedMessageId,
        setExpandedSources,
        setMessageSearchCards,
        setMessageSources,
    ])

    const editarMensagemUsuario = useCallback((msgId: string, novoConteudo: string) => {
        if (!activeConversation) return

        const indiceMensagem = activeConversation.messages.findIndex((message) => (
            message.id === msgId && message.role === 'user'
        ))

        if (indiceMensagem === -1) return

        const mensagemAtual = activeConversation.messages[indiceMensagem]
        const conteudoNormalizado = novoConteudo.trim()

        if (!conteudoNormalizado && !(mensagemAtual.images?.length || 0)) return
        if (conteudoNormalizado === mensagemAtual.content) return

        const mensagensPosteriores = activeConversation.messages.slice(indiceMensagem + 1)
        if (
            mensagensPosteriores.length > 0 &&
            !confirm('Editar esta mensagem vai remover as respostas posteriores para manter o contexto consistente. Deseja continuar?')
        ) {
            return
        }

        const primeiraMensagemUsuario = activeConversation.messages.find((message) => message.role === 'user')
        const tituloAtualAutomatico = primeiraMensagemUsuario
            ? obterTituloAutomaticoConversa(primeiraMensagemUsuario.content)
            : 'Nova conversa'
        const deveAtualizarTitulo = primeiraMensagemUsuario?.id === msgId && (
            activeConversation.title === 'Nova conversa' ||
            activeConversation.title === tituloAtualAutomatico
        )

        setConversations((prev) => prev.map((conversation) => {
            if (conversation.id !== activeConversation.id) return conversation

            const mensagensAtualizadas = [
                ...conversation.messages.slice(0, indiceMensagem),
                {
                    ...mensagemAtual,
                    content: conteudoNormalizado,
                },
            ]

            return {
                ...conversation,
                messages: mensagensAtualizadas,
                title: deveAtualizarTitulo
                    ? obterTituloAutomaticoConversa(conteudoNormalizado)
                    : conversation.title,
                updatedAt: Date.now(),
            }
        }))

        limparMetadadosMensagens(mensagensPosteriores.map((message) => message.id))

        if (mensagensPosteriores.length > 0) {
            setConversaPendenteRegeneracaoPosEdicao(activeConversation.id)
        }
    }, [activeConversation, limparMetadadosMensagens])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            ultimaTranscricaoSincronizadaRef.current = ''
            voiceInput.setTranscription('')
            void handleSend()
        }
    }, [handleSend, voiceInput])

    const handleInputChange = useCallback((value: string) => {
        if (!value) {
            ultimaTranscricaoSincronizadaRef.current = ''
            voiceInput.setTranscription('')
        }
        setInput(value)
    }, [setInput, voiceInput])

    const handleSendChat = useCallback(() => {
        ultimaTranscricaoSincronizadaRef.current = ''
        voiceInput.setTranscription('')
        autoScrollTravadoManualmenteRef.current = false
        shouldAutoScrollRef.current = true
        setShouldAutoScroll(true)
        void handleSend()
    }, [handleSend, voiceInput])

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file) {
                    try {
                        const [base64] = await lerArquivosComoBase64([file])
                        setPendingScreenshots(prev => [...prev, base64])
                    } catch (error) {
                        console.error('[ChatWindow] Falha ao colar imagem no chat:', error)
                    }
                }
                break
            }
        }
    }, [setPendingScreenshots])

    const lidarComAnexoArquivo = useCallback(async (arquivo: File) => {
        const id = crypto.randomUUID()
        const tipo = getFileType(arquivo)

        // Adiciona arquivo temporário com status "processando"
        setPendingFiles(prev => [...prev, {
            id,
            name: arquivo.name,
            type: tipo,
            size: arquivo.size,
            content: '',
            status: 'processando',
            arquivoOriginal: arquivo,
        }])

        try {
            const textoExtraido = await extractTextFromFile(arquivo, tipo === 'pdf' ? { pdfMaxPages: 5 } : {})
            const texto = tipo === 'pdf'
                ? [
                    `[Prévia limitada do PDF: ${arquivo.name}]`,
                    'Apenas as páginas 1 a 5 foram extraídas ao anexar para evitar ler o PDF inteiro.',
                    'Se o usuário pedir uma página específica, extraia somente essa página antes de responder.',
                    '',
                    textoExtraido,
                ].join('\n')
                : textoExtraido
            setPendingFiles(prev => prev.map(f =>
                f.id === id ? { ...f, content: texto, status: 'concluido' } : f
            ))
        } catch (erro) {
            console.error('[ChatWindow] Falha ao processar arquivo:', erro)
            setPendingFiles(prev => prev.map(f =>
                f.id === id ? { ...f, status: 'erro' } : f
            ))
            alert(erro instanceof Error ? erro.message : 'Erro ao processar arquivo')
            // Remove o arquivo com erro
            setPendingFiles(prev => prev.filter(f => f.id !== id))
        }
    }, [setPendingFiles])

    const handleProjectChatPaste = useCallback(async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file) {
                    try {
                        const [base64] = await lerArquivosComoBase64([file])
                        setProjectPendingScreenshots((prev) => [...prev, base64])
                    } catch (error) {
                        console.error('[ChatWindow] Falha ao colar imagem no projeto:', error)
                    }
                }
                break
            }
        }
    }, [setProjectPendingScreenshots])

    const handleProjectChatImagesSelected = useCallback(async (files: File[]) => {
        try {
            const imagens = await lerArquivosComoBase64(files)
            setProjectPendingScreenshots((prev) => [...prev, ...imagens])
        } catch (error) {
            console.error('[ChatWindow] Falha ao anexar imagens no projeto:', error)
        }
    }, [setProjectPendingScreenshots])

    const handleCreateProjectChat = useCallback((projectId: string) => {
        const mensagemInicial = projectChatInput.trim()
        const imagensIniciais = [...projectPendingScreenshots]

        if (!mensagemInicial && imagensIniciais.length === 0) {
            return
        }

        createNewConversationInProject(projectId, mensagemInicial, imagensIniciais)
        setProjectChatInput('')
        setProjectPendingScreenshots([])
    }, [
        createNewConversationInProject,
        projectChatInput,
        projectPendingScreenshots,
        setProjectChatInput,
        setProjectPendingScreenshots,
    ])

    const handleConnectMCPServer = useCallback(async (serverId: string) => {
        try {
            await window.electronAPI?.mcp?.connect(serverId)
            const servers = await window.electronAPI?.mcp?.getServers()
            if (servers) {
                setMcpServers(servers.map(s => ({
                    id: s.config.id,
                    name: s.config.name,
                    status: s.status,
                    icon: s.config.icon,
                    toolCount: s.toolCount
                })))
            }
            mcpToolBridge.syncServerTools(serverId)
        } catch (err) {
            console.error('[ChatWindow] Erro ao conectar MCP:', err)
        }
    }, [setMcpServers])

    useEffect(() => {
        if (
            !conversaPendenteRegeneracaoPosEdicao ||
            conversaPendenteRegeneracaoPosEdicao !== activeConversationId ||
            isGenerating ||
            !activeConversation
        ) {
            return
        }

        const ultimaMensagem = activeConversation.messages[activeConversation.messages.length - 1]
        setConversaPendenteRegeneracaoPosEdicao(null)

        if (ultimaMensagem?.role === 'user') {
            regenerateLastResponse()
        }
    }, [
        activeConversation,
        activeConversationId,
        conversaPendenteRegeneracaoPosEdicao,
        isGenerating,
        regenerateLastResponse,
    ])

    useEffect(() => {
        const transcricaoAtual = voiceInput.transcription
        const transcricaoAnterior = ultimaTranscricaoSincronizadaRef.current

        if (!transcricaoAtual && transcricaoAnterior && input === transcricaoAnterior) {
            setInput('')
            if (textareaRef.current) {
                textareaRef.current.value = ''
                textareaRef.current.style.height = 'auto'
            }
        } else if (transcricaoAtual && (!input || input === transcricaoAnterior)) {
            console.log('[ChatWindow] Sincronizando transcrição no input:', transcricaoAtual)
            setInput(transcricaoAtual)
            if (textareaRef.current) {
                textareaRef.current.value = transcricaoAtual
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
            }
        }

        ultimaTranscricaoSincronizadaRef.current = transcricaoAtual
    }, [input, setInput, textareaRef, voiceInput])

    useEffect(() => {
        ultimaTranscricaoSincronizadaRef.current = ''
        voiceInput.setTranscription('')
    }, [activeConversationId, activeProjectId, voiceInput])

    // ============================================
    // Render
    // ============================================
    // ============================================
    // Verificação de Compatibilidade com Reasoning
    // ============================================
    type ModeloLocalDisponivel = NonNullable<
        Awaited<ReturnType<NonNullable<typeof window.electronAPI.localLLM>['listModels']>>['models']
    >[number]
    const [modelosLocais, setModelosLocais] = useState<ModeloLocalDisponivel[]>([])

    useEffect(() => {
        if (provedorAtivo === 'local') {
            window.electronAPI?.localLLM?.listModels()
                .then((resposta) => {
                    if (resposta?.success && resposta.models) {
                        setModelosLocais(resposta.models)
                    }
                })
                .catch((erro) => {
                    console.error('[ChatWindow] Erro ao listar modelos locais:', erro)
                })
        }
    }, [provedorAtivo])

    const modeloCompativelComReasoning = useMemo(() => {
        if (provedorAtivo === 'openrouter') {
            return verificarSuporteReasoningOpenRouter(modeloOpenRouter || modeloAtivo)
        }
        if (provedorAtivo === 'local') {
            const modeloResolvido = modeloLocal || modeloAtivo
            const encontrado = modelosLocais.find((m) => m.id === modeloResolvido)
            return encontrado ? !!encontrado.capacidades?.reasoning : false
        }
        if (provedorAtivo === 'openai') {
            const nomeLower = (modeloAtivo || '').toLowerCase()
            return nomeLower.includes('o1') || nomeLower.includes('o3')
        }
        if (provedorAtivo === 'gemini') {
            const nomeLower = (modeloAtivo || '').toLowerCase()
            return nomeLower.includes('thinking')
        }
        return false
    }, [provedorAtivo, modeloOpenRouter, modeloLocal, modeloAtivo, modelosLocais])

    const alternarReasoning = useCallback((valor?: boolean) => {
        const novoValor = typeof valor === 'boolean' ? valor : !reasoningAtivo
        setReasoningAtivo(novoValor)
        localStorage.setItem('selene_reasoning_ativo', String(novoValor))
    }, [reasoningAtivo, setReasoningAtivo])

    const activeProject = projects.find(p => p.id === activeProjectId)
    const visualizacaoPrincipalAtiva = showAssistantEditor
        ? 'editor-assistente'
        : showSettings
        ? 'configuracoes'
        : showAssistantsPanel
        ? 'assistentes'
        : showMCPPanel
        ? 'mcp'
        : activeProject
        ? 'projeto'
        : 'chat'

    const abrirConfiguracoesPorSecao = useCallback((secao: SecaoConfiguracoes) => {
        shell.fecharOverlays()
        setInputMenuOpen(false)
        setSecaoConfiguracoesAtiva(secao)
        setShowSettings(true)
        setShowAssistantsPanel(false)
        setShowAssistantEditor(false)
        setShowMCPPanel(false)
        setEditingAssistant(null)
        setActiveProjectId(null)
    }, [setInputMenuOpen, setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    const abrirConfiguracoes = useCallback(() => {
        abrirConfiguracoesPorSecao('configuracao')
    }, [abrirConfiguracoesPorSecao])

    const abrirPainelAssistentes = useCallback(() => {
        shell.fecharOverlays()
        setInputMenuOpen(false)
        setShowAssistantsPanel(true)
        setShowSettings(false)
        setShowAssistantEditor(false)
        setShowMCPPanel(false)
        setEditingAssistant(null)
        setActiveProjectId(null)
    }, [setInputMenuOpen, setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    const abrirEditorAssistente = useCallback((assistant: AssistantConfig | null, origem: 'assistentes' | 'configuracoes' = 'assistentes') => {
        shell.fecharOverlays()
        setInputMenuOpen(false)
        setOrigemEditorAssistente(origem)
        setEditingAssistant(assistant)
        setShowAssistantEditor(true)
        setShowAssistantsPanel(false)
        setShowSettings(false)
        setShowMCPPanel(false)
        setActiveProjectId(null)
    }, [setInputMenuOpen, setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    const abrirPainelMcp = useCallback(() => {
        shell.fecharOverlays()
        setInputMenuOpen(false)
        setShowMCPPanel(true)
        setShowSettings(false)
        setShowAssistantsPanel(false)
        setShowAssistantEditor(false)
        setEditingAssistant(null)
        setActiveProjectId(null)
    }, [setInputMenuOpen, setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    const abrirChatPrincipal = useCallback(() => {
        shell.fecharOverlays()
        setInputMenuOpen(false)
        setActiveProjectId(null)
        setShowSettings(false)
        setShowAssistantsPanel(false)
        setShowAssistantEditor(false)
        setShowMCPPanel(false)
        setEditingAssistant(null)
    }, [setInputMenuOpen, setShowAssistantsPanel, setShowAssistantEditor, setShowMCPPanel, setShowSettings, shell])

    const fecharEditorAssistente = useCallback(() => {
        setShowAssistantEditor(false)
        setEditingAssistant(null)
        setShowAssistantsPanel(origemEditorAssistente === 'assistentes')
        setShowSettings(origemEditorAssistente === 'configuracoes')
    }, [origemEditorAssistente, setShowAssistantsPanel, setShowAssistantEditor, setShowSettings])

    const salvarAssistenteEditado = useCallback((config: AssistantConfig) => {
        if (editingAssistant) {
            assistants.updateAssistant(editingAssistant.id, config)
        } else {
            assistants.addAssistant(config)
        }

        setShowAssistantEditor(false)
        setEditingAssistant(null)
        setShowAssistantsPanel(origemEditorAssistente === 'assistentes')
        setShowSettings(origemEditorAssistente === 'configuracoes')
    }, [assistants, editingAssistant, origemEditorAssistente, setShowAssistantsPanel, setShowAssistantEditor, setShowSettings])

    const alternarNavegacaoChat = useCallback(() => {
        setSidebarExpandida((atual) => !atual)
    }, [setSidebarExpandida])

    const iniciarNovaConversa = useCallback(() => {
        createNewConversation()
        abrirChatPrincipal()
        setPendingScreenshots([])
        shell.fecharOverlays()
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [abrirChatPrincipal, createNewConversation, setPendingScreenshots, shell, textareaRef])

    const alternarToolCalling = useCallback((valor?: boolean) => {
        const novoValor = typeof valor === 'boolean' ? valor : !toolCallingAtivo
        setToolCallingAtivo(novoValor)
        localStorage.setItem('selene_tool_calling', String(novoValor))
    }, [toolCallingAtivo, setToolCallingAtivo])

    const prepararRascunhoProjeto = useCallback((projectId: string, prompt?: string) => {
        const newConv: Conversation = {
            id: uuidv4(),
            title: prompt?.slice(0, 30) || 'Nova conversa',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectId,
        }

        setConversations((prev) => [newConv, ...prev])
        setActiveConversationId(newConv.id)
        setActiveProjectId(null)
        setInput(prompt || '')
        shell.fecharOverlays()
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [setConversations, setInput, shell, textareaRef])

    const selecionarAssistenteContexto = useCallback((assistantId: string | null) => {
        if (assistantId === null) {
            assistants.selectAssistant(null)
            if (assistants.useDefaultPrompt) {
                assistants.toggleDefaultPrompt()
            }
            shell.fecharOverlays()
            return
        }

        if (!assistants.useDefaultPrompt && assistants.activeAssistant?.id === assistantId) {
            assistants.selectAssistant(null)
            shell.fecharOverlays()
            return
        }

        assistants.selectAssistant(assistantId)
        assistants.incrementUsage(assistantId)
        shell.fecharOverlays()
    }, [assistants, shell])

    const selecionarProjetoContexto = useCallback((projectId: string) => {
        if (!projects.some((project) => project.id === projectId)) return

        if (currentProjectContextId === projectId) {
            if (activeConversationId) {
                setConversations((prev) => prev.map((conversation) => (
                    conversation.id === activeConversationId
                        ? { ...conversation, projectId: undefined, updatedAt: Date.now() }
                        : conversation
                )))
            }

            setActiveProjectId(null)
            shell.fecharOverlays()
            setTimeout(() => textareaRef.current?.focus(), 0)
            return
        }

        if (activeConversationId) {
            setConversations((prev) => prev.map((conversation) => (
                conversation.id === activeConversationId
                    ? { ...conversation, projectId, updatedAt: Date.now() }
                    : conversation
            )))
        } else {
            const newConv: Conversation = {
                id: uuidv4(),
                title: 'Nova conversa',
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                projectId,
            }

            setConversations((prev) => [newConv, ...prev])
            setActiveConversationId(newConv.id)
        }

        setActiveProjectId(null)
        setShowSettings(false)
        setShowAssistantsPanel(false)
        setShowAssistantEditor(false)
        setShowMCPPanel(false)
        setEditingAssistant(null)
        shell.fecharOverlays()
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [
        activeConversationId,
        currentProjectContextId,
        projects,
        setShowAssistantsPanel,
        setShowAssistantEditor,
        setShowMCPPanel,
        setShowSettings,
        shell,
        textareaRef,
    ])

    const aplicarAcaoHome = useCallback((acao: AcaoHomeChat) => {
        if (acao.assistantId !== undefined) {
            selecionarAssistenteContexto(acao.assistantId)
        }

        if (acao.ativarWeb !== undefined) {
            setWebSearchEnabled(acao.ativarWeb)
        }

        if (acao.ativarInvestigacao !== undefined) {
            setInvestigateMode(acao.ativarInvestigacao)
        }

        if (acao.ativarToolCalling !== undefined) {
            alternarToolCalling(acao.ativarToolCalling)
        }

        if (acao.projectId) {
            prepararRascunhoProjeto(acao.projectId, acao.prompt)
            return
        }

        setInput(acao.prompt)
        shell.fecharOverlays()
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [alternarToolCalling, prepararRascunhoProjeto, selecionarAssistenteContexto, setInput, setInvestigateMode, setWebSearchEnabled, shell, textareaRef])

    const criarProjetoRapido = useCallback(() => {
        const novoId = addProject('Novo projeto')
        shell.fecharOverlays()
        abrirProjeto(novoId)
    }, [addProject, abrirProjeto, shell])

    const propsPainelConfiguracoes = {
        profile,
        setProfile,
        memories,
        addMemory,
        removeMemory,
        autoMemories: memoryAutopilot.memories.map((memory) => ({
            id: memory.id,
            text: memory.text,
            category: memory.category,
            confidence: memory.confidence,
            createdAt: memory.createdAt
        })),
        removeAutoMemory: memoryAutopilot.removeMemory,
        clearAutoMemories: memoryAutopilot.clearMemories,
        apiKey,
        setApiKey,
        geminiKey,
        setGeminiKey,
        openRouterKey,
        setOpenRouterKey,
        modeloOpenRouter,
        setModeloOpenRouter,
        modeloLmStudio,
        setModeloLmStudio,
        baseUrlLmStudio,
        setBaseUrlLmStudio,
        perfilLatencia,
        setPerfilLatencia,
        provedorAtivo,
        setProvedorAtivo,
        overlayProativoConfig,
        setOverlayProativoHabilitado,
        setOverlayProativoNivelIntervencao,
        setOverlayProativoSonecaAte,
        crossChatEnabled: crossChat.enabled,
        setCrossChatEnabled: crossChat.setEnabled,
        memoryAutopilotEnabled: memoryAutopilot.enabled,
        setMemoryAutopilotEnabled: memoryAutopilot.setEnabled,
        voiceInput,
        secaoInicial: secaoConfiguracoesAtiva,
        assistentes: assistants,
        onAbrirEditorAssistente: (assistant: AssistantConfig | null) => abrirEditorAssistente(assistant, 'configuracoes'),
    }

    const classeCanvasPrincipal = 'mt-3 relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[18px] border-t border-white/[0.05] bg-[#141416]'
    // Transição CSS pura (sem Framer Motion layout) para não aplicar transform
    // persistente que quebra a seleção de texto no Chromium/Electron.
    const estiloTransicaoLayout = 'transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]'

    return (
        <>
            <div
                className="flex h-screen w-full min-w-0 overflow-hidden bg-[#090a0c] text-[#f2f3f7] font-sans selection:bg-[#4b479f]/30"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <div
                    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <BarraSuperiorChat
                        janelaMaximizada={janelaMaximizada}
                        onMinimizarJanela={() => window.electronAPI?.minimizeWindow?.()}
                        onAlternarMaximizacaoJanela={() => window.electronAPI?.toggleMaximizeWindow?.()}
                        onFecharJanela={() => window.electronAPI?.closeWindow?.()}
                    />

                    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#090a0c]">
                        <RailChat
                            onAlternarSidebar={alternarNavegacaoChat}
                            onNovaConversa={iniciarNovaConversa}
                            sidebarExpandida={sidebarExpandida}
                            mostrarNovaConversa={!sidebarExpandida}
                        />

                        <Sidebar
                            collapsed={!sidebarExpandida}
                            projects={projects}
                            activeProjectId={activeProjectId}
                            onSelectProject={abrirProjeto}
                            isCreatingProject={isCreatingProject}
                            newProjectName={newProjectName}
                            onSetNewProjectName={setNewProjectName}
                            onSetIsCreatingProject={setIsCreatingProject}
                            onAddProject={addProject}
                            newProjectInputRef={newProjectInputRef}
                            conversations={conversations}
                            activeConversationId={activeConversationId}
                            onSelectConversation={(id) => {
                                setActiveConversationId(id)
                                setActiveProjectId(null)
                                setShowSettings(false)
                                setShowAssistantsPanel(false)
                                setShowAssistantEditor(false)
                                setShowMCPPanel(false)
                                setEditingAssistant(null)
                            }}
                            onDeleteConversation={deleteConversation}
                            onRenameConversation={renameConversation}
                            onMoveConversationToProject={moveConversationToProject}
                            onCreateNewConversation={iniciarNovaConversa}
                            busca={shell.buscaSidebar}
                            onBuscaChange={shell.setBuscaSidebar}
                            onAbrirContexto={() => shell.alternarOverlay('hub-contexto')}
                            nomePerfil={profile.name}
                            fotoPerfil={profile.fotoPerfil}
                            perfilAberto={shell.perfilAberto}
                            onAlternarPerfil={() => shell.alternarOverlay('perfil')}
                            onFecharPerfil={shell.fecharOverlays}
                            onAbrirPerfil={() => {
                                shell.fecharOverlays()
                                abrirConfiguracoesPorSecao('perfil')
                            }}
                            onAbrirPersonalizacao={() => {
                                shell.fecharOverlays()
                                abrirConfiguracoesPorSecao('personalizacao')
                            }}
                            onAbrirConfiguracao={() => {
                                shell.fecharOverlays()
                                abrirConfiguracoesPorSecao('configuracao')
                            }}
                        />

                        <div
                            className={`flex min-h-0 min-w-0 flex-1 flex-col ${estiloTransicaoLayout}`}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            <div className={classeCanvasPrincipal}>
                                <AnimatePresence mode="wait">
                                    {visualizacaoPrincipalAtiva === 'chat' && (
                                        <motion.div
                                            key="conteudo-chat"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                                        >
                                            {messages.length === 0 ? (
                                                <PainelInicialChat
                                                    acoesPrincipais={shell.acoesHome}
                                                    promptsRapidos={shell.promptsRapidos}
                                                    onSelecionarAcao={aplicarAcaoHome}
                                                />
                                            ) : (
                                                <MessageList
                                                    messages={messages}
                                                    messagesContainerRef={messagesContainerRef}
                                                    messagesEndRef={messagesEndRef}
                                                    isGenerating={isGenerating}
                                                    isAnalyzingImage={isAnalyzingImage}
                                                    messageSources={messageSources}
                                                    messageSearchCards={messageSearchCards}
                                                    expandedSources={expandedSources}
                                                    onToggleSources={(msgId) => setExpandedSources(expandedSources === msgId ? null : msgId)}
                                                    copiedMessageId={copiedMessageId}
                                                    onCopyMessage={copyMessage}
                                                    onEditUserMessage={editarMensagemUsuario}
                                                    onRegenerateResponse={regenerateLastResponse}
                                                    profileName={profile.name}
                                                    hasInvestigationTrace={!!currentTrace}
                                                    onShowReasoning={() => setShowReasoningTrail(true)}
                                                />
                                            )}

                                            {currentTrace?.state === 'awaiting_clarification' && currentTrace.alignmentCheckpoint && (
                                                <div className="px-6 pb-2">
                                                    <ClarificationCard
                                                        checkpoint={currentTrace.alignmentCheckpoint}
                                                        onSubmit={async (clarification) => {
                                                            try {
                                                                await investigateService.provideClarification(clarification)
                                                            } catch (error) {
                                                                console.error('[ChatWindow] Error providing clarification:', error)
                                                            }
                                                        }}
                                                        onSkip={async () => {
                                                            try {
                                                                await investigateService.provideClarification({
                                                                    answers: {},
                                                                    skipClarification: true
                                                                })
                                                            } catch (error) {
                                                                console.error('[ChatWindow] Error skipping clarification:', error)
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <InputArea
                                                input={input}
                                                onInputChange={handleInputChange}
                                                onSend={handleSendChat}
                                                onKeyDown={handleKeyDown}
                                                onPaste={handlePaste}
                                                textareaRef={textareaRef}
                                                isGenerating={isGenerating}
                                                onStopGeneration={stopGeneration}
                                                pendingMessage={pendingMessage}
                                                pendingScreenshots={pendingScreenshots}
                                                onRemoveScreenshot={(idx) => setPendingScreenshots((prev) => prev.filter((_, i) => i !== idx))}
                                                onAddScreenshot={(base64) => setPendingScreenshots((prev) => [...prev, base64])}
                                                pendingFiles={pendingFiles}
                                                onRemoveFile={(id) => setPendingFiles((prev) => prev.filter((file) => file.id !== id))}
                                                onAttachFile={lidarComAnexoArquivo}
                                                inputMenuOpen={inputMenuOpen}
                                                onToggleInputMenu={() => {
                                                    if (shell.resumoContextoAberto) {
                                                        shell.fecharOverlays()
                                                    }

                                                    setInputMenuOpen(!inputMenuOpen)
                                                }}
                                                webSearchEnabled={webSearchEnabled}
                                                onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
                                                investigateMode={investigateMode}
                                                onToggleInvestigateMode={() => setInvestigateMode(!investigateMode)}
                                                isInvestigating={isInvestigating}
                                                toolCallingAtivo={toolCallingAtivo}
                                                onToggleToolCalling={() => {
                                                    const novoValor = !toolCallingAtivo
                                                    setToolCallingAtivo(novoValor)
                                                    localStorage.setItem('selene_tool_calling', String(novoValor))
                                                }}
                                                reasoningAtivo={reasoningAtivo}
                                                onToggleReasoning={alternarReasoning}
                                                modeloCompativelComReasoning={modeloCompativelComReasoning}
                                                mcpServers={mcpServers}
                                                onOpenMCPPanel={abrirPainelMcp}
                                                onConnectMCPServer={handleConnectMCPServer}
                                                provedorAtivo={provedorAtivo}
                                                modeloOpenRouter={modeloOpenRouter}
                                                modeloLocal={modeloLocal}
                                                modeloAtivo={modeloAtivo}
                                                openRouterKey={openRouterKey}
                                                onSelecionarModeloOpenRouter={setModeloOpenRouter}
                                                onSelecionarModeloLocal={setModeloLocal}
                                                voiceInput={voiceInput}
                                                resumoContextoAtivo={shell.resumoContextoAtivo}
                                                itensContexto={shell.itensHubContexto}
                                                resumoContextoAberto={shell.resumoContextoAberto}
                                                onToggleResumoContexto={() => {
                                                    if (inputMenuOpen) {
                                                        setInputMenuOpen(false)
                                                    }

                                                    shell.alternarOverlay('resumo-contexto')
                                                }}
                                                onFecharResumoContexto={shell.fecharOverlays}
                                                onSelecionarAssistenteContexto={selecionarAssistenteContexto}
                                                onSelecionarProjetoContexto={selecionarProjetoContexto}
                                            />
                                        </motion.div>
                                    )}

                                    {visualizacaoPrincipalAtiva === 'configuracoes' && (
                                        <SettingsPanel
                                            key="painel-configuracoes"
                                            {...propsPainelConfiguracoes}
                                            onClose={abrirChatPrincipal}
                                        />
                                    )}

                                    {visualizacaoPrincipalAtiva === 'assistentes' && (
                                        <AssistantsPanel
                                            key="painel-assistentes"
                                            assistants={assistants}
                                            onOpenEditor={abrirEditorAssistente}
                                            onClose={abrirChatPrincipal}
                                        />
                                    )}

                                    {visualizacaoPrincipalAtiva === 'editor-assistente' && (
                                        <AssistantEditor
                                            key={`editor-assistente-${editingAssistant?.id ?? 'novo'}`}
                                            isOpen={showAssistantEditor}
                                            assistant={editingAssistant}
                                            onSave={salvarAssistenteEditado}
                                            onClose={fecharEditorAssistente}
                                        />
                                    )}

                                    {visualizacaoPrincipalAtiva === 'mcp' && (
                                        <MCPPanel
                                            key="painel-mcp"
                                            onClose={abrirChatPrincipal}
                                        />
                                    )}

                                    {visualizacaoPrincipalAtiva === 'projeto' && activeProject && (
                                        <ProjectView
                                            key={`projeto-${activeProject.id}`}
                                            project={activeProject}
                                            conversations={conversations}
                                            onClose={abrirChatPrincipal}
                                            onDeleteProject={() => deleteProject(activeProject.id)}
                                            onRenameProject={(newName) => renameProject(activeProject.id, newName)}
                                            onUpdateProject={(updates) => updateProject(activeProject.id, updates)}
                                            onRenameFile={(fileId, newName) => renameProjectFile(activeProject.id, fileId, newName)}
                                            onRemoveFile={(fileId) => removeFileFromProject(activeProject.id, fileId)}
                                            onDeleteConversation={deleteConversation}
                                            onRenameConversation={renameConversation}
                                            onUploadFiles={() => handleProjectFileUpload(activeProject.id)}
                                            onSelectConversation={(convId) => {
                                                setActiveConversationId(convId)
                                                setActiveProjectId(null)
                                            }}
                                            chatInput={projectChatInput}
                                            onChatInputChange={setProjectChatInput}
                                            onCreateChat={() => handleCreateProjectChat(activeProject.id)}
                                            chatInputRef={projectChatInputRef}
                                            pendingScreenshots={projectPendingScreenshots}
                                            onRemoveScreenshot={(index) => setProjectPendingScreenshots((prev) => prev.filter((_, idx) => idx !== index))}
                                            onAddImages={handleProjectChatImagesSelected}
                                            onChatPaste={handleProjectChatPaste}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <HubContextoChat
                            aberto={shell.hubContextoAberto}
                            itens={shell.itensHubContexto}
                            provedor={shell.resumoContextoAtivo.provedor}
                            modelo={shell.resumoContextoAtivo.modelo}
                            perfilLatencia={shell.resumoContextoAtivo.perfilLatencia}
                            onClose={shell.fecharOverlays}
                            onSelecionarAssistente={selecionarAssistenteContexto}
                            onSelecionarProjeto={(projectId) => {
                                shell.fecharOverlays()
                                abrirProjeto(projectId)
                            }}
                            onAbrirAssistentes={() => {
                                shell.fecharOverlays()
                                abrirPainelAssistentes()
                            }}
                            onAbrirProjetos={() => shell.alternarOverlay('seletor-projetos')}
                            onAbrirConfiguracoes={() => {
                                shell.fecharOverlays()
                                abrirConfiguracoes()
                            }}
                        />

                        <SeletorProjetosChat
                            aberto={shell.seletorProjetosAberto}
                            projects={shell.projetosRecentes}
                            onClose={shell.fecharOverlays}
                            onSelecionarProjeto={(projectId) => {
                                shell.fecharOverlays()
                                abrirProjeto(projectId)
                            }}
                            onCriarProjeto={criarProjetoRapido}
                        />
                    </div>
                </div>
            </div>

            {/* Reasoning Trail Modal */}
            <ReasoningTrailModal
                isOpen={showReasoningTrail}
                onClose={() => setShowReasoningTrail(false)}
                trace={currentTrace}
            />
        </>
    )
}

export default ChatWindow
