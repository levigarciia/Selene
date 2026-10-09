import { PlusIcon, TrashIcon, ChatCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Projeto, Resultado } from '../../shared/contratos';
import type { useSelene } from '../hooks/useSelene';
import { possuiRascunho } from '../../shared/rascunhos';
import { IconeProjeto } from './IconeProjeto';
import { EscolherIconeProjeto } from './EscolherIconeProjeto';
import { AdicionarProjeto } from './AdicionarProjeto';

const botao =
    'inline-flex items-center justify-center gap-2 rounded-md border border-borda ' +
    'bg-superficie px-3 py-2 text-xs hover:enabled:bg-borda';
const linha =
    'flex items-center justify-between gap-5 p-4 text-[13px] ' +
    'border-b border-borda last:border-b-0 max-sm:flex-col max-sm:items-stretch max-sm:gap-3';

/** Reúne cadastro, identidade e conversas dos projetos preservando a composição em andamento. */
export function TelaProjetos({
    dados,
    projetoId,
    selecionarProjeto,
    adicionando,
    adicionar,
    cancelarAdicao,
    criar,
    selecionarConversa,
}: {
    dados: ReturnType<typeof useSelene>;
    projetoId: string | null;
    selecionarProjeto: (id: string) => void;
    adicionando: boolean;
    adicionar: () => void;
    cancelarAdicao: () => void;
    criar: (projeto: Projeto) => void;
    selecionarConversa: (id: string) => void;
}) {
    const [ocupado, definirOcupado] = useState(false);
    const [mensagem, definirMensagem] = useState('');
    const [editandoIcone, definirEditandoIcone] = useState(false);
    const projetos = dados.estado.projetos;
    const projeto = projetos.find((item) => item.id === projetoId) ?? projetos[0];
    const conversas = dados.estado.conversas.filter(
        (item) =>
            projeto &&
            item.modo === 'code' &&
            (item.projetoId === projeto.id || item.projeto === projeto.caminho) &&
            (item.mensagens.length || possuiRascunho(item)),
    );

    async function executar(operacao: () => Promise<Resultado<unknown>>) {
        if (ocupado) return;
        definirOcupado(true);
        definirMensagem('');
        try {
            if (!dados.ponte) throw new Error('Gerencie os projetos no aplicativo desktop.');
            const resultado = await operacao();
            if (!resultado.ok) throw new Error(resultado.erro);
        } catch (erro) {
            definirMensagem(erro instanceof Error ? erro.message : 'Não foi possível atualizar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <div
            data-ui="tela-projetos"
            className={[
                'grid flex-1 min-h-0 min-w-0 grid-cols-[220px_minmax(0,1fr)] overflow-hidden',
                '[&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-borda',
                '[&_input]:bg-superficie [&_input]:px-3 [&_input]:py-2 [&_input]:text-principal',
                'max-lg:grid-cols-[180px_minmax(0,1fr)] max-sm:flex max-sm:flex-col max-sm:overflow-y-auto',
            ].join(' ')}
        >
            <nav
                data-ui="lista-projetos"
                aria-label="Projetos cadastrados"
                className={[
                    'flex flex-col gap-1 overflow-y-auto border-r border-borda p-3',
                    'max-sm:flex-row max-sm:shrink-0 max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b',
                ].join(' ')}
            >
                <button className={`${botao} mb-3 shrink-0 max-sm:mb-0`} disabled={ocupado} onClick={adicionar}>
                    <PlusIcon size={16} /> Adicionar projeto
                </button>
                {projetos.map((item) => (
                    <button
                        key={item.id}
                        data-ui="linha-projeto-gerenciamento"
                        className={[
                            'flex min-w-0 items-center gap-3 rounded-md p-3 text-left text-secundario',
                            'hover:enabled:bg-superficie hover:enabled:text-principal max-sm:shrink-0 max-sm:max-w-60',
                            'aria-[current=page]:bg-selecionado aria-[current=page]:text-principal',
                        ].join(' ')}
                        disabled={ocupado}
                        aria-label={item.nome}
                        aria-current={!adicionando && item.id === projeto?.id ? 'page' : undefined}
                        onClick={() => {
                            definirMensagem('');
                            definirEditandoIcone(false);
                            cancelarAdicao();
                            selecionarProjeto(item.id);
                        }}
                    >
                        <IconeProjeto projeto={item} tamanho={18} />
                        <span className="min-w-0">
                            <span className="block truncate text-xs">{item.nome}</span>
                            <small className="mt-1 block truncate text-[10px] text-discreto" title={item.caminho}>
                                {item.caminho}
                            </small>
                        </span>
                    </button>
                ))}
            </nav>
            <div className="min-w-0 overflow-y-auto p-8 max-lg:p-5 max-sm:overflow-visible max-sm:p-4">
                <div className="mx-auto w-full max-w-[820px]">
                    {adicionando || !projeto ? (
                        <AdicionarProjeto dados={dados} fechar={cancelarAdicao} selecionar={criar} />
                    ) : (
                        <div data-ui="detalhes-projeto" key={projeto.id}>
                            <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <IconeProjeto projeto={projeto} tamanho={28} />
                                    <h2 className="m-0 truncate text-lg font-medium">{projeto.nome}</h2>
                                </div>
                                <button className={botao} disabled={ocupado} onClick={() => criar(projeto)}>
                                    <PlusIcon size={16} /> Nova conversa neste projeto
                                </button>
                            </header>
                            <section
                                className="overflow-hidden rounded-lg border border-borda"
                                aria-label="Configurações do projeto"
                            >
                                <form
                                    data-ui="nome-projeto-formulario"
                                    className={linha}
                                    onSubmit={(evento) => {
                                        evento.preventDefault();
                                        const nome = new FormData(evento.currentTarget).get('nome')?.toString().trim();
                                        if (nome && nome !== projeto.nome)
                                            void executar(() => dados.ponte!.alterarProjeto(projeto.id, nome));
                                    }}
                                >
                                    <label htmlFor="nome-projeto">Nome</label>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <input
                                            id="nome-projeto"
                                            aria-label="Nome do projeto"
                                            name="nome"
                                            className="w-52 max-sm:flex-1 max-sm:w-full"
                                            key={projeto.nome}
                                            defaultValue={projeto.nome}
                                            required
                                            maxLength={100}
                                            disabled={ocupado}
                                        />
                                        <button className={`${botao} shrink-0`} disabled={ocupado}>
                                            Salvar nome
                                        </button>
                                    </div>
                                </form>
                                <div className={linha}>
                                    <span>Pasta</span>
                                    <span className="min-w-0 break-all text-xs text-discreto" title={projeto.caminho}>
                                        {projeto.caminho}
                                    </span>
                                </div>
                                <div className={linha}>
                                    <span>Ícone</span>
                                    <div className="flex items-center gap-3">
                                        <IconeProjeto projeto={projeto} tamanho={24} />
                                        <button
                                            className={botao}
                                            disabled={ocupado}
                                            aria-expanded={editandoIcone}
                                            aria-controls="editor-icone-projeto"
                                            onClick={() => definirEditandoIcone(!editandoIcone)}
                                        >
                                            Escolher ícone
                                        </button>
                                    </div>
                                </div>
                                {editandoIcone && (
                                    <div id="editor-icone-projeto" className="border-b border-borda px-4">
                                        <EscolherIconeProjeto
                                            key={`${projeto.id}:${projeto.icone?.tipo}`}
                                            projeto={projeto}
                                            ocupado={ocupado}
                                            salvar={(icone) =>
                                                executar(() => dados.ponte!.salvarIconeProjeto(projeto.id, icone))
                                            }
                                            importar={() =>
                                                executar(() => dados.ponte!.importarIconeProjeto(projeto.id))
                                            }
                                        />
                                    </div>
                                )}
                                <div className={linha}>
                                    <div>
                                        <span>Remover projeto</span>
                                        <p className="mt-1 mb-0 text-xs text-discreto">
                                            Preserva os arquivos e as conversas.
                                        </p>
                                    </div>
                                    <button
                                        className={`${botao} text-[#e9aaa7]`}
                                        disabled={ocupado}
                                        aria-label={`Remover projeto ${projeto.nome}`}
                                        onClick={() => void executar(() => dados.ponte!.removerProjeto(projeto.id))}
                                    >
                                        <TrashIcon size={15} /> Remover da lista
                                    </button>
                                </div>
                            </section>
                            <section data-ui="conversas-projeto" className="mt-8">
                                <h3 className="mb-3 text-xs font-medium text-secundario">
                                    Conversas <span className="ml-2 text-discreto">{conversas.length}</span>
                                </h3>
                                {conversas.length ? (
                                    conversas.map((conversa) => (
                                        <button
                                            data-ui="conversa-no-projeto"
                                            key={conversa.id}
                                            disabled={ocupado}
                                            className="flex w-full items-center gap-3 rounded-md p-3 text-left text-xs
                                            text-principal hover:enabled:bg-superficie"
                                            onClick={() => selecionarConversa(conversa.id)}
                                        >
                                            <ChatCircleIcon size={16} />
                                            <span className="min-w-0 flex-1 truncate">{conversa.titulo}</span>
                                            <small className="text-discreto">
                                                {possuiRascunho(conversa)
                                                    ? 'Rascunho'
                                                    : conversa.concluida
                                                      ? 'Concluída'
                                                      : ''}
                                            </small>
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-xs text-discreto">Nenhuma conversa neste projeto.</p>
                                )}
                            </section>
                        </div>
                    )}
                    {mensagem && (
                        <p className="rounded-md bg-[#33201f] p-3 text-xs text-[#f0b2ae]" role="alert">
                            {mensagem}
                        </p>
                    )}
                    {ocupado && (
                        <p className="text-xs text-secundario" role="status">
                            Salvando projeto
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
