// Project Context Service
// Handles intelligent context for projects: embeddings, semantic search, and context injection

import type { Project, ProjectFile } from '../types/project'
import type { ChatMessage } from '../types/chat'

// Simple cosine similarity for vector comparison
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Text chunking for better context retrieval
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim())
    const chunks: string[] = []
    let currentChunk = ''
    
    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = ''
        }
        currentChunk += sentence + '. '
    }
    
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
    }
    
    return chunks
}

// Project memory storage (per-project)
interface ProjectMemory {
    id: string
    projectId: string
    text: string
    category: string
    embedding?: number[]
    createdAt: number
}

// Storage keys
const STORAGE_KEY_MEMORIES = 'selene_project_memories'
const STORAGE_KEY_FILE_EMBEDDINGS = 'selene_project_file_embeddings'

// Load project memories from localStorage
export function loadProjectMemories(): ProjectMemory[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_MEMORIES)
        return saved ? JSON.parse(saved) : []
    } catch {
        return []
    }
}

// Save project memories to localStorage
export function saveProjectMemories(memories: ProjectMemory[]): void {
    localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(memories))
}

// Add memory to a specific project
export function addProjectMemory(
    projectId: string,
    text: string,
    category: string = 'general'
): ProjectMemory {
    const memories = loadProjectMemories()
    const newMemory: ProjectMemory = {
        id: crypto.randomUUID(),
        projectId,
        text,
        category,
        createdAt: Date.now()
    }
    memories.push(newMemory)
    saveProjectMemories(memories)
    return newMemory
}

// Get memories for a specific project
export function getProjectMemories(projectId: string): ProjectMemory[] {
    return loadProjectMemories().filter(m => m.projectId === projectId)
}

// Remove a memory
export function removeProjectMemory(memoryId: string): void {
    const memories = loadProjectMemories().filter(m => m.id !== memoryId)
    saveProjectMemories(memories)
}

// Clear all memories for a project
export function clearProjectMemories(projectId: string): void {
    const memories = loadProjectMemories().filter(m => m.projectId !== projectId)
    saveProjectMemories(memories)
}

// File chunk with embedding storage
interface FileChunkEmbedding {
    fileId: string
    projectId: string
    chunkIndex: number
    text: string
    embedding: number[]
}

export interface ContextoPromptProjeto {
    promptSistemaProjeto: string
    totalArquivos: number
    arquivosListados: number
    trechosIncluidos: number
    temInstrucoes: boolean
}

export interface ContextoArquivosProjeto {
    blocoContexto: string
    totalArquivos: number
    arquivosListados: number
    trechosIncluidos: number
}

// Load file embeddings
export function loadFileEmbeddings(): FileChunkEmbedding[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_FILE_EMBEDDINGS)
        return saved ? JSON.parse(saved) : []
    } catch {
        return []
    }
}

// Save file embeddings
export function saveFileEmbeddings(embeddings: FileChunkEmbedding[]): void {
    localStorage.setItem(STORAGE_KEY_FILE_EMBEDDINGS, JSON.stringify(embeddings))
}

// Generate a simple text embedding (hash-based for offline use)
// In production, this would use an embedding API
function generateSimpleEmbedding(text: string): number[] {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    const words = normalized.split(/\s+/).filter(w => w.length > 2)
    
    // Create a simple 128-dimension embedding based on character frequencies and word patterns
    const embedding = new Array(128).fill(0)
    
    // Character trigram frequencies
    for (let i = 0; i < text.length - 2; i++) {
        const trigram = text.substring(i, i + 3)
        const hash = (trigram.charCodeAt(0) * 31 + trigram.charCodeAt(1)) * 31 + trigram.charCodeAt(2)
        embedding[Math.abs(hash) % 64] += 1
    }
    
    // Word presence hashing
    for (const word of words) {
        let hash = 0
        for (let i = 0; i < word.length; i++) {
            hash = ((hash << 5) - hash) + word.charCodeAt(i)
        }
        embedding[64 + (Math.abs(hash) % 64)] += 1
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= magnitude
        }
    }
    
    return embedding
}

