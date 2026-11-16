import { useId, useState } from 'react';
import { CaretDownIcon, CheckIcon, LeafIcon } from '@phosphor-icons/react';
import { useMenuEntrada } from '../hooks/useMenuEntrada';
import {
    descricoesNiveis,
    estimarEconomia,
    niveisCaveman,
    pacotesEconomia,
    type EconomiaTokens as Economia,
    type PacoteEconomia,
} from '../../shared/economiaTokens';

const desligada: Economia = { pacotes: [], nivel: 'completo' };

/** Escolhe os pacotes de economia de tokens da conversa, aplicados ao próximo envio. */
export function EconomiaTokens({
    economia = desligada,
    rtkDisponivel,
    desativado,
    alterar,
}: {
    economia?: Economia;
    rtkDisponivel: boolean;
    desativado: boolean;
    alterar: (economia: Economia) => Promise<void>;
}) {
    const [salvando, definirSalvando] = useState(false);
    const id = useId();
    const { aberto, definirAberto, raiz, gatilho, menu, abertoPorToque } = useMenuEntrada(
        desativado,
        '[role="menuitemcheckbox"]',
    );
    const disponivel = { rtk: rtkDisponivel };
    const ativos = economia.pacotes.filter((pacote) => pacote !== 'rtk' || rtkDisponivel);
    const percentual = estimarEconomia(economia, disponivel);

    async function salvar(proxima: Economia) {
        if (salvando || desativado) return;
        definirSalvando(true);
        try {
            await alterar(proxima);
        } finally {
            definirSalvando(false);
        }
    }

    function alternar(pacote: PacoteEconomia) {
        const pacotes = economia.pacotes.includes(pacote)
            ? economia.pacotes.filter((item) => item !== pacote)
            : [...economia.pacotes, pacote];
        void salvar({ ...economia, pacotes });
    }

    return (
        <div
            data-ui="controle-entrada"
            className={[
                'min-w-0 border-l border-solid border-l-[#2b2d31] pl-[10px]',
                '[@media(width<=760px)]:[order:1] [@media(width<=760px)]:border-l-0 [@media(width<=760px)]:p-0',
            ].join(' ')}
            ref={raiz}
            onBlur={(evento) => {
                if (evento.relatedTarget && !evento.currentTarget.contains(evento.relatedTarget)) {
                    definirAberto(false);
                }
            }}
        >
            <button
                type="button"
                className={[
                    'flex items-center gap-[7px] shrink-0 bg-transparent text-[12px] px-0 py-[7px] border-0',
                    ativos.length ? 'text-[#9fd8a8]' : 'text-secundario',
                    '[&:hover]:text-principal',
                ].join(' ')}
                ref={gatilho}
                aria-label={
                    ativos.length
                        ? `Economia de tokens: ${ativos.length} ativos, cerca de ${percentual}% menos tokens`
                        : 'Economia de tokens: desligada'
                }
                aria-haspopup="menu"
                aria-expanded={aberto}
                aria-controls={id}
                disabled={desativado}
                onPointerDown={(evento) => {
                    abertoPorToque.current = evento.pointerType === 'touch';
                }}
                onClick={(evento) => {
                    if (evento.detail === 0) abertoPorToque.current = false;
                    definirAberto(!aberto);
                }}
            >
                <LeafIcon size={16} />
                {!!ativos.length && <span>{percentual}%</span>}
                <CaretDownIcon size={12} />
            </button>
            {aberto && (
                <div
                    className={[
                        'fixed z-[30] w-[min(320px,_calc(100vw_-_16px))] bg-superficie rounded-[12px] p-[5px]',
                        'shadow-[0_12px_36px_#0006] border border-solid border-[#30333a]',
                    ].join(' ')}
                    ref={menu}
                    role="menu"
                    aria-label="Economia de tokens"
                    id={id}
                    onKeyDown={(evento) => {
                        if (evento.key !== 'Escape') return;
                        evento.preventDefault();
                        definirAberto(false);
                        gatilho.current?.focus();
                    }}
                >
                    {pacotesEconomia.map((pacote) => {
                        const indisponivel = pacote.exigeRtk && !rtkDisponivel;
                        const marcado = economia.pacotes.includes(pacote.id) && !indisponivel;
                        return (
                            <div key={pacote.id}>
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={marcado}
                                    disabled={salvando || indisponivel}
                                    title={`Economiza ${pacote.economia}`}
                                    className={[
                                        'flex items-center justify-between gap-[12px] w-full rounded-[7px] p-[10px]',
                                        'bg-transparent text-left text-[12px] text-[#d1d5dd] border-0',
                                        'hover:bg-borda focus-visible:bg-borda disabled:opacity-50',
                                    ].join(' ')}
                                    onClick={() => alternar(pacote.id)}
                                >
                                    <span>
                                        <span>{pacote.titulo}</span>
                                        <small className="block mt-[5px] text-secundario text-[11px] leading-[1.5]">
                                            {indisponivel ? 'Instale o rtk para ativar.' : pacote.resumo}
                                        </small>
                                    </span>
                                    {marcado && <CheckIcon size={16} className="shrink-0 text-[#b5a2dc]" />}
                                </button>
                                {pacote.id === 'caveman' && marcado && (
                                    <div role="group" aria-label="Intensidade" className="flex gap-[4px] px-[10px] pb-[8px]">
                                        {niveisCaveman.map((nivel) => (
                                            <button
                                                type="button"
                                                key={nivel}
                                                aria-pressed={economia.nivel === nivel}
                                                title={descricoesNiveis[nivel].dica}
                                                disabled={salvando}
                                                className={[
                                                    'flex-1 rounded-[6px] py-[5px] text-[11px] border-0',
                                                    economia.nivel === nivel
                                                        ? 'bg-borda text-principal'
                                                        : 'bg-transparent text-secundario hover:text-principal',
                                                ].join(' ')}
                                                onClick={() => void salvar({ ...economia, nivel })}
                                            >
                                                {descricoesNiveis[nivel].nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
