import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ProvedorAssinatura } from '../../shared/assinaturas';

const limiteCorpo = 1024 ** 2;

/** O que uma credencial autoriza: a conversa que a recebeu e o teto de permissões para os filhos. */
export type EscopoMcp = {
    conversaId: string;
    provedor: ProvedorAssinatura;
    modelo: string;
    acessoCompleto: boolean;
    profundidade: number;
};

export type CredencialMcp = { url: string; token: string; revogar: () => void };

/**
 * Servidor MCP da Selene, somente em loopback, para os harnesses de inscrição chamarem as ferramentas de
 * orquestração. Cada execução recebe um token próprio, revogado ao terminar; pedidos de navegador (com `Origin`)
 * são recusados.
 */
export class ServidorMcp {
    private servidor?: Server;
    private readonly credenciais = new Map<string, EscopoMcp>();

    constructor(private readonly registrarFerramentas: (servidor: McpServer, escopo: EscopoMcp) => void) {}

    async abrir(): Promise<void> {
        const servidor = createServer((pedido, resposta) => {
            void this.atender(pedido, resposta).catch(() => {
                if (!resposta.headersSent) this.responder(resposta, 500, 'Falha no servidor MCP.');
            });
        });
        await new Promise<void>((resolver, rejeitar) => {
            servidor.once('error', rejeitar);
            servidor.listen(0, '127.0.0.1', () => resolver());
        });
        this.servidor = servidor;
    }

    /** Emite um token para uma execução. O chamador deve revogá-lo quando a execução terminar. */
    emitir(escopo: EscopoMcp): CredencialMcp {
        if (!this.servidor) throw new Error('O servidor MCP não está aberto.');
        const token = randomBytes(32).toString('base64url');
        this.credenciais.set(token, escopo);
        const { port } = this.servidor.address() as AddressInfo;
        return { url: `http://127.0.0.1:${port}/mcp`, token, revogar: () => this.credenciais.delete(token) };
    }

    async fechar(): Promise<void> {
        this.credenciais.clear();
        const servidor = this.servidor;
        this.servidor = undefined;
        if (servidor) await new Promise<void>((resolver) => servidor.close(() => resolver()));
    }

    private async atender(pedido: IncomingMessage, resposta: ServerResponse): Promise<void> {
        if (pedido.headers.origin) return this.responder(resposta, 403, 'Origem não permitida.');
        if (new URL(pedido.url ?? '/', 'http://127.0.0.1').pathname !== '/mcp') {
            return this.responder(resposta, 404, 'Não encontrado.');
        }
        const token = /^Bearer (\S+)$/.exec(pedido.headers.authorization ?? '')?.[1];
        const escopo = token ? this.credenciais.get(token) : undefined;
        if (!escopo) return this.responder(resposta, 401, 'Credencial inválida.');
        if (pedido.method !== 'POST') return this.responder(resposta, 405, 'Use POST.');
        const corpo = await lerCorpo(pedido);
        if (corpo === undefined) return this.responder(resposta, 413, 'Pedido grande demais.');
        const servidor = new McpServer({ name: 'selene', version: '1.0.0' });
        this.registrarFerramentas(servidor, escopo);
        const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        resposta.on('close', () => {
            void transporte.close();
            void servidor.close();
        });
        await servidor.connect(transporte);
        await transporte.handleRequest(pedido, resposta, corpo);
    }

    private responder(resposta: ServerResponse, codigo: number, mensagem: string): void {
        resposta.writeHead(codigo, { 'Content-Type': 'application/json' });
        resposta.end(JSON.stringify({ error: mensagem }));
    }
}

/** Lê o corpo JSON com limite de tamanho; `undefined` quando excede o limite. */
async function lerCorpo(pedido: IncomingMessage): Promise<unknown> {
    const partes: Buffer[] = [];
    let tamanho = 0;
    for await (const parte of pedido as AsyncIterable<Buffer>) {
        tamanho += parte.length;
        if (tamanho > limiteCorpo) return undefined;
        partes.push(parte);
    }
    const texto = Buffer.concat(partes).toString('utf8');
    try {
        return texto ? JSON.parse(texto) : null;
    } catch {
        return null;
    }
}
