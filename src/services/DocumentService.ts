// Document Processing Service
// Handles extraction of text from PDF, DOCX, TXT, MD files

import type { ProjectFile } from '../types/project'

// Supported file types
export const SUPPORTED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain',
    'text/markdown',
    '.pdf',
    '.docx',
    '.txt',
    '.md'
]

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function getFileType(file: File): ProjectFile['type'] {
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'pdf': return 'pdf'
        case 'docx': return 'docx'
        case 'txt': return 'txt'
        case 'md': return 'md'
        default: return 'other'
    }
}

export function isFileSupported(file: File): boolean {
    return SUPPORTED_FILE_TYPES.some(type => 
        file.type.includes(type) || file.name.endsWith(type)
    )
}

// Extract text from a file
export async function extractTextFromFile(file: File): Promise<string> {
    const type = getFileType(file)
    
    switch (type) {
        case 'txt':
        case 'md':
            return await extractFromText(file)
        case 'pdf':
            return await extractFromPDF(file)
        case 'docx':
            return await extractFromDOCX(file)
        default:
            throw new Error(`Tipo de arquivo não suportado: ${file.name}`)
    }
}

// Extract from plain text files
async function extractFromText(file: File): Promise<string> {
    return await file.text()
}

// Extract from PDF using pdfjs-dist
async function extractFromPDF(file: File): Promise<string> {
    try {
        // Dynamic import to avoid bundling if not needed
        const pdfjs = await import('pdfjs-dist')
        
        // Set worker source
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
        
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        
        const textParts: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ')
            textParts.push(pageText)
        }
        
        return textParts.join('\n\n')
    } catch (error) {
        console.error('[DocumentService] Failed to extract PDF:', error)
        throw new Error(`Falha ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
}

// Extract from DOCX using mammoth
async function extractFromDOCX(file: File): Promise<string> {
    try {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value
    } catch (error) {
        console.error('[DocumentService] Failed to extract DOCX:', error)
        throw new Error(`Falha ao processar DOCX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
}

// Create a ProjectFile from a File
export async function processFileForProject(file: File): Promise<ProjectFile> {
    const content = await extractTextFromFile(file)
    
    return {
        id: crypto.randomUUID(),
        name: file.name,
        type: getFileType(file),
        size: file.size,
        content,
        addedAt: Date.now()
    }
}

// Get a readable file size string
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
