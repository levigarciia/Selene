import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import type { Estado, PonteSelene } from '../../shared/contratos';
import { reunirRegistrosUso, type PeriodoEstatisticas } from '../../shared/estatisticas';
import { montarPainelEstatisticas } from '../../shared/painelEstatisticas';
import { GraficoTokens } from './GraficoTokens';
import { formatarCusto, formatarTotalCusto, nomeExibicaoModelo, type SaldoOpenRouter } from '../../shared/openrouter';
import { rolagemDiscreta } from './rolagemDiscreta';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const periodos: { valor: PeriodoEstatisticas; nome: string }[] = [
    { valor: '24h', nome: 'Últimas 24h' },
    { valor: '7dias', nome: '7 dias' },
    { valor: '30dias', nome: '30 dias' },
    { valor: '90dias', nome: '90 dias' },
    { valor: 'total', nome: 'Total' },
];
const seletor =
    'cursor-pointer appearance-none border-0 border-b border-[#222] bg-transparent py-1 pr-1 text-[12px] ' +
    'font-medium text-principal/80 outline-none transition-colors hover:text-principal focus:border-[#444] ' +
    'max-w-[200px] truncate';
const pilulas =
    'inline-flex gap-1 rounded-lg bg-[#121212] p-1 ' +
    '[&_button]:rounded-md [&_button]:px-3.5 [&_button]:py-1.5 [&_button]:text-[12px] [&_button]:font-medium ' +
    '[&_button]:text-principal/50 [&_button]:transition-colors [&_button:hover]:text-principal ' +
    '[&_button[aria-pressed=true]]:bg-[#242424] [&_button[aria-pressed=true]]:text-principal';
const rotulo = 'text-[12px] font-medium text-principal/70';

