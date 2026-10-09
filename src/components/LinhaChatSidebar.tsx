import { ChatCircleIcon, CircleNotchIcon, DotsThreeIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { Conversa, Estado } from '../../shared/contratos';
import { obterAtividadeConversa } from '../../shared/historico';
import type { PosicaoMenuConversa } from './MenuConversa';

/** Use para navegar pelos chats com uma linha compacta e ações no menu de contexto. */
export function LinhaChatSidebar({
    conversa,
    estado,
    selecionada,
    recolhida,
    selecionar,
    abrirMenu,
}: {
    conversa: Conversa;
    estado: Estado;
    selecionada: boolean;
    recolhida: boolean;
    selecionar: (id: string) => void;
    abrirMenu: (posicao: PosicaoMenuConversa) => void;
}) {
    const atividade = obterAtividadeConversa(conversa, estado.conversaEmExecucao);
    const Icone = atividade.ocupada ? CircleNotchIcon : atividade.fase === 'erro' ? WarningCircleIcon : ChatCircleIcon;
    const mostrarIcone = recolhida || atividade.ocupada || atividade.fase === 'erro';

    return (
        <div data-ui="linha-sidebar linha-chat-sidebar" className="group relative">
            <button
                data-ui={`item-conversa ${selecionada ? 'selecionado' : ''}`}
                className={[
                    'flex h-[34px] w-full min-w-0 items-center gap-2 rounded-[7px] border-0',
                    'text-left text-[13px] font-normal text-principal hover:bg-selecionado',
                    recolhida ? 'justify-center px-2' : 'pl-3 pr-9',
                    selecionada ? 'bg-selecionado' : 'bg-transparent',
                ].join(' ')}
                onClick={() => selecionar(conversa.id)}
                aria-current={selecionada ? 'page' : undefined}
                aria-label={conversa.titulo}
                title={`${conversa.titulo}. ${atividade.nome}`}
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
                {mostrarIcone && (
                    <Icone
                        size={16}
                        aria-hidden="true"
                        className={[
                            'shrink-0',
                            atividade.ocupada ? 'animate-spin text-secundario motion-reduce:animate-none' : '',
                            atividade.fase === 'erro' ? 'text-[#e3a09a]' : '',
                        ].join(' ')}
                    />
                )}
                {!recolhida && (
                    <span data-ui="titulo-item-conversa" className="min-w-0 truncate leading-5">
                        {conversa.titulo}
                    </span>
                )}
                <span data-ui={`estado-conversa estado-${atividade.fase}`} className="sr-only">
                    {atividade.nome}
                </span>
            </button>
            {!recolhida && (
                <button
                    aria-label={`Opções da conversa: ${conversa.titulo}`}
                    title="Opções da conversa"
                    className={[
                        'absolute right-1 top-1 flex size-[26px] items-center justify-center rounded-md border-0',
                        'bg-transparent text-secundario opacity-0 hover:bg-hover hover:text-principal',
                        'group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                    ].join(' ')}
                    onClick={(evento) => {
                        const posicao = evento.currentTarget.getBoundingClientRect();
                        abrirMenu({ conversa, x: posicao.right, y: posicao.bottom, origem: evento.currentTarget });
                    }}
                >
                    <DotsThreeIcon size={20} weight="bold" />
                </button>
            )}
        </div>
    );
}
