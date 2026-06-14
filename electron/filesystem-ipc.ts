import { ipcMain, shell, app } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Resolve caminhos especiais do sistema operacional (como Downloads, Documentos, Desktop, home (~))
 * e converte caminhos relativos para serem salvos na pasta de Downloads do usuário por padrão.
 */
function resolverCaminhoEspecial(caminhoOriginal: string): string {
    if (!caminhoOriginal) return caminhoOriginal

    let caminho = caminhoOriginal.trim()

    // Substituir contrabarras por barras para facilitar manipulação
    caminho = caminho.replace(/\\/g, '/')

    // Se for apenas um nome de arquivo (sem barras)
    if (!caminho.includes('/')) {
        try {
            const pastaDownloads = app.getPath('downloads')
            return path.join(pastaDownloads, caminho)
        } catch {
            return caminho
        }
    }

    // Tratar atalhos comuns
    const atalhos: { [key: string]: () => string } = {
        '~/': () => app.getPath('home'),
        '%userprofile%/': () => app.getPath('home'),
        '$userprofile%/': () => app.getPath('home'),
        'downloads/': () => app.getPath('downloads'),
        '$downloads/': () => app.getPath('downloads'),
        '%downloads%/': () => app.getPath('downloads'),
        'documents/': () => app.getPath('documents'),
        '$documents/': () => app.getPath('documents'),
        '%documents%/': () => app.getPath('documents'),
        'desktop/': () => app.getPath('desktop'),
        '$desktop/': () => app.getPath('desktop'),
        '%desktop%/': () => app.getPath('desktop'),
    }

    const caminhoLower = caminho.toLowerCase()
    for (const [atalho, getCaminhoReal] of Object.entries(atalhos)) {
        if (caminhoLower.startsWith(atalho)) {
            try {
                const baseReal = getCaminhoReal()
                const resto = caminho.slice(atalho.length)
                return path.join(baseReal, resto)
            } catch (erro) {
                console.error(`[IPC Filesystem] Erro ao resolver atalho ${atalho}:`, erro)
            }
        }
    }

    // Se não for caminho absoluto nem tiver drive (ex: C:/), resolve relativo à pasta Downloads
    if (!path.isAbsolute(caminho) && !/^[a-zA-Z]:\//.test(caminho)) {
        try {
            const pastaDownloads = app.getPath('downloads')
            return path.join(pastaDownloads, caminho)
        } catch {
            return caminho
        }
    }

    return path.normalize(caminho)
}

/**
 * Configura os canais de comunicação IPC para operações de arquivos e comandos.
 */
