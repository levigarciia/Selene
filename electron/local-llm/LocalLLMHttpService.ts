import * as crypto from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { Readable } from 'stream'
import { app, safeStorage } from 'electron'
import { llamaModelManager } from './LlamaModelManager.js'
import { localLLMHostService } from './LocalLLMHostService.js'

const PORTA_PUBLICA = 11435

type ConfigHttpLocal = {
    chaveCriptografada?: string
    chaveTexto?: string
}

export class LocalLLMHttpService {
    private servidor: http.Server | null = null
    private chave: string | null = null
    private erroInicializacao: string | null = null

    async start(): Promise<void> {
        if (this.servidor) return
        this.chave = this.carregarOuCriarChave()

        await new Promise<void>((resolve) => {
            this.servidor = http.createServer((req, res) => {
                void this.handleRequest(req, res)
            })

            this.servidor.once('error', (erro: NodeJS.ErrnoException) => {
                this.erroInicializacao = erro.code === 'EADDRINUSE'
                    ? `Porta ${PORTA_PUBLICA} já está em uso.`
                    : erro.message
                console.error('[LocalLLMHttpService] Falha ao iniciar HTTP público:', this.erroInicializacao)
                this.servidor = null
                resolve()
            })

            this.servidor.listen(PORTA_PUBLICA, '127.0.0.1', () => {
                this.erroInicializacao = null
                console.log(`[LocalLLMHttpService] API pública em http://127.0.0.1:${PORTA_PUBLICA}/v1`)
                resolve()
            })
        })
    }

    async stop(): Promise<void> {
        if (!this.servidor) return
        const servidor = this.servidor
        this.servidor = null
        await new Promise<void>((resolve) => servidor.close(() => resolve()))
    }

    getConfig(): { baseUrl: string; key: string; running: boolean; error: string | null } {
        if (!this.chave) {
            this.chave = this.carregarOuCriarChave()
        }
        return {
            baseUrl: `http://127.0.0.1:${PORTA_PUBLICA}/v1`,
            key: this.chave,
            running: !!this.servidor,
            error: this.erroInicializacao
        }
    }

    rotateKey(): { baseUrl: string; key: string; running: boolean; error: string | null } {
        this.chave = this.criarChave()
        this.salvarChave(this.chave)
        return this.getConfig()
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        this.aplicarHeaders(res)

        if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
        }

        if (!this.autorizado(req)) {
            this.enviarJson(res, 401, { error: { message: 'Chave local inválida.', type: 'authentication_error' } })
            return
        }

        const url = new URL(req.url || '/', `http://127.0.0.1:${PORTA_PUBLICA}`)
        if (req.method === 'GET' && url.pathname === '/v1/models') {
            this.enviarJson(res, 200, {
                object: 'list',
                data: llamaModelManager.listDownloadedModels().map((modelo) => ({
                    id: modelo.id,
                    object: 'model',
                    owned_by: 'selene-local',
                    created: 0
                }))
            })
            return
        }

        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
            await this.handleChatCompletions(req, res)
            return
        }

        this.enviarJson(res, 404, { error: { message: 'Endpoint não suportado no v1 local.', type: 'not_found' } })
    }

    private async handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const body = await this.lerJson(req)
            const modeloSolicitado = typeof body.model === 'string' ? body.model : ''
            const modelId = modeloSolicitado || llamaModelManager.listDownloadedModels()[0]?.id
            if (!modelId) {
                this.enviarJson(res, 400, { error: { message: 'Nenhum modelo local baixado.', type: 'invalid_request_error' } })
                return
            }

            const servidor = await localLLMHostService.ensureServer(modelId)
            const resposta = await fetch(`${servidor.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, model: modelId })
            })

            res.writeHead(resposta.status, {
                'Content-Type': resposta.headers.get('content-type') || 'application/json',
                'Cache-Control': 'no-cache'
            })

            if (resposta.body) {
                Readable.fromWeb(resposta.body as unknown as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
                return
            }

            res.end(await resposta.text())
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido'
            this.enviarJson(res, 500, { error: { message: mensagem, type: 'server_error' } })
        }
    }

    private autorizado(req: http.IncomingMessage): boolean {
        const esperado = this.chave || this.carregarOuCriarChave()
        const auth = req.headers.authorization || ''
        return auth === `Bearer ${esperado}`
    }

    private async lerJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
        const chunks: Buffer[] = []
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const texto = Buffer.concat(chunks).toString('utf8')
        if (!texto.trim()) return {}
        return JSON.parse(texto) as Record<string, unknown>
    }

    private enviarJson(res: http.ServerResponse, status: number, data: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
    }

    private aplicarHeaders(res: http.ServerResponse): void {
        res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1')
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }

    private carregarOuCriarChave(): string {
        const arquivo = this.getConfigPath()
        if (fs.existsSync(arquivo)) {
            try {
                const config = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as ConfigHttpLocal
                if (config.chaveCriptografada && safeStorage.isEncryptionAvailable()) {
                    return safeStorage.decryptString(Buffer.from(config.chaveCriptografada, 'base64'))
                }
                if (config.chaveTexto) {
                    return config.chaveTexto
                }
            } catch (erro) {
                console.warn('[LocalLLMHttpService] Falha ao ler chave local:', erro)
            }
        }

        const chave = this.criarChave()
        this.salvarChave(chave)
        return chave
    }

    private salvarChave(chave: string): void {
        const config: ConfigHttpLocal = safeStorage.isEncryptionAvailable()
            ? { chaveCriptografada: safeStorage.encryptString(chave).toString('base64') }
            : { chaveTexto: chave }

        fs.mkdirSync(path.dirname(this.getConfigPath()), { recursive: true })
        fs.writeFileSync(this.getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
    }

    private criarChave(): string {
        return `selene-local-${crypto.randomBytes(24).toString('hex')}`
    }

    private getConfigPath(): string {
        return path.join(app.getPath('userData'), 'local-llm', 'http-config.json')
    }
}

export const localLLMHttpService = new LocalLLMHttpService()
