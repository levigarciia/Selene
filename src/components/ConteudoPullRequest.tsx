import { lazy, Suspense, useState } from 'react';
import type { ArquivoPullRequest, DetalhesPullRequest } from '../../shared/detalhesPullRequest';

const Markdown = lazy(() => import('./TextoMarkdown'));
const nomesVerificacoes: Record<string, string> = {
    SUCCESS: 'Passou',
    FAILURE: 'Falhou',
    ERROR: 'Erro',
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em execução',
    QUEUED: 'Na fila',
    CANCELLED: 'Cancelada',
    SKIPPED: 'Dispensada',
    NEUTRAL: 'Neutra',
    TIMED_OUT: 'Tempo esgotado',
    ACTION_REQUIRED: 'Ação necessária',
    COMPLETED: 'Concluída',
    UNKNOWN: 'Não informado',
};

function Texto({ texto }: { texto: string }) {
    return (
        <div
            className="break-words text-[12px] leading-relaxed [&_p]:mb-3 [&_pre]:overflow-x-auto
        [&_pre]:rounded-md [&_pre]:bg-superficie [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4 [&_h1]:text-sm
        [&_h2]:text-sm [&_h3]:text-sm"
        >
            <Suspense fallback={<p className="text-discreto">Carregando texto...</p>}>
                <Markdown texto={texto} />
            </Suspense>
        </div>
    );
}

/** Resumo do PR com descrição, revisores, rótulos e resultados reais das verificações. */
export function ResumoPullRequest({ detalhes }: { detalhes: DetalhesPullRequest }) {
    const comentarios = detalhes.atividade.filter((item) => item.tipo === 'comentario');
    return (
        <div className="space-y-5 p-4 text-[12px]">
            <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-3">
                <dt className="text-discreto">Revisores</dt>
                <dd>{detalhes.revisores.join(', ') || 'Nenhum'}</dd>
                <dt className="text-discreto">Rótulos</dt>
                <dd>{detalhes.rotulos.join(', ') || 'Nenhum'}</dd>
            </dl>
            <details open>
                <summary className="mb-3 cursor-pointer text-discreto">Descrição</summary>
                {detalhes.descricao ? (
                    <Texto texto={detalhes.descricao} />
                ) : (
                    <p className="text-discreto">Sem descrição.</p>
                )}
            </details>
            <details>
                <summary className="cursor-pointer text-discreto">
                    Verificações ({detalhes.verificacoes.length})
                </summary>
                <div className="mt-3 space-y-2">
                    {!detalhes.verificacoes.length && <p className="text-discreto">Nenhuma verificação informada.</p>}
                    {detalhes.verificacoes.map((item, indice) => (
                        <div key={`${item.nome}:${indice}`} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate" title={item.nome}>
                                {item.nome}
                            </span>
                            <span className={item.estado === 'SUCCESS' ? 'text-sucesso' : 'text-discreto'}>
                                {nomesVerificacoes[item.estado] ?? item.estado}
                            </span>
                        </div>
                    ))}
                </div>
            </details>
            <details open>
                <summary className="cursor-pointer text-discreto">Comentários ({comentarios.length})</summary>
                <div className="mt-3 space-y-4">
                    {!comentarios.length && <p className="text-discreto">Nenhum comentário.</p>}
                    {comentarios.map((item) => (
                        <article key={item.id}>
                            <p className="mb-2 text-discreto">{item.autor ?? 'Autor removido'}</p>
                            <Texto texto={item.texto} />
                        </article>
                    ))}
                </div>
            </details>
        </div>
    );
}

/** Reúne comentários, revisões e commits em ordem temporal sem criar eventos inferidos. */
export function AtividadePullRequest({ detalhes }: { detalhes: DetalhesPullRequest }) {
    const nomes = { comentario: 'Comentário', revisao: 'Revisão', commit: 'Commit' };
    return (
        <div className="space-y-4 p-4 text-[12px]">
            {!detalhes.atividade.length && <p className="text-discreto">Nenhuma atividade disponível.</p>}
            {detalhes.atividade.map((item) => (
                <article key={`${item.tipo}:${item.id}`} className="border-l border-borda pl-3">
                    <p className="mb-1 text-discreto">
                        {nomes[item.tipo]}: {item.autor ?? 'Autor removido'}
                    </p>
                    <time className="mb-2 block text-[10px] text-discreto">
                        {new Date(item.criadoEm).toLocaleString('pt-BR')}
                    </time>
                    <Texto texto={item.texto} />
                </article>
            ))}
        </div>
    );
}

function ArquivoDiff({ arquivo }: { arquivo: ArquivoPullRequest }) {
    const [aberto, definirAberto] = useState(false);
    const linhas = aberto ? (arquivo.patch?.split('\n') ?? []) : [];
    return (
        <details className="border-b border-borda" onToggle={(evento) => definirAberto(evento.currentTarget.open)}>
            <summary className="cursor-pointer break-all px-3 py-3 text-[11px]">
                {arquivo.caminho}
                <span className="ml-2 whitespace-nowrap font-mono">
                    <span className="text-sucesso">+{arquivo.adicoes}</span>{' '}
                    <span className="text-[#f0b2ae]">−{arquivo.remocoes}</span>
                </span>
            </summary>
            {aberto &&
                (arquivo.patch ? (
                    <>
                        <pre className="overflow-x-auto pb-3 text-[10px] leading-5">
                            <code>
                                {linhas.slice(0, 2000).map((linha, indice) => (
                                    <span
                                        key={indice}
                                        className={[
                                            'block min-w-max px-3',
                                            linha.startsWith('+')
                                                ? 'bg-sucesso/10 text-sucesso'
                                                : linha.startsWith('-')
                                                  ? 'bg-[#f0b2ae]/10 text-[#f0b2ae]'
                                                  : linha.startsWith('@@')
                                                    ? 'bg-selecionado text-secundario'
                                                    : 'text-discreto',
                                        ].join(' ')}
                                    >
                                        {linha || ' '}
                                    </span>
                                ))}
                            </code>
                        </pre>
                        {linhas.length > 2000 && (
                            <p className="p-3 text-[11px] text-discreto">
                                Exibindo as primeiras 2000 linhas. Abra no GitHub para consultar o diff completo.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="px-3 pb-3 text-[11px] text-discreto">
                        O GitHub não disponibilizou um patch textual para este arquivo.
                    </p>
                ))}
        </details>
    );
}

/** Mostra alterações de cada arquivo e carrega o texto do patch somente quando ele é expandido. */
export function ArquivosPullRequest({ arquivos }: { arquivos: ArquivoPullRequest[] }) {
    if (!arquivos.length) return <p className="p-4 text-[12px] text-discreto">Nenhum arquivo alterado.</p>;
    return (
        <div>
            {arquivos.map((arquivo) => (
                <ArquivoDiff key={arquivo.caminho} arquivo={arquivo} />
            ))}
        </div>
    );
}