/** Consulta o uso acumulado em tela ampla, alternando entre custo e tokens. */
export function Estatisticas({
    estado,
    ponte,
    fechar,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    fechar: () => void;
}) {
    const [visao, definirVisao] = useState<'custo' | 'tokens'>('custo');
    const [periodo, definirPeriodo] = useState<PeriodoEstatisticas>('30dias');
    const [saldo, definirSaldo] = useState<SaldoOpenRouter | null>(null);
    const [erroSaldo, definirErroSaldo] = useState('');
    const [modo, definirModo] = useState('todos');
    const [modelo, definirModelo] = useState('todos');
    const [conversa, definirConversa] = useState('todas');
    const [agrupamento, definirAgrupamento] = useState<'modelo' | 'dia'>('modelo');
    const tela = useRef<HTMLElement>(null);
    const aoFechar = useRef(fechar);
    aoFechar.current = fechar;
    useEffect(() => {
        if (!ponte || !estado.openrouterConfigurado) return;
        let ativo = true;
        ponte
            .saldoOpenRouter()
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirSaldo(resultado.valor);
                else definirErroSaldo(resultado.erro);
            })
            .catch(() => {
                if (ativo) definirErroSaldo('Não foi possível consultar o saldo.');
            });
        return () => {
            ativo = false;
        };
    }, [ponte, estado.openrouterConfigurado]);
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
        nomeExibicaoModelo(nomes.get(id)) ??
        (id === 'desconhecido' ? 'Modelo não registrado' : 'Modelo removido');
    const modelos = [...new Set(todos.map((item) => item.modeloId ?? 'desconhecido'))];
    const conversasMedidas = new Set(todos.map((registro) => registro.conversaId));
    const conversas = estado.conversas.filter((item) => conversasMedidas.has(item.id));
    const registros = todos.filter(
        (item) =>
            (modo === 'todos' || item.modo === modo) &&
            (modelo === 'todos' || (item.modeloId ?? 'desconhecido') === modelo) &&
            (conversa === 'todas' || item.conversaId === conversa),
    );
    const dados = montarPainelEstatisticas(registros, periodo);
    const grupos = agrupamento === 'modelo' ? dados.modelos : dados.dias;
    const total = dados.tokensRegistrados;
    const parteDe = (valor: number) => (total ? valor / total : 0);
    const totalCusto = dados.custoUsd;
    const parteRanking = (item: { total: number; custoUsd: number }) =>
        visao === 'custo' ? (totalCusto ? item.custoUsd / totalCusto : 0) : parteDe(item.total);
    const rankingLateral =
        visao === 'custo'
            ? dados.modelos.filter((item) => item.custoUsd > 0).sort((a, b) => b.custoUsd - a.custoUsd)
            : dados.modelos;
    const gruposVisiveis =
        visao === 'custo'
            ? grupos.filter((item) => item.custoUsd > 0).sort((a, b) => b.custoUsd - a.custoUsd)
            : grupos;
    const tipos = [
        { nome: 'Entrada', tokens: dados.tokensEntradaSemCache, cor: '#8a8a8a' },
        { nome: 'Cache', tokens: dados.tokensEntradaCache, cor: '#4a4a4a' },
        { nome: 'Entrada sem divisão', tokens: dados.tokensEntradaSemMedicaoCache, cor: '#666' },
        { nome: 'Saída', tokens: dados.tokensGerados, cor: '#f2f2f2' },
    ];
    const totaisTokens = [
        { nome: 'Tokens processados', valor: compacto.format(total) },
        { nome: 'Entrada em cache', valor: dados.entradasCacheMedidas ? compacto.format(dados.tokensEntradaCache) : '—' },
        { nome: 'Entrada sem cache', valor: dados.entradasCacheMedidas ? compacto.format(dados.tokensEntradaSemCache) : '—' },
        { nome: 'Saída', valor: compacto.format(dados.tokensGerados) },
        { nome: 'Velocidade média', valor: dados.tokensPorSegundo === null ? '—' : `${numero.format(dados.tokensPorSegundo)} t/s` },
    ];
    const totaisCusto = [
        { nome: 'Custo no período', valor: formatarTotalCusto(dados.custoUsd) },
        { nome: 'Respostas medidas', valor: numero.format(dados.respostas) },
        { nome: 'Sessões', valor: numero.format(dados.sessoes) },
        { nome: 'Saída', valor: compacto.format(dados.tokensGerados) },
    ];
    const totaisSaldo = saldo
        ? [
              { nome: 'Saldo disponível', valor: formatarTotalCusto(saldo.restante) },
              { nome: 'Créditos comprados', valor: formatarTotalCusto(saldo.creditos) },
              { nome: 'Consumo na conta', valor: formatarTotalCusto(saldo.usado) },
          ]
        : [];
    const totais = visao === 'custo' ? totaisCusto : totaisTokens;
    const principal = visao === 'custo' ? formatarTotalCusto(dados.custoUsd) : compacto.format(total);
    const subtitulo =
        visao === 'custo'
            ? `${dados.sessoes} sessões · valores informados pelo OpenRouter`
            : `${dados.sessoes} sessões · ${dados.respostas} respostas medidas`;
    return (
        <section
            ref={tela}
            tabIndex={-1}
            aria-label="Estatísticas"
            data-ui="tela-estatisticas"
            className={['min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#090909] text-principal outline-none', rolagemDiscreta].join(' ')}
        >
            <header className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-8 pb-6 pt-6">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={fechar}
                        aria-label="Voltar das estatísticas"
                        className="rounded-md p-1.5 text-principal/60 transition-colors hover:bg-hover hover:text-principal"
                    >
                        <ArrowLeftIcon size={16} />
                    </button>
                    <h1 className="text-[15px] font-semibold">Estatísticas</h1>
                    <span className="text-[12px] tabular-nums text-principal/60">
                        {data.format(dados.inicio)} a {data.format(dados.fim)}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className={pilulas} role="group" aria-label="Visão das estatísticas">
                        <button type="button" aria-pressed={visao === 'custo'} onClick={() => definirVisao('custo')}>
                            Custo
                        </button>
                        <button type="button" aria-pressed={visao === 'tokens'} onClick={() => definirVisao('tokens')}>
                            Tokens
                        </button>
                    </div>
                    <div className={pilulas} role="group" aria-label="Período das estatísticas">
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
                </div>
            </header>
            <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-6 gap-y-2 px-8 pb-10">
                <select aria-label="Modo das estatísticas" value={modo} className={seletor} onChange={(e) => definirModo(e.target.value)}>
                    <option value="todos">Todos os modos</option>
                    <option value="chat">Chat</option>
                    <option value="code">Code</option>
                </select>
                <select aria-label="Modelo das estatísticas" value={modelo} className={seletor} onChange={(e) => definirModelo(e.target.value)}>
                    <option value="todos">Todos os modelos</option>
                    {modelos.map((id) => (
                        <option key={id} value={id}>
                            {nomeModelo(id)}
                        </option>
                    ))}
                </select>
                <select aria-label="Conversa das estatísticas" value={conversa} className={seletor} onChange={(e) => definirConversa(e.target.value)}>
                    <option value="todas">Todas as conversas</option>
                    {conversas.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.titulo}
                        </option>
                    ))}
                </select>
            </div>
            <main className="mx-auto max-w-[1080px] px-8 pb-16">
                <div className="grid gap-12 md:grid-cols-[260px_minmax(0,1fr)]">
                    <aside>
                        <div
                            data-ui="total-estatisticas"
                            title={visao === 'tokens' ? `${numero.format(total)} tokens` : undefined}
                            className="text-[40px] font-semibold leading-none tracking-tight tabular-nums"
                        >
                            {principal}
                        </div>
                        <p className="mt-3 text-[12px] font-medium text-principal/70">{subtitulo}</p>
                        <ul className="mt-8 space-y-4">
                            {rankingLateral.slice(0, 4).map((item) => (
                                <li key={item.id}>
                                    <div className="flex items-baseline gap-3 text-[13px]">
                                        <span className="min-w-0 truncate font-medium" title={nomeModelo(item.id)}>
                                            {nomeModelo(item.id)}
                                        </span>
                                        <strong className="ml-auto font-semibold tabular-nums">
                                            {visao === 'custo' ? formatarCusto(item.custoUsd) : compacto.format(item.total)}
                                        </strong>
                                    </div>
                                    <div className="mt-2 h-[2px] w-full bg-[#1c1c1c]">
                                        <div
                                            className="h-[2px] bg-[#ededed]"
                                            style={{ width: `${parteRanking(item) * 100}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[12px] text-principal/60">
                                        {percentual.format(parteRanking(item))}{' '}
                                        {visao === 'custo' ? 'do custo' : 'dos tokens'}
                                    </p>
                                </li>
                            ))}
                            {rankingLateral.length === 0 && (
                                <p className="text-[13px] text-principal/60">
                                    {visao === 'custo'
                                        ? 'Nenhum custo registrado neste período.'
                                        : 'Nenhuma medição neste período.'}
                                </p>
                            )}
                        </ul>
                    </aside>
                    <GraficoTokens serie={dados.serie} />
                </div>
                <section className="mt-14" aria-label="Totais">
                    <h2 className="mb-5 text-[14px] font-semibold">Totais</h2>
                    <dl data-ui="metricas-estatisticas" className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 xl:grid-cols-5">
                        {totais.map((item) => (
                            <div key={item.nome}>
                                <dt className="text-[12px] font-medium text-principal/60">{item.nome}</dt>
                                <dd className="mt-1.5 text-[18px] font-semibold tabular-nums">{item.valor}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
                {visao === 'custo' && (saldo || erroSaldo || estado.openrouterConfigurado) && (
                    <section className="mt-14" aria-label="Saldo OpenRouter">
                        <h2 className="mb-5 text-[14px] font-semibold">Saldo OpenRouter</h2>
                        {saldo ? (
                            <dl data-ui="saldo-openrouter" className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
                                {totaisSaldo.map((item) => (
                                    <div key={item.nome}>
                                        <dt className="text-[12px] font-medium text-principal/60">{item.nome}</dt>
                                        <dd className="mt-1.5 text-[18px] font-semibold tabular-nums">{item.valor}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p role={erroSaldo ? 'alert' : 'status'} className="text-[12px] text-principal/60">
                                {erroSaldo || 'Consultando saldo'}
                            </p>
                        )}
                    </section>
                )}
                <section className="mt-14 max-w-[640px]" aria-label="Tokens por tipo">
                    <h2 className="mb-4 text-[14px] font-semibold">Tokens por tipo</h2>
                    <svg
                        viewBox="0 0 1000 6"
                        preserveAspectRatio="none"
                        className="block h-1.5 w-full overflow-hidden rounded-full"
                        role="img"
                        aria-label="Proporção de entrada e saída"
                    >
                        <rect width="1000" height="6" className="fill-[#1c1c1c]" />
                        {tipos.map((tipo, indice) => (
                            <rect
                                key={tipo.nome}
                                x={parteDe(tipos.slice(0, indice).reduce((soma, item) => soma + item.tokens, 0)) * 1000}
                                width={parteDe(tipo.tokens) * 1000}
                                height="6"
                                fill={tipo.cor}
                            />
                        ))}
                    </svg>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
                        {tipos
                            .filter((tipo) => tipo.tokens > 0)
                            .map((tipo) => (
                                <span key={tipo.nome} className="inline-flex items-center gap-2 text-principal/70">
                                    <span className="inline-block size-2 rounded-full" style={{ background: tipo.cor }} />
                                    {tipo.nome}{' '}
                                    <span className="font-semibold tabular-nums text-principal">{compacto.format(tipo.tokens)}</span>
                                </span>
                            ))}
                    </div>
                </section>
                <section className="mt-14" aria-label="Detalhamento">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <h2 className="text-[14px] font-semibold">Detalhamento</h2>
                        <div className={pilulas} role="group" aria-label="Agrupamento das estatísticas">
                            <button type="button" aria-pressed={agrupamento === 'modelo'} onClick={() => definirAgrupamento('modelo')}>
                                Modelo
                            </button>
                            <button type="button" aria-pressed={agrupamento === 'dia'} onClick={() => definirAgrupamento('dia')}>
                                Dia
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table data-ui="detalhamento-estatisticas" className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                            <thead className={rotulo}>
                                <tr>
                                    <th className="w-8 pb-3 font-medium">#</th>
                                    <th className="pb-3 font-medium">{agrupamento === 'modelo' ? 'Modelo' : 'Dia'}</th>
                                    {(visao === 'custo'
                                        ? ['Custo', 'Participação', 'Tokens']
                                        : ['Entrada', 'Saída', 'Participação', 'Tokens']
                                    ).map((nome) => (
                                        <th key={nome} className="pb-3 text-right font-medium">
                                            {nome}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {gruposVisiveis.map((item, indice) => {
                                    const celulas =
                                        visao === 'custo'
                                            ? [
                                                  formatarCusto(item.custoUsd),
                                                  percentual.format(parteRanking(item)),
                                                  compacto.format(item.total),
                                              ]
                                            : [
                                                  compacto.format(item.entrada),
                                                  compacto.format(item.saida),
                                                  percentual.format(parteDe(item.total)),
                                                  compacto.format(item.total),
                                              ];
                                    return (
                                        <tr key={item.id} className="border-t border-[#1a1a1a] transition-colors hover:bg-[#0f0f0f]">
                                            <td className="py-4 text-principal/50">{indice + 1}</td>
                                            <td className="py-4 pr-5">
                                                <span className="font-medium">
                                                    {agrupamento === 'modelo'
                                                        ? nomeModelo(item.id)
                                                        : new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.id}T12:00:00`))}
                                                </span>
                                                <svg viewBox="0 0 200 2" preserveAspectRatio="none" className="mt-2 block h-[2px] w-[160px]" aria-hidden="true">
                                                    <rect width={parteRanking(item) * 200} height="2" className="fill-[#ededed]" />
                                                </svg>
                                            </td>
                                            {celulas.map((valor, coluna) => (
                                                <td
                                                    key={coluna}
                                                    className={`py-4 text-right tabular-nums ${
                                                        coluna === celulas.length - 1 ? 'font-semibold text-principal' : 'text-principal/70'
                                                    }`}
                                                >
                                                    {valor}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
                <p data-ui="nota-estatisticas" className="mt-12 text-[12px] leading-relaxed text-principal/50">
                    {visao === 'custo'
                        ? 'Custos informados pelo OpenRouter nas solicitações feitas pela Selene, em dólares.'
                        : 'A entrada inclui histórico e resultados de ferramentas reenviados em cada chamada.'}
                    {dados.custosPendentes > 0 &&
                        ` ${dados.custosPendentes} respostas sem custo informado não entram no total.`}
                    {visao === 'tokens' &&
                        (dados.entradasCacheMedidas
                            ? ` Cache medido em ${dados.entradasCacheMedidas} de ${dados.respostas} respostas.`
                            : ' Cache sem medição neste período.')}
                </p>
            </main>
        </section>
    );
}
