import type { ReactNode } from 'react';
import {
    CircleCheckIcon,
    CircleDotIcon,
    FolderGit2Icon,
    GitMergeIcon,
    GitPullRequestArrowIcon,
    GitPullRequestClosedIcon,
    GitPullRequestDraftIcon,
    RefreshCwIcon,
    SearchIcon,
} from 'lucide-react';
import type { ItemGitHub } from '../../shared/repositorio';
import type { GrupoGitHub } from './listaGitHub';
import { tempoRelativo } from './listaGitHub';

const tons: Record<ItemGitHub['estado'], string> = {
    aberto: 'text-sucesso',
    rascunho: 'text-discreto',
    fechado: 'text-[#f87171]',
    mesclado: 'text-[#b5a2dc]',
};

function GlifoItem({ item, issue }: { item: ItemGitHub; issue: boolean }) {
    const classe = `size-4 shrink-0 ${issue && item.estado === 'fechado' ? 'text-[#b5a2dc]' : tons[item.estado]}`;
    if (issue) return item.estado === 'aberto' ? <CircleDotIcon className={classe} /> : <CircleCheckIcon className={classe} />;
    if (item.estado === 'mesclado') return <GitMergeIcon className={classe} />;
    if (item.estado === 'rascunho') return <GitPullRequestDraftIcon className={classe} />;
    if (item.estado === 'fechado') return <GitPullRequestClosedIcon className={classe} />;
    return <GitPullRequestArrowIcon className={classe} />;
}

function Autor({ login }: { login: string | null }) {
    const nome = login ?? 'ghost';
    return (
        <span className="inline-flex min-w-0 items-center gap-1">
            <img
                alt=""
                loading="lazy"
                src={`https://github.com/${encodeURIComponent(nome)}.png?size=32`}
                className="size-3.5 shrink-0 rounded-full bg-selecionado"
            />
            <span className="truncate">{nome}</span>
        </span>
    );
}

function Rotulo({ nome, cor }: { nome: string; cor: string }) {
    return (
        <span className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-full border border-borda px-1.5">
            <svg aria-hidden viewBox="0 0 8 8" className="size-2 shrink-0">
                <circle cx="4" cy="4" r="4" fill={/^[0-9a-f]{6}$/i.test(cor) ? `#${cor}` : 'currentColor'} />
            </svg>
            <span className="truncate">{nome}</span>
        </span>
    );
}

/** Uma linha da lista: glifo de estado, número e título, e abaixo autor, rótulos e tempo. */
export function LinhaItemGitHub({ item, issue, abrir }: { item: ItemGitHub; issue: boolean; abrir: () => void }) {
    return (
        <li>
            <button
                onClick={abrir}
                title={`Abrir #${item.numero} no GitHub`}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-hover
                    focus-visible:bg-hover focus-visible:outline-none"
            >
                <GlifoItem item={item} issue={issue} />
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 font-mono text-[12px] tabular-nums text-discreto">
                            #{item.numero}
                        </span>
                        <span className="min-w-0 truncate text-[13px] text-principal">{item.titulo}</span>
                        {item.adicoes !== undefined && (
                            <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums">
                                <span className="text-sucesso">+{item.adicoes.toLocaleString('pt-BR')}</span>{' '}
                                <span className="text-[#f87171]">-{(item.remocoes ?? 0).toLocaleString('pt-BR')}</span>
                            </span>
                        )}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-discreto">
                        <Autor login={item.autor} />
                        {item.rotulos.slice(0, 4).map((rotulo) => (
                            <Rotulo key={rotulo.nome} nome={rotulo.nome} cor={rotulo.cor} />
                        ))}
                        <span className="ml-auto shrink-0 whitespace-nowrap tabular-nums">
                            {tempoRelativo(item.atualizadoEm)}
                        </span>
                    </span>
                </span>
            </button>
        </li>
    );
}

export function CabecalhoGrupoGitHub({ grupo }: { grupo: GrupoGitHub }) {
    return (
        <div className="flex items-center gap-2 px-3 pb-1 text-[12px] font-medium text-discreto">
            <FolderGit2Icon aria-hidden className="size-3.5 shrink-0" />
            <h2 className="m-0 shrink-0 text-[12px] font-medium">{grupo.repositorio}</h2>
            <span className="shrink-0 tabular-nums opacity-70">{grupo.itens.length}</span>
            <span className="h-px min-w-2 flex-1 bg-borda" />
        </div>
    );
}

