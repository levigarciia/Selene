import { z } from 'zod';
import { esquemaModeloAssinatura, esquemaProvedorAssinatura } from './assinaturas';

/** Profundidade máxima de delegação: um subagente pode delegar, mas a cadeia não cresce sem limite. */
export const profundidadeMaximaSubagentes = 3;
/** Tamanho do resultado devolvido ao agente pai, como o `summaryLimit` do PandaCode. */
export const limiteResumoSubagente = 6000;
export const tempoEsperaPadraoMs = 10 * 60 * 1000;

export const papeisSubagente = ['implementacao', 'pesquisa', 'revisao', 'design', 'teste', 'geral'] as const;

/** Vínculo persistido de uma conversa filha com a conversa que a delegou. */
export const esquemaVinculoSubagente = z.object({
    paiId: z.string().uuid(),
    tarefaId: z.string().uuid(),
    papel: z.enum(papeisSubagente),
    profundidade: z.number().int().min(1).max(profundidadeMaximaSubagentes),
});
export type VinculoSubagente = z.infer<typeof esquemaVinculoSubagente>;

export const formatoEntradaDelegacao = {
    tarefa: z.string().trim().min(1).max(30000),
    titulo: z.string().trim().min(1).max(120).optional(),
    alvo: z
        .object({
            provedor: esquemaProvedorAssinatura.optional(),
            modelo: esquemaModeloAssinatura.optional(),
        })
        .optional(),
    papel: z.enum(papeisSubagente).optional(),
    modo: z.enum(['async', 'wait']).optional(),
    timeoutMs: z.number().int().min(1000).max(60 * 60 * 1000).optional(),
    clientRequestId: z.string().trim().min(1).max(200).optional(),
    acesso: z.enum(['herdar', 'aprovacao']).optional(),
};
export const esquemaEntradaDelegacao = z.object(formatoEntradaDelegacao);
export type EntradaDelegacao = z.infer<typeof esquemaEntradaDelegacao>;

export type EstadoTarefa = 'executando' | 'concluida' | 'erro' | 'interrompida';

/** Estado de uma tarefa delegada devolvido às ferramentas `delegar_tarefa` e `status_tarefa`. */
export type ResultadoTarefa = {
    tarefaId: string;
    conversaFilhaId: string;
    estado: EstadoTarefa;
    provedor: string;
    modelo: string;
    resumo: string | null;
    esperaExpirou: boolean;
};

export const instrucaoOrquestracao = [
    'A Selene expõe o servidor MCP selene para delegar trabalho a subagentes de outras inscrições (Claude ou ChatGPT).',
    'Use capacidades_orquestrador para ver provedores e modelos disponíveis. Use delegar_tarefa para criar um ',
    'subagente com apenas o texto da tarefa, sem o histórico desta conversa; inclua todo o contexto necessário. ',
    'Prefira as ferramentas nativas de subagentes para trabalho no mesmo provedor e modelo; use delegar_tarefa para ',
    'outro modelo, outro provedor ou quando o usuário pedir subagentes da Selene. Prefira modo async em trabalhos ',
    'longos: a conclusão chega a esta conversa como nova mensagem, então encerre o turno em vez de consultar ',
    'status repetidamente. Para cada nova rodada de revisão, chame delegar_tarefa de novo com o pedido original, as ',
    'conclusões anteriores e as objeções pendentes, usando um clientRequestId distinto por rodada.',
].join('');
