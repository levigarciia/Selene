import { afterEach, describe, expect, test } from 'vitest'
import {
    clearProjectFilesSearchCallback,
    projectFilesSearchHandler,
    setProjectFilesSearchCallback,
} from '../builtin/projectFilesTool'
import type { ProjectFile } from '../../../types/project'

interface DadosBuscaProjeto {
    formattedForAI?: string
}

afterEach(() => {
    clearProjectFilesSearchCallback()
})

describe('projectFilesSearchHandler', () => {
    test('busca trechos nos arquivos do projeto ativo usando o projectId do contexto', async () => {
        setProjectFilesSearchCallback((projectId) => {
            if (projectId !== 'projeto-1') return null

            return {
                id: projectId,
                files: [
                    criarArquivoProjeto(
                        'sobrevivendo-ao-horror.pdf',
                        [
                            'Inventor Paranormal é uma origem para personagens que usam criatividade e',
                            'conhecimento técnico para criar ou adaptar objetos contra fenômenos paranormais.',
                        ].join(' ')
                    ),
                    criarArquivoProjeto('ordem-paranormal.pdf', 'Este arquivo fala sobre outras regras gerais.'),
                ],
            }
        })

        const resultado = await projectFilesSearchHandler(
            {
                query: 'Me explica o que é o "inventor paranormal" de Sobrevivendo ao Horror.',
                fileName: 'Sobrevivendo',
            },
            { projectId: 'projeto-1' }
        )
        const dados = resultado.data as DadosBuscaProjeto | undefined

        expect(resultado.success).toBe(true)
        expect(String(dados?.formattedForAI)).toContain('Inventor Paranormal')
        expect(String(dados?.formattedForAI)).toContain('sobrevivendo-ao-horror.pdf')
    })

    test('retorna erro claro quando não existe projeto ativo', async () => {
        const resultado = await projectFilesSearchHandler({ query: 'inventor paranormal' })

        expect(resultado.success).toBe(false)
        expect(resultado.error).toContain('Nenhum projeto ativo')
    })
})

function criarArquivoProjeto(name: string, content: string): ProjectFile {
    return {
        id: name,
        name,
        type: 'pdf',
        size: content.length,
        content,
        addedAt: Date.now(),
    }
}
