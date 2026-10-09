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
            <div className="filtros-estatisticas">
                <div className="seletor-modo" aria-label="Período das estatísticas">
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
            <div className="total-estatisticas">
                <strong>{numero.format(dados.tokensRegistrados)}</strong>
                <span>tokens registrados</span>
            </div>
            <dl className="metricas-estatisticas">
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
            <p className="nota-estatisticas">
                Somente métricas registradas pelo motor. O uso permanece salvo ao apagar chats.
            </p>
        </Modal>
    );
}