export function configurarIpcSistemaArquivos(): void {
    // 1. Executar comando de terminal (bash_tool)
    ipcMain.handle('filesystem:exec-command', async (_evento, comando: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> => {
        console.log('[IPC Filesystem] Executando comando:', comando)
        return new Promise((resolve) => {
            // Executa o comando usando o shell padrão do sistema operacional
            exec(comando, { timeout: 60000 }, (erro, stdout, stderr) => {
                if (erro) {
                    resolve({
                        success: false,
                        stdout: stdout.toString(),
                        stderr: stderr.toString(),
                        error: erro.message
                    })
                } else {
                    resolve({
                        success: true,
                        stdout: stdout.toString(),
                        stderr: stderr.toString()
                    })
                }
            })
        })
    })

    // 2. Criar ou sobrescrever arquivo (create_file)
    ipcMain.handle('filesystem:write-file', async (_evento, caminhoAbsoluto: string, conteudo: string): Promise<{ success: boolean; error?: string }> => {
        const caminhoReal = resolverCaminhoEspecial(caminhoAbsoluto)
        console.log('[IPC Filesystem] Escrevendo arquivo em:', caminhoReal)
        try {
            const pastaPai = path.dirname(caminhoReal)
            if (!fs.existsSync(pastaPai)) {
                fs.mkdirSync(pastaPai, { recursive: true })
            }
            fs.writeFileSync(caminhoReal, conteudo, 'utf8')
            return { success: true }
        } catch (erro: unknown) {
            console.error('[IPC Filesystem] Erro ao escrever arquivo:', erro)
            return {
                success: false,
                error: erro instanceof Error ? erro.message : String(erro)
            }
        }
    })

    // 3. Ler arquivo (view)
    ipcMain.handle('filesystem:read-file', async (_evento, caminhoAbsoluto: string, linhaInicio?: number, linhaFim?: number): Promise<{ success: boolean; content?: string; contentBuffer?: Buffer; isBinary?: boolean; isDirectory?: boolean; files?: string[]; error?: string }> => {
        const caminhoReal = resolverCaminhoEspecial(caminhoAbsoluto)
        console.log('[IPC Filesystem] Lendo:', caminhoReal)
        try {
            if (!fs.existsSync(caminhoReal)) {
                return { success: false, error: 'Arquivo ou diretório não existe.' }
            }

            const stats = fs.statSync(caminhoReal)
            if (stats.isDirectory()) {
                const arquivos = fs.readdirSync(caminhoReal)
                return {
                    success: true,
                    isDirectory: true,
                    files: arquivos
                }
            }

            const extensao = path.extname(caminhoReal).toLowerCase()
            const ehBinario = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.zip'].includes(extensao)

            if (ehBinario) {
                const buffer = fs.readFileSync(caminhoReal)
                return {
                    success: true,
                    isDirectory: false,
                    isBinary: true,
                    contentBuffer: buffer
                }
            }

            let conteudo = fs.readFileSync(caminhoReal, 'utf8')
            
            // Paginação opcional de linhas
            if (linhaInicio !== undefined && linhaFim !== undefined) {
                const linhas = conteudo.split('\n')
                conteudo = linhas.slice(linhaInicio - 1, linhaFim).join('\n')
            }

            return {
                success: true,
                isDirectory: false,
                isBinary: false,
                content: conteudo
            }
        } catch (erro: unknown) {
            console.error('[IPC Filesystem] Erro ao ler:', caminhoReal, erro)
            return {
                success: false,
                error: erro instanceof Error ? erro.message : String(erro)
            }
        }
    })

    // 4. Substituir texto no arquivo (str_replace)
    ipcMain.handle('filesystem:replace-text', async (_evento, caminhoAbsoluto: string, textoAntigo: string, textoNovo: string): Promise<{ success: boolean; error?: string }> => {
        const caminhoReal = resolverCaminhoEspecial(caminhoAbsoluto)
        console.log('[IPC Filesystem] Substituindo texto em:', caminhoReal)
        try {
            if (!fs.existsSync(caminhoReal)) {
                return { success: false, error: 'O arquivo não existe.' }
            }

            const stats = fs.statSync(caminhoReal)
            if (stats.isDirectory()) {
                return { success: false, error: 'O caminho aponta para um diretório, não um arquivo.' }
            }

            const conteudoOriginal = fs.readFileSync(caminhoReal, 'utf8')
            if (!conteudoOriginal.includes(textoAntigo)) {
                return { success: false, error: 'O texto antigo a ser substituído não foi encontrado no arquivo.' }
            }

            const novoConteudo = conteudoOriginal.replace(textoAntigo, textoNovo)
            fs.writeFileSync(caminhoReal, novoConteudo, 'utf8')
            return { success: true }
        } catch (erro: unknown) {
            console.error('[IPC Filesystem] Erro ao substituir texto:', erro)
            return {
                success: false,
                error: erro instanceof Error ? erro.message : String(erro)
            }
        }
    })

    // 5. Apresentar arquivo no gerenciador de arquivos do sistema (present_files)
    ipcMain.handle('filesystem:present-file', async (_evento, caminhoAbsoluto: string): Promise<{ success: boolean; error?: string }> => {
        const caminhoReal = resolverCaminhoEspecial(caminhoAbsoluto)
        console.log('[IPC Filesystem] Apresentando arquivo no SO:', caminhoReal)
        try {
            if (!fs.existsSync(caminhoReal)) {
                return { success: false, error: 'O arquivo ou pasta especificada não existe.' }
            }
            shell.showItemInFolder(caminhoReal)
            return { success: true }
        } catch (erro: unknown) {
            console.error('[IPC Filesystem] Erro ao apresentar arquivo:', erro)
            return {
                success: false,
                error: erro instanceof Error ? erro.message : String(erro)
            }
        }
    })

    // 6. Excluir arquivo ou diretório (delete_file)
    ipcMain.handle('filesystem:delete-file', async (_evento, caminhoAbsoluto: string): Promise<{ success: boolean; error?: string }> => {
        const caminhoReal = resolverCaminhoEspecial(caminhoAbsoluto)
        console.log('[IPC Filesystem] Excluindo:', caminhoReal)
        try {
            if (!fs.existsSync(caminhoReal)) {
                return { success: false, error: 'O arquivo ou pasta especificada não existe.' }
            }

            const stats = fs.statSync(caminhoReal)
            if (stats.isDirectory()) {
                fs.rmSync(caminhoReal, { recursive: true, force: true })
            } else {
                fs.unlinkSync(caminhoReal)
            }
            return { success: true }
        } catch (erro: unknown) {
            console.error('[IPC Filesystem] Erro ao excluir:', caminhoReal, erro)
            return {
                success: false,
                error: erro instanceof Error ? erro.message : String(erro)
            }
        }
    })
}
