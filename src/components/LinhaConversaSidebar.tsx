import {
    ChatCircleIcon,
    CircleNotchIcon,
    TerminalIcon,
    ClockIcon,
    WarningCircleIcon,
    StopCircleIcon,
    CheckCircleIcon,
    PlusIcon,
    PencilSimpleIcon,
    CheckIcon,
    ArrowCounterClockwiseIcon,
} from '@phosphor-icons/react';
import type { Conversa, Estado } from '../../shared/contratos';
import { IconeProjeto } from './IconeProjeto';
import { obterAtividadeConversa, tempoConversa } from '../../shared/historico';
import type { PosicaoMenuConversa } from './MenuConversa';

/** Use para mostrar a atividade da conversa e permitir encerramento sem abrir o menu. */
export function LinhaConversaSidebar({
    conversa,
    estado,
    selecionada,
    recolhida,
    agora,
    selecionar,
    concluir,
    abrirMenu,
}: {
    conversa: Conversa;
    estado: Estado;
    selecionada: boolean;
    recolhida: boolean;
    agora: number;
    selecionar: (id: string) => void;
    concluir: (conversa: Conversa) => void;
    abrirMenu: (posicao: PosicaoMenuConversa) => void;
}) {
    const atividade = obterAtividadeConversa(conversa, estado.conversaEmExecucao);
    const mensagem = [...conversa.mensagens].reverse().find((item) => item.papel === 'assistant');
    const modelo = estado.modelos.find((item) => item.id === conversa.modeloId);
    const projeto = estado.projetos.find((item) => item.id === conversa.projetoId || item.caminho === conversa.projeto);
    const encerrada = conversa.concluida && !atividade.ocupada;
    const pronta = conversa.modo === 'code' && !encerrada && atividade.fase === 'concluida';
    const destacar = atividade.ocupada || pronta || ['erro', 'interrompida', 'rascunho'].includes(atividade.fase);
    const comando =
        atividade.ocupada &&
        mensagem?.acoes.find((item) => item.nome === 'executar_terminal' && item.estado === 'executando');
    const Icone =
        atividade.fase === 'comando'
            ? TerminalIcon
            : atividade.fase === 'aprovacao'
              ? ClockIcon
              : atividade.fase === 'erro'
                ? WarningCircleIcon
                : atividade.fase === 'interrompida'
                  ? StopCircleIcon
                  : atividade.ocupada
                    ? CircleNotchIcon
                    : atividade.fase === 'rascunho'
                      ? PencilSimpleIcon
                      : atividade.fase === 'nova'
                        ? PlusIcon
                        : CheckCircleIcon;
    const permiteAcao = conversa.modo === 'code' && !!conversa.mensagens.length && !atividade.ocupada && !recolhida;
    return (
        <div
            data-ui={`linha-sidebar ${permiteAcao ? 'linha-sidebar-acoes' : ''}`}
            className={['relative', permiteAcao ? '' : ''].join(' ')}
        >
            <button
                data-ui={[
                    'item-conversa',
                    selecionada ? 'selecionado' : '',
                    encerrada ? 'item-conversa-encerrada' : '',
                ].join(' ')}
                className={[
                    [
                        '[[data-ui~=sidebar-recolhida]_&]:justify-center',
                        '[[data-ui~=sidebar-recolhida]_&]:items-center [[data-ui~=sidebar-recolhida]_&]:px-[8px]',
                        '[[data-ui~=sidebar-recolhida]_&]:py-[11px] [&&]:flex',
                        '[&&]:items-stretch [&&]:gap-[7px]',
                        '[&&]:w-full [&&]:bg-transparent',
                        '[&&]:rounded-[7px] [&&]:text-[#b1b5bc]',
                        '[&&]:text-[12px] [&&]:text-left',
                        '[&&]:flex-col [&&]:mb-[3px]',
                        '[&&]:px-[10px] [&&]:py-[11px]',
                        '[&&]:border-0 [&&]:border-solid',
                        '[&&]:border-current [&:hover]:bg-[#1a1c21]',
                        '[&:hover]:text-[#e6e7e9] [&_svg]:shrink-0',
                    ].join(' '),
                    selecionada ? '[&&]:bg-[#1a1c21] [&&]:text-[#e6e7e9]' : '',
                    encerrada
                        ? [
                              '[&&]:flex-row [&&]:items-center',
                              '[&&]:text-[#7e8490] [&&]:pt-[9px]',
                              '[&&]:pb-[9px] [&_.truncate]:flex-1 [&_small]:text-[10px]',
                              '[&_small]:whitespace-nowrap',
                          ].join(' ')
                        : '',
                ].join(' ')}
                onClick={() => selecionar(conversa.id)}
                aria-current={selecionada ? 'page' : undefined}
                aria-label={conversa.titulo}
                title={`${conversa.titulo}. ${atividade.nome}${conversa.projeto ? `. ${conversa.projeto}` : ''}`}
                onContextMenu={(evento) => {
                    evento.preventDefault();
                    abrirMenu({ conversa, x: evento.clientX, y: evento.clientY, origem: evento.currentTarget });
                }}
                onKeyDown={(evento) => {
                    if (evento.key !== 'ContextMenu' && !(evento.shiftKey && evento.key === 'F10')) return;
                    evento.preventDefault();
                    const posicao = evento.currentTarget.getBoundingClientRect();
                    abrirMenu({ conversa, x: posicao.right, y: posicao.top, origem: evento.currentTarget });
                }}
            >
                {encerrada && !recolhida ? (
                    <>
                        <IconeProjeto projeto={projeto} tamanho={14} />
                        <span className="truncate">{conversa.titulo}</span>
                        <small
                            data-ui="tempo-encerrada"
                            className={[
                                '[[data-ui~=linha-sidebar-acoes]:hover_&]:opacity-[0]',
                                '[[data-ui~=linha-sidebar-acoes]:focus-within_&]:opacity-[0]',
                            ].join(' ')}
                        >
                            {tempoConversa(conversa.encerradaEm ?? conversa.atualizadoEm, agora)}
                        </small>
                    </>
                ) : recolhida ? (
                    <Icone
                        size={18}
                        data-ui={[
                            'estado-conversa',
                            atividade.ocupada ? 'ativo' : '',
                            Icone === CircleNotchIcon ? 'girando' : '',
                        ].join(' ')}
                        className={[
                            [
                                '[[data-ui~=linha-sidebar-acoes]:hover_&]:opacity-[0]',
                                '[[data-ui~=linha-sidebar-acoes]:focus-within_&]:opacity-[0]',
                                '[&&]:inline-flex [&&]:items-center',
                                '[&&]:gap-[4px] [&&]:whitespace-nowrap',
                            ].join(' '),
                            atividade.ocupada ? '[&&]:text-[#78adf5]' : '',
                            Icone === CircleNotchIcon
                                ? ['[&&]:animate-[spin_1.2s_linear_infinite]', 'motion-reduce:[&&]:animate-none'].join(
                                      ' ',
                                  )
                                : '',
                        ].join(' ')}
                    />
                ) : (
                    <>
                        <span
                            data-ui="linha-projeto-conversa"
                            className={[
                                [
                                    'flex items-center gap-[6px] w-full min-w-0 text-[#818792] text-[10px]',
                                    '[&_>_.truncate]:flex-1',
                                ].join(' '),
                                '[&_>_svg]:text-[#94b7a5]',
                            ].join(' ')}
                        >
                            {conversa.modo === 'code' ? (
                                <IconeProjeto projeto={projeto} tamanho={14} />
                            ) : (
                                <ChatCircleIcon size={14} />
                            )}
                            <span className="truncate">
                                {estado.projetos.find(
                                    (item) => item.id === conversa.projetoId || item.caminho === conversa.projeto,
                                )?.nome ??
                                    conversa.projeto?.split(/[\\/]/).at(-1) ??
                                    'Sem projeto'}
                            </span>
                            <span
                                data-ui={`estado-conversa estado-${atividade.fase}`}
                                className={[
                                    [
                                        '[[data-ui~=linha-sidebar-acoes]:hover_&]:opacity-[0]',
                                        [
                                            '[[data-ui~=linha-sidebar-acoes]:focus-within_&]:opacity-[0]',
                                            'inline-flex items-center',
                                        ].join(' '),
                                        'gap-[4px] whitespace-nowrap',
                                    ].join(' '),
                                    atividade.fase === 'trabalhando'
                                        ? '[&&]:text-[#78adf5]'
                                        : atividade.fase === 'compactando'
                                          ? '[&&]:text-[#78adf5]'
                                          : atividade.fase === 'ferramenta'
                                            ? '[&&]:text-[#78adf5]'
                                            : atividade.fase === 'comando'
                                              ? '[&&]:text-[#8dc8b1]'
                                              : atividade.fase === 'concluida'
                                                ? '[&&]:text-[#2dcea0]'
                                                : atividade.fase === 'aprovacao'
                                                  ? '[&&]:text-[#deb76c]'
                                                  : atividade.fase === 'erro'
                                                    ? '[&&]:text-[#e3a09a]'
                                                    : atividade.fase === 'interrompida'
                                                      ? '[&&]:text-[#baaaa0]'
                                                      : atividade.fase === 'rascunho'
                                                        ? '[&&]:text-[#94b7a5]'
                                                        : '',
                                ].join(' ')}
                            >
                                {destacar && (
                                    <Icone
                                        size={13}
                                        data-ui={Icone === CircleNotchIcon ? 'girando' : ''}
                                        className={
                                            Icone === CircleNotchIcon
                                                ? [
                                                      '[&&]:animate-[spin_1.2s_linear_infinite]',
                                                      'motion-reduce:[&&]:animate-none',
                                                  ].join(' ')
                                                : ''
                                        }
                                    />
                                )}
                                {destacar ? <span>{atividade.nome}</span> : tempoConversa(conversa.atualizadoEm, agora)}
                                {atividade.ocupada && (
                                    <small>{tempoConversa(mensagem?.criadoEm ?? conversa.atualizadoEm, agora)}</small>
                                )}
                            </span>
                        </span>
                        <span
                            data-ui="titulo-item-conversa truncate"
                            className={[
                                [
                                    'truncate',
                                    '[[data-ui~=item-conversa][data-ui~=selecionado]_&]:font-semibold',
                                    'block w-full',
                                ].join(' '),
                                'leading-[1.5]',
                            ].join(' ')}
                        >
                            {conversa.titulo}
                        </span>
                        {(modelo || comando) && (
                            <span
                                data-ui="detalhes-item-conversa"
                                className={[
                                    [
                                        'flex items-center gap-[6px] w-full min-w-0 text-[#818792]',
                                        'text-[10px] justify-between',
                                    ].join(' '),
                                    '[&_>_.truncate]:max-w-[48%]',
                                ].join(' ')}
                            >
                                {modelo && (
                                    <span className="truncate" title={modelo.nome}>
                                        {modelo.nome}
                                    </span>
                                )}
                                {comando && (
                                    <span
                                        data-ui="indicador-terminal"
                                        className="inline-flex ml-auto text-[#66c6ae]"
                                        role="img"
                                        aria-label="Comando em execução"
                                        title={
                                            typeof comando.argumentos.comando === 'string'
                                                ? comando.argumentos.comando
                                                : 'Comando em execução'
                                        }
                                    >
                                        <TerminalIcon size={15} />
                                    </span>
                                )}
                            </span>
                        )}
                    </>
                )}
            </button>
            {conversa.modo === 'code' && !!conversa.mensagens.length && !recolhida && (
                <button
                    data-ui="botao-icone acao-hover-conversa"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-[#a0b5ac] rounded-[6px] absolute',
                        'right-[4px] top-[5px] opacity-[0] pointer-events-none p-[8px] border-0 border-solid',
                        'border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                        '[[data-ui~=linha-sidebar-acoes]:hover_&]:opacity-[1]',
                        '[[data-ui~=linha-sidebar-acoes]:hover_&]:pointer-events-auto',
                        '[[data-ui~=linha-sidebar-acoes]:focus-within_&]:opacity-[1]',
                        '[[data-ui~=linha-sidebar-acoes]:focus-within_&]:pointer-events-auto',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#94b7a5]",
                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                    ].join(' ')}
                    disabled={atividade.ocupada}
                    onClick={() => concluir(conversa)}
                    aria-label={`${encerrada ? 'Retomar' : 'Concluir'} conversa: ${conversa.titulo}`}
                    title={encerrada ? 'Retomar conversa' : 'Concluir conversa'}
                >
                    {encerrada ? <ArrowCounterClockwiseIcon size={15} /> : <CheckIcon size={15} />}
                </button>
            )}
        </div>
    );
}
