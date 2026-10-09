import {
    ChatCircleIcon,
    CodeIcon,
    CircleNotchIcon,
    TerminalIcon,
    ClockIcon,
    WarningCircleIcon,
    StopCircleIcon,
    CheckCircleIcon,
    PlusIcon,
    CheckIcon,
    ArrowCounterClockwiseIcon,
} from '@phosphor-icons/react';
import type { Conversa, Estado } from '../../shared/contratos';
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
    const encerrada = conversa.concluida && !atividade.ocupada;
    const pronta = conversa.modo === 'code' && !encerrada && atividade.fase === 'concluida';
    const destacar = atividade.ocupada || pronta || atividade.fase === 'erro' || atividade.fase === 'interrompida';
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
                    : atividade.fase === 'nova'
                      ? PlusIcon
                      : CheckCircleIcon;
    const permiteAcao = conversa.modo === 'code' && !atividade.ocupada && !recolhida;
    return (
        <div className={`linha-sidebar ${permiteAcao ? 'linha-sidebar-acoes' : ''}`}>
            <button
                className={[
                    'item-conversa',
                    selecionada ? 'selecionado' : '',
                    encerrada ? 'item-conversa-encerrada' : '',
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
                        <CodeIcon size={14} />
                        <span className="truncate">{conversa.titulo}</span>
                        <small className="tempo-encerrada">
                            {tempoConversa(conversa.encerradaEm ?? conversa.atualizadoEm, agora)}
                        </small>
                    </>
                ) : recolhida ? (
                    <Icone
                        size={18}
                        className={[
                            'estado-conversa',
                            atividade.ocupada ? 'ativo' : '',
                            Icone === CircleNotchIcon ? 'girando' : '',
                        ].join(' ')}
                    />
                ) : (
                    <>
                        <span className="linha-projeto-conversa">
                            {conversa.modo === 'code' ? <CodeIcon size={14} /> : <ChatCircleIcon size={14} />}
                            <span className="truncate">{conversa.projeto?.split(/[\\/]/).at(-1) || 'Sem projeto'}</span>
                            <span className={`estado-conversa estado-${atividade.fase}`}>
                                {destacar && <Icone size={13} className={Icone === CircleNotchIcon ? 'girando' : ''} />}
                                {destacar ? <span>{atividade.nome}</span> : tempoConversa(conversa.atualizadoEm, agora)}
                                {atividade.ocupada && (
                                    <small>{tempoConversa(mensagem?.criadoEm ?? conversa.atualizadoEm, agora)}</small>
                                )}
                            </span>
                        </span>
                        <span className="titulo-item-conversa truncate">{conversa.titulo}</span>
                        {(modelo || comando) && (
                            <span className="detalhes-item-conversa">
                                {modelo && (
                                    <span className="truncate" title={modelo.nome}>
                                        {modelo.nome}
                                    </span>
                                )}
                                {comando && (
                                    <span
                                        className="indicador-terminal"
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
            {conversa.modo === 'code' && !recolhida && (
                <button
                    className="botao-icone acao-hover-conversa"
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
