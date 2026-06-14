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
interface OpcoesExtracaoArquivo {
    pdfMaxPages?: number
}

export async function extractTextFromFile(file: File, opcoes: OpcoesExtracaoArquivo = {}): Promise<string> {
    const type = getFileType(file)
    
    switch (type) {
        case 'txt':
        case 'md':
            return await extractFromText(file)
        case 'pdf':
            return await extractFromPDF(file, opcoes)
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

// Extrai texto de um PDF a partir de um ArrayBuffer/Uint8Array
export async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer, startPage?: number, endPage?: number): Promise<string> {
    try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = caminhoWorkerPdf
        
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        
        const paginaInicial = startPage ? Math.max(1, startPage) : 1
        const paginaFinal = endPage ? Math.min(pdf.numPages, endPage) : pdf.numPages
        
        const textParts: string[] = []
        for (let i = paginaInicial; i <= paginaFinal; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .map((item) => ('str' in item ? item.str : ''))
                .join(' ')
            textParts.push(`--- Página ${i} ---\n` + pageText.trim())
        }
        
        return textParts.join('\n\n')
    } catch (error) {
        console.error('[DocumentService] Failed to extract PDF from buffer:', error)
        throw new Error(`Falha ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
}

// Extrai texto de um DOCX a partir de um ArrayBuffer/Uint8Array
export async function extractTextFromDocxBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value
    } catch (error) {
        console.error('[DocumentService] Failed to extract DOCX from buffer:', error)
        throw new Error(`Falha ao processar DOCX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
}

// Busca textual dentro de um PDF a partir de um ArrayBuffer
export async function searchPdfBuffer(arrayBuffer: ArrayBuffer, query: string): Promise<{ matches: Array<{ page: number; text: string }> }> {
    try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = caminhoWorkerPdf
        
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        
        const matches: Array<{ page: number; text: string }> = []
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .map((item) => ('str' in item ? item.str : ''))
                .join(' ')
            
            const normalizedPageText = pageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            
            if (normalizedPageText.includes(normalizedQuery)) {
                matches.push({
                    page: i,
                    text: pageText.trim()
                })
                // Limita a 5 páginas com matches para não estourar o limite de tokens/memória
                if (matches.length >= 5) {
                    break
                }
            }
        }
        
        return { matches }
    } catch (error) {
        console.error('[DocumentService] Failed to search PDF:', error)
        throw new Error(`Falha ao buscar no PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
}

// Extrai conteúdo de PDF usando pdfjs-dist
async function extractFromPDF(file: File, opcoes: OpcoesExtracaoArquivo = {}): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const paginaFinal = opcoes.pdfMaxPages ? Math.max(1, opcoes.pdfMaxPages) : undefined
    return await extractTextFromPdfBuffer(arrayBuffer, 1, paginaFinal)
}

// Extrai conteúdo de DOCX usando mammoth
async function extractFromDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    return await extractTextFromDocxBuffer(arrayBuffer)
}

// Cria um ProjectFile a partir de um File
export async function processFileForProject(file: File): Promise<ProjectFile> {
    const tipo = getFileType(file)
    const textoExtraido = await extractTextFromFile(file, tipo === 'pdf' ? { pdfMaxPages: 5 } : {})
    const content = tipo === 'pdf'
        ? [
            `[Prévia limitada do PDF: ${file.name}]`,
            'Apenas as páginas 1 a 5 foram extraídas para o contexto do projeto.',
            'Para responder sobre uma página específica, anexe o PDF na conversa ou use uma ferramenta de leitura com página explícita.',
            '',
            textoExtraido,
        ].join('\n')
        : textoExtraido
    
    return {
        id: crypto.randomUUID(),
        name: file.name,
        type: tipo,
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
