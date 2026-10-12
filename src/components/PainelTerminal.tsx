import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { PlusIcon, TerminalIcon, TrashIcon } from '@phosphor-icons/react';
import type { PonteSelene } from '../../shared/contratos';
import { SuperficieTerminal } from './SuperficieTerminal';

interface AbasProjeto {
    ids: string[];
    ativo: string | null;
}

/** Pedido para abrir um terminal novo, opcionalmente já executando um comando. */
export interface PedidoTerminal {
    chave: number;
    projetoId: string;
    comando?: string;
}

const DIMENSOES_INICIAIS = { colunas: 120, linhas: 24 };
const ALTURA_MINIMA = 120;

function lerAltura(): number {
    const salva = Number(localStorage.getItem('selene.alturaTerminal'));
    return Number.isFinite(salva) && salva >= ALTURA_MINIMA ? salva : 280;
}

/** Painel inferior do modo Code com os terminais de cada projeto, mantidos vivos ao trocar de projeto. */
export function PainelTerminal({
    ponte,
    projetoId,
    aberto,
    pedido,
    fechar,
    definirErro,
}: {
    ponte: PonteSelene;
    projetoId: string | null;
    aberto: boolean;
    pedido: PedidoTerminal | null;
    fechar: () => void;
    definirErro: (erro: string) => void;
}) {
    const [abas, definirAbas] = useState<Record<string, AbasProjeto>>({});
    const [altura, definirAltura] = useState(lerAltura);
    const painel = useRef<HTMLElement>(null);
    const criando = useRef(new Set<string>());

    useEffect(() => {
        painel.current?.style.setProperty('--altura-terminal', `${altura}px`);
    }, [altura]);
    const pedidosAtendidos = useRef(new Set<number>());
    const atuais = projetoId ? abas[projetoId] : undefined;

    async function criar(projeto: string, comando?: string) {
        const resultado = await ponte.abrirTerminal(projeto, DIMENSOES_INICIAIS, comando);
        criando.current.delete(projeto);
        if (!resultado.ok) {
            definirErro(resultado.erro);
            return;
        }
        definirAbas((anteriores) => {
            const atual = anteriores[projeto] ?? { ids: [], ativo: null };
            return { ...anteriores, [projeto]: { ids: [...atual.ids, resultado.valor], ativo: resultado.valor } };
        });
    }

    function remover(id: string) {
        definirAbas((anteriores) => {
            const proximas: Record<string, AbasProjeto> = {};
            for (const [projeto, atual] of Object.entries(anteriores)) {
                const ids = atual.ids.filter((item) => item !== id);
                proximas[projeto] = { ids, ativo: atual.ativo === id ? (ids.at(-1) ?? null) : atual.ativo };
            }
            return proximas;
        });
    }

    useEffect(
        () =>
            ponte.aoEvento((evento) => {
                if (evento.tipo === 'terminalFim') remover(evento.id);
            }),
        [ponte],
    );

    useEffect(() => {
        if (!aberto || !projetoId || atuais?.ids.length || criando.current.has(projetoId)) return;
        if (pedido && !pedidosAtendidos.current.has(pedido.chave)) return;
        criando.current.add(projetoId);
        void criar(projetoId);
    }, [aberto, projetoId, atuais?.ids.length, pedido]);

    useEffect(() => {
        if (!pedido || pedidosAtendidos.current.has(pedido.chave)) return;
        pedidosAtendidos.current.add(pedido.chave);
        criando.current.add(pedido.projetoId);
        void criar(pedido.projetoId, pedido.comando);
    }, [pedido]);

    function redimensionar(evento: PointerEvent<HTMLDivElement>) {
        const inicio = evento.clientY;
        const alturaInicial = altura;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        const mover = (movimento: globalThis.PointerEvent) => {
            const maxima = window.innerHeight - 200;
            definirAltura(Math.min(maxima, Math.max(ALTURA_MINIMA, alturaInicial + inicio - movimento.clientY)));
        };
        const soltar = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', soltar);
            definirAltura((final) => {
                localStorage.setItem('selene.alturaTerminal', String(final));
                return final;
            });
        };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
    }

    async function fecharAtivo() {
        if (!atuais?.ativo) return;
        const id = atuais.ativo;
        remover(id);
        await ponte.fecharTerminal(id);
        if (atuais.ids.length <= 1) fechar();
    }

    const todas = Object.entries(abas).flatMap(([projeto, atual]) => atual.ids.map((id) => ({ projeto, id })));

    return (
        <section
            aria-label="Terminal"
            ref={painel}
            hidden={!aberto || !projetoId}
            className="relative flex h-(--altura-terminal) shrink-0 border-t border-borda bg-fundo [&[hidden]]:hidden"
        >
            <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Redimensionar terminal"
                onPointerDown={redimensionar}
                className="absolute inset-x-0 -top-[3px] z-10 h-[6px] cursor-row-resize"
            />
            <div className="relative min-w-0 flex-1 py-1 pl-2">
                {todas.map(({ projeto, id }) => (
                    <div
                        key={id}
                        hidden={projeto !== projetoId || abas[projeto]?.ativo !== id}
                        className="absolute inset-0 py-1 pl-2 [&[hidden]]:hidden"
                    >
                        <SuperficieTerminal
                            ponte={ponte}
                            id={id}
                            visivel={aberto && projeto === projetoId && abas[projeto]?.ativo === id}
                            focar={aberto}
                        />
                    </div>
                ))}
            </div>
            <div className="flex w-[148px] shrink-0 flex-col border-l border-borda">
                <div className="flex justify-end gap-1 p-1">
                    <button
                        aria-label="Novo terminal"
                        title="Novo terminal"
                        onClick={() => projetoId && void criar(projetoId)}
                        className="rounded-md p-[6px] text-secundario hover:bg-hover hover:text-principal"
                    >
                        <PlusIcon size={14} />
                    </button>
                    <button
                        aria-label="Encerrar terminal"
                        title="Encerrar terminal"
                        onClick={() => void fecharAtivo()}
                        className="rounded-md p-[6px] text-secundario hover:bg-hover hover:text-principal"
                    >
                        <TrashIcon size={14} />
                    </button>
                </div>
                <ul className="min-h-0 flex-1 overflow-auto px-1">
                    {atuais?.ids.map((id, indice) => (
                        <li key={id}>
                            <button
                                aria-current={atuais.ativo === id ? 'true' : undefined}
                                onClick={() =>
                                    definirAbas((anteriores) => ({
                                        ...anteriores,
                                        [projetoId!]: { ...anteriores[projetoId!], ativo: id },
                                    }))
                                }
                                className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[12px]
                                    text-secundario hover:bg-hover aria-[current]:bg-selecionado
                                    aria-[current]:text-principal"
                            >
                                <TerminalIcon size={13} />
                                Terminal {indice + 1}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
