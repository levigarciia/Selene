import { useState } from 'react';
import { ChatCircleIcon, FileTextIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { useSelene } from '../hooks/useSelene';
import type { ProjetoChat } from '../../shared/projetosChat';
import { possuiRascunho } from '../../shared/rascunhos';
import { IconeProjeto } from './IconeProjeto';
import { EscolherIconeProjeto } from './EscolherIconeProjeto';

const botao =
    'inline-flex items-center justify-center gap-2 rounded-md border border-borda ' +
    'bg-superficie px-3 py-2 text-xs hover:enabled:bg-hover';
const campo = 'w-full min-w-0 rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-principal';

/** Reúne instruções, referências e conversas de um espaço de Chat sem depender de pastas de código. */
export function TelaProjetoChat({
    dados,
    projeto,
    abrir,
    criarConversa,
    selecionar,
    fechar,
}: {
    dados: ReturnType<typeof useSelene>;
    projeto?: ProjetoChat;
    abrir: (id: string) => void;
    criarConversa: (id: string) => void;
    selecionar: (id: string) => void;
    fechar: () => void;
}) {
    const [ocupado, definirOcupado] = useState(false);
    const [erro, definirErro] = useState('');
    const [confirmando, definirConfirmando] = useState(false);
    const [editandoIcone, definirEditandoIcone] = useState(false);
    const emExecucao = dados.estado.conversas.some(
        (item) => item.projetoChatId === projeto?.id && item.id === dados.estado.conversaEmExecucao,
    );
    const bloqueado = ocupado || emExecucao;
    const conversas = dados.estado.conversas
        .filter(
            (item) =>
                item.modo === 'chat' &&
                item.projetoChatId === projeto?.id &&
                (item.mensagens.length || possuiRascunho(item)),
        )
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));

    async function executar(operacao: () => Promise<void>) {
        if (ocupado) return;
        definirOcupado(true);
        definirErro('');
        try {
            if (!dados.ponte) throw new Error('Projetos estão disponíveis no aplicativo desktop.');
            await operacao();
        } catch (erro) {
            definirErro(erro instanceof Error ? erro.message : 'Não foi possível atualizar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    async function conferir(operacao: ReturnType<NonNullable<typeof dados.ponte>['removerProjetoChat']>) {
        const resultado = await operacao;
        if (!resultado.ok) throw new Error(resultado.erro);
    }

    return (
        <div data-ui="tela-projeto-chat" className="min-h-0 flex-1 overflow-y-auto px-8 py-7 max-sm:p-4">
            <div className="mx-auto max-w-3xl">
                {!projeto ? (
                    <form
                        className="mx-auto max-w-md pt-12"
                        onSubmit={(evento) => {
                            evento.preventDefault();
                            const nome = new FormData(evento.currentTarget).get('nome')?.toString().trim();
                            if (!nome) return;
                            void executar(async () => {
                                const resultado = await dados.ponte!.criarProjetoChat(nome);
                                if (!resultado.ok) throw new Error(resultado.erro);
                                abrir(resultado.valor.id);
                            });
                        }}
                    >
                        <h2 className="mb-6 text-xl font-medium">Novo projeto de Chat</h2>
                        <label className="flex flex-col gap-2 text-xs text-secundario">
                            Nome do projeto
                            <input
                                className={campo}
                                name="nome"
                                autoFocus
                                required
                                maxLength={100}
                                disabled={ocupado}
                            />
                        </label>
                        <div className="mt-5 flex justify-end gap-2">
                            <button className={botao} type="button" disabled={ocupado} onClick={fechar}>
                                Cancelar
                            </button>
                            <button className={`${botao} bg-principal! text-fundo`} disabled={ocupado}>
                                Criar projeto
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <IconeProjeto projeto={projeto} tamanho={30} />
                                <h2 className="m-0 truncate text-xl font-medium">{projeto.nome}</h2>
                            </div>
                            <button className={botao} onClick={() => criarConversa(projeto.id)} disabled={ocupado}>
                                <PlusIcon size={16} /> Novo chat neste projeto
                            </button>
                        </header>
                        <details className="mb-5 rounded-lg border border-borda">
                            <summary className="cursor-pointer px-4 py-3 text-sm">Instruções e configurações</summary>
                            <form
                                className="flex flex-col gap-4 border-t border-borda p-4"
                                onSubmit={(evento) => {
                                    evento.preventDefault();
                                    const campos = new FormData(evento.currentTarget);
                                    void executar(() =>
                                        conferir(
                                            dados.ponte!.editarProjetoChat(projeto.id, {
                                                nome: campos.get('nome')!.toString().trim(),
                                                instrucao: campos.get('instrucao')!.toString(),
                                                memoria: campos.get('memoria') === 'on',
                                                icone: projeto.icone,
                                            }),
                                        ),
                                    );
                                }}
                            >
                                <label className="flex flex-col gap-2 text-xs text-secundario">
                                    Nome do projeto
                                    <input
                                        className={campo}
                                        name="nome"
                                        key={projeto.nome}
                                        defaultValue={projeto.nome}
                                        required
                                        maxLength={100}
                                        disabled={bloqueado}
                                    />
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-secundario">
                                    Instruções do projeto
                                    <textarea
                                        className={`${campo} min-h-32 resize-y`}
                                        name="instrucao"
                                        defaultValue={projeto.instrucao}
                                        maxLength={20000}
                                        disabled={bloqueado}
                                        placeholder="Como o modelo deve responder nas conversas deste projeto"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-secundario">
                                    <input
                                        type="checkbox"
                                        name="memoria"
                                        defaultChecked={projeto.memoria}
                                        disabled={bloqueado}
                                    />{' '}
                                    Usar contexto recente das outras conversas deste projeto
                                </label>
                                <button className={`${botao} self-end`} disabled={bloqueado}>
                                    Salvar configurações
                                </button>
                            </form>
                            <div className="border-t border-borda p-4">
                                <button
                                    className={botao}
                                    disabled={bloqueado}
                                    aria-expanded={editandoIcone}
                                    onClick={() => definirEditandoIcone(!editandoIcone)}
                                >
                                    Escolher ícone
                                </button>
                                {editandoIcone && (
                                    <EscolherIconeProjeto
                                        projeto={projeto}
                                        ocupado={bloqueado}
                                        salvar={(icone) =>
                                            executar(() =>
                                                conferir(
                                                    dados.ponte!.editarProjetoChat(projeto.id, {
                                                        nome: projeto.nome,
                                                        instrucao: projeto.instrucao,
                                                        memoria: projeto.memoria,
                                                        icone,
                                                    }),
                                                ),
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </details>
                        <section className="mb-7 rounded-lg border border-borda p-4" aria-label="Arquivos do projeto">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="m-0 text-sm font-medium">Arquivos de referência</h3>
                                <button
                                    className={botao}
                                    disabled={bloqueado || projeto.arquivos.length >= 10}
                                    onClick={() =>
                                        void executar(() =>
                                            conferir(dados.ponte!.importarArquivosProjetoChat(projeto.id)),
                                        )
                                    }
                                >
                                    <PlusIcon size={15} /> Adicionar arquivos
                                </button>
                            </div>
                            <p className="text-xs text-discreto">
                                TXT, Markdown, CSV ou JSON. Até 10 arquivos de texto.
                            </p>
                            {projeto.arquivos.map((arquivo) => (
                                <div key={arquivo.id} className="flex items-start gap-3 border-t border-borda py-3">
                                    <FileTextIcon size={18} className="mt-1 shrink-0 text-secundario" />
                                    <details className="min-w-0 flex-1">
                                        <summary className="cursor-pointer truncate text-xs">{arquivo.nome}</summary>
                                        <pre
                                            className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs
                                            text-secundario"
                                        >
                                            {arquivo.texto}
                                        </pre>
                                    </details>
                                    <button
                                        className="rounded p-1 text-secundario hover:bg-hover"
                                        disabled={bloqueado}
                                        aria-label={`Remover arquivo ${arquivo.nome}`}
                                        onClick={() =>
                                            void executar(() =>
                                                conferir(
                                                    dados.ponte!.removerArquivoProjetoChat(projeto.id, arquivo.id),
                                                ),
                                            )
                                        }
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                </div>
                            ))}
                        </section>
                        <section aria-label="Conversas do projeto">
                            <h3 className="text-xs font-medium text-secundario">Conversas</h3>
                            {conversas.length ? (
                                conversas.map((conversa) => (
                                    <button
                                        key={conversa.id}
                                        className="flex w-full items-center gap-3 rounded-md p-3
                                    text-left text-sm hover:bg-hover"
                                        onClick={() => selecionar(conversa.id)}
                                    >
                                        <ChatCircleIcon size={17} />
                                        <span className="min-w-0 flex-1 truncate">{conversa.titulo}</span>
                                        {possuiRascunho(conversa) && <small className="text-discreto">Rascunho</small>}
                                    </button>
                                ))
                            ) : (
                                <p className="py-6 text-center text-sm text-discreto">Comece um chat neste projeto.</p>
                            )}
                        </section>
                        <div className="mt-10 border-t border-borda pt-4">
                            {confirmando ? (
                                <div className="flex flex-wrap items-center gap-3 text-xs text-secundario">
                                    <span>As conversas voltarão ao histórico geral.</span>
                                    <button
                                        className={botao}
                                        disabled={bloqueado}
                                        onClick={() => definirConfirmando(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className={`${botao} text-[#e9aaa7]`}
                                        disabled={bloqueado}
                                        onClick={() =>
                                            void executar(async () => {
                                                await conferir(dados.ponte!.removerProjetoChat(projeto.id));
                                                fechar();
                                            })
                                        }
                                    >
                                        Confirmar remoção
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={`${botao} text-[#e9aaa7]`}
                                    disabled={bloqueado}
                                    onClick={() => definirConfirmando(true)}
                                >
                                    Remover projeto
                                </button>
                            )}
                        </div>
                    </>
                )}
                {erro && (
                    <p role="alert" className="mt-4 rounded-md bg-[#33201f] p-3 text-xs text-[#f0b2ae]">
                        {erro}
                    </p>
                )}
                {ocupado && (
                    <p role="status" className="mt-4 text-xs text-secundario">
                        Salvando projeto
                    </p>
                )}
            </div>
        </div>
    );
}
