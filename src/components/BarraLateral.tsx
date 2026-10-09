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
    estatisticas,
    atualizar,
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
    estatisticas: () => void;
    atualizar: () => void;
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
                    ${conversa.rascunho ?? ''} ${conversa.mensagens.map((item) => item.texto).join(' ')}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(termo)),
    );
    const grupos = agruparHistorico(conversas, modo, estado.conversaEmExecucao);
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
                className={'grupo-historico grupo-' + grupo.chave}
                aria-label={grupo.nome || 'Conversas atuais'}
            >
                {!recolhida && grupo.nome && (
                    <button
                        className="rotulo-grupo separador-historico"
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
                        <CaretDownIcon size={12} className={!aberta ? 'grupo-fechado' : ''} />
                    </button>
                )}
                {visiveis.map(renderizarConversa)}
                {aberta && !recolhida && !todos && grupo.itens.length > itens.length && (
                    <button
                        className="mostrar-conversas"
                        onClick={() => definirExpandidos((anteriores) => new Set(anteriores).add(grupo.chave))}
                    >
                        <PlusIcon size={13} /> Mostrar mais {grupo.itens.length - itens.length}
                    </button>
                )}
            </section>
        );
    }

    return (
        <aside className={`sidebar ${recolhida ? 'sidebar-recolhida' : ''}`} aria-label="Navegação principal">
            <div className="ceu-sidebar" aria-hidden="true">
                {Array.from({ length: 38 }, (_, indice) => (
                    <i
                        key={indice}
                        style={{
                            left: ((indice * 37 + 7) % 100) + '%',
                            top: ((indice * indice * 17 + 8) % 65) + '%',
                            opacity: 0.25 + (indice % 5) * 0.13,
                        }}
                    />
                ))}
            </div>
            <div className="marca">
                <MoonIcon size={21} weight="duotone" />
                {!recolhida && <span>selene</span>}
                <button
                    className="botao-icone"
                    onClick={alternar}
                    aria-expanded={!recolhida}
                    aria-label={recolhida ? 'Expandir sidebar' : 'Recolher sidebar'}
                    title={recolhida ? 'Expandir sidebar' : 'Recolher sidebar'}
                >
                    <SidebarSimpleIcon size={18} />
                </button>
            </div>
            <div className="seletor-modo seletor-modo-sidebar" aria-label="Modo da Selene">
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
            <div className="acoes-sidebar">
                {!recolhida && (
                    <label className="busca">
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
                        className="botao-icone"
                        aria-label="Projetos"
                        title="Gerenciar projetos"
                        onClick={gerenciarProjetos}
                    >
                        <FolderIcon size={18} />
                    </button>
                )}
                <button
                    className="botao-icone nova-conversa"
                    onClick={() => criar()}
                    aria-label="Nova conversa"
                    title="Nova conversa"
                >
                    <PlusIcon size={18} />
                </button>
            </div>
            <nav className="historico" aria-label="Conversas">
                {grupos.filter((grupo) => grupo.chave === 'atuais').map(renderizarGrupo)}
                {conversas.length === 0 && !recolhida && (
                    <p className="historico-vazio texto-secundario">
                        {busca ? 'Nenhuma conversa encontrada.' : 'Seu histórico aparecerá aqui.'}
                    </p>
                )}
                {modo === 'code' && (
                    <div className="prateleiras-historico">
                        {grupos.filter((grupo) => grupo.chave !== 'atuais').map(renderizarGrupo)}
                    </div>
                )}
            </nav>
            <footer className="rodape-sidebar">
                <button
                    className="botao-icone"
                    onClick={configurar}
                    aria-label="Configurações"
                    title="Configurações"
                    aria-current={configurando ? 'page' : undefined}
                >
                    <GearSixIcon size={19} />
                </button>
                <button className="botao-icone" onClick={estatisticas} aria-label="Estatísticas" title="Estatísticas">
                    <ChartBarIcon size={19} />
                </button>
                <AtualizacaoSidebar estado={estado.atualizacao} verificar={atualizar} abrirRelease={abrirRelease} />
            </footer>
            {menu && (
                <MenuConversa
                    menu={menu}
                    fechar={fecharMenus}
                    exportar={exportar}
                    excluir={excluir}
                    concluir={concluir}
                    ocupado={estado.conversaEmExecucao === menu.conversa.id}
                />
            )}
            {menuConcluidas && (
                <MenuContexto posicao={menuConcluidas} fechar={fecharMenus} titulo="Ações das conversas concluídas">
                    <button
                        role="menuitem"
                        className="texto-erro"
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
