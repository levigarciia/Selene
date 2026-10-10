import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { extname, join, relative, isAbsolute } from 'node:path';
import { z } from 'zod';
import { esquemaConfiguracaoWeb, type EntradaConfiguracaoWeb, type EstadoAcessoWeb } from '../../shared/acessoWeb';
import type { Evento } from '../../shared/contratos';
import type { Operacoes } from './operacoes';

const esquemaPedido = z.object({ nome: z.string().max(80), argumentos: z.array(z.unknown()).max(8) });
const tipos: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};
const operacoesDesktop = new Set([
    'acessoWeb',
    'configurarAcessoWeb',
    'renovarChaveWeb',
    'importar',
    'importarProjetor',
    'importarIconeProjeto',
    'importarArquivosProjetoChat',
    'exportar',
    'reiniciarAtualizacao',
    'abrirRelease',
]);

function enderecosLocais(): string[] {
    return [
        ...new Set(
            Object.values(networkInterfaces()).flatMap((interfaces) =>
                (interfaces ?? [])
                    .filter((item) => item.family === 'IPv4' && !item.internal)
                    .map((item) => item.address),
            ),
        ),
    ];
}

async function lerJson(pedido: IncomingMessage): Promise<unknown> {
    const partes: Buffer[] = [];
    let tamanho = 0;
    for await (const parte of pedido) {
        tamanho += parte.length;
        if (tamanho > 32 * 1024 ** 2) throw new Error('O pedido excede o limite de 32 MB.');
        partes.push(Buffer.from(parte));
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
}

function responder(resposta: ServerResponse, codigo: number, valor: unknown): void {
    resposta.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
    resposta.end(JSON.stringify(valor));
}

/** Oferece a interface da Selene na rede local com sessões revogáveis e operações validadas. */
export class AcessoWeb {
    private servidor?: Server;
    private configuracao = esquemaConfiguracaoWeb.parse({ ativo: false, porta: 4318 });
    private chave = randomBytes(24).toString('base64url');
    private erro?: string;
    private alterando = false;
    private readonly sessoes = new Map<string, number>();
    private readonly clientes = new Map<ServerResponse, string>();
    private readonly tentativas = new Map<string, { quantidade: number; ate: number }>();

    constructor(
        private readonly arquivo: string,
        private readonly pastaInterface: string,
        private readonly operacoes: Operacoes,
        private readonly estadoInicial: () => Evento,
    ) {}

    get estado(): EstadoAcessoWeb {
        return {
            ...this.configuracao,
            ativo: !!this.servidor?.listening,
            enderecos: this.servidor?.listening
                ? enderecosLocais().map((ip) => `http://${ip}:${this.configuracao.porta}`)
                : [],
            chave: this.chave,
            erro: this.erro,
        };
    }

    async abrir(): Promise<void> {
        try {
            this.configuracao = esquemaConfiguracaoWeb.parse(JSON.parse(await readFile(this.arquivo, 'utf8')));
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') this.erro = 'Configuração web inválida.';
        }
        if (!this.configuracao.ativo) return;
        try {
            await this.iniciar();
        } catch (erro) {
            this.erro = erro instanceof Error ? erro.message : 'Não foi possível iniciar o acesso web.';
        }
    }

    async configurar(entrada: EntradaConfiguracaoWeb): Promise<EstadoAcessoWeb> {
        if (this.alterando) throw new Error('Aguarde a alteração do acesso web.');
        this.alterando = true;
        const anterior = this.configuracao;
        try {
            const configuracao = esquemaConfiguracaoWeb.parse(entrada);
            await this.encerrar();
            this.configuracao = configuracao;
            this.erro = undefined;
            if (configuracao.ativo) await this.iniciar();
            await writeFile(this.arquivo, JSON.stringify(configuracao), { mode: 0o600 });
            return this.estado;
        } catch (erro) {
            await this.encerrar();
            this.configuracao = anterior;
            if (anterior.ativo) await this.iniciar().catch(() => {});
            throw erro;
        } finally {
            this.alterando = false;
        }
    }

    renovarChave(): EstadoAcessoWeb {
        this.chave = randomBytes(24).toString('base64url');
        this.sessoes.clear();
        for (const resposta of this.clientes.keys()) resposta.end();
        this.clientes.clear();
        return this.estado;
    }

    publicar(evento: Evento): void {
        for (const [resposta, sessao] of this.clientes) {
            if (!this.sessaoValida(sessao)) {
                resposta.end();
                continue;
            }
            if (resposta.writableLength > 4 * 1024 ** 2) resposta.destroy();
            else resposta.write(`data: ${JSON.stringify(evento)}\n\n`);
        }
    }

    async encerrar(): Promise<void> {
        this.sessoes.clear();
        for (const resposta of this.clientes.keys()) resposta.end();
        this.clientes.clear();
        const servidor = this.servidor;
        this.servidor = undefined;
        if (!servidor) return;
        await new Promise<void>((resolve) => {
            servidor.close(() => resolve());
            servidor.closeAllConnections();
        });
    }

    private async iniciar(): Promise<void> {
        await readFile(join(this.pastaInterface, 'index.html'));
        const servidor = createServer((pedido, resposta) => {
            void this.receber(pedido, resposta).catch((erro: Error) => {
                if (!resposta.headersSent) responder(resposta, 400, { ok: false, erro: erro.message });
                else resposta.end();
            });
        });
        servidor.requestTimeout = 30000;
        await new Promise<void>((resolve, reject) => {
            servidor.once('error', reject);
            servidor.listen(this.configuracao.porta, '0.0.0.0', () => {
                servidor.removeListener('error', reject);
                resolve();
            });
        });
        servidor.on('error', (erro) => {
            this.erro = erro.message;
        });
        this.servidor = servidor;
    }

    private sessaoValida(sessao: string): boolean {
        if (!this.configuracao.exigirChave) return true;
        const validade = this.sessoes.get(sessao);
        if (validade && validade > Date.now()) return true;
        this.sessoes.delete(sessao);
        return false;
    }

    private async receber(pedido: IncomingMessage, resposta: ServerResponse): Promise<void> {
        resposta.setHeader('Cache-Control', 'no-store');
        resposta.setHeader('X-Content-Type-Options', 'nosniff');
        resposta.setHeader('Referrer-Policy', 'no-referrer');
        resposta.setHeader('X-Frame-Options', 'DENY');
        const hosts = ['localhost', '127.0.0.1', ...enderecosLocais()].map((ip) => `${ip}:${this.configuracao.porta}`);
        if (!pedido.headers.host || !hosts.includes(pedido.headers.host)) {
            responder(resposta, 403, { ok: false, erro: 'Endereço não autorizado.' });
            return;
        }
        const origem = `http://${pedido.headers.host}`;
        if ((pedido.method === 'POST' || pedido.headers.origin) && pedido.headers.origin !== origem) {
            responder(resposta, 403, { ok: false, erro: 'Origem não autorizada.' });
            return;
        }
        const caminho = new URL(pedido.url ?? '/', origem).pathname;
        const sessao =
            pedido.headers.cookie
                ?.split('; ')
                .find((item) => item.startsWith('selene_sessao='))
                ?.slice('selene_sessao='.length) ?? '';
        if (caminho === '/api/entrar' && pedido.method === 'POST') {
            await this.entrar(pedido, resposta);
            return;
        }
        if (caminho.startsWith('/api/')) {
            if (!this.sessaoValida(sessao)) {
                responder(resposta, 401, { ok: false, erro: 'Informe a chave de acesso exibida no computador.' });
                return;
            }
            if (caminho === '/api/sessao' && pedido.method === 'GET') {
                responder(resposta, 200, { ok: true, exigirChave: this.configuracao.exigirChave });
            } else if (caminho === '/api/eventos' && pedido.method === 'GET') this.assinar(pedido, resposta, sessao);
            else if (caminho === '/api/sair' && pedido.method === 'POST') {
                this.sessoes.delete(sessao);
                for (const [cliente, id] of this.clientes) if (id === sessao) cliente.end();
                resposta.setHeader('Set-Cookie', 'selene_sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
                responder(resposta, 200, { ok: true });
            } else if (caminho === '/api/operacao' && pedido.method === 'POST') {
                const entrada = esquemaPedido.parse(await lerJson(pedido));
                const seletorPasta = entrada.nome === 'projeto' && entrada.argumentos[1] === undefined;
                const importarPasta =
                    entrada.nome === 'adicionarProjeto' &&
                    z.object({ tipo: z.literal('pasta') }).safeParse(entrada.argumentos[0]).success;
                if (operacoesDesktop.has(entrada.nome) || seletorPasta || importarPasta) {
                    responder(resposta, 403, {
                        ok: false,
                        erro: 'Esta operação deve ser feita na Selene do computador.',
                    });
                    return;
                }
                responder(resposta, 200, await this.operacoes.executar(entrada.nome, entrada.argumentos));
            } else responder(resposta, 404, { ok: false, erro: 'Rota não encontrada.' });
            return;
        }
        if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
            responder(resposta, 405, { ok: false, erro: 'Método não permitido.' });
            return;
        }
        await this.servirArquivo(caminho, pedido, resposta);
    }

    private async entrar(pedido: IncomingMessage, resposta: ServerResponse): Promise<void> {
        if (!this.configuracao.exigirChave) {
            responder(resposta, 200, { ok: true });
            return;
        }
        const agora = Date.now();
        for (const [ip, tentativa] of this.tentativas) if (tentativa.ate < agora) this.tentativas.delete(ip);
        const ip = pedido.socket.remoteAddress ?? '';
        const tentativa = this.tentativas.get(ip) ?? { quantidade: 0, ate: agora + 60000 };
        if (tentativa.quantidade >= 10 || this.tentativas.size > 1024) {
            responder(resposta, 429, { ok: false, erro: 'Aguarde um minuto antes de tentar novamente.' });
            return;
        }
        tentativa.quantidade++;
        this.tentativas.set(ip, tentativa);
        const { chave } = z.object({ chave: z.string().max(100) }).parse(await lerJson(pedido));
        const recebida = Buffer.from(chave);
        const esperada = Buffer.from(this.chave);
        if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
            responder(resposta, 401, { ok: false, erro: 'Chave de acesso inválida.' });
            return;
        }
        for (const [id, validade] of this.sessoes) if (validade < agora) this.sessoes.delete(id);
        if (this.sessoes.size >= 64) {
            responder(resposta, 429, { ok: false, erro: 'Limite de sessões atingido. Renove a chave no computador.' });
            return;
        }
        const sessao = randomBytes(32).toString('base64url');
        this.sessoes.set(sessao, agora + 86400000);
        resposta.setHeader('Set-Cookie', `selene_sessao=${sessao}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
        responder(resposta, 200, { ok: true });
    }

    private assinar(pedido: IncomingMessage, resposta: ServerResponse, sessao: string): void {
        if (this.clientes.size >= 64) {
            responder(resposta, 429, { ok: false, erro: 'Limite de conexões atingido.' });
            return;
        }
        resposta.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
        this.clientes.set(resposta, sessao);
        resposta.write(`data: ${JSON.stringify(this.estadoInicial())}\n\n`);
        const intervalo = setInterval(() => {
            if (!this.sessaoValida(sessao)) resposta.end();
            else resposta.write(': conectado\n\n');
        }, 15000);
        intervalo.unref();
        resposta.on('close', () => {
            clearInterval(intervalo);
            this.clientes.delete(resposta);
        });
    }

    private async servirArquivo(caminho: string, pedido: IncomingMessage, resposta: ServerResponse): Promise<void> {
        try {
            const raiz = await realpath(this.pastaInterface);
            const arquivo = await realpath(join(raiz, caminho === '/' ? 'index.html' : decodeURIComponent(caminho)));
            const relativo = relative(raiz, arquivo);
            if (relativo.startsWith('..') || isAbsolute(relativo) || !tipos[extname(arquivo)]) {
                responder(resposta, 404, { ok: false, erro: 'Arquivo não encontrado.' });
                return;
            }
            const bytes = await readFile(arquivo);
            resposta.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] });
            resposta.end(pedido.method === 'HEAD' ? undefined : bytes);
        } catch {
            responder(resposta, 404, { ok: false, erro: 'Arquivo não encontrado.' });
        }
    }
}
