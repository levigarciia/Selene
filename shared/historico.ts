import type { Conversa } from './contratos';

export type AtividadeConversa = {
    fase:
        | 'trabalhando'
        | 'comando'
        | 'ferramenta'
        | 'aprovacao'
        | 'compactando'
        | 'concluida'
        | 'erro'
        | 'interrompida'
        | 'nova';
    nome: string;
    ocupada: boolean;
};

/** Use com o identificador da tarefa atual para evitar apresentar atividade antiga como execução real. */
export function obterAtividadeConversa(conversa: Conversa, execucao: string | null): AtividadeConversa {
    const mensagem = [...conversa.mensagens].reverse().find((item) => item.papel === 'assistant');
    if (execucao === conversa.id) {
        if (mensagem?.faseContexto) return { fase: 'compactando', nome: 'Compactando', ocupada: true };
        const pendente = mensagem?.acoes.find((acao) => acao.estado === 'aguardando');
        if (pendente) return { fase: 'aprovacao', nome: 'Aprovação', ocupada: true };
        const acao = mensagem?.acoes.find((item) => item.estado === 'executando');
        if (acao?.nome === 'executar_terminal') return { fase: 'comando', nome: 'Comando', ocupada: true };
        if (acao) return { fase: 'ferramenta', nome: 'Ferramenta', ocupada: true };
        return { fase: 'trabalhando', nome: 'Trabalhando', ocupada: true };
    }
    if (!mensagem) return { fase: 'nova', nome: 'Nova', ocupada: false };
    if (mensagem.estado === 'erro') return { fase: 'erro', nome: 'Erro', ocupada: false };
    if (mensagem.estado === 'interrompida' || mensagem.estado === 'gerando') {
        return { fase: 'interrompida', nome: 'Interrompida', ocupada: false };
    }
    return { fase: 'concluida', nome: 'Pronto', ocupada: false };
}

export type GrupoHistorico = {
    chave: 'atuais' | 'trabalhando' | 'concluidas';
    nome: string;
    itens: Conversa[];
};

/** Use para separar modos e organizar Code em atuais, trabalhando e encerradas, sem agrupar por projeto. */
export function agruparHistorico(
    conversas: Conversa[],
    modo: 'chat' | 'code',
    execucao: string | null,
): GrupoHistorico[] {
    const grupos: GrupoHistorico[] = [
        { chave: 'atuais', nome: '', itens: [] },
        { chave: 'trabalhando', nome: 'Trabalhando', itens: [] },
        { chave: 'concluidas', nome: 'Concluídas', itens: [] },
    ];
    const ordenadas = conversas
        .filter((conversa) => conversa.modo === modo)
        .sort((a, b) => {
            const data = (conversa: Conversa) => {
                const mensagem = [...conversa.mensagens].reverse().find((item) => item.papel === 'assistant');
                return (
                    conversa.encerradaEm ??
                    (mensagem?.concluidoEm && mensagem.concluidoEm > conversa.atualizadoEm
                        ? mensagem.concluidoEm
                        : conversa.atualizadoEm)
                );
            };
            const aprovacao = (conversa: Conversa) => obterAtividadeConversa(conversa, execucao).fase === 'aprovacao';
            return Number(aprovacao(b)) - Number(aprovacao(a)) || data(b).localeCompare(data(a));
        });
    for (const conversa of ordenadas) {
        const atividade = obterAtividadeConversa(conversa, execucao);
        const indice =
            modo === 'chat'
                ? 0
                : atividade.ocupada
                  ? atividade.fase === 'aprovacao'
                      ? 0
                      : 1
                  : conversa.concluida
                    ? 2
                    : 0;
        grupos[indice].itens.push(conversa);
    }
    return grupos.filter((grupo) => grupo.itens.length > 0);
}

/** Formata o tempo decorrido para a lista compacta de conversas. */
export function tempoConversa(data: string, agora: number): string {
    const minutos = Math.max(0, Math.floor((agora - Date.parse(data)) / 60000));
    if (!Number.isFinite(minutos) || minutos < 1) return 'agora';
    if (minutos < 60) return `${minutos}m`;
    if (minutos < 1440) return `${Math.floor(minutos / 60)}h`;
    return `${Math.floor(minutos / 1440)}d`;
}
