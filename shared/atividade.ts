import { z } from 'zod';
import type { Acao, Mensagem } from './contratos';

export const esquemaPlano = z.object({
    etapas: z
        .array(
            z.object({
                descricao: z.string().min(1).max(30000),
                estado: z.enum(['pendente', 'em andamento', 'concluida']),
            }),
        )
        .min(1)
        .max(20),
});

type BlocoAtividade = { tipo: 'texto'; texto: string } | { tipo: 'acao'; acao: Acao };

/** Use para apresentar o histórico na ordem registrada, sem inferir cortes em mensagens antigas. */
export function montarAtividade(mensagem: Mensagem, limite = mensagem.texto.length): BlocoAtividade[] {
    const blocos: BlocoAtividade[] = [];
    let posicao = 0;
    for (const acao of mensagem.acoes) {
        const fim = Math.max(posicao, Math.min(acao.posicaoTexto ?? limite, limite));
        if (fim > posicao) blocos.push({ tipo: 'texto', texto: mensagem.texto.slice(posicao, fim) });
        blocos.push({ tipo: 'acao', acao });
        posicao = fim;
    }
    if (posicao < limite) blocos.push({ tipo: 'texto', texto: mensagem.texto.slice(posicao, limite) });
    return blocos;
}

/** Obtém somente o último plano validado e executado para acompanhar uma tarefa. */
export function obterPlano(mensagem?: Mensagem) {
    const acao = mensagem?.acoes
        .slice()
        .reverse()
        .find((item) => item.nome === 'atualizar_plano' && item.estado === 'concluida');
    const resultado = esquemaPlano.safeParse(acao?.argumentos);
    return resultado.success ? resultado.data.etapas : [];
}
