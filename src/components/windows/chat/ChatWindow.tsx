import React, { useEffect, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Minus, Square, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

// Types
import type { Conversation } from './types'
import type { ChatMessage } from '../../../types/chat'
import type { AssistantConfig } from '../../../utils/assistentesPadrao'

// Hooks
import { useAppConfig } from '../../../hooks/useAppConfig'
import { useCrossChatContext } from '../../../hooks/useCrossChatContext'
import { useMemoryAutopilot } from '../../../hooks/useMemoryAutopilot'
import { useAssistants } from '../../../hooks/useAssistants'
import { useChatUI } from './hooks'
import { useSendMessage } from './hooks'

// Components
import { Sidebar, ProjectView, MessageList, InputArea, ClarificationCard } from './components'
import { SettingsPanel } from '../../config/SettingsPanel'
import { AssistantsPanel } from './AssistantsPanel'
import { AssistantEditor } from './AssistantEditor'
import { MCPPanel } from '../../config/MCPPanel'
import { ReasoningTrailModal } from '../../modals/ReasoningTrailModal'

// Services
import { investigateService } from '../../../services/investigate'
import { toolCallingService } from '../../../services/tools/ToolCallingService'
import { mcpToolBridge } from '../../../services/tools/MCPToolBridge'
import { obterConfiguracaoPerfilGeracao } from '../../../services/ai/politicaGeracao'
import { processFileForProject, isFileSupported, formatFileSize, MAX_FILE_SIZE } from '../../../services/DocumentService'
import { indexProjectFile, removeFileEmbeddings } from '../../../services/ProjectContextService'
import type { Project } from '../../../types/project'
import { createProject } from '../../../types/project'
import { setProjectUpdateCallback, clearProjectUpdateCallback } from '../../../services/tools/builtin'

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
        modeloLmStudio, setModeloLmStudio,
        baseUrlLmStudio, setBaseUrlLmStudio,
        provedorAtivo, setProvedorAtivo,
        systemPrompt,
        criarOuObterServico,
        voiceInput,
    } = useAppConfig()

    const crossChat = useCrossChatContext()
    const memoryAutopilot = useMemoryAutopilot()
    const assistants = useAssistants()

    // ============================================
    // UI State (from hook)
    // ============================================
    const chatUI = useChatUI()
    const {
        sidebarCollapsed, setSidebarCollapsed,
        showSettings, setShowSettings,
        showAssistantsPanel, setShowAssistantsPanel,
        showAssistantEditor, setShowAssistantEditor,
        showMCPPanel, setShowMCPPanel,
        showReasoningTrail, setShowReasoningTrail,
        input, setInput,
        inputMenuOpen, setInputMenuOpen,
        pendingScreenshots, setPendingScreenshots,
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
        currentTrace, setCurrentTrace,
        mcpServers, setMcpServers,
        isCreatingProject, setIsCreatingProject,
        newProjectName, setNewProjectName,
        newProjectInputRef,
        projectChatInput, setProjectChatInput,
        projectChatInputRef,
        messagesEndRef,
        messagesContainerRef,
    } = chatUI

    // ============================================
    // Conversation State
    // ============================================
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        const saved = localStorage.getItem('selene_conversations')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return []
            }
        }
        return []
    })
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

    const activeConversation = conversations.find(c => c.id === activeConversationId)
    const messages = activeConversation?.messages ?? []

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
        setIsInvestigating,
        setCurrentTrace,
        setMessageSources,
        setMessageSearchCards,
        promptBase: assistants.effectiveSystemPrompt || systemPrompt,
        getProfileContext,
        criarOuObterServico,
    })

    // ============================================
    // Persistence Effects
    // ============================================
    useEffect(() => {
        localStorage.setItem('selene_conversations', JSON.stringify(conversations))
    }, [conversations])

    useEffect(() => {
        localStorage.setItem('selene_projects', JSON.stringify(projects))
    }, [projects])

    useEffect(() => {
        if (isCreatingProject && newProjectInputRef.current) {
            newProjectInputRef.current.focus()
        }
    }, [isCreatingProject, newProjectInputRef])

    // ============================================
    // Electron Events
    // ============================================
    useEffect(() => {
        const removeListener = window.electronAPI?.onHydrateChat?.((msgs: ChatMessage[]) => {
            console.log('[ChatWindow] Hydrating with', msgs.length, 'messages')
            if (msgs.length > 0) {
                const newConv: Conversation = {
                    id: uuidv4(),
                    title: msgs[0].content.slice(0, 30) + (msgs[0].content.length > 30 ? '...' : ''),
                    messages: msgs,
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

    // ============================================
    // Scroll Handling
    // ============================================
    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
            setShouldAutoScroll(isNearBottom)
        }

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [messagesContainerRef])

    useEffect(() => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, shouldAutoScroll, messagesEndRef])

    // ============================================
    // Service Configuration
    // ============================================
    useEffect(() => {
        const chatFnInvestigacao = async (prompt: string): Promise<string> => {
            const servico = criarOuObterServico()
            if (!servico) throw new Error('No AI service available')

            const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { investigateMode: true })
            let response = ''
            await servico.streamChat(
                prompt,
                (chunk: string) => { response += chunk },
                'Você é um assistente de pesquisa. Responda de forma objetiva e estruturada.',
                [],
                {
                    temperature: configGeracao.temperature,
                }
            )
            return response
        }

        const chatFnTools = async (prompt: string): Promise<string> => {
            const servico = criarOuObterServico()
            if (!servico) throw new Error('No AI service available')

            const configGeracao = obterConfiguracaoPerfilGeracao(prompt, { forcarPerfil: 'pergunta_curta' })
            let response = ''
            await servico.streamChat(
                prompt,
                (chunk: string) => { response += chunk },
                'Você é um assistente de decisão de ferramentas. Seja extremamente conciso.',
                [],
                {
                    temperature: configGeracao.temperature,
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
        setActiveConversationId(null)
        setInput('')
    }, [setInput])

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

    const addFileToProject = useCallback(async (projectId: string, file: File) => {
        if (!isFileSupported(file)) {
            alert(`Tipo de arquivo não suportado: ${file.name}\n\nFormatos aceitos: PDF, DOCX, TXT, MD`)
            return
        }
        if (file.size > MAX_FILE_SIZE) {
            alert(`Arquivo muito grande: ${formatFileSize(file.size)}\n\nTamanho máximo: ${formatFileSize(MAX_FILE_SIZE)}`)
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

    const removeFileFromProject = useCallback((projectId: string, fileId: string) => {
        removeFileEmbeddings(fileId)
        setProjects(prev => prev.map(p =>
            p.id === projectId
                ? { ...p, files: p.files.filter(f => f.id !== fileId), updatedAt: Date.now() }
                : p
        ))
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

    const createNewConversationInProject = useCallback((projectId: string, initialMessage?: string) => {
        const newConv: Conversation = {
            id: uuidv4(),
            title: initialMessage?.slice(0, 30) || 'Nova conversa',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectId
        }
        setConversations(prev => [newConv, ...prev])
        setActiveConversationId(newConv.id)
        setActiveProjectId(null)

        if (initialMessage) {
            setInput(initialMessage)
            setTimeout(() => {
                const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement
                sendButton?.click()
            }, 100)
        }

        return newConv.id
    }, [setInput])

    // ============================================
    // Message Actions
    // ============================================
    const copyMessage = useCallback((msgId: string, content: string) => {
        navigator.clipboard.writeText(content)
        setCopiedMessageId(msgId)
        setTimeout(() => setCopiedMessageId(null), 2000)
    }, [setCopiedMessageId])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }, [handleSend])

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                        const base64 = ev.target?.result as string
                        setPendingScreenshots(prev => [...prev, base64])
                    }
                    reader.readAsDataURL(file)
                }
                break
            }
        }
    }, [setPendingScreenshots])

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

    // ============================================
    // Render
    // ============================================
    const activeProject = projects.find(p => p.id === activeProjectId)

    return (
        <>
            <div className="flex h-screen w-full bg-[#0a0a0c] text-neutral-100 font-sans overflow-hidden selection:bg-purple-500/30">
                {/* Sidebar */}
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
                    projects={projects}
                    activeProjectId={activeProjectId}
                    onSelectProject={setActiveProjectId}
                    onDeleteProject={deleteProject}
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
                        setActiveProjectId(null) // Close project view when selecting conversation
                        setShowSettings(false)
                        setShowAssistantsPanel(false)
                        setShowMCPPanel(false)
                    }}
                    onDeleteConversation={deleteConversation}
                    onRenameConversation={renameConversation}
                    onMoveConversationToProject={moveConversationToProject}
                    onCreateNewConversation={() => {
                        createNewConversation()
                        setActiveProjectId(null)
                        setShowAssistantsPanel(false)
                        setShowSettings(false)
                        setShowMCPPanel(false)
                    }}
                    showAssistantsPanel={showAssistantsPanel}
                    onOpenAssistantsPanel={() => {
                        setShowAssistantsPanel(true)
                        setActiveProjectId(null)
                        setShowSettings(false)
                        setShowMCPPanel(false)
                    }}
                    onOpenMCPPanel={() => {
                        setShowMCPPanel(true)
                        setActiveProjectId(null)
                        setShowSettings(false)
                        setShowAssistantsPanel(false)
                    }}
                    onOpenSettings={() => {
                        setShowSettings(true)
                        setActiveProjectId(null)
                        setShowAssistantsPanel(false)
                        setShowMCPPanel(false)
                    }}
                    showMCPPanel={showMCPPanel}
                    activeAssistant={assistants.activeAssistant}
                    hasActiveAssistant={assistants.hasActiveAssistant}
                />

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col relative">
                    {/* Settings Panel */}
                    <AnimatePresence>
                        {showSettings && (
                            <SettingsPanel
                                profile={profile}
                                setProfile={setProfile}
                                memories={memories}
                                addMemory={addMemory}
                                removeMemory={removeMemory}
                                autoMemories={memoryAutopilot.memories.map(m => ({
                                    id: m.id,
                                    text: m.text,
                                    category: m.category,
                                    confidence: m.confidence,
                                    createdAt: m.createdAt
                                }))}
                                removeAutoMemory={memoryAutopilot.removeMemory}
                                clearAutoMemories={memoryAutopilot.clearMemories}
                                apiKey={apiKey}
                                setApiKey={setApiKey}
                                geminiKey={geminiKey}
                                setGeminiKey={setGeminiKey}
                                openRouterKey={openRouterKey}
                                setOpenRouterKey={setOpenRouterKey}
                                modeloOpenRouter={modeloOpenRouter}
                                setModeloOpenRouter={setModeloOpenRouter}
                                modeloLmStudio={modeloLmStudio}
                                setModeloLmStudio={setModeloLmStudio}
                                baseUrlLmStudio={baseUrlLmStudio}
                                setBaseUrlLmStudio={setBaseUrlLmStudio}
                                provedorAtivo={provedorAtivo}
                                setProvedorAtivo={setProvedorAtivo}
                                crossChatEnabled={crossChat.enabled}
                                setCrossChatEnabled={crossChat.setEnabled}
                                memoryAutopilotEnabled={memoryAutopilot.enabled}
                                setMemoryAutopilotEnabled={memoryAutopilot.setEnabled}
                                voiceInput={voiceInput}
                                onClose={() => setShowSettings(false)}
                            />
                        )}
                    </AnimatePresence>

                    {/* Assistants Panel */}
                    <AnimatePresence>
                        {showAssistantsPanel && (
                            <AssistantsPanel
                                assistants={assistants}
                                onOpenEditor={(assistant) => {
                                    setEditingAssistant(assistant)
                                    setShowAssistantEditor(true)
                                }}
                                onClose={() => setShowAssistantsPanel(false)}
                            />
                        )}
                    </AnimatePresence>

                    {/* Assistant Editor */}
                    <AnimatePresence>
                        {showAssistantEditor && (
                            <AssistantEditor
                                isOpen={showAssistantEditor}
                                assistant={editingAssistant}
                                onSave={(config) => {
                                    if (editingAssistant) {
                                        assistants.updateAssistant(editingAssistant.id, config)
                                    } else {
                                        assistants.addAssistant(config)
                                    }
                                    setShowAssistantEditor(false)
                                    setEditingAssistant(null)
                                }}
                                onClose={() => {
                                    setShowAssistantEditor(false)
                                    setEditingAssistant(null)
                                }}
                            />
                        )}
                    </AnimatePresence>

                    {/* MCP Panel */}
                    <AnimatePresence>
                        {showMCPPanel && (
                            <MCPPanel onClose={() => setShowMCPPanel(false)} />
                        )}
                    </AnimatePresence>

                    {/* Project View */}
                    {activeProject && (
                        <ProjectView
                            project={activeProject}
                            conversations={conversations}
                            onClose={() => setActiveProjectId(null)}
                            onRenameProject={(newName) => renameProject(activeProjectId!, newName)}
                            onUpdateProject={(updates) => updateProject(activeProjectId!, updates)}
                            onDeleteFile={(fileId) => removeFileFromProject(activeProjectId!, fileId)}
                            onDeleteConversation={deleteConversation}
                            onUploadFiles={() => handleProjectFileUpload(activeProjectId!)}
                            onSelectConversation={(convId) => {
                                setActiveConversationId(convId)
                                setActiveProjectId(null)
                            }}
                            chatInput={projectChatInput}
                            onChatInputChange={setProjectChatInput}
                            onCreateChat={(initialMessage) => {
                                createNewConversationInProject(activeProjectId!, initialMessage)
                                setProjectChatInput('')
                            }}
                            chatInputRef={projectChatInputRef}
                        />
                    )}

                    {/* Header */}
                    <header
                        className="flex-none h-14 flex items-center justify-between px-5 bg-neutral-900/80 border-b border-white/5 backdrop-blur-xl"
                        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                    >
                        <div>
                            <h1 className="font-medium text-sm text-neutral-200">
                                {activeConversation?.title || 'Selene Chat'}
                            </h1>
                            <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                {profile.name ? `Olá, ${profile.name}` : 'Online'}
                            </p>
                        </div>

                        <div
                            className="flex items-center gap-1"
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            <button
                                onClick={() => window.electronAPI?.minimizeWindow?.()}
                                className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Minus size={16} />
                            </button>
                            <button
                                onClick={() => window.electronAPI?.toggleMaximizeWindow?.()}
                                className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Square size={14} />
                            </button>
                            <button
                                onClick={() => window.electronAPI?.closeWindow?.()}
                                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </header>

                    {/* Message List */}
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
                        onRegenerateResponse={regenerateLastResponse}
                        profileName={profile.name}
                        hasInvestigationTrace={!!currentTrace}
                        onShowReasoning={() => setShowReasoningTrail(true)}
                    />

                    {/* Clarification Card - quando aguardando esclarecimento */}
                    {currentTrace?.state === 'awaiting_clarification' && currentTrace.alignmentCheckpoint && (
                        <div className="px-4 pb-2">
                            <ClarificationCard
                                checkpoint={currentTrace.alignmentCheckpoint}
                                onSubmit={async (clarification) => {
                                    try {
                                        await investigateService.provideClarification(clarification)
                                        // O trace será atualizado via subscription no useSendMessage
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

                    {/* Input Area */}
                    <InputArea
                        input={input}
                        onInputChange={setInput}
                        onSend={handleSend}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        textareaRef={textareaRef}
                        isGenerating={isGenerating}
                        onStopGeneration={stopGeneration}
                        pendingMessage={pendingMessage}
                        pendingScreenshots={pendingScreenshots}
                        onRemoveScreenshot={(idx) => setPendingScreenshots(prev => prev.filter((_, i) => i !== idx))}
                        onAddScreenshot={(base64) => setPendingScreenshots(prev => [...prev, base64])}
                        inputMenuOpen={inputMenuOpen}
                        onToggleInputMenu={() => setInputMenuOpen(!inputMenuOpen)}
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
                        mcpServers={mcpServers}
                        onOpenMCPPanel={() => setShowMCPPanel(true)}
                        onConnectMCPServer={handleConnectMCPServer}
                    />
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