// Index a file's content for semantic search
export function indexProjectFile(projectId: string, file: ProjectFile): void {
    const chunks = chunkText(file.content)
    const embeddings = loadFileEmbeddings().filter(e => e.fileId !== file.id)
    
    for (let i = 0; i < chunks.length; i++) {
        embeddings.push({
            fileId: file.id,
            projectId,
            chunkIndex: i,
            text: chunks[i],
            embedding: generateSimpleEmbedding(chunks[i])
        })
    }
    
    saveFileEmbeddings(embeddings)
    console.log(`[ProjectContext] Indexed ${chunks.length} chunks for file ${file.name}`)
}

// Remove file embeddings
export function removeFileEmbeddings(fileId: string): void {
    const embeddings = loadFileEmbeddings().filter(e => e.fileId !== fileId)
    saveFileEmbeddings(embeddings)
}

// Search project files semantically
export function searchProjectFiles(
    projectId: string,
    query: string,
    topK: number = 5
): { text: string; score: number; fileId: string }[] {
    const embeddings = loadFileEmbeddings().filter(e => e.projectId === projectId)
    if (embeddings.length === 0) return []
    
    const queryEmbedding = generateSimpleEmbedding(query)
    
    const results = embeddings.map(e => ({
        text: e.text,
        score: cosineSimilarity(queryEmbedding, e.embedding),
        fileId: e.fileId
    }))
    
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(r => r.score > 0.1) // Only return relevant results
}

// Generate a summary of project context for AI
export function generateProjectContextSummary(
    project: Project,
    recentMessages: ChatMessage[] = []
): string {
    const parts: string[] = []
    
    // Project info
    parts.push(`## Contexto do Projeto: ${project.name}\n`)
    
    // Files summary
    if (project.files.length > 0) {
        parts.push(`### Arquivos do Projeto (${project.files.length}):`)
        for (const file of project.files) {
            const preview = file.content.slice(0, 200).replace(/\n/g, ' ')
            parts.push(`- **${file.name}**: ${preview}...`)
        }
        parts.push('')
    }
    
    // Project memories
    const memories = getProjectMemories(project.id)
    if (memories.length > 0) {
        parts.push(`### Memórias do Projeto:`)
        for (const memory of memories.slice(-10)) { // Last 10 memories
            parts.push(`- ${memory.text}`)
        }
        parts.push('')
    }
    
    // Recent conversation context
    if (recentMessages.length > 0) {
        parts.push(`### Histórico Recente:`)
        for (const msg of recentMessages.slice(-5)) {
            const role = msg.role === 'user' ? 'Usuário' : 'Assistente'
            const content = msg.content.slice(0, 150).replace(/\n/g, ' ')
            parts.push(`- **${role}**: ${content}...`)
        }
    }
    
    return parts.join('\n')
}

// Build context for a chat message based on project files
export function buildProjectContext(
    project: Project,
    userMessage: string,
    files: ProjectFile[]
): string {
    const parts: string[] = []
    
    // Search for relevant file chunks
    const relevantChunks = searchProjectFiles(project.id, userMessage, 5)
    
    if (relevantChunks.length > 0) {
        parts.push('## Contexto Relevante dos Arquivos do Projeto:\n')
        for (const chunk of relevantChunks) {
            const file = files.find(f => f.id === chunk.fileId)
            if (file) {
                parts.push(`### De "${file.name}":\n${chunk.text}\n`)
            }
        }
    }

    return parts.join('\n')
}

function limitarTexto(texto: string, maxCaracteres: number): string {
    if (maxCaracteres <= 0) return ''
    if (texto.length <= maxCaracteres) return texto
    return texto.slice(0, maxCaracteres).trimEnd() + '...'
}

