import { CaretDownIcon, CheckCircleIcon, CircleIcon, ListChecksIcon } from '@phosphor-icons/react';
import type { Mensagem } from '../../shared/contratos';
import { obterPlano } from '../../shared/atividade';

/** Use para acompanhar os objetivos declarados pela IA durante a resposta atual. */
export function TarefasConversa({ mensagem, abrirHistorico }: { mensagem?: Mensagem; abrirHistorico: () => void }) {
    const etapas = obterPlano(mensagem);
    if (!mensagem || mensagem.estado !== 'gerando' || !etapas.length) return null;
    const concluidas = etapas.filter((etapa) => etapa.estado === 'concluida').length;
    const atual =
        etapas.find((etapa) => etapa.estado === 'em andamento') ??
        etapas.find((etapa) => etapa.estado === 'pendente') ??
        etapas.at(-1);
    return (
        <details className="tarefas-conversa" key={`${mensagem.id}-${mensagem.estado}`}>
            <summary>
                <ListChecksIcon size={18} />
                <span className="texto-secundario">Tarefas</span>
                <span className="tarefa-atual">{atual?.descricao}</span>
                <span className="texto-secundario">
                    {concluidas}/{etapas.length}
                </span>
                <progress value={concluidas} max={etapas.length} aria-label="Progresso das tarefas" />
                <CaretDownIcon className="seta-detalhes" size={14} />
            </summary>
            <ol>
                {etapas.map((etapa, indice) => (
                    <li key={indice}>
                        {etapa.estado === 'concluida' ? <CheckCircleIcon size={17} /> : <CircleIcon size={17} />}
                        <span className={etapa.estado === 'em andamento' ? 'texto-em-andamento' : ''}>
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
