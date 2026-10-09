import { useEffect, useState } from 'react';
import { ArrowLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import type { Conversa } from '../shared/contratos';
import { useSelene } from './hooks/useSelene';
import { BarraLateral } from './components/BarraLateral';
import { BarraJanela } from './components/BarraJanela';
import { Configuracoes } from './components/Configuracoes';
import { TelaConversa } from './components/TelaConversa';
import { Modal } from './components/Modal';
import { Estatisticas } from './components/Estatisticas';
import { AdicionarProjeto } from './components/AdicionarProjeto';
import type { Projeto } from '../shared/contratos';
import { TelaProjetos } from './components/TelaProjetos';
import { IconeProjeto } from './components/IconeProjeto';

function lerSidebarRecolhida(): boolean {
    try {
        return localStorage.getItem('selene.sidebarRecolhida') === 'true';
    } catch {
        return false;
    }
}

/** Coordena navegação, janela e ações do histórico preservando os rascunhos das telas. */
export function Aplicativo() {
    const dados = useSelene();
    const { estado, erro, carregando, executar, definirErro, ponte } = dados;
    const [ativas, definirAtivas] = useState<Record<'chat' | 'code', string | null>>({ chat: null, code: null });
    const [modoInicial, definirModoInicial] = useState<'chat' | 'code'>('chat');
    const [configurando, definirConfigurando] = useState(false);
    const [configuracoesMontadas, definirConfiguracoesMontadas] = useState(false);
    const [recolhida, definirRecolhida] = useState(lerSidebarRecolhida);
    const [excluindo, definirExcluindo] = useState<Conversa | null>(null);
    const [excluindoConcluidas, definirExcluindoConcluidas] = useState(false);
    const [estatisticasAbertas, definirEstatisticasAbertas] = useState(false);
    const [apagando, definirApagando] = useState(false);
    const [projetosAbertos, definirProjetosAbertos] = useState(false);
    const [gerenciandoProjetos, definirGerenciandoProjetos] = useState(false);
    const [projetoGerenciadoId, definirProjetoGerenciadoId] = useState<string | null>(null);
    const quantidadeConcluidas = estado.conversas.filter((item) => item.modo === 'code' && item.concluida).length;
    const ativa = ativas[modoInicial];
    const conversa = estado.conversas.find((item) => item.id === ativa);
    const projetoAtual = estado.projetos.find(
        (item) => item.id === conversa?.projetoId || item.caminho === conversa?.projeto,
    );
    const ocupado = !!estado.conversaEmExecucao;
    useEffect(() => {
        if (carregando || ativas[modoInicial]) return;
        const novo = dados.criarRascunho(modoInicial);
        definirAtivas((anteriores) => ({ ...anteriores, [modoInicial]: novo.id }));
    }, [carregando, modoInicial, ativas]);
    function configurar() {
        definirGerenciandoProjetos(false);
        definirConfiguracoesMontadas(true);
        definirConfigurando(true);
    }
    function selecionar(id: string) {
        definirGerenciandoProjetos(false);
        const escolhida = estado.conversas.find((item) => item.id === id);
        const modo = escolhida?.modo ?? modoInicial;
        definirModoInicial(modo);
        definirAtivas((anteriores) => ({ ...anteriores, [modo]: id }));
        definirConfigurando(false);
    }
    function criar(projeto?: Projeto | null, modo: 'chat' | 'code' = modoInicial) {
        definirGerenciandoProjetos(false);
        const novo = dados.criarRascunho(modo, projeto);
        definirModoInicial(modo);
        definirAtivas((anteriores) => ({ ...anteriores, [modo]: novo.id }));
        definirConfigurando(false);
    }
    function abrirProjetos(id: string | null = projetoAtual?.id ?? null) {
        definirProjetoGerenciadoId(id);
        definirConfigurando(false);
        definirGerenciandoProjetos(true);
    }
    if (carregando)
        return (
            <div data-ui="tela-carregando" className="grid place-items-center h-dvh text-[#b5bbc4]">
                Abrindo a Selene
            </div>
        );
    return (
        <div
            data-ui={`aplicativo ${recolhida ? 'aplicativo-recolhido' : ''}`}
            className={[
                [
                    'grid grid-cols-[290px_minmax(0,_1fr)] h-dvh min-h-[600px]',
                    '[@media(width<=1000px)]:grid-cols-[240px_minmax(0,_1fr)]',
                    '[@media(width<=760px)]:grid-cols-[minmax(0,_1fr)]',
                    '[@media(width<=760px)]:grid-rows-[auto_minmax(0,_1fr)]',
                ].join(' '),
                recolhida
                    ? [
                          '[&&]:grid-cols-[72px_minmax(0,_1fr)]',
                          '[@media(width<=760px)]:[&&]:grid-cols-[minmax(0,_1fr)]',
                          '[@media(width<=760px)]:[&&]:grid-rows-[auto_minmax(0,_1fr)]',
                      ].join(' ')
                    : '',
            ].join(' ')}
        >
            <BarraLateral
                estado={estado}
                modo={modoInicial}
                alterarModo={(modo) => {
                    definirGerenciandoProjetos(false);
                    definirModoInicial(modo);
                    definirConfigurando(false);
                }}
                concluir={(item) => {
                    void executar(() => ponte!.alterarConversa(item.id, { concluida: !item.concluida }));
                }}
                ativa={ativa}
                selecionar={selecionar}
                configurar={configurar}
                gerenciarProjetos={() => abrirProjetos()}
                estatisticas={() => definirEstatisticasAbertas(true)}
                atualizar={() => void executar(() => ponte!.verificarAtualizacao())}
                reiniciarAtualizacao={() => void executar(() => ponte!.reiniciarAtualizacao())}
                abrirRelease={(versao) => void executar(() => ponte!.abrirRelease(versao))}
                excluirConcluidas={() => definirExcluindoConcluidas(true)}
                configurando={configurando || gerenciandoProjetos}
                recolhida={recolhida}
                alternar={() => {
                    definirRecolhida((anterior) => {
                        try {
                            localStorage.setItem('selene.sidebarRecolhida', String(!anterior));
                        } catch {}
                        return !anterior;
                    });
                }}
                criar={(origemId) => {
                    const origem = estado.conversas.find((item) => item.id === origemId);
                    const projeto = estado.projetos.find(
                        (item) => item.id === origemId || item.caminho === (origem?.projeto ?? conversa?.projeto),
                    );
                    criar(projeto, origemId ? 'code' : modoInicial);
                }}
                exportar={(id) => {
                    void executar(() => ponte!.exportarConversa(id));
                }}
                excluir={definirExcluindo}
            />
            <main data-ui="area-principal" className="flex flex-col min-h-0 min-w-0">
                <BarraJanela ponte={ponte}>
                    {gerenciandoProjetos ? (
                        <>
                            <button
                                data-ui="botao-icone"
                                className={[
                                    [
                                        '[[data-ui~=marca]_&]:ml-auto',
                                        '[[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                    ].join(' '),
                                    [
                                        'inline-flex items-center justify-center bg-transparent',
                                        'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                    ].join(' '),
                                    'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                    '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                    "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                    '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                ].join(' ')}
                                aria-label="Voltar à conversa"
                                onClick={() => definirGerenciandoProjetos(false)}
                            >
                                <ArrowLeftIcon size={18} />
                            </button>
                            <h1
                                data-ui="titulo-tela"
                                className="text-[13px] leading-[1.3] font-medium tracking-[-0.7px] mt-0 mb-[13px] mx-0"
                            >
                                Projetos
                            </h1>
                        </>
                    ) : configurando ? (
                        <>
                            <button
                                data-ui="botao-icone"
                                className={[
                                    [
                                        '[[data-ui~=marca]_&]:ml-auto',
                                        '[[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                    ].join(' '),
                                    [
                                        'inline-flex items-center justify-center bg-transparent',
                                        'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                    ].join(' '),
                                    'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                    '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                    "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                    '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                ].join(' ')}
                                aria-label="Voltar à conversa"
                                onClick={() => definirConfigurando(false)}
                            >
                                <ArrowLeftIcon size={18} />
                            </button>
                            <h1
                                data-ui="titulo-tela"
                                className="text-[13px] leading-[1.3] font-medium tracking-[-0.7px] mt-0 mb-[13px] mx-0"
                            >
                                Configurações
                            </h1>
                        </>
                    ) : conversa ? (
                        <nav
                            data-ui="breadcrumbs-conversa"
                            className="flex items-center gap-[10px] min-w-0 text-[#85858c] [&_svg]:shrink-0"
                            aria-label="Localização da conversa"
                        >
                            {modoInicial === 'code' ? (
                                <button
                                    data-ui="breadcrumb-projeto"
                                    className={[
                                        'flex items-center gap-[7px] min-w-0 max-w-[180px] [flex-shrink:2]',
                                        [
                                            '[&:is(button)]:bg-transparent [&:is(button)]:text-inherit',
                                            '[&:is(button)]:text-[inherit]',
                                        ].join(' '),
                                        '[&:is(button)]:text-left [&:is(button)]:px-0 [&:is(button)]:py-[4px]',
                                        [
                                            '[&:is(button)]:border-0 [&:is(button)]:border-solid',
                                            '[&:is(button)]:border-current',
                                        ].join(' '),
                                        '[&:is(button):hover]:text-[#e6e7e9]',
                                    ].join(' ')}
                                    title={conversa.projeto ?? undefined}
                                    aria-label={
                                        projetoAtual ? `Gerenciar projeto ${projetoAtual.nome}` : 'Gerenciar projetos'
                                    }
                                    onClick={() => abrirProjetos()}
                                >
                                    <IconeProjeto projeto={projetoAtual} tamanho={15} />
                                    <span className="truncate">
                                        {projetoAtual?.nome ?? conversa.projeto?.split(/[\\/]/).at(-1) ?? 'Sem projeto'}
                                    </span>
                                </button>
                            ) : (
                                <span
                                    data-ui="breadcrumb-projeto"
                                    className={[
                                        'flex items-center gap-[7px] min-w-0 max-w-[180px] [flex-shrink:2]',
                                        [
                                            '[&:is(button)]:bg-transparent [&:is(button)]:text-inherit',
                                            '[&:is(button)]:text-[inherit]',
                                        ].join(' '),
                                        '[&:is(button)]:text-left [&:is(button)]:px-0 [&:is(button)]:py-[4px]',
                                        [
                                            '[&:is(button)]:border-0 [&:is(button)]:border-solid',
                                            '[&:is(button)]:border-current',
                                        ].join(' '),
                                        '[&:is(button):hover]:text-[#e6e7e9]',
                                    ].join(' ')}
                                >
                                    Chat
                                </span>
                            )}
                            <CaretRightIcon size={12} aria-hidden="true" />
                            <input
                                data-ui="titulo-conversa"
                                className={[
                                    '[[data-ui~=breadcrumbs-conversa]_&]:min-w-0',
                                    [
                                        '[[data-ui~=breadcrumbs-conversa]_&]:text-ellipsis bg-transparent',
                                        'w-[300px] max-w-[35vw]',
                                    ].join(' '),
                                    'text-[#b9bdc4] border-0 border-solid border-current',
                                ].join(' ')}
                                aria-label="Título da conversa"
                                key={`${conversa.id}:${conversa.titulo}`}
                                defaultValue={conversa.titulo}
                                disabled={ocupado}
                                onBlur={(evento) => {
                                    const titulo = evento.target.value.trim();
                                    if (titulo && titulo !== conversa.titulo) {
                                        if (dados.estadoPersistido.conversas.some((item) => item.id === conversa.id)) {
                                            void executar(() => ponte!.alterarConversa(conversa.id, { titulo }));
                                        } else {
                                            dados.alterarRascunho(conversa, { titulo });
                                        }
                                    }
                                }}
                                onKeyDown={(evento) => {
                                    if (evento.key === 'Enter') evento.currentTarget.blur();
                                }}
                            />
                        </nav>
                    ) : (
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
                            Selene
                        </span>
                    )}
                </BarraJanela>
                {erro && (
                    <div
                        data-ui="aviso-erro aviso-global"
                        className={[
                            [
                                'mt-[16px] mb-[12px] flex justify-between items-center gap-[12px]',
                                'text-[#f0b2ae] bg-[#33201f]',
                            ].join(' '),
                            'rounded-[9px] text-[12px] max-h-[150px] overflow-auto wrap-anywhere p-[12px] mx-[30px]',
                            'border border-solid border-[#6f403b]',
                        ].join(' ')}
                        role="alert"
                    >
                        <span>{erro}</span>
                        <button
                            data-ui="botao-icone"
                            className={[
                                '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                [
                                    'inline-flex items-center justify-center bg-transparent text-[#a1a5ad]',
                                    'rounded-[6px] p-[8px]',
                                ].join(' '),
                                'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                            ].join(' ')}
                            aria-label="Fechar aviso"
                            onClick={() => definirErro('')}
                        >
                            <XIcon size={16} />
                        </button>
                    </div>
                )}
                <div
                    data-ui="area-tela"
                    className="flex-1 min-h-0 flex min-w-0 [&[hidden]]:hidden"
                    hidden={configurando || gerenciandoProjetos}
                >
                    {(['chat', 'code'] as const).map((modo) => (
                        <div
                            data-ui="area-tela"
                            className="flex-1 min-h-0 flex min-w-0 [&[hidden]]:hidden"
                            key={modo}
                            hidden={modo !== modoInicial}
                        >
                            <TelaConversa
                                dados={dados}
                                modoInicial={modo}
                                ativa={ativas[modo]}
                                selecionar={selecionar}
                                configurar={configurar}
                                visivel={!configurando && !gerenciandoProjetos && modo === modoInicial}
                                adicionarProjeto={() => definirProjetosAbertos(true)}
                            />
                        </div>
                    ))}
                </div>
                {gerenciandoProjetos && (
                    <TelaProjetos
                        dados={dados}
                        projetoId={projetoGerenciadoId}
                        selecionarProjeto={definirProjetoGerenciadoId}
                        adicionar={() => definirProjetosAbertos(true)}
                        criar={(projeto) => criar(projeto, 'code')}
                        selecionarConversa={selecionar}
                    />
                )}
                {configuracoesMontadas && (
                    <div
                        data-ui="area-tela"
                        className="flex-1 min-h-0 flex min-w-0 [&[hidden]]:hidden"
                        hidden={!configurando}
                    >
                        <Configuracoes estado={estado} ponte={ponte} executar={executar} />
                    </div>
                )}
            </main>
            {projetosAbertos && (
                <AdicionarProjeto
                    dados={dados}
                    fechar={() => definirProjetosAbertos(false)}
                    selecionar={(projeto) => criar(projeto, 'code')}
                />
            )}
            {estatisticasAbertas && <Estatisticas estado={estado} fechar={() => definirEstatisticasAbertas(false)} />}
            {excluindoConcluidas && (
                <Modal
                    titulo="Apagar todos os chats concluídos?"
                    fechar={() => {
                        if (!apagando) definirExcluindoConcluidas(false);
                    }}
                >
                    <p
                        data-ui="texto-secundario mb-6"
                        className={[
                            'mb-6 text-[#a1a5ad] text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        {quantidadeConcluidas} conversas Code serão apagadas. As estatísticas de uso serão preservadas.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={apagando}
                            onClick={() => definirExcluindoConcluidas(false)}
                        >
                            Cancelar
                        </button>
                        <button
                            data-ui="botao botao-primario"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#e0d8ef] rounded-[8px]',
                                'whitespace-nowrap text-[#251b38] px-[14px] py-[9px] border border-solid',
                                'border-transparent [&:hover:not(:disabled)]:bg-[#cec0e5]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                ].join(' '),
                                '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={apagando || quantidadeConcluidas === 0}
                            onClick={async () => {
                                definirApagando(true);
                                try {
                                    const ids = await executar(() => ponte!.excluirConcluidas());
                                    if (!ids) return;
                                    const removidas = new Set(ids);
                                    definirAtivas((anteriores) => ({
                                        chat:
                                            anteriores.chat && removidas.has(anteriores.chat) ? null : anteriores.chat,
                                        code:
                                            anteriores.code && removidas.has(anteriores.code) ? null : anteriores.code,
                                    }));
                                    definirExcluindoConcluidas(false);
                                } finally {
                                    definirApagando(false);
                                }
                            }}
                        >
                            {apagando ? 'Apagando' : 'Apagar todos'}
                        </button>
                    </div>
                </Modal>
            )}
            {excluindo && (
                <Modal titulo="Excluir esta conversa?" fechar={() => definirExcluindo(null)}>
                    <p
                        data-ui="texto-secundario mb-6"
                        className={[
                            'mb-6 text-[#a1a5ad] text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        O histórico de {excluindo.titulo} será removido.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            onClick={() => definirExcluindo(null)}
                        >
                            Cancelar
                        </button>
                        <button
                            data-ui="botao botao-primario"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#e0d8ef] rounded-[8px]',
                                'whitespace-nowrap text-[#251b38] px-[14px] py-[9px] border border-solid',
                                'border-transparent [&:hover:not(:disabled)]:bg-[#cec0e5]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                ].join(' '),
                                '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={estado.conversaEmExecucao === excluindo.id}
                            onClick={() =>
                                executar(async () => {
                                    if (!dados.estadoPersistido.conversas.some((item) => item.id === excluindo.id)) {
                                        dados.removerRascunho(excluindo.id);
                                        definirAtivas((anteriores) => ({ ...anteriores, [excluindo.modo]: null }));
                                        definirExcluindo(null);
                                        return { ok: true, valor: undefined };
                                    }
                                    const resultado = await ponte!.excluirConversa(excluindo.id);
                                    if (resultado.ok) {
                                        dados.removerRascunho(excluindo.id);
                                        definirAtivas((anteriores) => ({
                                            chat: anteriores.chat === excluindo.id ? null : anteriores.chat,
                                            code: anteriores.code === excluindo.id ? null : anteriores.code,
                                        }));
                                        definirExcluindo(null);
                                    }
                                    return resultado;
                                })
                            }
                        >
                            Excluir
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
