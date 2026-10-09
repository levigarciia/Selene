import { CaretDownIcon, CheckCircleIcon, CircleIcon, ListChecksIcon } from '@phosphor-icons/react';
import type { Mensagem } from '../../shared/contratos';
import { obterPlano } from '../../shared/atividade';

/** Acompanha o plano real da tarefa e oferece acesso ao histórico completo da resposta. */
export function TarefasConversa({ mensagem, abrirHistorico }: { mensagem?: Mensagem; abrirHistorico: () => void }) {
    const etapas = obterPlano(mensagem);
    if (!mensagem?.acoes.length) return null;
    const itens = etapas.length
        ? etapas
        : mensagem.acoes.map((acao) => ({
              descricao: String(acao.argumentos.comando ?? acao.argumentos.caminho ?? acao.nome),
              estado:
                  acao.estado === 'concluida'
                      ? 'concluida'
                      : acao.estado === 'executando'
                        ? 'em andamento'
                        : acao.estado === 'aguardando'
                          ? 'Aguardando aprovação'
                          : acao.estado,
          }));
    const concluidas = itens.filter((item) => item.estado === 'concluida').length;
    const atual =
        itens.find((item) => item.estado === 'em andamento') ?? itens.find((item) => item.estado !== 'concluida');
    return (
        <details className="tarefas-conversa" key={`${mensagem.id}-${mensagem.estado}`}>
            <summary>
                <ListChecksIcon size={18} />
                <span className="texto-secundario">Tarefas</span>
                <span className="tarefa-atual">
                    {mensagem.estado === 'erro'
                        ? 'Tarefa com erro'
                        : mensagem.estado === 'interrompida'
                          ? 'Tarefa interrompida'
                          : (atual?.descricao ??
                            (mensagem.estado === 'gerando' ? 'Finalizando' : 'Trabalho concluído'))}
                </span>
                <span className="texto-secundario">
                    {concluidas}/{itens.length}
                </span>
                <progress value={concluidas} max={itens.length} aria-label="Progresso das tarefas" />
                <CaretDownIcon className="seta-detalhes" size={14} />
            </summary>
            <ol>
                {itens.map((etapa, indice) => (
                    <li key={indice}>
                        {etapa.estado === 'concluida' ? <CheckCircleIcon size={17} /> : <CircleIcon size={17} />}
                        <span
                            className={
                                mensagem.estado === 'gerando' && etapa.estado === 'em andamento'
                                    ? 'texto-em-andamento'
                                    : ''
                            }
                        >
                            {etapa.descricao}
                        </span>
                        <span className="estado-etapa">
                            {etapa.estado === 'concluida'
                                ? 'Concluída'
                                : etapa.estado === 'pendente'
                                  ? 'Pendente'
                                  : etapa.estado}
                        </span>
                    </li>
                ))}
            </ol>
            <button type="button" className="abrir-historico" onClick={abrirHistorico}>
                Ver histórico completo
            </button>
        </details>
    );
}
