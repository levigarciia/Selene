import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Conversa, Mensagem, Modelo } from '../../shared/contratos';
import type { ModeloAssinaturaDisponivel, ProvedorAssinatura } from '../../shared/assinaturas';
import {
    formatoEntradaDelegacao,
    limiteResumoSubagente,
    profundidadeMaximaSubagentes,
    tempoEsperaPadraoMs,
    type EntradaDelegacao,
    type EstadoTarefa,
    type ResultadoTarefa,
} from '../../shared/subagentes';
import type { EscopoMcp } from './servidorMcp';

export type CapacidadeProvedor = {
    provedor: ProvedorAssinatura;
    disponivel: boolean;
    motivo?: string;
    modelos: ModeloAssinaturaDisponivel[];
};

type Dependencias = {
    conversaPorId: (id: string) => Conversa;
    conversas: () => readonly Conversa[];
    assinaturaDoModelo: (modeloId: string | null) => Modelo['assinatura'];
    /** Persiste uma nova conversa filha. */
    criarConversa: (conversa: Conversa) => Promise<void>;
    /** Modelo cadastrado para a inscrição; sem `modelo`, usa o primeiro anunciado pelo provedor. */
    obterModelo: (provedor: ProvedorAssinatura, modelo?: string) => Promise<Modelo>;
    executarConversa: (conversa: Conversa, texto: string, sinal: AbortSignal) => Promise<void>;
    capacidades: () => Promise<CapacidadeProvedor[]>;
    /** Entrega o resultado de uma tarefa assíncrona à conversa pai, como direção ou novo envio. */
    entregarAoPai: (paiId: string, texto: string) => Promise<void>;
    publicarEstado: () => void;
};

type Tarefa = {
    id: string;
    paiId: string;
    filhaId: string;
    titulo: string;
    provedor: ProvedorAssinatura;
    modelo: string;
    controle: AbortController;
    termino: Promise<void>;
    entregar: boolean;
};

class FalhaOrquestracao extends Error {}

const nomesPapeis: Record<NonNullable<EntradaDelegacao['papel']>, string> = {
    implementacao: 'implementação',
    pesquisa: 'pesquisa',
    revisao: 'revisão',
    design: 'design',
    teste: 'testes',
    geral: 'geral',
};

/**
 * Tarefas delegadas por agentes de inscrição a outros agentes de inscrição, no modelo do T3 Code: cada tarefa é
 * uma conversa Code filha que recebe somente o texto da tarefa e roda em paralelo à conversa pai.
 */
export class Subagentes {
    private readonly tarefas = new Map<string, Tarefa>();
    private readonly porPedido = new Map<string, string>();
    private readonly ativas = new Set<string>();

    constructor(private readonly dependencias: Dependencias) {}

    /** Conversas filhas em execução agora, para a interface tratá-las como ativas. */
    emExecucao(): string[] {
        return [...this.ativas];
    }

    async delegar(escopo: EscopoMcp, entrada: EntradaDelegacao): Promise<ResultadoTarefa> {
        if (escopo.profundidade + 1 > profundidadeMaximaSubagentes) {
            throw new FalhaOrquestracao('Profundidade máxima de subagentes atingida.');
        }
        const chavePedido = entrada.clientRequestId && `${escopo.conversaId}:${entrada.clientRequestId}`;
        const repetida = chavePedido ? this.tarefas.get(this.porPedido.get(chavePedido) ?? '') : undefined;
        const tarefa = repetida ?? (await this.criar(escopo, entrada, chavePedido));
        const modo = entrada.modo ?? 'async';
        if (modo === 'async') return this.resultado(tarefa, false);
        const expirou = await esperar(tarefa.termino, entrada.timeoutMs ?? tempoEsperaPadraoMs);
        if (!expirou) tarefa.entregar = false;
        return this.resultado(tarefa, expirou);
    }

    status(escopo: EscopoMcp, tarefaId: string): ResultadoTarefa {
        const tarefa = this.tarefaDoPai(escopo.conversaId, tarefaId);
        const resultado = this.resultado(tarefa, false);
        if (resultado.estado !== 'executando') tarefa.entregar = false;
        return resultado;
    }

    cancelar(escopo: EscopoMcp, tarefaId: string): ResultadoTarefa {
        const tarefa = this.tarefaDoPai(escopo.conversaId, tarefaId);
        tarefa.entregar = false;
        this.interromper(tarefa);
        return this.resultado(tarefa, false);
    }

    /** Interrompe todas as tarefas em execução, como no botão de parar da interface. */
    cancelarTodas(): void {
        for (const tarefa of this.tarefas.values()) {
            if (!this.ativas.has(tarefa.filhaId)) continue;
            tarefa.entregar = false;
            tarefa.controle.abort();
        }
    }

