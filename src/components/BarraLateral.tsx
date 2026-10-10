import { useCallback, useEffect, useState } from 'react';
import {
    ChatCircleIcon,
    CodeIcon,
    GearSixIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    PlusIcon,
    FolderIcon,
    SidebarSimpleIcon,
    CaretDownIcon,
    ChartBarIcon,
    TrashIcon,
} from '@phosphor-icons/react';
import type { Conversa, Estado } from '../../shared/contratos';
import { agruparHistorico, type GrupoHistorico } from '../../shared/historico';
import { MenuConversa, type PosicaoMenuConversa } from './MenuConversa';
import { MenuContexto, type PosicaoMenu } from './MenuContexto';
import { LinhaConversaSidebar } from './LinhaConversaSidebar';
import { possuiRascunho } from '../../shared/rascunhos';
import { AtualizacaoSidebar } from './AtualizacaoSidebar';
import { ProjetosChatSidebar } from './ProjetosChatSidebar';

/** Use para separar os modos, navegar pelo histórico e acompanhar as tarefas do agente. */
export function BarraLateral({
    estado,
    ativa,
    modo,
    alterarModo,
    concluir,
    selecionar,
    criar,
    configurar,
    gerenciarProjetos,
    abrirProjetoChat,
    criarProjetoChat,
    criarChatProjeto,
    moverChatProjeto,
    estatisticas,
    atualizar,
    reiniciarAtualizacao,
    abrirRelease,
    excluirConcluidas,
    recolhida,
    alternar,
    configurando,
    exportar,
    excluir,
}: {
    estado: Estado;
    ativa: string | null;
    modo: 'chat' | 'code';
    alterarModo: (modo: 'chat' | 'code') => void;
    concluir: (conversa: Conversa) => void;
    selecionar: (id: string) => void;
    criar: (origemId?: string) => void;
    configurar: () => void;
    gerenciarProjetos: () => void;
    abrirProjetoChat: (id: string) => void;
    criarProjetoChat: () => void;
    criarChatProjeto: (id: string) => void;
    moverChatProjeto: (conversa: Conversa, id: string | null) => void;
    estatisticas: () => void;
    atualizar: () => void;
    reiniciarAtualizacao: () => void;
    abrirRelease: (versao?: string) => void;
    excluirConcluidas: () => void;
    recolhida: boolean;
    alternar: () => void;
    configurando: boolean;
    exportar: (id: string) => void;
    excluir: (conversa: Conversa) => void;
}) {
    const [busca, definirBusca] = useState('');
    const [menu, definirMenu] = useState<PosicaoMenuConversa | null>(null);
    const [menuConcluidas, definirMenuConcluidas] = useState<PosicaoMenu | null>(null);
    const [fechados, definirFechados] = useState<Set<string>>(new Set(['concluidas']));
    const [expandidos, definirExpandidos] = useState<Set<string>>(new Set());
    const [agora, definirAgora] = useState(Date.now);
    const fecharMenus = useCallback(() => {
        definirMenu(null);
        definirMenuConcluidas(null);
    }, []);
    useEffect(() => {
        const intervalo = setInterval(() => definirAgora(Date.now()), 30000);
        return () => clearInterval(intervalo);
    }, []);
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const conversas = estado.conversas.filter(
        (conversa) =>
            conversa.modo === modo &&
            (conversa.mensagens.length || possuiRascunho(conversa)) &&
            (!termo ||
                `${conversa.titulo} ${conversa.projeto ?? ''} ${
                    estado.projetos.find((item) => item.id === conversa.projetoId || item.caminho === conversa.projeto)
                        ?.nome ?? ''
                }
                    ${estado.projetosChat.find((item) => item.id === conversa.projetoChatId)?.nome ?? ''}
                    ${conversa.rascunho ?? ''} ${conversa.mensagens.map((item) => item.texto).join(' ')}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(termo)),
    );
    const grupos = agruparHistorico(
        conversas.filter((item) => modo === 'code' || !item.projetoChatId),
        modo,
        estado.conversaEmExecucao,
    );
    const quantidadeConcluidas = estado.conversas.filter((item) => item.modo === 'code' && item.concluida).length;

    function alternarGrupo(chave: string) {
        definirFechados((anterior) => {
            const novos = new Set(anterior);
            if (novos.has(chave)) novos.delete(chave);
            else novos.add(chave);
            return novos;
        });
    }

    function abrirMenuConcluidas(origem: HTMLElement, x: number, y: number) {
        definirMenu(null);
        definirMenuConcluidas({ origem, x, y });
    }

    function renderizarConversa(conversa: Conversa) {
        return (
            <LinhaConversaSidebar
                key={conversa.id}
                conversa={conversa}
                estado={estado}
                selecionada={!configurando && ativa === conversa.id}
                recolhida={recolhida}
                agora={agora}
                selecionar={selecionar}
                concluir={concluir}
                abrirMenu={(posicao) => {
                    definirMenuConcluidas(null);
                    definirMenu(posicao);
                }}
            />
        );
    }

    function renderizarGrupo(grupo: GrupoHistorico) {
        const aberta = grupo.chave === 'atuais' || !!termo || !fechados.has(grupo.chave);
        const todos = grupo.chave !== 'concluidas' || !!termo || expandidos.has(grupo.chave);
        const itens = todos ? grupo.itens : grupo.itens.filter((item, indice) => indice < 6 || item.id === ativa);
        const visiveis =
            aberta || recolhida
                ? itens
                : grupo.chave === 'trabalhando'
                  ? itens.filter((item) => item.id === ativa)
                  : [];
        return (
            <section
                key={grupo.chave}
                data-ui={`grupo-historico grupo-${grupo.chave}`}
                className={[
                    'mb-[14px] shrink-0',
                    grupo.chave === 'atuais'
                        ? '[&&]:mb-[30px]'
                        : grupo.chave === 'concluidas'
                          ? '[&&]:mb-[6px]'
                          : 'grupo-trabalhando',
                ].join(' ')}
                aria-label={grupo.nome || 'Conversas atuais'}
            >
                {!recolhida && grupo.nome && (
                    <button
                        data-ui="rotulo-grupo separador-historico"
                        className={[
                            'text-[11px] text-secundario flex items-center gap-[7px] flex-1 min-w-0 bg-transparent',
                            'text-left w-full p-[8px] mx-0 my-[8px] border-0 border-solid border-current',
                            [
                                '[&_.truncate]:flex-1 [&_small]:text-[#666d76] [&_small]:text-[10px]',
                                '[&:hover]:text-principal',
                            ].join(' '),
                            '[&_>_svg]:ml-auto',
                        ].join(' ')}
                        aria-label={grupo.nome}
                        onClick={() => alternarGrupo(grupo.chave)}
                        aria-expanded={aberta}
                        onContextMenu={
                            grupo.chave === 'concluidas'
                                ? (evento) => {
                                      evento.preventDefault();
                                      abrirMenuConcluidas(evento.currentTarget, evento.clientX, evento.clientY);
                                  }
                                : undefined
                        }
                        onKeyDown={
                            grupo.chave === 'concluidas'
                                ? (evento) => {
                                      if (evento.key !== 'ContextMenu' && !(evento.shiftKey && evento.key === 'F10'))
                                          return;
                                      evento.preventDefault();
                                      const posicao = evento.currentTarget.getBoundingClientRect();
                                      abrirMenuConcluidas(evento.currentTarget, posicao.right, posicao.top);
                                  }
                                : undefined
                        }
                    >
                        <span>
                            {grupo.nome}
                            {grupo.itens.length > 0 && ` (${grupo.itens.length})`}
                        </span>
                        <CaretDownIcon
                            size={12}
                            data-ui={!aberta ? 'grupo-fechado' : ''}
                            className={!aberta ? '[&&]:[transform:rotate(-90deg)]' : ''}
                        />
                    </button>
                )}
                {visiveis.map(renderizarConversa)}
                {aberta && !recolhida && !todos && grupo.itens.length > itens.length && (
                    <button
                        data-ui="mostrar-conversas"
                        className={[
                            'flex items-center gap-[8px] text-secundario bg-transparent text-[11px] px-[10px] py-[9px]',
                            'border-0 border-solid border-current [&:hover]:text-principal',
                        ].join(' ')}
                        onClick={() => definirExpandidos((anteriores) => new Set(anteriores).add(grupo.chave))}
                    >
                        <PlusIcon size={13} /> Mostrar mais {grupo.itens.length - itens.length}
                    </button>
                )}
            </section>
        );
    }

    return (
        <aside
            data-ui={`sidebar ${recolhida ? 'sidebar-recolhida' : ''}`}
            className={[
                [
                    'bg-sidebar border-r border-solid border-r-borda flex flex-col',
                    'pt-0 pb-[12px] relative isolate min-h-0 px-[10px]',
                ].join(' '),
                recolhida ? ['[&&]:px-[10px]', '[&&]:pt-[16px]'].join(' ') : '',
            ].join(' ')}
            aria-label="Navegação principal"
        >
            <div
                data-ui="ceu-sidebar"
                className={[
                    'absolute z-[-1] top-0 right-0 bottom-[auto] left-0 h-20 overflow-hidden',
                    'pointer-events-none',
                    'bg-linear-135 from-ceu-inicio via-ceu-meio to-ceu-fim',
                    '[mask-image:linear-gradient(#000_35%,_transparent_100%)] [&_i]:absolute [&_i]:w-[1.5px]',
                    '[&_i]:h-[1.5px] [&_i]:rounded-full [&_i]:bg-[#c9d3eb] [&_i]:shadow-[0_0_2px_#c0d6ff22]',
                    '[&_i:nth-of-type(9n)]:w-[3px] [&_i:nth-of-type(9n)]:h-[3px] [&_i:nth-of-type(9n)]:bg-[#f5f7ff]',
                    '[&_i:nth-of-type(9n)]:shadow-[0_0_3px_#dae7ff44]',
                ].join(' ')}
                aria-hidden="true"
            >
                <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_20%,#493caf66,transparent_65%)]" />
                <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,#451b6c55,transparent_70%)]" />
                {Array.from({ length: 38 }, (_, indice) => (
                    <i
                        key={indice}
                        style={{
                            left: ((indice * 37 + 7) % 100) + '%',
                            top: ((indice * indice * 17 + 8) % 65) + '%',
                            opacity: 0.12 + (indice % 5) * 0.07,
                        }}
                    />
                ))}
            </div>
            <div
                data-ui="marca"
                className={[
                    'flex h-[56px] shrink-0 items-center gap-[11px] mt-0 mb-[12px] [-webkit-app-region:drag] mx-[8px]',
                    'border-b border-transparent [[data-ui~=sidebar-recolhida]_&]:border-0',
                    '[&_span]:text-[17px] [&_span]:font-semibold [&_span]:tracking-[-0.4px] [&_span]:text-white',
                    '[[data-ui~=sidebar-recolhida]_&]:flex-col [[data-ui~=sidebar-recolhida]_&]:mt-0',
                    '[[data-ui~=sidebar-recolhida]_&]:h-auto',
                    '[[data-ui~=sidebar-recolhida]_&]:mb-[20px] [[data-ui~=sidebar-recolhida]_&]:gap-[14px]',
                    '[[data-ui~=sidebar-recolhida]_&]:mx-0 [&_button_svg]:text-[#b5a2dc]',
                ].join(' ')}
            >
                <MoonIcon size={21} weight="fill" className="text-white" />
                {!recolhida && <span>Selene</span>}
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-secundario rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                        '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                    ].join(' ')}
                    onClick={alternar}
                    aria-expanded={!recolhida}
                    aria-label={recolhida ? 'Expandir sidebar' : 'Recolher sidebar'}
                    title={recolhida ? 'Expandir sidebar' : 'Recolher sidebar'}
                >
                    <SidebarSimpleIcon size={18} />
                </button>
            </div>
            <div
                data-ui="seletor-modo seletor-modo-sidebar"
                className={[
                    'flex rounded-[8px] mt-0 mb-[12px] p-[3px] mx-[6px] border border-solid',
                    'border-borda [&_button]:flex [&_button]:items-center [&_button]:gap-[7px]',
                    '[&_button]:text-[12px] [&_button]:text-secundario [&_button]:bg-transparent',
                    '[&_button]:rounded-[5px] [&_button]:flex-1 [&_button]:justify-center [&_button]:px-[13px]',
                    '[&_button]:py-[7px] [&_button]:border-0 [&_button]:border-solid',
                    "[&_button]:border-current [&_button[aria-pressed='true']]:bg-selecionado",
                    "[&_button[aria-pressed='true']]:text-[#eff0f2] [[data-ui~=sidebar-recolhida]_&]:flex-col",
                    '[[data-ui~=sidebar-recolhida]_&]:ml-0 [[data-ui~=sidebar-recolhida]_&]:mr-0',
                ].join(' ')}
                aria-label="Modo da Selene"
            >
                {(['chat', 'code'] as const).map((opcao) => (
                    <button
                        key={opcao}
                        aria-label={opcao === 'chat' ? 'Chat' : 'Code'}
                        title={opcao === 'chat' ? 'Chat' : 'Code'}
                        aria-pressed={modo === opcao}
                        onClick={() => {
                            fecharMenus();
                            definirBusca('');
                            alterarModo(opcao);
                        }}
                    >
                        {opcao === 'chat' ? <ChatCircleIcon size={16} /> : <CodeIcon size={16} />}
                        {!recolhida && <span>{opcao === 'chat' ? 'Chat' : 'Code'}</span>}
                    </button>
                ))}
            </div>
            <div
                data-ui="acoes-sidebar"
                className={['flex items-center gap-[2px] mb-[14px] [[data-ui~=sidebar-recolhida]_&]:flex-col'].join(
                    ' ',
                )}
            >
                {!recolhida && (
                    <label
                        data-ui="busca"
                        className={[
                            'flex items-center gap-[9px] text-secundario flex-1 min-w-0 p-[8px] [&_input]:min-w-0',
                            '[&_input]:w-full [&_input]:bg-transparent [&_input]:text-[12px] [&_input]:border-0',
                            '[&_input]:border-solid [&_input]:border-current [&_input::placeholder]:text-secundario',
                        ].join(' ')}
                    >
                        <MagnifyingGlassIcon size={16} />
                        <input
                            aria-label="Buscar conversas"
                            placeholder="Buscar"
                            value={busca}
                            onChange={(evento) => definirBusca(evento.target.value)}
                        />
                    </label>
                )}
                {modo === 'code' && (
                    <button
                        data-ui="botao-icone"
                        className={[
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-secundario',
                                'rounded-[6px] p-[8px]',
                            ].join(' '),
                            'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                        ].join(' ')}
                        aria-label="Projetos"
                        title="Gerenciar projetos"
                        onClick={gerenciarProjetos}
                    >
                        <FolderIcon size={18} />
                    </button>
                )}
                {modo === 'chat' && (
                    <button
                        className="rounded-md p-2 text-secundario hover:bg-hover
                    hover:text-principal"
                        aria-label="Novo projeto de Chat"
                        title="Novo projeto de Chat"
                        onClick={criarProjetoChat}
                    >
                        <FolderIcon size={18} />
                    </button>
                )}
                <button
                    data-ui="botao-icone nova-conversa"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        '[[data-ui~=sidebar-recolhida]_&]:justify-center [[data-ui~=sidebar-recolhida]_&]:px-[8px]',
                        '[[data-ui~=sidebar-recolhida]_&]:py-[11px] inline-flex items-center justify-start',
                        'bg-superficie text-secundario rounded-[6px] w-full px-[14px] py-[12px] border-0',
                        'border-solid border-current [&:hover:not(:disabled)]:text-principal',
                        '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                        '[[data-ui~=sidebar]_&]:w-auto [[data-ui~=sidebar]_&]:bg-transparent',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                    ].join(' ')}
                    onClick={() => criar()}
                    aria-label="Nova conversa"
                    title="Nova conversa"
                >
                    <PlusIcon size={18} />
                </button>
            </div>
            <nav
                data-ui="historico"
                className={[
                    '[[data-ui~=sidebar-recolhida]_&]:mt-[20px] flex-1 min-h-0 overflow-y-auto mt-[8px] flex',
                    'flex-col [scrollbar-width:thin] [scrollbar-color:#303339_transparent]',
                ].join(' ')}
                aria-label="Conversas"
            >
                {modo === 'chat' && (
                    <ProjetosChatSidebar
                        projetos={estado.projetosChat}
                        conversas={conversas}
                        recolhida={recolhida}
                        termo={termo}
                        abrir={abrirProjetoChat}
                        criar={criarChatProjeto}
                        renderizar={renderizarConversa}
                    />
                )}
                {grupos.filter((grupo) => grupo.chave === 'atuais').map(renderizarGrupo)}
                {conversas.length === 0 && !recolhida && (
                    <p
                        data-ui="historico-vazio texto-secundario"
                        className={[
                            'text-[12px] leading-[1.7] text-secundario p-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        {busca ? 'Nenhuma conversa encontrada.' : 'Seu histórico aparecerá aqui.'}
                    </p>
                )}
                {modo === 'code' && (
                    <div data-ui="prateleiras-historico" className="mt-auto shrink-0">
                        {grupos.filter((grupo) => grupo.chave !== 'atuais').map(renderizarGrupo)}
                    </div>
                )}
            </nav>
            <footer
                data-ui="rodape-sidebar"
                className={[
                    '[[data-ui~=sidebar-recolhida]_&]:justify-center [[data-ui~=sidebar-recolhida]_&]:flex-col',
                    '[[data-ui~=sidebar-recolhida]_&]:px-[8px] [[data-ui~=sidebar-recolhida]_&]:py-[11px]',
                    "[&[aria-current='page']]:text-[#b5a2dc] [&[aria-current='page']]:bg-selecionado flex",
                    'items-center gap-[2px] pt-[6px] pb-0 text-left bg-transparent border-t',
                    'border-t-borda border-r-0 border-r-[currentColor] border-b-0',
                    'border-b-[currentColor] border-l-0 border-l-[currentColor] rounded-[0] text-[#9298a2]',
                    'px-[2px] border-solid [&_span]:text-[12px] [&_small]:block [&_small]:text-secundario',
                    '[&_small]:text-[11px] [&_small]:mt-[4px]',
                ].join(' ')}
            >
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-secundario rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                        '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                    ].join(' ')}
                    onClick={configurar}
                    aria-label="Configurações"
                    title="Configurações"
                    aria-current={configurando ? 'page' : undefined}
                >
                    <GearSixIcon size={19} />
                </button>
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-secundario rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                        '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                    ].join(' ')}
                    onClick={estatisticas}
                    aria-label="Estatísticas"
                    title="Estatísticas"
                >
                    <ChartBarIcon size={19} />
                </button>
                <AtualizacaoSidebar
                    estado={estado.atualizacao}
                    verificar={atualizar}
                    reiniciar={reiniciarAtualizacao}
                    abrirRelease={abrirRelease}
                />
            </footer>
            {menu && (
                <MenuConversa
                    menu={menu}
                    fechar={fecharMenus}
                    exportar={exportar}
                    excluir={excluir}
                    concluir={concluir}
                    ocupado={estado.conversaEmExecucao === menu.conversa.id}
                    projetosChat={estado.projetosChat}
                    moverProjetoChat={moverChatProjeto}
                />
            )}
            {menuConcluidas && (
                <MenuContexto posicao={menuConcluidas} fechar={fecharMenus} titulo="Ações das conversas concluídas">
                    <button
                        role="menuitem"
                        data-ui="texto-erro"
                        className={[
                            'text-[#e9aaa7] text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        ].join(' ')}
                        disabled={quantidadeConcluidas === 0}
                        onClick={() => {
                            fecharMenus();
                            excluirConcluidas();
                        }}
                    >
                        <TrashIcon size={17} /> Apagar todos os chats concluídos
                    </button>
                </MenuContexto>
            )}
        </aside>
    );
}
