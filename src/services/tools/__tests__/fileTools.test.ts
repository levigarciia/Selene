import { beforeAll, describe, expect, test, vi } from 'vitest'
import { viewHandler } from '../builtin/fileTools'
import type { ToolCallContext } from '../../../types/tools'

interface DadosViewHandler {
    content: string
    displayResults?: Array<{ title: string }>
}

function obterDadosView(data: unknown): DadosViewHandler {
    return data as DadosViewHandler
}

// Mock do DocumentService
vi.mock('../../DocumentService', () => {
    return {
        extractTextFromPdfBuffer: vi.fn(async (_buffer, start, end) => {
            return `Conteúdo extraído das páginas ${start || 1} a ${end || 'Fim'}`
        }),
        extractTextFromDocxBuffer: vi.fn(async () => 'Conteúdo DOCX mockado'),
        searchPdfBuffer: vi.fn(async (_buffer, query) => {
            if (query === 'Espirais da Perdição') {
                return {
                    matches: [
                        { page: 142, text: 'O ritual Espirais da Perdição cria alucinações...' }
                    ]
                }
            }
            return { matches: [] }
        })
    }
})

describe('fileTools - viewHandler', () => {
    beforeAll(() => {
        // Mock da API global do Electron
        global.window = {
            electronAPI: {
                filesystem: {
                    readFile: vi.fn(async (caminho) => {
                        const extensao = caminho.split('.').pop()?.toLowerCase()
                        const isBinary = ['pdf', 'docx'].includes(extensao || '')
                        return {
                            success: true,
                            isDirectory: false,
                            isBinary,
                            content: isBinary ? '' : 'Conteúdo TXT mockado',
                            contentBuffer: isBinary ? new Uint8Array(8) : undefined
                        }
                    })
                }
            }
        } as unknown as Window & typeof globalThis
    })

    test('deve ler arquivo texto normal com sucesso', async () => {
        const result = await viewHandler({ path: 'documento.txt' })
        const dados = obterDadosView(result.data)
        expect(result.success).toBe(true)
        expect(dados.content).toBe('Conteúdo TXT mockado')
    })

    test('deve retornar nota informativa e instruções se não houver query ou páginas no contexto', async () => {
        const result = await viewHandler({ path: 'livro.pdf' })
        const dados = obterDadosView(result.data)
        expect(result.success).toBe(true)
        expect(dados.content).toContain('Nota de Informação')
        expect(dados.content).toContain('carregado com sucesso')
    })

    test('deve realizar busca automática no PDF usando aspas no userQuery', async () => {
        const context: ToolCallContext = {
            userQuery: 'me explica o "Espirais da Perdição" tbm'
        }
        const result = await viewHandler({ path: 'livro.pdf' }, context)
        const dados = obterDadosView(result.data)
        expect(result.success).toBe(true)
        expect(dados.content).toContain('O ritual Espirais da Perdição cria alucinações')
        expect(dados.displayResults?.[0].title).toContain('Busca Automática: Espirais da Perdição')
    })

    test('deve realizar busca automática no PDF usando padrão sem aspas no userQuery', async () => {
        const context: ToolCallContext = {
            userQuery: 'me explica sobre o ritual Espirais da Perdição'
        }
        const result = await viewHandler({ path: 'livro.pdf' }, context)
        const dados = obterDadosView(result.data)
        expect(result.success).toBe(true)
        expect(dados.content).toContain('O ritual Espirais da Perdição cria alucinações')
    })

    test('deve retornar nota de matches não encontrados se a busca automática falhar', async () => {
        const context: ToolCallContext = {
            userQuery: 'me explica sobre um ritual inexistente'
        }
        const result = await viewHandler({ path: 'livro.pdf' }, context)
        const dados = obterDadosView(result.data)
        expect(result.success).toBe(true)
        expect(dados.content).toContain('Tentamos realizar uma busca inteligente automática pelo termo "um ritual inexistente"')
        expect(dados.content).toContain('nenhum match foi encontrado')
    })
})
