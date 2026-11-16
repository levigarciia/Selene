import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Conversa, Modelo } from '../shared/contratos';
import { profundidadeMaximaSubagentes } from '../shared/subagentes';
import { ServidorMcp, type EscopoMcp } from '../electron/services/servidorMcp';
import { Subagentes } from '../electron/services/subagentes';
import { argumentosMcp } from '../electron/services/codexAppServer';

const abertos: ServidorMcp[] = [];
afterEach(async () => {
    await Promise.all(abertos.splice(0).map((servidor) => servidor.fechar()));
});

const modelo: Modelo = {
    id: randomUUID(),
    nome: 'Claude',
    caminho: 'claude:claude-opus-5-5',
    tamanho: 0,
    assinatura: { provedor: 'claude', id: 'claude-opus-5-5' },
};

function conversaPai(): Conversa {
    return {
        id: randomUUID(),
        titulo: 'Pai',
        modo: 'code',
        projeto: null,
        pastaTrabalho: 'C:/tmp',
        acessoCompleto: false,
        modeloId: modelo.id,
        mensagens: [],
        atualizadoEm: new Date().toISOString(),
    };
}

async function preparar(executar: (conversa: Conversa, texto: string, sinal: AbortSignal) => Promise<void>) {
    const conversas: Conversa[] = [conversaPai()];
    const entregas: { paiId: string; texto: string }[] = [];
    const subagentes = new Subagentes({
        conversaPorId: (id) => conversas.find((conversa) => conversa.id === id)!,
        conversas: () => conversas,
        assinaturaDoModelo: () => modelo.assinatura,
        criarConversa: async (conversa) => void conversas.push(conversa),
        obterModelo: async () => modelo,
        executarConversa: executar,
        capacidades: async () => [{ provedor: 'claude', disponivel: true, modelos: [] }],
        entregarAoPai: async (paiId, texto) => void entregas.push({ paiId, texto }),
        publicarEstado: () => undefined,
    });
    const servidor = new ServidorMcp((mcp, escopo) => subagentes.registrarFerramentas(mcp, escopo));
    await servidor.abrir();
    abertos.push(servidor);
    const escopo: EscopoMcp = {
        conversaId: conversas[0]!.id,
        provedor: 'claude',
        modelo: 'claude-opus-5-5',
        acessoCompleto: false,
        profundidade: 0,
    };
    return { conversas, entregas, subagentes, servidor, escopo };
}

async function conectar(url: string, token: string) {
    const cliente = new Client({ name: 'teste', version: '1.0.0' });
    await cliente.connect(
        new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
    );
    return cliente;
}

function lerResultado(resposta: unknown) {
    const conteudo = (resposta as { content: { text: string }[] }).content[0]!.text;
    return JSON.parse(conteudo) as Record<string, unknown>;
}

function responder(conversa: Conversa, texto: string) {
    conversa.mensagens.push({
        id: randomUUID(),
        papel: 'assistant',
        texto,
        estado: 'concluida',
        acoes: [],
        criadoEm: new Date().toISOString(),
    });
}

describe('servidor MCP', () => {
    test('recusa token inválido e pedidos de navegador', async () => {
        const { servidor, escopo } = await preparar(async () => undefined);
        const { url, token } = servidor.emitir(escopo);
        expect((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer outro' } })).status).toBe(401);
        const comOrigem = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Origin: 'https://exemplo.com' },
        });
        expect(comOrigem.status).toBe(403);
    });

    test('token revogado deixa de valer', async () => {
        const { servidor, escopo } = await preparar(async () => undefined);
        const credencial = servidor.emitir(escopo);
        credencial.revogar();
        expect((await fetch(credencial.url, { method: 'POST', headers: { Authorization: `Bearer ${credencial.token}` } })).status).toBe(401);
    });
});

