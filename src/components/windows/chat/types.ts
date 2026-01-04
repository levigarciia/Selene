// Chat Window Types

import type { ChatMessage } from '../../../types/chat'

export interface Conversation {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
    projectId?: string
}

export interface WebSource {
    url: string
    title: string
    favicon?: string
    resumo?: string
    nomeFonte?: string
    dominio?: string
}

export interface MessageSources {
    [messageId: string]: WebSource[]
}

export interface ExpandedSources {
    [messageId: string]: boolean
}

export interface CopiedMessages {
    [messageId: string]: boolean
}
