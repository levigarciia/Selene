import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, CpuIcon } from '@phosphor-icons/react';
import type { Estado } from '../../shared/contratos';
import { reunirRegistrosUso, type PeriodoEstatisticas } from '../../shared/estatisticas';
import { montarPainelEstatisticas } from '../../shared/painelEstatisticas';
import { GraficoTokens } from './GraficoTokens';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const periodos: { valor: PeriodoEstatisticas; nome: string }[] = [
    { valor: '24h', nome: '24 horas' },
    { valor: '7dias', nome: '7 dias' },
    { valor: '30dias', nome: '30 dias' },
    { valor: '90dias', nome: '90 dias' },
    { valor: 'total', nome: 'Total' },
];
const seletor = 'rounded-md border-0 bg-[#141414] px-3 py-2 text-[12px] text-secundario max-w-full';
const abas =
    'flex flex-wrap gap-1 rounded-lg bg-[#131313] p-1 [&_button]:rounded-md [&_button]:px-3 ' +
    '[&_button]:py-1 [&_button]:text-[12px] [&_button]:text-secundario ' +
    '[&_button[aria-pressed=true]]:bg-[#252525] [&_button[aria-pressed=true]]:text-principal';

/** Consulta o uso acumulado em tela ampla, com histórico diário e grupos por modelo. */
export function Estatisticas({ estado, fechar }: { estado: Estado; fechar: () => void }) {
    const [periodo, definirPeriodo] = useState<PeriodoEstatisticas>('30dias');
    const [modo, definirModo] = useState('todos');
    const [modelo, definirModelo] = useState('todos');
    const [agrupamento, definirAgrupamento] = useState<'modelo' | 'dia'>('modelo');
    const tela = useRef<HTMLElement>(null);
    const aoFechar = useRef(fechar);
    aoFechar.current = fechar;
    useEffect(() => {
        tela.current?.focus();
        const aoTeclado = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape' && !document.querySelector('dialog[open]')) aoFechar.current();
        };
        document.addEventListener('keydown', aoTeclado);
        return () => document.removeEventListener('keydown', aoTeclado);
    }, []);
    const todos = reunirRegistrosUso(estado);
    const nomes = new Map(estado.modelos.map((item) => [item.id, item.nome]));
    const nomeModelo = (id: string) =>
        nomes.get(id) ?? (id === 'desconhecido' ? 'Modelo não registrado' : 'Modelo removido');
    const modelos = [...new Set(todos.map((item) => item.modeloId ?? 'desconhecido'))];
    const registros = todos.filter(
        (item) =>
            (modo === 'todos' || item.modo === modo) &&
            (modelo === 'todos' || (item.modeloId ?? 'desconhecido') === modelo),
    );
    const dados = montarPainelEstatisticas(registros, periodo);
    const grupos = agrupamento === 'modelo' ? dados.modelos : dados.dias;
    const tipos = [
        { nome: 'Entrada sem cache', tokens: dados.tokensEntradaSemCache, cor: '#858585' },
        { nome: 'Cache', tokens: dados.tokensEntradaCache, cor: '#414141' },
        { nome: 'Entrada sem divisão medida', tokens: dados.tokensEntradaSemMedicaoCache, cor: '#626262' },
        { nome: 'Saída', tokens: dados.tokensGerados, cor: '#ececec' },
    ];
    const metricas = [
        { nome: 'Tokens acumulados', valor: compacto.format(dados.tokensRegistrados) },
        {
            nome: 'Entrada acumulada',
            valor: dados.entradasMedidas ? compacto.format(dados.tokensEntrada) : 'Sem medição',
        },
        {
            nome: 'Entrada em cache',
            valor: dados.entradasCacheMedidas ? compacto.format(dados.tokensEntradaCache) : 'Sem medição',
        },
        {
            nome: 'Entrada sem cache',
            valor: dados.entradasCacheMedidas ? compacto.format(dados.tokensEntradaSemCache) : 'Sem medição',
        },
        { nome: 'Saída', valor: compacto.format(dados.tokensGerados) },
        {
            nome: 'Velocidade média',
            valor:
                dados.tokensPorSegundo === null ? 'Sem medição' : `${numero.format(dados.tokensPorSegundo)} tokens/s`,
        },
    ];
    return (
        <section
            ref={tela}
            tabIndex={-1}
            aria-label="Estatísticas"
            data-ui="tela-estatisticas"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#090909] text-principal outline-none"
        >
            <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={fechar}
                        aria-label="Voltar das estatísticas"
                        className="rounded-md p-2 text-secundario hover:bg-hover hover:text-principal"
                    >
                        <ArrowLeftIcon size={17} />
                    </button>
                    <h1 className="sr-only">Estatísticas</h1>
                    <select
                        aria-label="Modo das estatísticas"
                        value={modo}
                        className={seletor}
                        onChange={(evento) => definirModo(evento.target.value)}
                    >
                        <option value="todos">Todos os modos</option>
                        <option value="chat">Chat</option>
                        <option value="code">Code</option>
                    </select>
                    <select
                        aria-label="Modelo das estatísticas"
                        value={modelo}
                        className={seletor}
                        onChange={(evento) => definirModelo(evento.target.value)}
                    >
                        <option value="todos">Todos os modelos</option>
                        {modelos.map((id) => (
                            <option key={id} value={id}>
                                {nomeModelo(id)}
                            </option>
                        ))}
                    </select>
                    <span className="text-[11px] text-secundario">
                        {data.format(dados.inicio)} a {data.format(dados.fim)}
                    </span>
                </div>
                <div className={abas} role="group" aria-label="Período das estatísticas">
                    {periodos.map((item) => (
                        <button
                            type="button"
                            key={item.valor}
                            aria-pressed={periodo === item.valor}
                            onClick={() => definirPeriodo(item.valor)}
                        >
                            {item.nome}
                        </button>
                    ))}
                </div>
            </header>
            <main className="mx-auto max-w-[1120px] px-6 pb-16 pt-10 lg:pt-12">
                <div className="grid gap-10 md:grid-cols-[260px_minmax(0,1fr)]">
                    <aside>
                        <div
                            data-ui="total-estatisticas"
                            title={`${numero.format(dados.tokensRegistrados)} tokens`}
                            className="text-[40px] font-medium leading-none tracking-tight tabular-nums"
                        >
                            {compacto.format(dados.tokensRegistrados)}
                        </div>
                        <p className="mt-2 text-[12px] text-secundario">
                            {dados.sessoes} sessões, {dados.respostas} respostas medidas
                        </p>
                        <div className="mt-6 space-y-4">
                            {dados.modelos.slice(0, 4).map((item) => (
                                <div key={item.id}>
                                    <div className="flex items-center gap-2 text-[12px]">
                                        <CpuIcon size={14} className="shrink-0" />
                                        <span className="min-w-0 truncate" title={nomeModelo(item.id)}>
                                            {nomeModelo(item.id)}
                                        </span>
                                        <strong className="ml-auto font-medium tabular-nums">
                                            {compacto.format(item.total)}
                                        </strong>
                                    </div>
                                    <p className="mt-1 text-[11px] text-secundario">
                                        {percentual.format(
                                            dados.tokensRegistrados ? item.total / dados.tokensRegistrados : 0,
                                        )}{' '}
                                        dos tokens
                                    </p>
                                </div>
                            ))}
                            {dados.respostas === 0 && (
                                <p className="text-[12px] text-secundario">Nenhuma medição neste período.</p>
                            )}
                        </div>
                    </aside>
                    <GraficoTokens serie={dados.serie} />
                </div>
                <section className="mt-12" aria-label="Totais">
                    <h2 className="mb-4 text-[13px] font-medium">Totais</h2>
                    <dl
                        data-ui="metricas-estatisticas"
                        className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-6"
                    >
                        {metricas.map((item) => (
                            <div key={item.nome}>
                                <dt className="text-[11px] text-secundario">{item.nome}</dt>
                                <dd className="mt-2 text-[16px] font-medium tabular-nums">{item.valor}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
                <section className="mt-8 max-w-[560px]" aria-label="Tokens por tipo">
                    <h2 className="mb-4 text-[13px] font-medium">Tokens por tipo</h2>
                    <svg
                        viewBox="0 0 1000 12"
                        className="block h-2 w-full overflow-hidden rounded-sm"
                        role="img"
                        aria-label="Proporção de entrada e saída"
                    >
                        <rect width="1000" height="12" className="fill-[#252525]" />
                        {tipos.map((tipo, indice) => (
                            <rect
                                key={tipo.nome}
                                x={
                                    dados.tokensRegistrados
                                        ? (tipos.slice(0, indice).reduce((soma, item) => soma + item.tokens, 0) /
                                              dados.tokensRegistrados) *
                                          1000
                                        : 0
                                }
                                width={dados.tokensRegistrados ? (tipo.tokens / dados.tokensRegistrados) * 1000 : 0}
                                height="12"
                                fill={tipo.cor}
                            />
                        ))}
                    </svg>
                    <div className="mt-3 flex flex-wrap gap-5 text-[11px] text-secundario">
                        {tipos
                            .filter((tipo) => tipo.tokens > 0)
                            .map((tipo) => (
                                <span key={tipo.nome}>
                                    <svg viewBox="0 0 8 8" className="mr-2 inline-block size-2" aria-hidden="true">
                                        <rect width="8" height="8" rx="2" fill={tipo.cor} />
                                    </svg>
                                    {tipo.nome} <span className="text-principal">{compacto.format(tipo.tokens)}</span>
                                </span>
                            ))}
                    </div>
                </section>
                <section className="mt-10" aria-label="Detalhamento">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-[13px] font-medium">Detalhamento</h2>
                        <div className={abas} role="group" aria-label="Agrupamento das estatísticas">
                            <button
                                type="button"
                                aria-pressed={agrupamento === 'modelo'}
                                onClick={() => definirAgrupamento('modelo')}
                            >
                                Modelo
                            </button>
                            <button
                                type="button"
                                aria-pressed={agrupamento === 'dia'}
                                onClick={() => definirAgrupamento('dia')}
                            >
                                Dia
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table
                            data-ui="detalhamento-estatisticas"
                            className="w-full min-w-[600px] border-collapse text-left text-[12px]"
                        >
                            <thead className="text-[11px] font-normal text-secundario">
                                <tr>
                                    <th className="w-8 pb-3 font-normal">#</th>
                                    <th className="pb-3 font-normal">{agrupamento === 'modelo' ? 'Modelo' : 'Dia'}</th>
                                    {['Entrada', 'Saída', 'Participação', 'Tokens'].map((nome) => (
                                        <th key={nome} className="pb-3 text-right font-normal">
                                            {nome}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {grupos.map((item, indice) => (
                                    <tr key={item.id} className="border-t border-[#1c1c1c]">
                                        <td className="py-4 text-secundario">{indice + 1}</td>
                                        <td className="py-4 pr-5">
                                            <span>
                                                {agrupamento === 'modelo'
                                                    ? nomeModelo(item.id)
                                                    : new Intl.DateTimeFormat('pt-BR').format(
                                                          new Date(`${item.id}T12:00:00`),
                                                      )}
                                            </span>
                                            <svg
                                                viewBox="0 0 200 2"
                                                className="mt-2 block h-[2px] w-[180px]"
                                                aria-hidden="true"
                                            >
                                                <rect
                                                    width={
                                                        dados.tokensRegistrados
                                                            ? (item.total / dados.tokensRegistrados) * 200
                                                            : 0
                                                    }
                                                    height="2"
                                                    className="fill-[#dedede]"
                                                />
                                            </svg>
                                        </td>
                                        {[
                                            compacto.format(item.entrada),
                                            compacto.format(item.saida),
                                            percentual.format(
                                                dados.tokensRegistrados ? item.total / dados.tokensRegistrados : 0,
                                            ),
                                            compacto.format(item.total),
                                        ].map((valor, coluna) => (
                                            <td
                                                key={coluna}
                                                className="py-4 text-right tabular-nums text-secundario last:text-principal"
                                            >
                                                {valor}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                <p data-ui="nota-estatisticas" className="mt-8 text-[11px] leading-relaxed text-secundario">
                    A entrada inclui histórico e resultados de ferramentas reenviados em cada chamada.
                    {dados.entradasCacheMedidas
                        ? ` Cache medido em ${dados.entradasCacheMedidas} de ${dados.respostas} respostas.`
                        : ' Cache sem medição neste período.'}{' '}
                    Registros antigos preservam a entrada sem divisão de cache. O uso permanece salvo ao apagar chats.
                </p>
            </main>
        </section>
    );
}