describe('injeção no Codex', () => {
    test('o token fica fora dos argumentos do processo', () => {
        const argumentos = argumentosMcp({ url: 'http://127.0.0.1:1/mcp', token: 'segredo', instrucoes: '' });
        expect(argumentos.join(' ')).not.toContain('segredo');
        expect(argumentos).toContain('mcp_servers.selene.bearer_token_env_var="SELENE_MCP_TOKEN"');
    });
});

describe('subagentes', () => {
    test('modo wait devolve o resultado do filho, que herda pasta e não amplia acesso', async () => {
        const { servidor, escopo, conversas } = await preparar(async (conversa, texto) => {
            responder(conversa, `feito: ${texto}`);
        });
        const { url, token } = servidor.emitir({ ...escopo, acessoCompleto: false });
        const cliente = await conectar(url, token);
        const resultado = lerResultado(
            await cliente.callTool({ name: 'delegar_tarefa', arguments: { tarefa: 'revise', papel: 'revisao', modo: 'wait' } }),
        );
        expect(resultado.estado).toBe('concluida');
        expect(resultado.resumo).toBe('feito: revise\n\nPapel: revisão.');
        const filha = conversas.find((conversa) => conversa.id === resultado.conversaFilhaId)!;
        expect(filha.subagente?.paiId).toBe(escopo.conversaId);
        expect(filha.pastaTrabalho).toBe('C:/tmp');
        expect(filha.acessoCompleto).toBe(false);
        await cliente.close();
    });

    test('modo async entrega a conclusão à conversa pai', async () => {
        let concluir!: () => void;
        const { servidor, escopo, entregas } = await preparar(
            (conversa) =>
                new Promise<void>((resolver) => {
                    concluir = () => {
                        responder(conversa, 'pronto');
                        resolver();
                    };
                }),
        );
        const { url, token } = servidor.emitir(escopo);
        const cliente = await conectar(url, token);
        const resultado = lerResultado(await cliente.callTool({ name: 'delegar_tarefa', arguments: { tarefa: 'x' } }));
        expect(resultado.estado).toBe('executando');
        concluir();
        await new Promise((resolver) => setTimeout(resolver, 20));
        expect(entregas).toHaveLength(1);
        expect(entregas[0]!.paiId).toBe(escopo.conversaId);
        expect(entregas[0]!.texto).toContain('pronto');
        await cliente.close();
    });

    test('clientRequestId repetido devolve a mesma tarefa', async () => {
        const { subagentes, escopo } = await preparar(async (conversa) => responder(conversa, 'ok'));
        const primeira = await subagentes.delegar(escopo, { tarefa: 'a', clientRequestId: 'r1', modo: 'wait' });
        const segunda = await subagentes.delegar(escopo, { tarefa: 'a', clientRequestId: 'r1', modo: 'wait' });
        expect(segunda.tarefaId).toBe(primeira.tarefaId);
    });

    test('cancelar interrompe o filho e dispensa a entrega', async () => {
        const { subagentes, escopo, entregas } = await preparar(
            (_conversa, _texto, sinal) => new Promise<void>((resolver) => sinal.addEventListener('abort', () => resolver())),
        );
        const tarefa = await subagentes.delegar(escopo, { tarefa: 'longa' });
        subagentes.cancelar(escopo, tarefa.tarefaId);
        await new Promise((resolver) => setTimeout(resolver, 20));
        expect(subagentes.emExecucao()).toEqual([]);
        expect(entregas).toEqual([]);
    });

    test('tarefa de outra conversa não é visível e a profundidade é limitada', async () => {
        const { subagentes, escopo } = await preparar(async (conversa) => responder(conversa, 'ok'));
        const tarefa = await subagentes.delegar(escopo, { tarefa: 'a', modo: 'wait' });
        expect(() => subagentes.status({ ...escopo, conversaId: randomUUID() }, tarefa.tarefaId)).toThrow();
        await expect(
            subagentes.delegar({ ...escopo, profundidade: profundidadeMaximaSubagentes }, { tarefa: 'b' }),
        ).rejects.toThrow('Profundidade');
    });
});
