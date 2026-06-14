import { beforeEach, describe, expect, test, vi } from 'vitest'
import { extractTextFromFile, processFileForProject } from '../DocumentService'

let paginasSolicitadas: number[] = []

vi.mock('pdfjs-dist', () => ({
    default: {},
    GlobalWorkerOptions: {},
    getDocument: () => ({
        promise: Promise.resolve({
            numPages: 200,
            getPage: async (pagina: number) => {
                paginasSolicitadas.push(pagina)
                return {
                    getTextContent: async () => ({
                        items: [{ str: `conteudo pagina ${pagina}` }],
                    }),
                }
            },
        }),
    }),
}))

describe('DocumentService PDF', () => {
    beforeEach(() => {
        paginasSolicitadas = []
    })

    test('limita extração de PDF quando pdfMaxPages é informado', async () => {
        const arquivo = criarPdf()

        await extractTextFromFile(arquivo, { pdfMaxPages: 5 })

        expect(paginasSolicitadas).toEqual([1, 2, 3, 4, 5])
    })

    test('processFileForProject guarda apenas prévia limitada de PDF', async () => {
        const arquivo = criarPdf()

        const projectFile = await processFileForProject(arquivo)

        expect(paginasSolicitadas).toEqual([1, 2, 3, 4, 5])
        expect(projectFile.content).toContain('[Prévia limitada do PDF')
        expect(projectFile.content).toContain('conteudo pagina 5')
        expect(projectFile.content).not.toContain('conteudo pagina 6')
    })
})

function criarPdf(): File {
    return new File([new Uint8Array([1, 2, 3])], 'ordem.pdf', { type: 'application/pdf' })
}