    /** Interrompe todas as tarefas delegadas por uma conversa e as que elas delegaram. */
    cancelarDescendentes(conversaId: string): void {
        for (const tarefa of this.tarefas.values()) {
            if (tarefa.paiId !== conversaId) continue;
            tarefa.entregar = false;
            this.interromper(tarefa);
        }
    }

    /** Registra as ferramentas de orquestração no servidor MCP de uma execução. */
    registrarFerramentas(servidor: McpServer, escopo: EscopoMcp): void {
        servidor.registerTool(
            'capacidades_orquestrador',
            {
                description:
                    'Lista as inscrições (Claude, ChatGPT) e modelos disponíveis para subagentes, o provedor e o ' +
                    'modelo herdados desta conversa e o acesso máximo que um subagente pode receber.',
                annotations: { readOnlyHint: true },
            },
            () => this.responder(async () => ({
                herdado: {
                    provedor: escopo.provedor,
                    modelo: escopo.modelo,
                    acesso: escopo.acessoCompleto ? 'completo' : 'aprovacao',
                },
                profundidadeRestante: profundidadeMaximaSubagentes - escopo.profundidade,
                provedores: await this.dependencias.capacidades(),
            })),
        );
        servidor.registerTool(
            'delegar_tarefa',
            {
                description:
                    'Cria um subagente da Selene em uma conversa filha e envia somente o texto da tarefa, sem o ' +
                    'histórico desta conversa. Provedor, modelo e acesso herdam desta conversa, salvo alvo; o acesso ' +
                    'só pode ficar mais restrito. modo async (padrão) devolve logo e a conclusão chega a esta ' +
                    'conversa como nova mensagem: encerre o turno em vez de consultar. modo wait espera até ' +
                    'timeoutMs sem cancelar o filho; esperaExpirou indica o fim da espera. Use um clientRequestId ' +
                    'por rodada, estável entre tentativas da mesma rodada.',
                inputSchema: formatoEntradaDelegacao,
                annotations: { destructiveHint: true, openWorldHint: true },
            },
            (entrada) => this.responder(() => this.delegar(escopo, entrada)),
        );
        servidor.registerTool(
            'status_tarefa',
            {
                description:
                    'Lê uma tarefa delegada por esta conversa. resumo traz o resultado final, inclusive erros. Ler um ' +
                    'resultado final dispensa a entrega automática dele a esta conversa.',
                inputSchema: { tarefaId: z.string().uuid() },
                annotations: { readOnlyHint: true },
            },
            ({ tarefaId }) => this.responder(async () => this.status(escopo, tarefaId)),
        );
        servidor.registerTool(
            'cancelar_tarefa',
            {
                description:
                    'Interrompe uma tarefa delegada por esta conversa e as tarefas que ela delegou, dispensando a ' +
                    'entrega automática. Resultados já publicados continuam disponíveis.',
                inputSchema: { tarefaId: z.string().uuid() },
                annotations: { destructiveHint: true },
            },
            ({ tarefaId }) => this.responder(async () => this.cancelar(escopo, tarefaId)),
        );
    }

    private async criar(escopo: EscopoMcp, entrada: EntradaDelegacao, chavePedido?: string): Promise<Tarefa> {
        const provedor = entrada.alvo?.provedor ?? escopo.provedor;
        const modeloPedido = entrada.alvo?.modelo ?? (provedor === escopo.provedor ? escopo.modelo : undefined);
        const modelo = await this.dependencias.obterModelo(provedor, modeloPedido);
        const pai = this.dependencias.conversaPorId(escopo.conversaId);
        const papel = entrada.papel ?? 'geral';
        const id = randomUUID();
        const filha: Conversa = {
            id: randomUUID(),
            titulo: (entrada.titulo ?? entrada.tarefa).slice(0, 70),
            modo: 'code',
            projeto: pai.projeto,
            projetoId: pai.projetoId,
            ...(pai.pastaRepositorio ? { pastaRepositorio: pai.pastaRepositorio } : {}),
            ...(pai.pastaTrabalho ? { pastaTrabalho: pai.pastaTrabalho } : {}),
            acessoCompleto: escopo.acessoCompleto && entrada.acesso !== 'aprovacao',
            modeloId: modelo.id,
            ...(pai.economiaTokens ? { economiaTokens: pai.economiaTokens } : {}),
            mensagens: [],
            atualizadoEm: new Date().toISOString(),
            subagente: { paiId: pai.id, tarefaId: id, papel, profundidade: escopo.profundidade + 1 },
        };
        await this.dependencias.criarConversa(filha);
        const texto = papel === 'geral' ? entrada.tarefa : `${entrada.tarefa}\n\nPapel: ${nomesPapeis[papel]}.`;
        const controle = new AbortController();
        const tarefa: Tarefa = {
            id,
            paiId: pai.id,
            filhaId: filha.id,
            titulo: filha.titulo,
            provedor,
            modelo: modelo.assinatura!.id,
            controle,
            termino: Promise.resolve(),
            entregar: true,
        };
        this.tarefas.set(id, tarefa);
        if (chavePedido) this.porPedido.set(chavePedido, id);
        this.ativas.add(filha.id);
        this.dependencias.publicarEstado();
        tarefa.termino = this.dependencias
            .executarConversa(filha, texto, controle.signal)
            .catch(() => undefined)
            .finally(() => this.concluir(tarefa));
        return tarefa;
    }

