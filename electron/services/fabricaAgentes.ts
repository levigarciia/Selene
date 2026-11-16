import type { Conversa, Dados, Evento, Mensagem } from '../../shared/contratos';
import { instrucaoOrquestracao } from '../../shared/subagentes';
import { Agente } from './agente';
import { assinaturaCompletar, type AcoesExternas } from './assinaturas';
import type { EnviosCode } from './enviosCode';
import type { Memorias } from './memorias';
import type { OpenRouter } from './openrouter';
import type { ServidorMcp } from './servidorMcp';
import type { ServicoWeb } from '../../shared/web';
import type { ServicoComputador } from '../../shared/computador';
import { createHash } from 'node:crypto';
import { Checkpoints } from './checkpoints';

export type ContextoAgentes = {
    dados: () => Dados;
    salvar: () => Promise<void>;
    publicar: (evento: Evento) => void;
    publicarEstado: () => void;
    memorias: Memorias;
    enviosCode: EnviosCode;
    web: ServicoWeb;
    computador?: ServicoComputador;
    openrouter: OpenRouter;
    servidorMcp: ServidorMcp;
    pastaAlteracoes: string;
    rtkDisponivel: () => boolean;
    lerImagem: (id: string) => Promise<string>;
    completarLocal: (corpo: unknown, sinal: AbortSignal) => Promise<Response>;
    contextoProjetoChat: (conversa: Conversa) => { instrucao: string; referencias: string } | null;
};

function acoesExternas(agente: Agente): AcoesExternas {
    return {
        iniciar: (chamadaId, nome, argumentos) => agente.iniciarAcaoExterna(chamadaId, nome, argumentos),
        aprovar: (chamadaId, nome, argumentos, sinal) => agente.aprovarAcaoExterna(chamadaId, nome, argumentos, sinal),
        concluir: (chamadaId, resultado, erro) => agente.concluirAcaoExterna(chamadaId, resultado, erro),
        capturarAntes: (caminho) => agente.capturarAntes(caminho),
        capturarDepois: (caminho) => agente.capturarDepois(caminho),
        capturaParcial: () => agente.capturaParcial(),
    };
}

/**
 * Cria um agente ligado aos serviços do aplicativo. Há um agente principal, acionado pela interface, e um por
 * subagente em execução; cada um responde pela própria conversa. Conversas Code de inscrição recebem o servidor
 * MCP da Selene com uma credencial que vale só enquanto o harness responde.
 */
export function criarAgente(contexto: ContextoAgentes, principal: boolean): Agente {
    const conversaAtual = () => {
        const id = agente.conversaId;
        return id ? contexto.dados().conversas.find((conversa) => conversa.id === id) : undefined;
    };
    const completar = (corpo: unknown, sinal: AbortSignal): Promise<Response> => {
        const conversa = conversaAtual();
        const modelo = contexto.dados().modelos.find((item) => item.id === conversa?.modeloId);
        if (conversa && modelo?.assinatura) {
            const mensagens = (corpo as { messages?: { role: string; content: unknown }[] }).messages ?? [];
            const auxiliar = mensagens.some((mensagem) => mensagem.role === 'system' && !!mensagem.content);
            const pasta = conversa.pastaRepositorio ?? conversa.projeto ?? conversa.pastaTrabalho;
            const chave = createHash('sha256').update(JSON.stringify([
                modelo.assinatura, conversa.modo, pasta, conversa.acessoCompleto,
            ])).digest('hex');
            const resposta = conversa.mensagens.at(-1);
            const anterior = conversa.mensagens.slice(0, -1).reverse().find((item) => item.papel === 'assistant');
            const sessao = !auxiliar && conversa.sessaoAssinatura?.chave === chave
                && conversa.sessaoAssinatura.ateMensagemId === anterior?.id && anterior?.estado === 'concluida'
                ? conversa.sessaoAssinatura.id : undefined;
            const corpoEnvio = sessao ? { ...corpo as object, messages: mensagens.slice(-1) } : corpo;
            const credencial =
                conversa.modo === 'code' && !auxiliar
                    ? contexto.servidorMcp.emitir({
                          conversaId: conversa.id,
                          provedor: modelo.assinatura.provedor,
                          modelo: modelo.assinatura.id,
                          acessoCompleto: conversa.acessoCompleto,
                          profundidade: conversa.subagente?.profundidade ?? 0,
                      })
                    : undefined;
            return assinaturaCompletar(modelo.assinatura, corpoEnvio, sinal, {
                modo: auxiliar ? 'chat' : conversa.modo,
                acessoCompleto: !auxiliar && conversa.acessoCompleto,
                pasta,
                sessao,
                ...(auxiliar ? {} : {
                    aoSessao: async (id: string) => {
                        conversa.sessaoAssinatura = { id, chave };
                        await contexto.salvar();
                    },
                    aoSucesso: async () => {
                        if (conversa.sessaoAssinatura && resposta) {
                            conversa.sessaoAssinatura.ateMensagemId = resposta.id;
                            await contexto.salvar();
                        }
                    },
                }),
                acoes: auxiliar || conversa.modo === 'chat' ? undefined : acoesExternas(agente),
                ...(credencial
                    ? {
                          mcp: { url: credencial.url, token: credencial.token, instrucoes: instrucaoOrquestracao },
                          aoConcluir: credencial.revogar,
                      }
                    : {}),
            }).catch((erro: unknown) => {
                credencial?.revogar();
                throw erro;
            });
        }
        if (!modelo?.openrouter) return contexto.completarLocal(corpo, sinal);
        const mensagem = [...conversa!.mensagens].reverse().find((item) => item.papel === 'assistant')!;
        return contexto.openrouter.completar(modelo.openrouter.id, corpo, sinal, async (custo) => {
            mensagem.custoUsd = (mensagem.custoUsd ?? 0) + custo;
            mensagem.provedor = 'openrouter';
            mensagem.modeloUsoId = modelo.id;
            await contexto.salvar();
        });
    };
    const publicarMensagem = (mensagem: Mensagem) => {
        const conversaId =
            agente.conversaId ??
            contexto.dados().conversas.find((conversa) => conversa.mensagens.some((item) => item.id === mensagem.id))
                ?.id;
        if (conversaId) contexto.publicar({ tipo: 'mensagem', conversaId, mensagem });
        if (principal && !agente.conversaId) contexto.publicarEstado();
    };
    const agente: Agente = new Agente({
        checkpoints: new Checkpoints(contexto.pastaAlteracoes + '/checkpoints'),
        pastaAlteracoes: contexto.pastaAlteracoes,
        memorias: contexto.memorias,
        conversas: () => contexto.dados().conversas,
        receberDirecoes: (conversa) =>
            conversa.modo === 'code' ? contexto.enviosCode.receberDirecoes(conversa) : Promise.resolve([]),
        web: contexto.web,
        rtkDisponivel: contexto.rtkDisponivel,
        computador: contexto.computador,
        contextoProjetoChat: contexto.contextoProjetoChat,
        completar,
        lerImagem: contexto.lerImagem,
        salvar: contexto.salvar,
        publicar: publicarMensagem,
    });
    return agente;
}
