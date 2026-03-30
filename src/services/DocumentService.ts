// Serviço de processamento de documentos
// Extrai texto de arquivos PDF, DOCX, TXT e MD

import type { ProjectFile } from '../types/project'
import caminhoWorkerPdf from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Tipos de arquivo suportados
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

const MB = 1024 * 1024

export const LIMITES_TAMANHO_ARQUIVO = {
    pdf: 200 * MB,
    docx: 100 * MB,
    txt: 50 * MB,
    md: 50 * MB,
    other: 10 * MB, // Fallback conservador para tipos não mapeados
} as const

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

export function obterLimiteMaximoArquivo(file: File): number {
    const tipo = getFileType(file)
    return LIMITES_TAMANHO_ARQUIVO[tipo] ?? LIMITES_TAMANHO_ARQUIVO.other
}

// Extrai texto de um arquivo suportado
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

// Extrai conteúdo de arquivos de texto simples
async function extractFromText(file: File): Promise<string> {
    return await file.text()
}

// Extrai conteúdo de PDF usando pdfjs-dist
async function extractFromPDF(file: File): Promise<string> {
    try {
        // Import dinâmico para carregar o parser só quando necessário
        const pdfjs = await import('pdfjs-dist')
        
        // Usa o worker empacotado localmente para funcionar no Electron sem depender de CDN
        pdfjs.GlobalWorkerOptions.workerSrc = caminhoWorkerPdf
        
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

// Extrai conteúdo de DOCX usando mammoth
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

// Cria um ProjectFile a partir de um File
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

// Retorna o tamanho do arquivo em formato legível
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
