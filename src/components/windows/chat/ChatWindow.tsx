import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Send, Minus, Square, X, Terminal,
    MessageSquare, Plus, Settings, ChevronLeft, ChevronRight,
    Copy, RefreshCw, StopCircle, Check, Trash2, Bot
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { v4 as uuidv4 } from 'uuid'

// Import logo image for production compatibility
import seleneLogo from '/tray-icon.png'

import type { ChatMessage } from '../../../types/chat'
import { useAppConfig } from '../../../hooks/useAppConfig'
import { useCrossChatContext } from '../../../hooks/useCrossChatContext'
import { useMemoryAutopilot } from '../../../hooks/useMemoryAutopilot'
import { composePrompt, processUserMessageForMemory } from '../../../services/PromptPipeline'
import { SettingsPanel } from '../../config/SettingsPanel'
import { useAssistants } from '../../../hooks/useAssistants'
import { AssistantsPanel } from './AssistantsPanel'
import { AssistantEditor } from './AssistantEditor'
import type { AssistantConfig } from '../../../utils/assistentesPadrao'

// Types
interface Conversation {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
}

// Sidebar Item Component
const SidebarItem: React.FC<{
    icon: React.ElementType
    label: string
    active?: boolean
    collapsed?: boolean
    onClick?: () => void
    onDelete?: () => void
    trailing?: React.ReactNode
}> = ({ icon: Icon, label, active, collapsed, onClick, onDelete, trailing }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            className={`w-full p-3 rounded-xl flex items-center transition-all duration-200 text-left ${active
                ? 'bg-purple-500/15 text-purple-200'
                : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'} ${collapsed ? 'justify-center' : 'gap-3'}`}
            title={collapsed ? label : undefined}
        >
            <Icon size={18} className={active ? 'text-purple-400' : 'group-hover:text-purple-300 transition-colors'} />
            {!collapsed && <span className="flex-1 text-sm font-medium truncate pr-6">{label}</span>}
            {!collapsed && trailing}
        </button>
        {!collapsed && onDelete && (
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
                title="Excluir conversa"
            >
                <Trash2 size={14} />
            </button>
        )}
    </div>
)

// Message Actions Component
const MessageActions: React.FC<{
    onCopy: () => void
    onRegenerate: () => void
    copied: boolean
    canRegenerate: boolean
}> = ({ onCopy, onRegenerate, copied, canRegenerate }) => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
            onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
            title="Copiar"
        >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
        {canRegenerate && (
            <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                title="Regenerar"
            >
                <RefreshCw size={14} />
            </button>
        )}
    </div>
)

// Streaming Indicator Component - Removed as requested
// const StreamingIndicator: React.FC = () => (...)

// SettingsPanel is now imported from ../../config/SettingsPanel

