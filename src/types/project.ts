// Project Types for Selene

export interface Project {
    id: string
    name: string
    icon?: string                    // Emoji or icon name
    color?: string                   // Folder color (hex)
    instructions?: string            // Custom instructions for this project
    createdAt: number
    updatedAt: number
    conversationIds: string[]        // IDs of conversations in this project
    files: ProjectFile[]             // Attached files
    contextSummary?: string          // AI-generated context summary
}

export interface ProjectFile {
    id: string
    name: string
    type: 'pdf' | 'txt' | 'docx' | 'md' | 'other'
    size: number                     // File size in bytes
    content: string                  // Extracted text content
    embedding?: number[]             // Semantic embedding for search
    addedAt: number
}

// Helper to create a new project
export const createProject = (name: string): Project => ({
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conversationIds: [],
    files: []
})

// Default project colors
export const PROJECT_COLORS = [
    '#FFD700', // Gold (como na imagem)
    '#7C3AED', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#EC4899', // Pink
    '#6366F1', // Indigo
]
