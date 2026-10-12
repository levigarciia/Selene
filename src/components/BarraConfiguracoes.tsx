import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeftIcon, MagnifyingGlassIcon, MoonIcon, XIcon } from '@phosphor-icons/react';
import { CeuSidebar } from './BarraLateral';
import {
    buscarConfiguracoes,
    nomeSecao,
    secoesConfiguracoes,
    type ItemBusca,
    type SecaoConfiguracoes,
} from './secoesConfiguracoes';

/** Substitui a navegação principal enquanto as configurações estão abertas, como no T3 Code. */
export function BarraConfiguracoes({
    secao,
    selecionar,
    abrirItem,
    voltar,
    alertaMotor,
}: {
    secao: SecaoConfiguracoes;
    selecionar: (secao: SecaoConfiguracoes) => void;
    abrirItem: (item: ItemBusca) => void;
    voltar: () => void;
    alertaMotor: boolean;
}) {
    const campoBusca = useRef<HTMLInputElement>(null);
    const [consulta, definirConsulta] = useState('');
    const [indice, definirIndice] = useState(0);
    const resultados = buscarConfiguracoes(consulta);
    const buscando = consulta.trim().length > 0;

    useEffect(() => {
        const atalho = (evento: globalThis.KeyboardEvent) => {
            if (evento.key !== '/' || evento.metaKey || evento.ctrlKey || evento.altKey) return;
            const alvo = evento.target;
            if (
                alvo instanceof HTMLElement &&
                (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)
            )
                return;
            evento.preventDefault();
            campoBusca.current?.focus();
            campoBusca.current?.select();
        };
        window.addEventListener('keydown', atalho);
        return () => window.removeEventListener('keydown', atalho);
    }, []);

    const limpar = () => {
        definirConsulta('');
        definirIndice(0);
    };
    const escolher = (item: ItemBusca) => {
        limpar();
        abrirItem(item);
    };
    const teclas = (evento: KeyboardEvent<HTMLInputElement>) => {
        if (evento.key === 'Escape' && buscando) {
            evento.preventDefault();
            limpar();
            return;
        }
        if (!resultados.length) return;
        if (evento.key === 'ArrowDown') {
            evento.preventDefault();
            definirIndice((atual) => (atual + 1) % resultados.length);
        } else if (evento.key === 'ArrowUp') {
            evento.preventDefault();
            definirIndice((atual) => (atual - 1 + resultados.length) % resultados.length);
        } else if (evento.key === 'Enter') {
            evento.preventDefault();
            escolher(resultados[Math.min(indice, resultados.length - 1)]);
        }
    };

    const item = 'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] font-medium';
    return (
        <aside
            data-ui="sidebar sidebar-configuracoes"
            aria-label="Navegação das configurações"
            className="relative isolate flex min-h-0 flex-col border-r border-borda bg-sidebar px-2.5 pb-3"
        >
            <CeuSidebar />
            <div className="mx-2 mb-3 flex h-14 shrink-0 items-center gap-[11px] [-webkit-app-region:drag]">
                <MoonIcon size={21} weight="fill" className="text-white" />
                <span className="text-[17px] font-semibold tracking-[-0.4px] text-white">Selene</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                <label
                    className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-secundario
                        hover:bg-hover hover:text-principal focus-within:bg-hover"
                >
                    <MagnifyingGlassIcon size={16} className="shrink-0" />
                    <input
                        ref={campoBusca}
                        type="search"
                        value={consulta}
                        placeholder="Buscar"
                        aria-label="Buscar nas configurações"
                        role="combobox"
                        aria-expanded={buscando && resultados.length > 0}
                        aria-controls={buscando && resultados.length ? 'resultados-configuracoes' : undefined}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-principal outline-none
                            placeholder:text-secundario [&::-webkit-search-cancel-button]:hidden"
                        onChange={(evento) => {
                            definirConsulta(evento.target.value);
                            definirIndice(0);
                        }}
                        onKeyDown={teclas}
                    />
                    {buscando ? (
                        <button
                            type="button"
                            aria-label="Limpar busca"
                            className="rounded p-0.5 hover:bg-white/10"
                            onClick={() => {
                                limpar();
                                campoBusca.current?.focus();
                            }}
                        >
                            <XIcon size={12} />
                        </button>
                    ) : (
                        <kbd className="rounded border border-borda px-1.5 font-sans text-[11px] text-discreto">/</kbd>
                    )}
                </label>
                {buscando ? (
                    resultados.length ? (
                        <ul id="resultados-configuracoes" role="listbox" aria-label="Resultados da busca">
                            {resultados.map((resultado, posicao) => {
                                const Icone = secoesConfiguracoes.find((item) => item.id === resultado.secao)!.Icone;
                                return (
                                    <li key={resultado.id} role="presentation">
                                        <button
                                            role="option"
                                            aria-selected={posicao === indice}
                                            tabIndex={-1}
                                            className="flex min-h-10 w-full items-start gap-2.5 rounded-md px-2 py-1.5
                                                text-left aria-selected:bg-selecionado"
                                            onMouseMove={() => definirIndice(posicao)}
                                            onClick={() => escolher(resultado)}
                                        >
                                            <Icone size={14} className="mt-0.5 shrink-0 text-discreto" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] font-medium text-principal">
                                                    {resultado.titulo}
                                                </span>
                                                <span className="block truncate text-[11px] text-discreto">
                                                    {nomeSecao(resultado.secao)}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p role="status" className="px-2 py-6 text-center text-xs text-secundario">
                            Nenhuma configuração encontrada
                        </p>
                    )
                ) : (
                    <nav aria-label="Seções das configurações" className="flex flex-col gap-0.5">
                        {secoesConfiguracoes.map(({ id, nome, Icone }) => (
                            <button
                                key={id}
                                aria-current={secao === id ? 'page' : undefined}
                                onClick={() => selecionar(id)}
                                className={`${item} text-secundario hover:bg-hover hover:text-principal
                                    aria-[current=page]:bg-selecionado aria-[current=page]:text-principal`}
                            >
                                <Icone size={16} className="shrink-0" />
                                <span className="truncate">{nome}</span>
                                {id === 'provedores' && alertaMotor && (
                                    <span
                                        aria-label="Precisa de atenção"
                                        className="ml-auto size-1.5 rounded-full bg-[#eab1aa]"
                                    />
                                )}
                            </button>
                        ))}
                    </nav>
                )}
            </div>
            <button
                onClick={voltar}
                aria-label="Voltar à conversa"
                className={`${item} mt-2 shrink-0 text-secundario hover:bg-hover hover:text-principal`}
            >
                <ArrowLeftIcon size={16} className="shrink-0" />
                Voltar
            </button>
        </aside>
    );
}