    private async concluir(tarefa: Tarefa): Promise<void> {
        this.ativas.delete(tarefa.filhaId);
        this.dependencias.publicarEstado();
        if (!tarefa.entregar) return;
        tarefa.entregar = false;
        const resultado = this.resultado(tarefa, false);
        const texto =
            `Subagente "${tarefa.titulo}" (${tarefa.provedor} ${tarefa.modelo}) terminou: ${resultado.estado}. ` +
            `tarefaId ${tarefa.id}.\n\n${resultado.resumo ?? ''}`;
        await this.dependencias.entregarAoPai(tarefa.paiId, texto.trim().slice(0, 30000)).catch(() => undefined);
    }

    private interromper(tarefa: Tarefa): void {
        tarefa.controle.abort();
        this.cancelarDescendentes(tarefa.filhaId);
    }

    private tarefaDoPai(paiId: string, tarefaId: string): Tarefa {
        const tarefa = this.tarefas.get(tarefaId) ?? this.restaurar(tarefaId);
        if (!tarefa || tarefa.paiId !== paiId) throw new FalhaOrquestracao('Tarefa não encontrada nesta conversa.');
        return tarefa;
    }

    /** Reconstrói uma tarefa de uma sessão anterior a partir da conversa filha persistida. */
    private restaurar(tarefaId: string): Tarefa | undefined {
        const filha = this.dependencias.conversas().find((conversa) => conversa.subagente?.tarefaId === tarefaId);
        if (!filha?.subagente) return undefined;
        const assinatura = this.dependencias.assinaturaDoModelo(filha.modeloId);
        if (!assinatura) return undefined;
        const tarefa: Tarefa = {
            id: tarefaId,
            paiId: filha.subagente.paiId,
            filhaId: filha.id,
            titulo: filha.titulo,
            provedor: assinatura.provedor,
            modelo: assinatura.id,
            controle: new AbortController(),
            termino: Promise.resolve(),
            entregar: false,
        };
        this.tarefas.set(tarefaId, tarefa);
        return tarefa;
    }

    private resultado(tarefa: Tarefa, esperaExpirou: boolean): ResultadoTarefa {
        const filha = this.dependencias.conversas().find((conversa) => conversa.id === tarefa.filhaId);
        const resposta = [...(filha?.mensagens ?? [])].reverse().find((mensagem) => mensagem.papel === 'assistant');
        const estado = this.ativas.has(tarefa.filhaId) ? 'executando' : estadoDaResposta(resposta);
        return {
            tarefaId: tarefa.id,
            conversaFilhaId: tarefa.filhaId,
            estado,
            provedor: tarefa.provedor,
            modelo: tarefa.modelo,
            resumo: estado === 'executando' || !resposta ? null : resumirResposta(resposta),
            esperaExpirou,
        };
    }

    private async responder(executar: () => Promise<unknown>) {
        try {
            return { content: [{ type: 'text' as const, text: JSON.stringify(await executar()) }] };
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : 'Falha na orquestração.';
            return { content: [{ type: 'text' as const, text: JSON.stringify({ erro: mensagem }) }], isError: true };
        }
    }
}

function estadoDaResposta(resposta?: Mensagem): EstadoTarefa {
    if (!resposta) return 'erro';
    if (resposta.estado === 'gerando') return 'interrompida';
    return resposta.estado;
}

/** Texto final da resposta do filho; em falhas, inclui a mensagem de erro que o agente anexa ao fim. */
function resumirResposta(resposta: Mensagem): string {
    const final = resposta.texto.slice(resposta.inicioTextoFinal ?? 0).trim() || resposta.texto.trim();
    return final.length > limiteResumoSubagente ? `${final.slice(0, limiteResumoSubagente)}…` : final;
}

/** Espera o término por até `limiteMs`; devolve `true` quando o prazo acabou antes. */
async function esperar(termino: Promise<void>, limiteMs: number): Promise<boolean> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<boolean>((resolver) => {
        temporizador = setTimeout(() => resolver(true), limiteMs);
    });
    try {
        return await Promise.race([termino.then(() => false), prazo]);
    } finally {
        clearTimeout(temporizador);
    }
}
