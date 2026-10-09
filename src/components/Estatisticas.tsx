import { useState } from 'react';
import type { Estado } from '../../shared/contratos';
import { calcularEstatisticas, reunirRegistrosUso, type PeriodoEstatisticas } from '../../shared/estatisticas';
import { Modal } from './Modal';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const periodos: { valor: PeriodoEstatisticas; nome: string }[] = [
    { valor: 'semana', nome: 'Semana' },
    { valor: 'mes', nome: 'Mês' },
    { valor: 'total', nome: 'Total' },
];

/** Use para consultar consumo e velocidade medidos, incluindo registros de conversas removidas. */
export function Estatisticas({ estado, fechar }: { estado: Estado; fechar: () => void }) {
    const [periodo, definirPeriodo] = useState<PeriodoEstatisticas>('semana');
    const [modo, definirModo] = useState('todos');
    const registros = reunirRegistrosUso(estado).filter((item) => modo === 'todos' || item.modo === modo);
    const dados = calcularEstatisticas(registros, periodo);
    return (
        <Modal titulo="Estatísticas" fechar={fechar}>
            <div
                data-ui="filtros-estatisticas"
                className={[
                    'flex items-center justify-between gap-[12px] [&_select]:text-[#a1a5ad]',
                    '[&_select]:rounded-[6px] [&_select]:bg-transparent [&_select]:text-[12px] [&_select]:p-[8px]',
                    '[&_select]:border [&_select]:border-solid [&_select]:border-[#2b2e34]',
                    '[@media(width<=480px)]:flex-wrap',
                ].join(' ')}
            >
                <div
                    data-ui="seletor-modo"
                    className={[
                        'flex rounded-[8px] p-[3px] border border-solid border-[#2b2e34] [&_button]:flex',
                        '[&_button]:items-center [&_button]:gap-[7px] [&_button]:text-[12px] [&_button]:text-[#a1a5ad]',
                        '[&_button]:bg-transparent [&_button]:rounded-[5px] [&_button]:px-[13px] [&_button]:py-[7px]',
                        '[&_button]:border-0 [&_button]:border-solid [&_button]:border-current',
                        "[&_button[aria-pressed='true']]:bg-[#292c32] [&_button[aria-pressed='true']]:text-[#eff0f2]",
                    ].join(' ')}
                    aria-label="Período das estatísticas"
                >
                    {periodos.map((item) => (
                        <button
                            key={item.valor}
                            aria-pressed={periodo === item.valor}
                            onClick={() => definirPeriodo(item.valor)}
                        >
                            {item.nome}
                        </button>
                    ))}
                </div>
                <select
                    aria-label="Modo das estatísticas"
                    value={modo}
                    onChange={(evento) => definirModo(evento.target.value)}
                >
                    <option value="todos">Todos os modos</option>
                    <option value="chat">Chat</option>
                    <option value="code">Code</option>
                </select>
            </div>
            <div
                data-ui="total-estatisticas"
                className={[
                    'flex items-baseline gap-[10px] mx-0 my-[30px] [&_strong]:text-[38px] [&_strong]:font-medium',
                    '[&_strong]:tracking-[-1px] [&_strong]:tabular-nums [&_span]:text-[#a1a5ad]',
                    '[&_span]:text-[12px] [@media(width<=480px)]:flex-wrap',
                ].join(' ')}
            >
                <strong>{numero.format(dados.tokensRegistrados)}</strong>
                <span>tokens registrados</span>
            </div>
            <dl
                data-ui="metricas-estatisticas"
                className={[
                    '[&_dt]:text-[#a1a5ad] [&_dt]:text-[12px] grid grid-cols-[repeat(2,_minmax(0,_1fr))]',
                    'gap-[24px] m-0 [&_dd]:mt-[8px] [&_dd]:mb-0 [&_dd]:text-[18px] [&_dd]:tabular-nums',
                    '[&_dd]:mx-[0]',
                ].join(' ')}
            >
                <div>
                    <dt>Gerados</dt>
                    <dd>{numero.format(dados.tokensGerados)}</dd>
                </div>
                <div>
                    <dt>Entrada</dt>
                    <dd>{dados.entradasMedidas ? numero.format(dados.tokensEntrada) : 'Sem medição'}</dd>
                </div>
                <div>
                    <dt>Velocidade média</dt>
                    <dd>
                        {dados.tokensPorSegundo === null
                            ? 'Sem medição'
                            : `${numero.format(dados.tokensPorSegundo)} tokens/s`}
                    </dd>
                </div>
                <div>
                    <dt>Última resposta</dt>
                    <dd>
                        {dados.ultimaVelocidade === null
                            ? 'Sem medição'
                            : `${numero.format(dados.ultimaVelocidade)} tokens/s`}
                    </dd>
                </div>
                <div>
                    <dt>Respostas medidas</dt>
                    <dd>{numero.format(dados.respostas)}</dd>
                </div>
            </dl>
            <p data-ui="nota-estatisticas" className="mt-[28px] mb-0 text-[#a1a5ad] text-[11px] leading-[1.6] mx-0">
                Somente métricas registradas pelo motor. O uso permanece salvo ao apagar chats.
            </p>
        </Modal>
    );
}
