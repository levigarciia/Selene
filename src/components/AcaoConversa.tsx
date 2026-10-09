import { CaretRightIcon, CheckIcon, ClockIcon, TerminalIcon } from '@phosphor-icons/react';
import type { Acao, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

const nomes: Record<string, string> = {
    listar_arquivos: 'Explorando',
    ler_arquivo: 'Lendo',
    escrever_arquivo: 'Escrevendo',
    editar_arquivo: 'Editando',
    executar_terminal: 'Executando',
    atualizar_plano: 'Atualizando tarefas',
};
const nomesConcluidos: Record<string, string> = {
    listar_arquivos: 'Explorou',
    ler_arquivo: 'Leu',
    escrever_arquivo: 'Escreveu',
    editar_arquivo: 'Editou',
    executar_terminal: 'Executou',
    atualizar_plano: 'Atualizou tarefas',
};
const estados: Record<Acao['estado'], string> = {
    preparando: 'Preparando ação',
    aguardando: 'Aguardando aprovação',
    executando: 'Em andamento',
    concluida: 'Concluída',
    recusada: 'Recusada',
    erro: 'Erro',
    interrompida: 'Interrompida',
};

/** Exibe uma ação no fluxo da conversa, com detalhes e decisão quando exigida. */
export function AcaoConversa({ acao, ponte, executar }: { acao: Acao; ponte?: PonteSelene; executar: Executar }) {
    const detalhe = acao.argumentos.comando ?? acao.argumentos.caminho;
    return (
        <div className={`acao ${acao.estado === 'aguardando' ? 'acao-pendente' : ''}`}>
            <details open={acao.estado === 'aguardando' ? true : undefined}>
                <summary>
                    {acao.estado === 'concluida' ? (
                        <CheckIcon size={15} />
                    ) : acao.estado === 'aguardando' ? (
                        <ClockIcon size={15} />
                    ) : (
                        <TerminalIcon size={15} />
                    )}
                    <span className={['preparando', 'executando'].includes(acao.estado) ? 'texto-em-andamento' : ''}>
                        {(acao.estado === 'concluida' ? nomesConcluidos[acao.nome] : nomes[acao.nome]) ?? acao.nome}
                        {typeof detalhe === 'string' ? ` ${detalhe}` : ''}
                    </span>
                    {!['preparando', 'executando', 'concluida'].includes(acao.estado) && (
                        <span className="estado-acao">{estados[acao.estado]}</span>
                    )}
                    <CaretRightIcon className="seta-detalhes" size={12} />
                </summary>
                <pre>{acao.previa || JSON.stringify(acao.argumentos, null, 4)}</pre>
                {acao.resultado && <pre className="resultado-acao">{acao.resultado}</pre>}
            </details>
            {acao.estado === 'aguardando' && (
                <div className="aprovacao">
                    <button
                        className="botao"
                        disabled={!ponte}
                        onClick={() => executar(() => ponte!.aprovar(acao.id, false))}
                    >
                        Recusar
                    </button>
                    <button
                        className="botao botao-primario"
                        disabled={!ponte}
                        onClick={() => executar(() => ponte!.aprovar(acao.id, true))}
                    >
                        Aprovar
                    </button>
                </div>
            )}
        </div>
    );
}
