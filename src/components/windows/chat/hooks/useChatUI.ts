// Hook for managing chat UI state
import { useState, useRef } from 'react'
import type { InvestigationTrace } from '../../../../services/investigate'
import type { ToolCardData } from '../../../../types/tools'
import type { WebSource } from '../types'
import type { ArquivoAnexo } from '../../../../types/chat'

export interface MCPServerInfo {
    id: string
    name: string
    status: 'connected' | 'connecting' | 'disconnected' | 'error'
    icon?: string
    toolCount: number
}

export function useChatUI() {
    // Sidebar state
    const [sidebarExpandida, setSidebarExpandida] = useState(true)
    const [showSettings, setShowSettings] = useState(false)
    const [showAssistantsPanel, setShowAssistantsPanel] = useState(false)
    const [showAssistantEditor, setShowAssistantEditor] = useState(false)
    const [showMCPPanel, setShowMCPPanel] = useState(false)
    const [showReasoningTrail, setShowReasoningTrail] = useState(false)

    // Input state
    const [input, setInput] = useState('')
    const [inputMenuOpen, setInputMenuOpen] = useState(false)
    const [pendingScreenshots, setPendingScreenshots] = useState<string[]>([])
    const [pendingFiles, setPendingFiles] = useState<ArquivoAnexo[]>([])
    const [pendingMessage, setPendingMessage] = useState<{text: string; screenshots: string[]; arquivos?: ArquivoAnexo[]} | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false)
    const [isInvestigating, setIsInvestigating] = useState(false)
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)
    const generationIdRef = useRef<string | null>(null)

    // Message UI state
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const [expandedSources, setExpandedSources] = useState<string | null>(null)
    const [messageSources, setMessageSources] = useState<Record<string, WebSource[]>>({})
    const [messageSearchCards, setMessageSearchCards] = useState<Record<string, ToolCardData[]>>({})

    // Feature toggles
    const [webSearchEnabled, setWebSearchEnabled] = useState(false)
    const [investigateMode, setInvestigateMode] = useState(false)
    const [toolCallingAtivo, setToolCallingAtivo] = useState(() => {
        const salvo = localStorage.getItem('selene_tool_calling')
        if (salvo === null) return true
        return salvo === 'true'
    })
    const [reasoningAtivo, setReasoningAtivo] = useState(() => {
        const salvo = localStorage.getItem('selene_reasoning_ativo')
        if (salvo === null) return true
        return salvo === 'true'
    })

    // Investigation state
    const [currentTrace, setCurrentTrace] = useState<InvestigationTrace | null>(null)

    // MCP servers
    const [mcpServers, setMcpServers] = useState<MCPServerInfo[]>([])

    // Project creation UI
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const newProjectInputRef = useRef<HTMLInputElement>(null)
    const [projectChatInput, setProjectChatInput] = useState('')
    const [projectPendingScreenshots, setProjectPendingScreenshots] = useState<string[]>([])
    const projectChatInputRef = useRef<HTMLInputElement>(null)

    // Scroll refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)

    return {
        // Sidebar
        sidebarExpandida, setSidebarExpandida,
        showSettings, setShowSettings,
        showAssistantsPanel, setShowAssistantsPanel,
        showAssistantEditor, setShowAssistantEditor,
        showMCPPanel, setShowMCPPanel,
        showReasoningTrail, setShowReasoningTrail,

        // Input
        input, setInput,
        inputMenuOpen, setInputMenuOpen,
        pendingScreenshots, setPendingScreenshots,
        pendingFiles, setPendingFiles,
        pendingMessage, setPendingMessage,
        textareaRef,

        // Generation
        isGenerating, setIsGenerating,
        isInvestigating, setIsInvestigating,
        isAnalyzingImage, setIsAnalyzingImage,
        abortControllerRef,
        generationIdRef,

        // Message UI
        copiedMessageId, setCopiedMessageId,
        expandedSources, setExpandedSources,
        messageSources, setMessageSources,
        messageSearchCards, setMessageSearchCards,

        // Features
        webSearchEnabled, setWebSearchEnabled,
        investigateMode, setInvestigateMode,
        toolCallingAtivo, setToolCallingAtivo,
        reasoningAtivo, setReasoningAtivo,

        // Investigation
        currentTrace, setCurrentTrace,

        // MCP
        mcpServers, setMcpServers,

        // Project UI
        isCreatingProject, setIsCreatingProject,
        newProjectName, setNewProjectName,
        newProjectInputRef,
        projectChatInput, setProjectChatInput,
        projectPendingScreenshots, setProjectPendingScreenshots,
        projectChatInputRef,

        // Scroll
        messagesEndRef,
        messagesContainerRef,
    }
}
