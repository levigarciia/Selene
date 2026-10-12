import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownUpIcon, CheckIcon, ListFilterIcon, SearchIcon, XIcon } from 'lucide-react';
import type { EnvolvimentoGitHub, EstadoFiltroGitHub, TipoItemGitHub } from '../../shared/repositorio';
import type { OrdemGitHub } from './listaGitHub';

export interface Opcao<T extends string> {
    valor: T;
    nome: string;
    indisponivel?: string;
}

const classeBaseBarra = [
    'inline-flex h-8 shrink-0 items-center rounded-md border border-borda bg-superficie',
    'text-[12px] font-medium text-principal hover:bg-hover aria-expanded:bg-hover disabled:opacity-60',
].join(' ');
const classeBotaoBarra = `${classeBaseBarra} gap-1.5 px-2.5`;
export const classeBotaoIconeBarra = `${classeBaseBarra} w-8 justify-center`;

/** Botão da barra que abre uma lista de opções ancorada abaixo dele. */
function MenuSuspenso({
    rotulo,
    icone,
    contagem,
    children,
}: {
    rotulo: string;
    icone: ReactNode;
    contagem?: number;
    children: (fechar: () => void) => ReactNode;
}) {
    const [aberto, definirAberto] = useState(false);
    const raiz = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!aberto) return;
        const fora = (evento: MouseEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) definirAberto(false);
        };
        const sair = (evento: KeyboardEvent) => evento.key === 'Escape' && definirAberto(false);
        window.addEventListener('mousedown', fora);
        window.addEventListener('keydown', sair);
        return () => {
            window.removeEventListener('mousedown', fora);
            window.removeEventListener('keydown', sair);
        };
    }, [aberto]);
    return (
        <div ref={raiz} className="relative">
            <button
                className={classeBotaoBarra}
                aria-haspopup="menu"
                aria-expanded={aberto}
                onClick={() => definirAberto((anterior) => !anterior)}
            >
                {icone}
                {rotulo}
                {!!contagem && (
                    <span className="rounded-full bg-selecionado px-1.5 text-[11px] tabular-nums text-discreto">
                        {contagem}
                    </span>
                )}
            </button>
            {aberto && (
                <div
                    role="menu"
                    aria-label={rotulo}
                    className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-[min(460px,calc(100dvh-120px))] w-56
                        overflow-y-auto rounded-[10px] border border-borda bg-[#111] p-1 shadow-[0_12px_36px_#0008]"
                >
                    {children(() => definirAberto(false))}
                </div>
            )}
        </div>
    );
}

function GrupoOpcoes<T extends string>({
    titulo,
    opcoes,
    valor,
    escolher,
}: {
    titulo: string;
    opcoes: Opcao<T>[];
    valor: T;
    escolher: (valor: T) => void;
}) {
    return (
        <div role="group" aria-label={titulo} className="py-0.5">
            <p className="m-0 px-2 pb-0.5 pt-1.5 text-[11px] font-medium text-discreto">{titulo}</p>
            {opcoes.map((opcao) => (
                <button
                    key={opcao.valor}
                    role="menuitemradio"
                    aria-checked={opcao.valor === valor}
                    title={opcao.indisponivel}
                    onClick={() => escolher(opcao.valor)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]
                        text-principal hover:bg-hover"
                >
                    <span className="min-w-0 flex-1 truncate">{opcao.nome}</span>
                    {opcao.indisponivel && <span className="shrink-0 text-[11px] text-discreto">indisponível</span>}
                    {opcao.valor === valor && <CheckIcon className="size-3.5 shrink-0 text-secundario" />}
                </button>
            ))}
        </div>
    );
}

