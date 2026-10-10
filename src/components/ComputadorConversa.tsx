import { useEffect, useState } from 'react';
import { ArrowsOutSimpleIcon, ArrowsInSimpleIcon, MonitorIcon, StopIcon } from '@phosphor-icons/react';
import type { PreviaComputador } from '../../shared/computador';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

/** Acompanha a tela real transmitida pelo desktop, inclusive no navegador do celular. */
export function ComputadorConversa({
    previa,
    ponte,
    executar,
}: {
    previa: PreviaComputador;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [ampliado, definirAmpliado] = useState(false);
    const [agora, definirAgora] = useState(Date.now());
    const [tamanho, definirTamanho] = useState({ largura: 1280, altura: 720 });
    useEffect(() => {
        const tempo = setInterval(() => definirAgora(Date.now()), 1000);
        return () => clearInterval(tempo);
    }, []);
    const atrasado = previa.ativo && agora - previa.atualizadoEm > 4000;
    return (
        <section
            data-ui="computador-inline"
            className={
                ampliado
                    ? 'fixed inset-[8px] z-50 flex flex-col rounded-[12px] border border-violet-400/40 bg-[#0c0d10] shadow-2xl'
                    : 'my-[16px] overflow-hidden rounded-[10px] border border-violet-400/40 bg-[#0c0d10]'
            }
        >
            <div className="flex min-w-0 items-center gap-[8px] px-[12px] py-[8px] text-[11px] text-secundario">
                <MonitorIcon size={16} className="shrink-0 text-violet-300" />
                <span className="min-w-0 flex-1 truncate">{previa.titulo}</span>
                <span role="status" className="shrink-0 text-violet-300">
                    {previa.erro
                        ? 'Falha na transmissão'
                        : atrasado
                          ? 'Reconectando'
                          : previa.ativo
                            ? 'Ao vivo'
                            : 'Encerrado'}
                </span>
                <button
                    type="button"
                    aria-label={ampliado ? 'Reduzir computador' : 'Ampliar computador'}
                    className="rounded p-[6px] hover:bg-hover"
                    onClick={() => definirAmpliado(!ampliado)}
                >
                    {ampliado ? <ArrowsInSimpleIcon size={16} /> : <ArrowsOutSimpleIcon size={16} />}
                </button>
                <button
                    type="button"
                    aria-label="Interromper uso do computador"
                    disabled={!previa.ativo || !ponte}
                    className="rounded p-[6px] text-red-300 hover:bg-red-400/10"
                    onClick={() => ponte && void executar(() => ponte.pararComputador(previa.conversaId))}
                >
                    <StopIcon size={16} />
                </button>
            </div>
            <div className="relative flex min-h-[160px] flex-1 items-center justify-center overflow-hidden bg-black">
                {previa.imagem ? (
                    <img
                        src={previa.imagem}
                        alt={`Tela do computador: ${previa.titulo}`}
                        onLoad={(evento) =>
                            definirTamanho({
                                largura: evento.currentTarget.naturalWidth,
                                altura: evento.currentTarget.naturalHeight,
                            })
                        }
                        data-ui="tela-computador"
                        className={ampliado ? 'h-full w-full object-contain' : 'block h-auto w-full'}
                    />
                ) : (
                    <p className="p-[20px] text-[12px] text-secundario">
                        {previa.erro || (previa.ativo ? 'Aguardando a tela do computador' : 'Transmissão encerrada')}
                    </p>
                )}
                {previa.cursor && previa.imagem && (
                    <svg
                        viewBox={`0 0 ${tamanho.largura} ${tamanho.altura}`}
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                        <g
                            transform={`translate(${previa.cursor.x * tamanho.largura} ${previa.cursor.y * tamanho.altura})`}
                        >
                            <path
                                d="M0 0 L0 31 L8 23 L15 36 L21 33 L14 20 L27 20 Z"
                                fill="#c4b5fd"
                                stroke="#faf5ff"
                                strokeWidth="1.5"
                            />
                        </g>
                    </svg>
                )}
                {previa.ativo && (
                    <div
                        className="pointer-events-none absolute inset-0 border-[2px] border-violet-400/60
                shadow-[inset_0_0_18px_#8b5cf666] motion-safe:animate-pulse"
                    />
                )}
            </div>
        </section>
    );
}
