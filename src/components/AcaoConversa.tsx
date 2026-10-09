import { TextoAtividade } from './TextoAtividade';
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
export function AcaoConversa({
    acao,
    emExecucao = false,
    ponte,
    executar,
}: {
    acao: Acao;
    emExecucao?: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const detalhe = acao.argumentos.comando ?? acao.argumentos.caminho;
    return (
        <div
            data-ui={`acao ${acao.estado === 'aguardando' ? 'acao-pendente' : ''}`}
            className={[
                [
                    'text-[#a1a5ad] mx-0 my-[10px] [&_summary]:flex [&_summary]:gap-[10px]',
                    '[&_summary]:items-center [&_summary]:cursor-pointer [&_summary]:text-[12px]',
                    '[&_summary]:px-0 [&_summary]:py-[4px] [&_summary_>_span:first-of-type]:overflow-hidden',
                    '[&_summary_>_span:first-of-type]:text-ellipsis',
                    '[&_summary_>_span:first-of-type]:whitespace-nowrap [&_summary::-webkit-details-marker]:hidden',
                    '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:max-h-[320px] [&_pre]:overflow-auto',
                    '[&_pre]:bg-[#0c0d10] [&_pre]:text-[11px]',
                    '[&_pre]:font-mono [&_pre]:mt-0 [&_pre]:mb-[12px]',
                    '[&_pre]:p-[14px] [&_pre]:mx-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:inline-block',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:bg-[#15171b]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:rounded-[9px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:mx-[8px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:my-[4px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-[1px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-solid',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-[#30333a]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:flex',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:gap-[10px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:items-center',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:cursor-pointer',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:text-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:px-[14px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:py-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:whitespace-pre-wrap',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:wrap-anywhere',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:max-h-[320px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:overflow-auto',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:bg-[#0c0d10]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:text-[11px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:font-mono',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mt-[0]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mb-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:p-[14px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mx-[12px]',
                    '[[data-ui~=usuario-direita]_&]:inline-block',
                    '[[data-ui~=usuario-direita]_&]:bg-[#15171b]',
                    '[[data-ui~=usuario-direita]_&]:rounded-[9px]',
                    '[[data-ui~=usuario-direita]_&]:mx-[8px]',
                    '[[data-ui~=usuario-direita]_&]:my-[4px]',
                    '[[data-ui~=usuario-direita]_&]:border-[1px]',
                    '[[data-ui~=usuario-direita]_&]:border-solid',
                    '[[data-ui~=usuario-direita]_&]:border-[#30333a]',
                    '[[data-ui~=usuario-direita]_&_summary]:flex',
                    '[[data-ui~=usuario-direita]_&_summary]:gap-[10px]',
                    '[[data-ui~=usuario-direita]_&_summary]:items-center',
                    '[[data-ui~=usuario-direita]_&_summary]:cursor-pointer',
                    '[[data-ui~=usuario-direita]_&_summary]:text-[12px]',
                    '[[data-ui~=usuario-direita]_&_summary]:px-[14px]',
                    '[[data-ui~=usuario-direita]_&_summary]:py-[12px]',
                    '[[data-ui~=usuario-direita]_&_pre]:whitespace-pre-wrap',
                    '[[data-ui~=usuario-direita]_&_pre]:wrap-anywhere',
                    '[[data-ui~=usuario-direita]_&_pre]:max-h-[320px]',
                    '[[data-ui~=usuario-direita]_&_pre]:overflow-auto',
                    '[[data-ui~=usuario-direita]_&_pre]:bg-[#0c0d10]',
                    '[[data-ui~=usuario-direita]_&_pre]:text-[11px]',
                    '[[data-ui~=usuario-direita]_&_pre]:font-mono',
                    '[[data-ui~=usuario-direita]_&_pre]:mt-[0]',
                    '[[data-ui~=usuario-direita]_&_pre]:mb-[12px]',
                    '[[data-ui~=usuario-direita]_&_pre]:p-[14px]',
                    '[[data-ui~=usuario-direita]_&_pre]:mx-[12px]',
                ].join(' '),
                acao.estado === 'aguardando' ? '[&&]:border-[#718f7d]' : '',
            ].join(' ')}
        >
            <details open={acao.estado === 'aguardando' ? true : undefined}>
                <summary>
                    {acao.estado === 'concluida' ? (
                        <CheckIcon size={15} />
                    ) : acao.estado === 'aguardando' ? (
                        <ClockIcon size={15} />
                    ) : (
                        <TerminalIcon size={15} />
                    )}
                    <TextoAtividade ativo={emExecucao && ['preparando', 'executando'].includes(acao.estado)}>
                        {(acao.estado === 'concluida' ? nomesConcluidos[acao.nome] : nomes[acao.nome]) ?? acao.nome}
                        {typeof detalhe === 'string' ? ` ${detalhe}` : ''}
                    </TextoAtividade>
                    {!['preparando', 'executando', 'concluida'].includes(acao.estado) && (
                        <span
                            data-ui="estado-acao"
                            className="text-[10px] ml-auto whitespace-nowrap [@media(width<=560px)]:hidden"
                        >
                            {estados[acao.estado]}
                        </span>
                    )}
                    <CaretRightIcon
                        data-ui="seta-detalhes"
                        className="[[data-ui~=acao]_details[open]_&]:[transform:rotate(90deg)]"
                        size={12}
                    />
                </summary>
                <pre>{acao.previa || JSON.stringify(acao.argumentos, null, 4)}</pre>
                {acao.resultado && (
                    <pre
                        data-ui="resultado-acao"
                        className={[
                            'text-[#b5c5bc]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#b5c5bc]',
                            '[[data-ui~=usuario-direita]_&]:text-[#b5c5bc]',
                        ].join(' ')}
                    >
                        {acao.resultado}
                    </pre>
                )}
            </details>
            {emExecucao && acao.estado === 'aguardando' && (
                <div
                    data-ui="aprovacao"
                    className={[
                        'flex justify-end gap-[9px] pt-0 pb-[12px] items-center px-[12px] [&_p]:text-[11px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:flex',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:justify-end',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:gap-[9px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pt-[0]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pb-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:items-center',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:px-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_p]:text-[11px]',
                        '[[data-ui~=usuario-direita]_&]:flex',
                        '[[data-ui~=usuario-direita]_&]:justify-start',
                        '[[data-ui~=usuario-direita]_&]:gap-[9px]',
                        '[[data-ui~=usuario-direita]_&]:pt-[0]',
                        '[[data-ui~=usuario-direita]_&]:pb-[12px]',
                        '[[data-ui~=usuario-direita]_&]:items-center',
                        '[[data-ui~=usuario-direita]_&]:px-[12px]',
                        '[[data-ui~=usuario-direita]_&_p]:text-[11px]',
                    ].join(' ')}
                >
                    <button
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                            '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={!ponte}
                        onClick={() => executar(() => ponte!.aprovar(acao.id, false))}
                    >
                        Recusar
                    </button>
                    <button
                        data-ui="botao botao-primario"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#d8e5dd] rounded-[8px]',
                            'whitespace-nowrap text-[#18241e] px-[14px] py-[9px] border border-solid',
                            'border-transparent [&:hover:not(:disabled)]:bg-[#c0d5c8]',
                            '[[data-ui~=lista-projetos]_>_&]:mb-[12px] [[data-ui~=lista-projetos]_>_&]:justify-start',
                            '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
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