function formatarTamanhoArquivo(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatarTipoArquivo(tipo: ProjectFile['type']): string {
    return tipo.toUpperCase()
}

interface OpcoesPromptProjeto {
    maxCaracteresTotais?: number
    maxArquivosInventario?: number
    maxTrechos?: number
}

export function criarPromptSistemaProjeto(
    project: Project,
    _userMessage?: string,
    _opcoes: OpcoesPromptProjeto = {}
): ContextoPromptProjeto {
    const promptSistemaProjeto = (project.instructions || '').trim()

    return {
        promptSistemaProjeto,
        totalArquivos: project.files.length,
        arquivosListados: 0,
        trechosIncluidos: 0,
        temInstrucoes: Boolean(promptSistemaProjeto),
    }
}

export function criarContextoArquivosProjeto(
    project: Project,
    userMessage: string,
    opcoes: OpcoesPromptProjeto = {}
): ContextoArquivosProjeto {
    const maxCaracteresTotais = opcoes.maxCaracteresTotais ?? 2400
    const maxArquivosInventario = opcoes.maxArquivosInventario ?? 12
    const maxTrechos = opcoes.maxTrechos ?? 4
    const inventario = project.files.slice(0, maxArquivosInventario)
    const arquivosRestantes = Math.max(0, project.files.length - inventario.length)
    const trechosRelevantes = searchProjectFiles(project.id, userMessage, maxTrechos)

    const secoes: string[] = []

    if (project.files.length > 0) {
        const linhasArquivos = inventario.map((file, indice) =>
            `${indice + 1}. ${file.name} (${formatarTipoArquivo(file.type)}, ${formatarTamanhoArquivo(file.size)})`
        )

        if (arquivosRestantes > 0) {
            linhasArquivos.push(`... e mais ${arquivosRestantes} arquivo(s).`)
        }

        secoes.push(`Arquivos do projeto:\n${linhasArquivos.join('\n')}`)
    }

    if (trechosRelevantes.length > 0) {
        const blocosTrechos = trechosRelevantes
            .map((chunk) => {
                const file = project.files.find(f => f.id === chunk.fileId)
                if (!file) return null
                return `${file.name}:\n${chunk.text}`
            })
            .filter((item): item is string => Boolean(item))

        if (blocosTrechos.length > 0) {
            secoes.push(`Trechos relevantes dos arquivos:\n${blocosTrechos.join('\n\n')}`)
        }
    }

    return {
        blocoContexto: limitarTexto(secoes.join('\n\n'), maxCaracteresTotais),
        totalArquivos: project.files.length,
        arquivosListados: inventario.length,
        trechosIncluidos: Math.min(trechosRelevantes.length, maxTrechos),
    }
}

// Extract key information from a conversation to add as project memory
export function extractConversationMemory(
    messages: ChatMessage[]
): string[] {
    // Simple extraction based on patterns (no AI needed)
    const memories: string[] = []
    
    for (const msg of messages) {
        // Look for definitions, decisions, or important statements
        const patterns = [
            /(?:decidimos|definimos|o projeto|a aplicação|o sistema)\s+(.{20,100})/gi,
            /(?:importante|lembrar|anotar):\s*(.{10,100})/gi,
            /(?:a ideia é|o objetivo é|queremos)\s+(.{20,100})/gi,
        ]
        
        for (const pattern of patterns) {
            const matches = msg.content.matchAll(pattern)
            for (const match of matches) {
                if (match[1]) {
                    memories.push(match[1].trim())
                }
            }
        }
    }
    
    return memories
}

// Index all files in a project
export function indexAllProjectFiles(project: Project): void {
    for (const file of project.files) {
        indexProjectFile(project.id, file)
    }
    console.log(`[ProjectContext] Indexed all ${project.files.length} files for project ${project.name}`)
}

// Get total context size for a project
export function getProjectContextSize(projectId: string): { files: number; memories: number; chunks: number } {
    const embeddings = loadFileEmbeddings().filter(e => e.projectId === projectId)
    const memories = getProjectMemories(projectId)
    
    return {
        files: new Set(embeddings.map(e => e.fileId)).size,
        memories: memories.length,
        chunks: embeddings.length
    }
}
