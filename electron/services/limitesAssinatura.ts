import { tmpdir } from 'node:os';
import type { ProvedorAssinatura } from '../../shared/assinaturas';
import { limitesDoClaude, limitesDoCodex, type LimitesAssinatura } from '../../shared/limites';
import { executar, limiteResposta } from './assinaturas';

const tempoLimiteMs = 20000;

/**
 * Faz um pedido de uma linha JSON por vez a um CLI oficial e devolve a primeira resposta aceita.
 * O processo é encerrado ao responder, ao estourar o tempo ou ao exceder o limite de saída.
 */
function conversar(
    binario: string,
    argumentos: string[],
    mensagens: object[],
    aceitar: (linha: unknown) => { valor: unknown } | undefined,
): Promise<unknown> {
    return new Promise((resolver, rejeitar) => {
        // Pasta temporária evita que o CLI carregue instruções de algum projeto.
        const processo = executar(binario, argumentos, tmpdir());
        let pendente = '';
        let tamanho = 0;
        let encerrado = false;
        const terminar = (acao: () => void) => {
            if (encerrado) return;
            encerrado = true;
            clearTimeout(limite);
            processo.kill();
            acao();
        };
        const limite = setTimeout(
            () => terminar(() => rejeitar(new Error('O CLI não respondeu a tempo.'))),
            tempoLimiteMs,
        );
        processo.on('error', (erro) => terminar(() => rejeitar(erro)));
        processo.on('close', () => terminar(() => rejeitar(new Error('O CLI encerrou sem informar os limites.'))));
        processo.stdout?.on('data', (parte: Buffer) => {
            tamanho += parte.length;
            if (tamanho > limiteResposta) return terminar(() => rejeitar(new Error('Resposta grande demais do CLI.')));
            pendente += parte.toString('utf8');
            const linhas = pendente.split('\n');
            pendente = linhas.pop() ?? '';
            for (const linha of linhas) {
                let json: unknown;
                try {
                    json = JSON.parse(linha);
                } catch {
                    continue;
                }
                const aceita = aceitar(json);
                if (aceita) return terminar(() => resolver(aceita.valor));
            }
        });
        for (const mensagem of mensagens) processo.stdin?.write(`${JSON.stringify(mensagem)}\n`);
    });
}

type Resposta = { id?: unknown; result?: unknown; error?: { message?: string } };
type RespostaControle = { type?: unknown; response?: { request_id?: unknown; subtype?: unknown; response?: unknown; error?: unknown } };

/** `codex app-server` responde a `account/rateLimits/read` com o uso da conta autenticada. */
async function consultarCodex(): Promise<unknown> {
    return conversar(
        'codex',
        ['app-server'],
        [
            { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'selene', version: '1' } } },
            { jsonrpc: '2.0', method: 'initialized' },
            { jsonrpc: '2.0', id: 2, method: 'account/rateLimits/read' },
        ],
        (linha) => {
            const resposta = linha as Resposta;
            if (resposta.id !== 2) return undefined;
            if (resposta.error) throw new Error(resposta.error.message ?? 'O Codex recusou a consulta.');
            return { valor: resposta.result };
        },
    );
}

/** O Claude Code aceita pedidos de controle em `stream-json`; `get_usage` devolve as janelas da assinatura. */
async function consultarClaude(): Promise<unknown> {
    return conversar(
        'claude',
        ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'],
        [
            { type: 'control_request', request_id: 'selene-init', request: { subtype: 'initialize' } },
            { type: 'control_request', request_id: 'selene-uso', request: { subtype: 'get_usage' } },
        ],
        (linha) => {
            const resposta = linha as RespostaControle;
            if (resposta.type !== 'control_response' || resposta.response?.request_id !== 'selene-uso') return undefined;
            if (resposta.response.subtype !== 'success') throw new Error('O Claude Code recusou a consulta.');
            return { valor: resposta.response.response };
        },
    );
}

/** Consulta os limites de uma inscrição sem expor credenciais; falhas viram um estado legível. */
export async function consultarLimites(provedor: ProvedorAssinatura): Promise<LimitesAssinatura> {
    const verificadoEm = new Date().toISOString();
    try {
        const bruto = provedor === 'chatgpt' ? await consultarCodex() : await consultarClaude();
        return provedor === 'chatgpt' ? limitesDoCodex(bruto, verificadoEm) : limitesDoClaude(bruto, verificadoEm);
    } catch (erro) {
        const ausente = (erro as NodeJS.ErrnoException).code === 'ENOENT';
        return {
            estado: 'indisponivel',
            motivo: ausente
                ? `O ${provedor === 'chatgpt' ? 'Codex' : 'Claude Code'} não está instalado neste computador.`
                : erro instanceof Error
                  ? erro.message
                  : 'Não foi possível consultar os limites.',
            verificadoEm,
        };
    }
}