export function BuscaGitHub({
    valor,
    alterar,
    tipo,
}: {
    valor: string;
    alterar: (valor: string) => void;
    tipo: TipoItemGitHub;
}) {
    return (
        <label
            className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-md border border-borda bg-superficie
                px-2.5 focus-within:border-discreto"
        >
            <SearchIcon className="size-4 shrink-0 text-discreto" />
            <input
                aria-label="Buscar"
                placeholder={`Buscar ${tipo === 'pr' ? 'pull requests' : 'issues'}, ou label:bug`}
                value={valor}
                onChange={(evento) => alterar(evento.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-discreto"
            />
            {valor && (
                <button aria-label="Limpar busca" onClick={() => alterar('')} className="text-discreto hover:text-principal">
                    <XIcon className="size-3.5" />
                </button>
            )}
        </label>
    );
}

export function MenuOrdemGitHub({
    ordem,
    tipo,
    escolher,
}: {
    ordem: OrdemGitHub;
    tipo: TipoItemGitHub;
    escolher: (ordem: OrdemGitHub) => void;
}) {
    const opcoes: Opcao<OrdemGitHub>[] = [
        { valor: 'atualizado', nome: 'Atualizados recentemente' },
        { valor: 'recente', nome: 'Mais novos' },
        { valor: 'antigo', nome: 'Mais antigos' },
        ...(tipo === 'pr'
            ? ([
                  { valor: 'maior', nome: 'Maiores' },
                  { valor: 'menor', nome: 'Menores' },
              ] as const)
            : []),
    ];
    return (
        <MenuSuspenso rotulo="Ordenar" icone={<ArrowDownUpIcon className="size-4" />}>
            {(fechar) => (
                <GrupoOpcoes
                    titulo="Ordenar por"
                    opcoes={opcoes}
                    valor={ordem}
                    escolher={(valor) => {
                        escolher(valor);
                        fechar();
                    }}
                />
            )}
        </MenuSuspenso>
    );
}

export function MenuFiltrosGitHub({
    tipo,
    estado,
    envolvimento,
    projetoId,
    projetos,
    escolherEstado,
    escolherEnvolvimento,
    escolherProjeto,
}: {
    tipo: TipoItemGitHub;
    estado: EstadoFiltroGitHub;
    envolvimento: EnvolvimentoGitHub;
    projetoId: string | null;
    projetos: Opcao<string>[];
    escolherEstado: (estado: EstadoFiltroGitHub) => void;
    escolherEnvolvimento: (envolvimento: EnvolvimentoGitHub) => void;
    escolherProjeto: (projetoId: string | null) => void;
}) {
    const estados: Opcao<EstadoFiltroGitHub>[] = [
        { valor: 'open', nome: 'Abertos' },
        { valor: 'closed', nome: 'Fechados' },
        ...(tipo === 'pr' ? [{ valor: 'merged' as const, nome: 'Mesclados' }] : []),
        { valor: 'all', nome: 'Todos' },
    ];
    const envolvimentos: Opcao<EnvolvimentoGitHub>[] = [
        { valor: 'todos', nome: 'Todos' },
        { valor: 'autor', nome: 'Criados por mim' },
        { valor: 'atribuido', nome: 'Atribuídos a mim' },
        ...(tipo === 'pr' ? [{ valor: 'revisao' as const, nome: 'Revisão solicitada' }] : []),
    ];
    const contagem = [estado !== 'open', envolvimento !== 'todos', projetoId !== null].filter(Boolean).length;
    return (
        <MenuSuspenso rotulo="Filtros" icone={<ListFilterIcon className="size-4" />} contagem={contagem}>
            {() => (
                <>
                    <GrupoOpcoes titulo="Estado" opcoes={estados} valor={estado} escolher={escolherEstado} />
                    <div className="my-1 h-px bg-borda" />
                    <GrupoOpcoes
                        titulo="Envolvimento"
                        opcoes={envolvimentos}
                        valor={envolvimento}
                        escolher={escolherEnvolvimento}
                    />
                    <div className="my-1 h-px bg-borda" />
                    <GrupoOpcoes
                        titulo="Projeto"
                        opcoes={[{ valor: '', nome: 'Todos os projetos' }, ...projetos]}
                        valor={projetoId ?? ''}
                        escolher={(valor) => escolherProjeto(valor || null)}
                    />
                </>
            )}
        </MenuSuspenso>
    );
}
