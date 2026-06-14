import type { ToolHandler, ToolCallResult, ToolResultItem } from '../../../types/tools'
import { extractTextFromPdfBuffer, extractTextFromDocxBuffer, searchPdfBuffer } from '../../DocumentService'

function copiarParaArrayBuffer(buffer: Uint8Array): ArrayBuffer {
    return new Uint8Array(buffer).buffer
}

/**
 * Handler para a ferramenta bash_tool. Executa comandos no console do sistema.
 */
export const bashToolHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const comando = args.command as string
    if (!comando) {
        return { success: false, error: 'O parâmetro "command" é obrigatório.' }
    }

    try {
        const resultado = await window.electronAPI.filesystem?.execCommand(comando)
        if (!resultado) {
            return { success: false, error: 'API do Electron para executar comandos não está disponível.' }
        }

        const formattedForAI = `[Comando executado]: ${comando}\n` +
            `[Retorno do Comando (Sucesso: ${resultado.success})]:\n` +
            `Stdout:\n${resultado.stdout || '(vazio)'}\n` +
            `Stderr:\n${resultado.stderr || '(vazio)'}\n` +
            (resultado.error ? `Erro do Processo: ${resultado.error}\n` : '')

        const displayResults: ToolResultItem[] = [
            {
                type: 'code',
                title: `Saída do terminal: ${comando}`,
                content: resultado.stdout || resultado.stderr || '(Sem retorno de texto)'
            }
        ]

        if (resultado.error) {
            displayResults.push({
                type: 'error',
                title: 'Erro de Execução',
                content: resultado.error
            })
        }

        return {
            success: resultado.success,
            data: {
                comando,
                stdout: resultado.stdout,
                stderr: resultado.stderr,
                error: resultado.error,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta create_file. Cria um arquivo com o conteúdo especificado.
 */
export const createFileHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const caminho = args.path as string
    const conteudo = args.content as string

    if (!caminho || conteudo === undefined) {
        return { success: false, error: 'Os parâmetros "path" e "content" são obrigatórios.' }
    }

    try {
        const resultado = await window.electronAPI.filesystem?.writeFile(caminho, conteudo)
        if (!resultado || !resultado.success) {
            return { success: false, error: resultado?.error || 'Erro ao gravar arquivo no backend.' }
        }

        return {
            success: true,
            data: {
                caminho,
                formattedForAI: `[Arquivo criado com sucesso]: ${caminho}\nConteúdo gravado (${conteudo.length} bytes).`,
                displayResults: [
                    {
                        type: 'text',
                        title: 'Arquivo Criado',
                        content: `Caminho: ${caminho}\n${conteudo.substring(0, 100)}${conteudo.length > 100 ? '...' : ''}`
                    }
                ]
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta str_replace. Substitui texto específico em um arquivo.
 */
export const strReplaceHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const caminho = args.path as string
    const textoAntigo = args.oldText as string
    const textoNovo = args.newText as string

    if (!caminho || textoAntigo === undefined || textoNovo === undefined) {
        return { success: false, error: 'Os parâmetros "path", "oldText" e "newText" são obrigatórios.' }
    }

    try {
        const resultado = await window.electronAPI.filesystem?.replaceText(caminho, textoAntigo, textoNovo)
        if (!resultado || !resultado.success) {
            return { success: false, error: resultado?.error || 'Erro ao editar arquivo no backend.' }
        }

        return {
            success: true,
            data: {
                caminho,
                formattedForAI: `[Texto alterado com sucesso no arquivo]: ${caminho}\nSubstituição concluída de "${textoAntigo.substring(0, 30)}..." por "${textoNovo.substring(0, 30)}...".`,
                displayResults: [
                    {
                        type: 'text',
                        title: 'Arquivo Editado',
                        content: `Substituição efetuada com sucesso em: ${caminho}`
                    }
                ]
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Tenta extrair termos específicos da mensagem do usuário para busca automática em PDFs.
 */
function extrairBuscaInteligente(userQuery?: string): string | undefined {
    if (!userQuery) return undefined

    // 1. Tenta extrair termos entre aspas
    const regexAspas = /["'“«]([^"'”»]{3,})["'”»]/i
    const matchAspas = userQuery.match(regexAspas)
    if (matchAspas && matchAspas[1]) {
        return matchAspas[1].trim()
    }

    // 2. Procura por expressões e tópicos logo após verbos de comando comuns
    const padroes = [
        /(?:me\s+explica\s+o\s+ritual|ritual|me\s+explica\s+o|me\s+explica\s+sobre|me\s+fale?\s+sobre\s+o|me\s+fale?\s+sobre|o\s+que\s+e\s+o|o\s+que\s+e|o\s+que\s+significa|onde\s+fala\s+de|sobre\s+o|sobre)\s+([^?.,;!]+)/i,
        /(?:explica|buscar?|pesquisar?|encontrar?)\s+([^?.,;!]+)/i
    ]

    for (const padrao of padroes) {
        const match = userQuery.match(padrao)
        if (match && match[1]) {
            let candidato = match[1].trim()
            // Limpa prefixos de introdução comuns no português para focar no assunto/ritual
            candidato = candidato.replace(/^(?:o\s+ritual\s+de\s+|o\s+ritual\s+|ritual\s+de\s+|ritual\s+|a\s+regra\s+de\s+|a\s+regra\s+|regra\s+de\s+|regra\s+|o\s+|a\s+|os\s+|as\s+|de\s+|do\s+|da\s+|sobre\s+)/i, '').trim()

            const termosIgnorados = ['pagina', 'página', 'pag', 'pág', 'linhas', 'linha', 'arquivo', 'pdf', 'docx', 'txt', 'resumo', 'resuma', 'conteúdo', 'conteudo']
            if (
                candidato.length >= 3 &&
                candidato.length < 50 &&
                !termosIgnorados.some(termo => candidato.toLowerCase().includes(termo))
            ) {
                return candidato
            }
        }
    }

    return undefined
}

/**
 * Handler para a ferramenta view. Lê o conteúdo de um arquivo ou lista um diretório.
 */
export const viewHandler: ToolHandler = async (args, context): Promise<ToolCallResult> => {
    const caminho = args.path as string
    const linhaInicio = args.startLine ? Number(args.startLine) : undefined
    const linhaFim = args.endLine ? Number(args.endLine) : undefined
    const buscaQuery = args.query as string | undefined

    if (!caminho) {
        return { success: false, error: 'O parâmetro "path" é obrigatório.' }
    }

    try {
        const resultado = await window.electronAPI.filesystem?.readFile(caminho, linhaInicio, linhaFim)
        if (!resultado || !resultado.success) {
            return { success: false, error: resultado?.error || 'Erro ao visualizar caminho no backend.' }
        }

        if (resultado.isDirectory) {
            const listaArquivos = resultado.files || []
            const formattedForAI = `[Diretório listado]: ${caminho}\nArquivos e subpastas:\n` + listaArquivos.map(f => `- ${f}`).join('\n')
            return {
                success: true,
                data: {
                    caminho,
                    isDirectory: true,
                    files: listaArquivos,
                    formattedForAI,
                    displayResults: [
                        {
                            type: 'json',
                            title: `Conteúdo da Pasta: ${caminho}`,
                            content: JSON.stringify(listaArquivos, null, 2)
                        }
                    ]
                }
            }
        }

        // É um arquivo
        let conteudo = resultado.content || ''
        let formattedForAI = ''
        let displayTitle = `Arquivo: ${caminho.split('/').pop()}`

        if (resultado.isBinary && resultado.contentBuffer) {
            const buffer = resultado.contentBuffer
            const arrayBuffer = copiarParaArrayBuffer(buffer)
            const extensao = caminho.split('.').pop()?.toLowerCase()

            try {
                if (extensao === 'pdf') {
                    if (buscaQuery && buscaQuery.trim()) {
                        const searchResult = await searchPdfBuffer(arrayBuffer, buscaQuery)
                        if (searchResult.matches.length > 0) {
                            conteudo = searchResult.matches.map(m => `--- Página ${m.page} (Match para "${buscaQuery}") ---\n${m.text}`).join('\n\n')
                            formattedForAI = `[Busca de PDF]: Encontrados ${searchResult.matches.length} matches para "${buscaQuery}" no arquivo ${caminho}:\n\n${conteudo}`
                            displayTitle = `PDF Encontrado (Termo: ${buscaQuery}): ${caminho.split('/').pop()}`
                        } else {
                            conteudo = `Nenhum resultado encontrado no PDF para o termo de busca: "${buscaQuery}".`
                            formattedForAI = `[Busca de PDF]: Busca por "${buscaQuery}" no arquivo ${caminho} não retornou nenhum resultado.`
                            displayTitle = `PDF Sem matches: ${caminho.split('/').pop()}`
                        }
                    } else if (linhaInicio || linhaFim) {
                        // Para PDFs, startLine/endLine representam páginas
                        conteudo = await extractTextFromPdfBuffer(
                            arrayBuffer,
                            linhaInicio,
                            linhaFim
                        )
                        formattedForAI = `[Extração de PDF]: ${caminho}\n` +
                            `Páginas ${linhaInicio || 1} a ${linhaFim || 'Fim'}:\n` +
                            conteudo
                        displayTitle = `PDF Extraído (Páginas ${linhaInicio || 1}-${linhaFim || 'Fim'}): ${caminho.split('/').pop()}`
                    } else {
                        // Nem query nem startLine/endLine fornecidos.
                        // Tentar busca inteligente automática com base na pergunta do usuário.
                        const termoBuscaAuto = extrairBuscaInteligente(context?.userQuery)
                        if (termoBuscaAuto) {
                            const searchResult = await searchPdfBuffer(arrayBuffer, termoBuscaAuto)
                            if (searchResult.matches.length > 0) {
                                conteudo = searchResult.matches.map(m => `--- Página ${m.page} (Match para "${termoBuscaAuto}") ---\n${m.text}`).join('\n\n')
                                formattedForAI = `[Busca Inteligente de PDF Automática]: Encontrados ${searchResult.matches.length} matches para o termo "${termoBuscaAuto}" (extraído do seu contexto de chat) no arquivo ${caminho}:\n\n${conteudo}`
                                displayTitle = `PDF Encontrado (Busca Automática: ${termoBuscaAuto}): ${caminho.split('/').pop()}`
                            } else {
                                // Se a busca não retornar nada, não extraímos páginas longas para evitar latência.
                                // Apenas notificamos que nenhum match foi encontrado para o termo detectado.
                                conteudo = `[Nota de Limitação]: O arquivo PDF "${caminho.split('/').pop()}" é muito grande. Tentamos realizar uma busca inteligente automática pelo termo "${termoBuscaAuto}", mas nenhum match foi encontrado no documento.\n\nInstrução à IA: Chame a ferramenta novamente especificando a página Candidata correta nos parâmetros startLine/endLine ou altere o termo de busca no parâmetro 'query'.`
                                formattedForAI = `[Busca Inteligente de PDF Automática]: Busca automática por "${termoBuscaAuto}" no arquivo ${caminho} não obteve matches.\n\nInstrução à IA: Como a busca não retornou dados, chame a ferramenta novamente especificando a página correta nos parâmetros startLine/endLine ou refine o termo de busca no parâmetro 'query'.`
                                displayTitle = `PDF Sem matches (Busca Automática: ${termoBuscaAuto}): ${caminho.split('/').pop()}`
                            }
                        } else {
                            // Sem termos identificados e sem páginas -> Retornar apenas nota de instrução
                            conteudo = `[Nota de Informação]: O arquivo PDF "${caminho.split('/').pop()}" foi carregado com sucesso. Por ser um documento extenso, o conteúdo textual completo não foi extraído automaticamente para economizar tokens e evitar lentidão de processamento.\n\nInstrução à IA: Use o parâmetro 'query' para pesquisar por termos específicos no documento (recomendado), ou use os parâmetros startLine/endLine para ler páginas específicas do PDF (ex: startLine=142, endLine=142 para ler a página 142).`
                            formattedForAI = `[Carregamento de PDF]: ${caminho} carregado com sucesso.\n\n${conteudo}`
                            displayTitle = `PDF Carregado: ${caminho.split('/').pop()}`
                        }
                    }
                } else if (extensao === 'docx') {
                    conteudo = await extractTextFromDocxBuffer(arrayBuffer)
                    formattedForAI = `[Extração de DOCX]: ${caminho}\nConteúdo:\n` + conteudo
                    displayTitle = `DOCX Extraído: ${caminho.split('/').pop()}`
                } else {
                    return {
                        success: false,
                        error: `O arquivo é binário (formato .${extensao}) e não possui extrator de texto suportado.`
                    }
                }
            } catch (erro: unknown) {
                return {
                    success: false,
                    error: `Falha ao processar arquivo binário: ${erro instanceof Error ? erro.message : String(erro)}`
                }
            }
        } else {
            formattedForAI = `[Leitura do arquivo]: ${caminho}\n` +
                (linhaInicio ? `Linhas ${linhaInicio} a ${linhaFim}:\n` : 'Conteúdo Completo:\n') +
                conteudo
        }

        return {
            success: true,
            data: {
                caminho,
                isDirectory: false,
                content: conteudo,
                formattedForAI,
                displayResults: [
                    {
                        type: 'code',
                        title: displayTitle,
                        content: conteudo
                    }
                ]
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta present_files. Apresenta o arquivo no sistema de arquivos padrão do SO.
 */
export const presentFilesHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    // Pode vir como caminho único (caminho string) ou lista (paths array)
    const caminhos = Array.isArray(args.paths) ? args.paths : (args.path ? [args.path as string] : [])

    if (caminhos.length === 0) {
        return { success: false, error: 'O parâmetro "paths" ou "path" deve ser especificado.' }
    }

    try {
        const resultadosApresentacao = []
        for (const caminho of caminhos) {
            const res = await window.electronAPI.filesystem?.presentFile(caminho)
            resultadosApresentacao.push({
                caminho,
                success: res?.success || false,
                error: res?.error
            })
        }

        const erros = resultadosApresentacao.filter(r => !r.success)
        const formattedForAI = `[Arquivos apresentados no SO]:\n` + 
            resultadosApresentacao.map(r => `- ${r.caminho}: ${r.success ? 'Exibido' : `Erro (${r.error})`}`).join('\n')

        const displayResults: ToolResultItem[] = resultadosApresentacao.map(r => ({
            type: r.success ? 'text' as const : 'error' as const,
            title: r.success ? 'Arquivo Exibido no Explorer' : 'Erro ao Exibir Arquivo',
            content: r.success ? `O arquivo foi revelado no explorador do sistema:\n${r.caminho}` : `Erro: ${r.error} para caminho:\n${r.caminho}`
        }))

        return {
            success: erros.length === 0,
            data: {
                resultados: resultadosApresentacao,
                formattedForAI,
                displayResults
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}

/**
 * Handler para a ferramenta delete_file. Exclui um arquivo ou pasta do disco.
 */
export const deleteFileHandler: ToolHandler = async (args): Promise<ToolCallResult> => {
    const caminho = args.path as string

    if (!caminho) {
        return { success: false, error: 'O parâmetro "path" é obrigatório.' }
    }

    try {
        const resultado = await window.electronAPI.filesystem?.deleteFile(caminho)
        if (!resultado || !resultado.success) {
            return { success: false, error: resultado?.error || 'Erro ao excluir o arquivo no backend.' }
        }

        return {
            success: true,
            data: {
                caminho,
                formattedForAI: `[Arquivo/Pasta excluído com sucesso]: ${caminho}`,
                displayResults: [
                    {
                        type: 'text',
                        title: 'Arquivo/Pasta Excluído',
                        content: `O caminho foi removido com sucesso:\n${caminho}`
                    }
                ]
            }
        }
    } catch (erro: unknown) {
        return {
            success: false,
            error: erro instanceof Error ? erro.message : String(erro)
        }
    }
}
