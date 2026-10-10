import { useState } from 'react';

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat('pt-BR');
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/** Mostra o consumo diário em linha contínua, com valores acessíveis por mouse e teclado. */
export function GraficoTokens({
    serie,
    titulo = 'Tokens por dia',
    formatar = (valor: number) => compacto.format(valor),
}: {
    serie: { dia: string; total: number }[];
    titulo?: string;
    formatar?: (valor: number) => string;
}) {
    const [selecionado, definirSelecionado] = useState<number | null>(null);
    const largura = 740;
    const altura = 260;
    const esquerda = 48;
    const direita = 728;
    const topo = 18;
    const base = 220;
    const maximo = Math.max(1, ...serie.map((item) => item.total));
    const potencia = 10 ** Math.floor(Math.log10(maximo));
    const teto = Math.ceil(maximo / potencia) * potencia;
    const pontos = serie.map((item, indice) => ({
        ...item,
        x: esquerda + (indice / Math.max(1, serie.length - 1)) * (direita - esquerda),
        y: base - (item.total / teto) * (base - topo),
    }));
    const linha = pontos.map((item) => `${item.x},${item.y}`).join(' ');
    const ativo = selecionado === null ? undefined : pontos[selecionado];
    const nomeDia = (dia: string) => data.format(new Date(`${dia}T12:00:00`));
    return (
        <section data-ui="grafico-tokens" className="min-w-0">
            <div className="mb-4 flex min-h-5 flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold">{titulo}</h2>
                <span aria-live="polite" className="text-[12px] font-medium tabular-nums text-principal">
                    {ativo ? `${nomeDia(ativo.dia)}: ${formatar(ativo.total)}` : ''}
                </span>
            </div>
            <svg
                viewBox={`0 0 ${largura} ${altura}`}
                className="block w-full overflow-visible"
                role="group"
                aria-label={`Gráfico diário: ${titulo.toLowerCase()}`}
            >
                {[0, 1, 2, 3].map((indice) => {
                    const y = base - (indice / 3) * (base - topo);
                    return (
                        <g key={indice}>
                            <line x1={esquerda} x2={direita} y1={y} y2={y} className="stroke-[#1a1a1a]" />
                            <text x={esquerda - 10} y={y + 3} textAnchor="end" className="fill-[#8a8a8a] text-[11px]">
                                {compacto.format((indice / 3) * teto)}
                            </text>
                        </g>
                    );
                })}
                {pontos.length > 0 && (
                    <polyline points={linha} fill="none" strokeWidth="1.6" strokeLinejoin="round" className="stroke-[#e6e6e6]" />
                )}
                {pontos.map((ponto, indice) => (
                    <g key={ponto.dia}>
                        <circle
                            cx={ponto.x}
                            cy={ponto.y}
                            r={ativo === ponto ? 4 : 0}
                            className="fill-white transition-all"
                        />
                        <rect
                            x={ponto.x - Math.max(4, (direita - esquerda) / Math.max(1, pontos.length) / 2)}
                            y={topo}
                            width={Math.max(8, (direita - esquerda) / Math.max(1, pontos.length))}
                            height={base - topo}
                            tabIndex={0}
                            role="button"
                            aria-label={`${nomeDia(ponto.dia)}: ${formatar(ponto.total)}`}
                            className="fill-transparent cursor-crosshair focus:outline-none"
                            onMouseEnter={() => definirSelecionado(indice)}
                            onMouseLeave={() => definirSelecionado(null)}
                            onFocus={() => definirSelecionado(indice)}
                            onBlur={() => definirSelecionado(null)}
                            onClick={() => definirSelecionado(indice)}
                            onKeyDown={(evento) => {
                                if (evento.key === 'Enter' || evento.key === ' ') definirSelecionado(indice);
                            }}
                        >
                            <title>
                                {nomeDia(ponto.dia)}: {numero.format(ponto.total)}
                            </title>
                        </rect>
                    </g>
                ))}
                {[...new Set([0, Math.floor((pontos.length - 1) / 2), pontos.length - 1])]
                    .filter((i) => i >= 0)
                    .map((indice) => (
                        <text
                            key={indice}
                            x={pontos[indice].x}
                            y={248}
                            textAnchor={indice === 0 ? 'start' : indice === pontos.length - 1 ? 'end' : 'middle'}
                            className="fill-[#8a8a8a] text-[11px]"
                        >
                            {nomeDia(pontos[indice].dia)}
                        </text>
                    ))}
            </svg>
        </section>
    );
}
