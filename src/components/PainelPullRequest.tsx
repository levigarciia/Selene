import { useEffect, useState } from 'react';
import { ArrowSquareOutIcon, ArrowsClockwiseIcon, GitMergeIcon, XIcon } from '@phosphor-icons/react';
import type { Conversa, PonteSelene } from '../../shared/contratos';
import {
    impedimentoMesclagem,
    type ArquivoPullRequest,
    type DetalhesPullRequest,
    type MetodoMesclagem,
} from '../../shared/detalhesPullRequest';
import { LinkPullRequest } from './PullRequestsConversa';
import { ResumoPullRequest, AtividadePullRequest, ArquivosPullRequest } from './ConteudoPullRequest';
import { MenuAcoesGitHub } from './MenuAcoesGitHub';

type Aba = 'resumo' | 'atividade' | 'codigo';
const abas: Record<Aba, string> = { resumo: 'Resumo', atividade: 'Atividade', codigo: 'Código' };
const estados = { aberto: 'Aberto', fechado: 'Fechado', mesclado: 'Mesclado' };
const classeIcone = 'rounded-md p-1 text-discreto hover:bg-hover hover:text-principal disabled:opacity-40';

/** Painel lateral do PR vinculado com dados reais, ações de conversa e mesclagem da revisão confirmada. */
export function PainelPullRequest({
    ponte,
    conversa,
    url,
    escolher,
    fechar,
    prepararMensagem,
}: {
    ponte: PonteSelene;
    conversa: Conversa;
    url: string;
    escolher: (url: string) => void;
    fechar: () => void;
    prepararMensagem: (texto: string) => void;
}) {
    const [aba, definirAba] = useState<Aba>('resumo');
    const [detalhes, definirDetalhes] = useState<DetalhesPullRequest | null>(null);
    const [arquivos, definirArquivos] = useState<ArquivoPullRequest[] | null>(null);
    const [carregando, definirCarregando] = useState(true);
    const [lendoArquivos, definirLendoArquivos] = useState(false);
    const [erro, definirErro] = useState('');
    const [erroArquivos, definirErroArquivos] = useState('');
    const [versao, definirVersao] = useState(0);
    const [confirmando, definirConfirmando] = useState(false);
    const [mesclando, definirMesclando] = useState(false);
    const [metodo, definirMetodo] = useState<MetodoMesclagem>('merge');
    const [aviso, definirAviso] = useState('');
    const vinculado = conversa.pullRequests?.find((pr) => pr.url === url);

    useEffect(() => {
        let ativo = true;
        definirCarregando(true);
        definirErro('');
        definirConfirmando(false);
        void ponte
            .detalhesPullRequest(conversa.id, url)
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirDetalhes(resultado.valor);
                else definirErro(resultado.erro);
            })
            .catch(() => ativo && definirErro('Não foi possível consultar o PR.'))
            .finally(() => {
                if (ativo) definirCarregando(false);
            });
        return () => {
            ativo = false;
        };
    }, [conversa.id, url, ponte, versao]);

    useEffect(() => {
        if (aba !== 'codigo') return;
        let ativo = true;
        definirArquivos(null);
        definirLendoArquivos(true);
        definirErroArquivos('');
        void ponte
            .arquivosPullRequest(conversa.id, url)
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirArquivos(resultado.valor);
                else definirErroArquivos(resultado.erro);
            })
            .catch(() => ativo && definirErroArquivos('Não foi possível consultar os arquivos.'))
            .finally(() => {
                if (ativo) definirLendoArquivos(false);
            });
        return () => {
            ativo = false;
        };
    }, [aba, conversa.id, url, ponte, detalhes?.sha, versao]);

    useEffect(() => {
        const sair = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape' && !document.querySelector('[role="menu"]') && !mesclando) fechar();
        };
        window.addEventListener('keydown', sair);
        return () => window.removeEventListener('keydown', sair);
    }, [fechar, mesclando]);

    async function removerVinculo() {
        try {
            const resultado = await ponte.desvincularPullRequest(conversa.id, url);
            if (resultado.ok) fechar();
            else definirErro(resultado.erro);
        } catch {
            definirErro('Não foi possível remover o vínculo.');
        }
    }

    async function mesclar() {
        if (!detalhes || !confirmando) return;
        definirMesclando(true);
        definirErro('');
        try {
            const resultado = await ponte.mesclarPullRequest(conversa.id, url, detalhes.sha, metodo);
            if (!resultado.ok) {
                definirErro(resultado.erro);
                return;
            }
            definirDetalhes(resultado.valor);
            definirConfirmando(false);
            definirAviso(
                resultado.valor.pr.estado === 'mesclado'
                    ? 'PR mesclado.'
                    : 'Solicitação de mesclagem registrada no GitHub.',
            );
        } catch {
            definirErro(
                'Não foi possível concluir a solicitação de mesclagem. Atualize o PR para conferir seu estado.',
            );
        } finally {
            definirMesclando(false);
        }
    }

    const pr = detalhes?.pr ?? vinculado;
    const impedimento = detalhes ? impedimentoMesclagem(detalhes) : 'Aguarde a consulta do PR.';
    const preparar = (pedido: string) => prepararMensagem(`${pedido}\n\n${url}`);
    const copiar = (texto: string) =>
        void navigator.clipboard
            .writeText(texto)
            .catch(() => definirErro('Não foi possível copiar para a área de transferência.'));

    return (
        <aside
            aria-label="Painel do pull request"
            className="absolute inset-y-0 right-0 z-20 flex w-full min-w-0
            flex-col border-l border-borda bg-fundo min-[1000px]:static min-[1000px]:w-[400px] min-[1000px]:shrink-0"
        >
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-borda px-3">
                <div className="flex min-w-0 gap-1 overflow-x-auto">
                    {conversa.pullRequests?.map((item) => (
                        <span key={item.url} className={item.url === url ? 'rounded-md bg-selecionado' : ''}>
                            <LinkPullRequest pr={item} abrir={escolher} />
                        </span>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        aria-label="Atualizar PR"
                        className={classeIcone}
                        disabled={carregando || mesclando}
                        onClick={() => definirVersao((valor) => valor + 1)}
                    >
                        <ArrowsClockwiseIcon size={15} />
                    </button>
                    <button
                        aria-label="Fechar painel do PR"
                        className={classeIcone}
                        disabled={mesclando}
                        onClick={fechar}
                    >
                        <XIcon size={16} />
                    </button>
                </div>
            </div>
            <div className="space-y-2 border-b border-borda p-3">
                <div className="flex items-center justify-between gap-2">
                    <button
                        className="flex min-w-0 items-center gap-1 text-[11px] text-secundario hover:text-principal"
                        onClick={() => void ponte.abrirGitHub(url)}
                        title="Abrir no GitHub"
                        aria-label="Abrir PR no GitHub"
                    >
                        <span className="truncate">
                            {pr?.repositorio} #{pr?.numero}
                        </span>
                        <ArrowSquareOutIcon size={12} />
                    </button>
                    {detalhes && pr?.estado === 'aberto' ? (
                        <button
                            title={impedimento ?? 'Mesclar este PR'}
                            disabled={!!impedimento || mesclando || carregando}
                            className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-[#3268d9] px-2 py-1
                                text-[10px] text-white hover:bg-[#4477e0] disabled:opacity-40"
                            onClick={() => definirConfirmando(true)}
                        >
                            <GitMergeIcon size={12} />
                            Mesclar
                        </button>
                    ) : (
                        <span className="ml-auto shrink-0 text-[10px] text-secundario">
                            {pr?.estado ? estados[pr.estado] : ''}
                        </span>
                    )}
                    <MenuAcoesGitHub
                        rotulo="Ações do PR"
                        acoes={[
                            {
                                nome: 'Desvincular da conversa',
                                executar: () => void removerVinculo(),
                                desativada: mesclando,
                            },
                            {
                                nome: 'Atualizar',
                                executar: () => definirVersao((valor) => valor + 1),
                                desativada: carregando,
                            },
                            {
                                nome: 'Fazer uma pergunta',
                                executar: () => preparar('Quero tirar uma dúvida sobre este PR:'),
                            },
                            {
                                nome: 'Explicar este PR',
                                executar: () =>
                                    preparar(
                                        'Explique este PR, percorra o diff e destaque ' +
                                            'o que merece uma revisão mais cuidadosa.',
                                    ),
                            },
                            {
                                nome: 'Corrigir problemas nesta conversa',
                                executar: () =>
                                    preparar(
                                        'Investigue os problemas encontrados na revisão e nas verificações deste PR. ' +
                                            'Implemente as correções necessárias e valide o resultado.',
                                    ),
                            },
                            { nome: 'Abrir no GitHub', executar: () => void ponte.abrirGitHub(url) },
                            { nome: 'Copiar link', executar: () => copiar(url) },
                            { nome: 'Copiar número do PR', executar: () => copiar(`#${pr?.numero}`) },
                        ]}
                    />
                </div>
                <h2 className="text-[14px] font-semibold leading-snug">{pr?.titulo ?? 'Carregando PR...'}</h2>
                <div className="flex items-center justify-between gap-3 text-[11px] text-discreto">
                    <span className="flex min-w-0 items-center gap-1.5">
                        {detalhes?.autor && (
                            <img
                                alt=""
                                className="size-4 rounded-full"
                                src={`https://github.com/${encodeURIComponent(detalhes.autor)}.png?size=32`}
                            />
                        )}
                        {detalhes?.autor ?? 'Autor não informado'}
                    </span>
                    {detalhes && (
                        <time className="text-[10px]" title={detalhes.alteradoEm}>
                            {new Date(detalhes.alteradoEm).toLocaleDateString('pt-BR')}
                        </time>
                    )}
                </div>
                {detalhes && (
                    <>
                        <div className="flex items-center justify-between gap-3 text-[10px]">
                            <p
                                className="min-w-0 truncate font-mono text-discreto"
                                title={`${detalhes.base} ← ${pr?.branch}`}
                            >
                                {detalhes.base} ← {pr?.branch}
                            </p>
                            <span className="shrink-0 font-mono">
                                <span className="mr-2 text-discreto">{detalhes.arquivosAlterados} arquivos</span>
                                <span className="text-sucesso">+{detalhes.adicoes}</span>{' '}
                                <span className="text-[#f0b2ae]">−{detalhes.remocoes}</span>
                            </span>
                        </div>
                        {confirmando && (
                            <div className="space-y-2 rounded-md border border-borda bg-superficie p-3">
                                <p className="text-[11px]">
                                    Mesclar #{pr?.numero} em {detalhes.base}?
                                </p>
                                <select
                                    aria-label="Método de mesclagem"
                                    className="w-full rounded-md bg-fundo p-1.5 text-[11px]"
                                    value={metodo}
                                    disabled={mesclando}
                                    onChange={(evento) => definirMetodo(evento.target.value as MetodoMesclagem)}
                                >
                                    <option value="merge">Commit de mesclagem</option>
                                    <option value="squash">Squash</option>
                                    <option value="rebase">Rebase</option>
                                </select>
                                <div className="flex gap-2 text-[11px]">
                                    <button
                                        disabled={mesclando}
                                        className="rounded-md bg-[#3268d9] px-2 py-1 text-white"
                                        onClick={() => void mesclar()}
                                    >
                                        {mesclando ? 'Mesclando...' : 'Confirmar mesclagem'}
                                    </button>
                                    <button disabled={mesclando} onClick={() => definirConfirmando(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div role="tablist" aria-label="Conteúdo do PR" className="flex gap-1 border-b border-borda px-3 py-2">
                {(Object.keys(abas) as Aba[]).map((item) => (
                    <button
                        key={item}
                        role="tab"
                        aria-selected={aba === item}
                        onClick={() => definirAba(item)}
                        className="rounded-md px-3 py-1 text-[11px] text-discreto hover:text-principal
                            aria-selected:bg-selecionado aria-selected:text-principal"
                    >
                        {abas[item]}
                    </button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                {erro && (
                    <p role="alert" className="p-4 text-[12px] text-[#f0b2ae]">
                        {erro}
                    </p>
                )}
                {aviso && (
                    <p role="status" className="px-4 pt-3 text-[12px] text-sucesso">
                        {aviso}
                    </p>
                )}
                {carregando && !detalhes ? (
                    <p role="status" className="p-4 text-[12px] text-discreto">
                        Consultando PR...
                    </p>
                ) : detalhes && aba === 'resumo' ? (
                    <ResumoPullRequest detalhes={detalhes} />
                ) : detalhes && aba === 'atividade' ? (
                    <AtividadePullRequest detalhes={detalhes} />
                ) : aba === 'codigo' ? (
                    <>
                        {erroArquivos && (
                            <p role="alert" className="p-4 text-[12px] text-[#f0b2ae]">
                                {erroArquivos}
                            </p>
                        )}
                        {lendoArquivos ? (
                            <p role="status" className="p-4 text-[12px] text-discreto">
                                Carregando arquivos...
                            </p>
                        ) : (
                            arquivos && <ArquivosPullRequest arquivos={arquivos} />
                        )}
                    </>
                ) : null}
            </div>
        </aside>
    );
}
