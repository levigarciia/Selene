import { TextoAtividade } from './TextoAtividade';
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
        <details
            data-ui="tarefas-conversa"
            className={[
                '[&_summary::-webkit-details-marker]:hidden bg-[#15171b] rounded-[12px] mb-[8px] text-[12px]',
                'border border-solid border-[#272a30] [&_>_summary]:flex [&_>_summary]:items-center',
                '[&_>_summary]:gap-[9px] [&_>_summary]:cursor-pointer [&_>_summary]:px-[14px]',
                '[&_>_summary]:py-[12px] [&_progress]:w-[65px] [&_progress]:h-[3px]',
                '[&_progress]:[appearance:none] [&_progress]:rounded-[3px] [&_progress]:overflow-hidden',
                '[&_progress]:border-0 [&_progress]:border-solid [&_progress]:border-current',
                '[&_progress::-webkit-progress-bar]:bg-[#30333a]',
                '[&_progress::-webkit-progress-value]:bg-[#a48cc8] [&_ol]:list-none',
                '[&_ol]:max-h-[180px] [&_ol]:overflow-auto [&_ol]:px-[14px] [&_ol]:py-0 [&_ol]:m-0',
                '[&_li]:flex [&_li]:items-center [&_li]:gap-[10px] [&_li]:text-[#a1a5ad] [&_li]:px-0',
                '[&_li]:py-[7px] [&_li_svg]:shrink-0 [&_li_>_span:first-of-type]:flex-1',
                '[&_li_>_span:first-of-type]:wrap-anywhere [@media(width<=560px)]:[&_progress]:hidden',
                '[@media(width<=560px)]:[&_>_summary]:gap-[6px]',
            ].join(' ')}
            key={`${mensagem.id}-${mensagem.estado}`}
        >
            <summary>
                <ListChecksIcon size={18} />
                <span
                    data-ui="texto-secundario"
                    className={[
                        'text-[#a1a5ad] text-[12px] leading-[1.7]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                    ].join(' ')}
                >
                    Tarefas
                </span>
                <span data-ui="tarefa-atual" className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {atual?.descricao}
                </span>
                <span
                    data-ui="texto-secundario"
                    className={[
                        'text-[#a1a5ad] text-[12px] leading-[1.7]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                    ].join(' ')}
                >
                    {concluidas}/{etapas.length}
                </span>
                <progress
                    className="accent-[#b5a2dc]"
                    value={concluidas}
                    max={etapas.length}
                    aria-label="Progresso das tarefas"
                />
                <CaretDownIcon
                    data-ui="seta-detalhes"
                    className="[[data-ui~=acao]_details[open]_&]:[transform:rotate(90deg)]"
                    size={14}
                />
            </summary>
            <ol>
                {etapas.map((etapa, indice) => (
                    <li key={indice}>
                        {etapa.estado === 'concluida' ? <CheckCircleIcon size={17} /> : <CircleIcon size={17} />}
                        <TextoAtividade ativo={etapa.estado === 'em andamento'}>{etapa.descricao}</TextoAtividade>
                        <span data-ui="estado-etapa" className="text-[10px]">
                            {etapa.estado === 'concluida'
                                ? 'Concluída'
                                : etapa.estado === 'pendente'
                                  ? 'Pendente'
                                  : etapa.estado}
                        </span>
                    </li>
                ))}
            </ol>
            <button
                type="button"
                data-ui="abrir-historico"
                className="text-[#a1a5ad] cursor-pointer px-[14px] py-[12px] [&:hover]:text-[#e4e7eb]"
                onClick={abrirHistorico}
            >
                Ver histórico completo
            </button>
        </details>
    );
}
