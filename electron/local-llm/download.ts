import * as fs from 'fs'
import * as https from 'https'

export type ProgressoDownload = (downloaded: number, total: number, percent: number) => void

export function obterMensagemErro(erro: unknown): string {
    if (erro instanceof Error && erro.message) {
        return erro.message
    }
    return 'Erro desconhecido'
}

export function formatarBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const unidades = ['B', 'KB', 'MB', 'GB']
    const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1)
    return `${(bytes / Math.pow(1024, indice)).toFixed(indice === 0 ? 0 : 1)} ${unidades[indice]}`
}

export function baixarArquivo(
    url: string,
    destinoTemporario: string,
    onProgress: ProgressoDownload = () => {}
): { promise: Promise<void>; cancelar: () => void } {
    let requestAtual: ReturnType<typeof https.get> | null = null
    let cancelado = false

    const promise = new Promise<void>((resolve, reject) => {
        const iniciar = (urlAtual: string) => {
            const arquivo = fs.createWriteStream(destinoTemporario)
            let baixado = 0

            requestAtual = https.get(urlAtual, {
                headers: { 'User-Agent': 'Selene-Desktop-App' }
            }, (resposta) => {
                if ([301, 302, 303, 307, 308].includes(resposta.statusCode || 0) && resposta.headers.location) {
                    arquivo.close()
                    fs.rmSync(destinoTemporario, { force: true })
                    iniciar(resposta.headers.location)
                    return
                }

                if (resposta.statusCode !== 200) {
                    arquivo.close()
                    fs.rmSync(destinoTemporario, { force: true })
                    reject(new Error(`Download falhou com status ${resposta.statusCode}`))
                    return
                }

                const total = Number(resposta.headers['content-length'] || 0)
                resposta.on('data', (chunk: Buffer) => {
                    if (cancelado) {
                        resposta.destroy()
                        return
                    }
                    baixado += chunk.length
                    const percent = total > 0 ? Math.round((baixado / total) * 100) : 0
                    onProgress(baixado, total, percent)
                })

                resposta.pipe(arquivo)
                arquivo.on('finish', () => {
                    arquivo.close()
                    if (cancelado) {
                        fs.rmSync(destinoTemporario, { force: true })
                        reject(new Error('Download cancelado'))
                        return
                    }
                    resolve()
                })
            })

            requestAtual.on('error', (erro) => {
                arquivo.close()
                fs.rmSync(destinoTemporario, { force: true })
                reject(erro)
            })
        }

        iniciar(url)
    })

    return {
        promise,
        cancelar: () => {
            cancelado = true
            requestAtual?.destroy(new Error('Download cancelado'))
        }
    }
}
