// Hook for managing chat conversations state and actions
import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage } from '../../../../types/chat'
import type { Conversation } from '../types'

export function useConversations() {
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

    // Get current conversation
    const activeConversation = conversations.find(c => c.id === activeConversationId)
    const messages = activeConversation?.messages ?? []

    // Create new conversation
    const createConversation = useCallback((projectId?: string) => {
        const newConv: Conversation = {
            id: uuidv4(),
            title: 'Nova conversa',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            projectId,
        }
        setConversations(prev => [newConv, ...prev])
        setActiveConversationId(newConv.id)
        return newConv.id
    }, [])

    // Update messages for a conversation
    const updateMessages = useCallback((convId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        setConversations(prev => prev.map(c => {
            if (c.id === convId) {
                const newMessages = updater(c.messages)
                // Auto-update title from first user message
                const firstUserMsg = newMessages.find(m => m.role === 'user')
                const newTitle = firstUserMsg 
                    ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
                    : c.title
                return { 
                    ...c, 
                    messages: newMessages, 
                    title: c.title === 'Nova conversa' ? newTitle : c.title,
                    updatedAt: Date.now() 
                }
            }
            return c
        }))
    }, [])

    // Add message to conversation
    const addMessage = useCallback((convId: string, message: ChatMessage) => {
        updateMessages(convId, prev => [...prev, message])
    }, [updateMessages])

    // Update last message
    const updateLastMessage = useCallback((convId: string, updater: (msg: ChatMessage) => ChatMessage) => {
        updateMessages(convId, prev => {
            if (prev.length === 0) return prev
            const newMessages = [...prev]
            newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1])
            return newMessages
        })
    }, [updateMessages])

    // Delete conversation
    const deleteConversation = useCallback((convId: string) => {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (activeConversationId === convId) {
            setActiveConversationId(null)
        }
    }, [activeConversationId])

    // Rename conversation
    const renameConversation = useCallback((convId: string, newTitle: string) => {
        setConversations(prev => prev.map(c => 
            c.id === convId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
        ))
    }, [])

    // Move conversation to project
    const moveConversationToProject = useCallback((convId: string, projectId: string | undefined) => {
        setConversations(prev => prev.map(c => 
            c.id === convId ? { ...c, projectId, updatedAt: Date.now() } : c
        ))
    }, [])

    // Remove messages from a conversation (for regeneration)
    const removeLastMessages = useCallback((convId: string, count: number) => {
        updateMessages(convId, prev => prev.slice(0, -count))
    }, [updateMessages])

    // Get standalone conversations (not in any project)
    const standaloneConversations = conversations.filter(c => !c.projectId)

    // Get conversations for a project
    const getProjectConversations = useCallback((projectId: string) => {
        return conversations.filter(c => c.projectId === projectId)
    }, [conversations])

    return {
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        messages,
        createConversation,
        addMessage,
        updateMessages,
        updateLastMessage,
        deleteConversation,
        renameConversation,
        moveConversationToProject,
        removeLastMessages,
        standaloneConversations,
        getProjectConversations,
    }
}