const largurasTitulo = ['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5', 'w-1/2'];
const largurasMeta = ['w-2/5', 'w-1/3', 'w-2/5', 'w-1/4', 'w-1/3', 'w-2/5', 'w-1/3'];

function Barra({ classe }: { classe: string }) {
    return <span aria-hidden className={`block rounded bg-discreto/15 ${classe}`} />;
}

/** Linhas fantasmas na geometria da lista, enquanto o GitHub responde. */
export function EsqueletoListaGitHub({ legenda }: { legenda?: string }) {
    return (
        <div role="status" aria-label={legenda ?? 'Carregando'} className="motion-safe:animate-pulse">
            {legenda && <p className="m-0 px-3 pb-1 text-[12px] font-medium text-discreto">{legenda}</p>}
            {Array.from({ length: 7 }, (_, indice) => (
                <div key={indice} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
                    <Barra classe="size-4 rounded-full" />
                    <span className="flex min-w-0 flex-col gap-1.5">
                        <Barra classe={`h-4 ${largurasTitulo[indice]}`} />
                        <Barra classe={`h-3 ${largurasMeta[indice]}`} />
                    </span>
                    <Barra classe="h-3 w-12" />
                </div>
            ))}
        </div>
    );
}

function MarcaBranch() {
    return (
        <svg
            aria-hidden
            viewBox="0 0 120 72"
            className="h-20 w-32 text-discreto/60"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10 58h100" className="text-discreto/30" />
            <circle cx="10" cy="58" r="5" fill="currentColor" fillOpacity={0.25} />
            <circle cx="110" cy="58" r="5" fill="currentColor" fillOpacity={0.25} />
            <path d="M30 58c0-18 8-26 24-26h4" />
            <path d="M90 58c0-18-8-26-24-26h-4" strokeDasharray="2 7" className="text-discreto/50" />
            <circle cx="60" cy="32" r="4" className="text-discreto/45" />
        </svg>
    );
}

function BotaoContorno({ children, ...props }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            {...props}
            className="inline-flex items-center gap-1.5 rounded-md border border-borda px-2.5 py-1 text-[12px]
                font-medium text-secundario hover:bg-hover hover:text-principal disabled:opacity-60"
        >
            {children}
        </button>
    );
}

/** O que a lista mostra sem linhas, dizendo qual filtro ou busca deixou a lista vazia. */
export function VazioGitHub({
    busca,
    filtrado,
    issue,
    semProjetos,
    atualizando,
    limparBusca,
    atualizar,
}: {
    busca: string;
    filtrado: boolean;
    issue: boolean;
    semProjetos: boolean;
    atualizando: boolean;
    limparBusca: () => void;
    atualizar: () => void;
}) {
    const nome = issue ? 'issues' : 'pull requests';
    const buscaCurta = busca.length > 48 ? `${busca.slice(0, 48)}...` : busca;
    const [titulo, descricao] = semProjetos
        ? ['Nenhum projeto Code', `Adicione um projeto, e os ${nome} do repositório aparecem aqui.`]
        : busca
          ? [`Nada corresponde a “${buscaCurta}”`, 'Tente menos palavras, ou busque por número, autor ou label:bug.']
          : filtrado
            ? ['Nada com esses filtros', 'Amplie o estado, o envolvimento ou o projeto para ver mais.']
            : [`Nenhum ${issue ? 'issue' : 'pull request'}`, `Os ${nome} de todos os projetos aparecem aqui.`];
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <MarcaBranch />
            <div>
                <h2 className="m-0 text-[15px] font-semibold text-principal">{titulo}</h2>
                <p className="m-0 mt-1 text-[12px] text-discreto">{descricao}</p>
            </div>
            {!semProjetos && (
                <div className="flex flex-wrap justify-center gap-2">
                    {busca && (
                        <BotaoContorno onClick={limparBusca}>
                            <SearchIcon className="size-3.5" />
                            Limpar busca
                        </BotaoContorno>
                    )}
                    <BotaoContorno onClick={atualizar} disabled={atualizando}>
                        <RefreshCwIcon className={`size-3.5 ${atualizando ? 'motion-safe:animate-spin' : ''}`} />
                        {atualizando ? 'Verificando...' : 'Verificar de novo'}
                    </BotaoContorno>
                </div>
            )}
        </div>
    );
}