const ChatWindow: React.FC = () => {
    // ============================================
    // Use centralized config hook
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

    // Memory and cross-chat hooks
    const crossChat = useCrossChatContext()
    const memoryAutopilot = useMemoryAutopilot()

    // Conversations state
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

    // UI state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showAssistantsPanel, setShowAssistantsPanel] = useState(false)
    const [showAssistantEditor, setShowAssistantEditor] = useState(false)
    const [editingAssistant, setEditingAssistant] = useState<AssistantConfig | null>(null)
    const [input, setInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const [pendingScreenshots, setPendingScreenshots] = useState<string[]>([])

    // Assistants hook
    const assistants = useAssistants()

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Get current conversation's messages
    const activeConversation = conversations.find(c => c.id === activeConversationId)
    const messages = activeConversation?.messages ?? []

    // Persist conversations
    useEffect(() => {
        localStorage.setItem('selene_conversations', JSON.stringify(conversations))
    }, [conversations])

    // Hydration from main window
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

    // Receber screenshot encaminhada do overlay/atalho
    useEffect(() => {
        const remover = window.electronAPI?.onScreenshotChat?.((dataUrl: string) => {
            setPendingScreenshots((lista) => [...lista, dataUrl])
            setShowSettings(false)
            setInput('')
        })
        return () => remover?.()
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Create new conversation
    const createNewConversation = useCallback(() => {
        setActiveConversationId(null)
        setInput('')
    }, [])

    // Update conversation messages
    const updateConversationMessages = useCallback((convId: string, newMessages: ChatMessage[]) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convId) {
                const title = newMessages[0]?.content.slice(0, 30) + (newMessages[0]?.content.length > 30 ? '...' : '') || 'Nova conversa'
                return { ...c, messages: newMessages, title, updatedAt: Date.now() }
            }
            return c
        }))
    }, [])

    // Delete conversation
    const deleteConversation = useCallback((convId: string) => {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (activeConversationId === convId) {
            setActiveConversationId(null)
        }
        // Also remove from embedding index (cross-chat memory)
        import('../../../services/crosschat/EmbeddingIndex').then(({ removeConversation }) => {
            const removed = removeConversation(convId)
            console.log(`[ChatWindow] Removed ${removed} messages from embedding index`)
        }).catch(err => console.warn('[ChatWindow] Failed to clean embedding index:', err))
    }, [activeConversationId])

    // Send message with streaming
    const handleSend = async () => {
        const hasTexto = input.trim().length > 0
        if ((!hasTexto && pendingScreenshots.length === 0) || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) {
            console.error('[ChatWindow] No AI service available')
            return
        }

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

        // Create conversation if none active
        let convId = activeConversationId
        if (!convId) {
            const titulo = hasTexto ? input.trim().slice(0, 30) : 'Screenshots'
            const newConv: Conversation = {
                id: uuidv4(),
                title: titulo + (hasTexto && input.trim().length > 30 ? '...' : ''),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            setConversations(prev => [newConv, ...prev])
            setActiveConversationId(newConv.id)
            convId = newConv.id
        }

        const promptImagem = pendingScreenshots.length > 0 ? (hasTexto ? input.trim() : 'Descreva a imagem e responda em português.') : null
        const userContent = promptImagem ?? input.trim()

        const userMsg: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: userContent,
            timestamp: Date.now()
        }

        // Create placeholder AI message for streaming ou imagem
        const aiMsgId = uuidv4()
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }

        const currentMessages = [...messages, userMsg, aiMsg]
        updateConversationMessages(convId, currentMessages)
        setInput('')
        setPendingScreenshots([])
        setIsGenerating(true)

        abortControllerRef.current = new AbortController()
        let streamedContent = ''

        try {
            if (pendingScreenshots.length > 0 && promptImagem) {
                const imagemUnica = await juntarScreenshots(pendingScreenshots)
                if (!imagemUnica) throw new Error('Falha ao preparar imagens')
                const resposta = await servico.analisarImagem(promptImagem, imagemUnica)
                setConversations(prev => prev.map(c => {
                    if (c.id === convId) {
                        return {
                            ...c,
                            messages: c.messages.map(m =>
                                m.id === aiMsgId ? { ...m, content: resposta } : m
                            )
                        }
                    }
                    return c
                }))
            } else {
                const { systemPrompt: composedPrompt } = await composePrompt({
                    systemPrompt,
                    userProfileContext: getProfileContext(),
                    currentConversationId: convId,
                    currentUserMessage: userMsg.content
                })

                await servico.streamChat(
                    userMsg.content,
                    (chunk: string) => {
                        streamedContent += chunk
                        setConversations(prev => prev.map(c => {
                            if (c.id === convId) {
                                return {
                                    ...c,
                                    messages: c.messages.map(m =>
                                        m.id === aiMsgId ? { ...m, content: streamedContent } : m
                                    )
                                }
                            }
                            return c
                        }))
                    },
                    composedPrompt,
                    messages
                )
            }

            processUserMessageForMemory(
                userMsg.id,
                convId,
                userMsg.content,
                userMsg.timestamp
            ).catch(err => console.warn('[ChatWindow] Memory processing failed:', err))

        } catch (error: any) {
            if (error?.name === 'AbortError') {
                console.log('[ChatWindow] Generation stopped by user')
            } else {
                console.error('[ChatWindow] Chat error:', error)
                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: 'Falha ao processar mensagem. Verifique sua conexão ou chaves de API.',
                    timestamp: Date.now()
                }
                updateConversationMessages(convId, [...messages, userMsg, errorMsg])
            }
        } finally {
            setIsGenerating(false)
            abortControllerRef.current = null
        }
    }

    // Stop generation
    const stopGeneration = () => {
        abortControllerRef.current?.abort()
        setIsGenerating(false)
    }

    // Regenerate last response
    const regenerateLastResponse = async () => {
        if (!activeConversationId || messages.length < 2 || isGenerating) return

        const servico = criarOuObterServico()
        if (!servico) return

        // Remove last assistant message
        const lastUserMsgIndex = messages.map(m => m.role).lastIndexOf('user')
        if (lastUserMsgIndex === -1) return

        const messagesUpToUser = messages.slice(0, lastUserMsgIndex + 1)
        const userContent = messages[lastUserMsgIndex].content

        updateConversationMessages(activeConversationId, messagesUpToUser)
        setIsGenerating(true)

        try {
            // Compose prompt with all contexts using the pipeline
            const { systemPrompt: composedPrompt } = await composePrompt({
                systemPrompt,
                userProfileContext: getProfileContext(),
                currentConversationId: activeConversationId,
                currentUserMessage: userContent
            })

            const response = await servico.chat(userContent, composedPrompt, messagesUpToUser.slice(0, -1))
            const aiMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }
            updateConversationMessages(activeConversationId, [...messagesUpToUser, aiMsg])
        } catch (error) {
            console.error('[ChatWindow] Regenerate error:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    // Copy message
    const copyMessage = (msgId: string, content: string) => {
        navigator.clipboard.writeText(content)
        setCopiedMessageId(msgId)
        setTimeout(() => setCopiedMessageId(null), 2000)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex h-screen w-full bg-[#0a0a0c] text-neutral-100 font-sans overflow-hidden selection:bg-purple-500/30">
            {/* Sidebar */}
            <AnimatePresence initial={false}>
                <motion.aside
                    initial={false}
                    animate={{ width: sidebarCollapsed ? 64 : 280 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="flex-none flex flex-col border-r border-white/5 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
                >
                    {/* Sidebar Header */}
                    <div
                        className={`h-14 flex items-center px-4 border-b border-white/5 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                    >
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 flex items-center justify-center">
                                <img src={seleneLogo} alt="Selene Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="font-semibold text-sm">Selene</span>
                            </div>
                        )}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    {/* Assistants Button */}
                    <div className="p-3 pb-0">
                        <button
                            onClick={() => {
                                setShowAssistantsPanel(true)
                                setShowSettings(false)
                            }}
                            className={`w-full flex items-center gap-2 p-3 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${
                                assistants.hasActiveAssistant
                                    ? 'text-purple-300 hover:bg-purple-500/20'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                            }`}
                            title={assistants.activeAssistant?.nome || 'Assistentes'}
                        >
                            <Bot size={18} />
                            {!sidebarCollapsed && (
                                <span className="text-sm font-medium">
                                    {assistants.activeAssistant?.nome || 'Assistentes'}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-3">
                        <button
                            onClick={() => {
                                createNewConversation()
                                setShowAssistantsPanel(false)
                            }}
                            className={`w-full flex items-center gap-2 p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                        >
                            <Plus size={18} />
                            {!sidebarCollapsed && <span className="text-sm font-medium">Nova conversa</span>}
                        </button>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                        {!sidebarCollapsed && (
                            <p className="px-3 text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
                                Conversas recentes
                            </p>
                        )}
                        {conversations.map(conv => (
                            <SidebarItem
                                key={conv.id}
                                icon={MessageSquare}
                                label={conv.title}
                                collapsed={sidebarCollapsed}
                                active={conv.id === activeConversationId}
                                onClick={() => {
                                setActiveConversationId(conv.id)
                                setShowSettings(false)
                                setShowAssistantsPanel(false)
                            }}
                                onDelete={() => deleteConversation(conv.id)}
                            />
                        ))}
                    </div>

                    {/* Settings */}
                    <div className="p-3 border-t border-white/5">
                        <SidebarItem
                            icon={Settings}
                            label="Configurações"
                            collapsed={sidebarCollapsed}
                            onClick={() => {
                                setShowSettings(true)
                                setShowAssistantsPanel(false)
                            }}
                        />
                    </div>
                </motion.aside>
            </AnimatePresence>

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

                {/* Messages Area */}
                <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-[#0a0a0c] to-[#0d0d10] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 flex items-center justify-center">
                                <img src={seleneLogo} alt="Selene Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <p className="text-[30px] text-neutral-400 font-sans font-light tracking-wide">
                                    {profile.name ? `Olá, ${profile.name}! Como posso ajudar?` : 'Comece uma conversa com a Selene'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mr-3 mt-1">
                                        <Sparkles size={14} className="text-purple-400" />
                                    </div>
                                )}

                                <div className={`max-w-[70%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/30'
                                            : 'bg-neutral-800/60 border border-white/5 text-neutral-200 rounded-tl-sm'
                                            } ${isGenerating && index === messages.length - 1 && msg.role === 'assistant'
                                                ? "[&>*:last-child]:after:content-[''] [&>*:last-child]:after:inline-block [&>*:last-child]:after:w-2.5 [&>*:last-child]:after:h-2.5 [&>*:last-child]:after:bg-purple-400 [&>*:last-child]:after:rounded-full [&>*:last-child]:after:ml-1.5 [&>*:last-child]:after:align-baseline [&>*:last-child]:after:animate-pulse"
                                                : ''
                                            }`}
                                    >
                                        {(isGenerating && index === messages.length - 1 && msg.role === 'assistant' && !msg.content) && (
                                            <div className="inline-block w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse" />
                                        )}
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                                ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ul>,
                                                ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1 marker:text-purple-400">{children}</ol>,
                                                li: ({ children }) => <li className="pl-1">{children}</li>,
                                                code: ({ className, children, ...props }) => {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    const isInline = !match && !String(children).includes('\n')
                                                    return isInline ? (
                                                        <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-purple-200 border border-white/5" {...props}>
                                                            {children}
                                                        </code>
                                                    ) : (
                                                        <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117]">
                                                            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Terminal size={12} className="text-white/40" />
                                                                    <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{match?.[1] || 'code'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-3 overflow-x-auto">
                                                                <code className="text-xs font-mono block text-neutral-300" {...props}>
                                                                    {children}
                                                                </code>
                                                            </div>
                                                        </div>
                                                    )
                                                },
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                                                        {children}
                                                    </a>
                                                ),
                                                blockquote: ({ children }) => (
                                                    <blockquote className="border-l-2 border-purple-500/50 pl-3 py-1 my-2 bg-purple-500/5 italic text-white/70 text-sm rounded-r">
                                                        {children}
                                                    </blockquote>
                                                ),
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Message Actions & Timestamp */}
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        <span className="text-[10px] text-neutral-600">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.role === 'assistant' && (
                                            <MessageActions
                                                onCopy={() => copyMessage(msg.id, msg.content)}
                                                onRegenerate={regenerateLastResponse}
                                                copied={copiedMessageId === msg.id}
                                                canRegenerate={index === messages.length - 1 && !isGenerating}
                                            />
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0 ml-3 mt-1">
                                        <div className="w-3 h-3 rounded-full bg-neutral-500" />
                                    </div>
                                )}
                            </motion.div>
                        ))
                    )}



                    <div ref={messagesEndRef} />
                </main>

                {/* Input Area */}
                <footer className="flex-none p-4 bg-neutral-900/50 border-t border-white/5">
                    {pendingScreenshots.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-start gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                            {pendingScreenshots.map((shot, idx) => (
                                <div key={`shot-chat-${idx}`} className="relative">
                                    <img src={shot} alt={`Screenshot ${idx + 1}`} className="h-16 w-auto rounded-lg border border-white/10" />
                                    <button
                                        onClick={() => setPendingScreenshots((lista) => lista.filter((_, i) => i !== idx))}
                                        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white text-[10px] shadow-lg"
                                        title="Remover imagem"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <div className="text-xs text-neutral-400 min-w-[120px]">Imagens prontas para enviar.</div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 bg-neutral-800/50 rounded-2xl border border-white/10 px-4 py-2 focus-within:border-purple-500/50 transition-colors">
                        <textarea
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value)
                                // Auto-resize
                                e.target.style.height = 'auto'
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={pendingScreenshots.length > 0 ? 'Descreva as imagens ou deixe em branco para resumo...' : 'Envie uma mensagem...'}
                            disabled={isGenerating}
                            rows={1}
                            className="flex-1 bg-transparent border-none outline-none text-neutral-200 placeholder-neutral-500 text-sm resize-none overflow-y-auto leading-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                            style={{ minHeight: '20px', maxHeight: '120px' }}
                        />
                        {isGenerating ? (
                            <button
                                onClick={stopGeneration}
                                className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                title="Parar geração"
                            >
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() && pendingScreenshots.length === 0}
                                className={`p-2.5 rounded-xl transition-all duration-200 ${(input.trim() || pendingScreenshots.length > 0)
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:scale-105'
                                    : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                                    }`}
                            >
                                <Send size={18} />
                            </button>
                        )}
                    </div>
                    <p className="text-center text-[10px] text-neutral-600 mt-2">
                        Selene pode cometer erros. Verifique informações importantes.
                    </p>
                </footer>
            </div>
        </div>
    )
}

export default ChatWindow
