import { useEffect, useMemo, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { GithubLogoIcon } from '@phosphor-icons/react';
import type { Estado, PonteSelene } from '../../shared/contratos';
import type { ItemGitHub, TipoItemGitHub } from '../../shared/repositorio';
import {
    agruparItensGitHub,
    lerPreferenciasGitHub,
    ordenarItensGitHub,
    salvarPreferenciasGitHub,
    unirItensGitHub,
    type PreferenciasGitHub,
} from './listaGitHub';
import { BuscaGitHub, classeBotaoIconeBarra, MenuFiltrosGitHub, MenuOrdemGitHub } from './FiltrosGitHub';
import { CabecalhoGrupoGitHub, EsqueletoListaGitHub, LinhaItemGitHub, VazioGitHub } from './ItensGitHub';

const ESPERA_BUSCA_MS = 250;

interface Leitura {
    itens: ItemGitHub[];
    repositorios: Record<string, string[]>;
    indisponiveis: Record<string, string>;
    avisos: Record<string, string>;
}

function useBuscaAdiada(valor: string): string {
    const [adiado, definirAdiado] = useState(valor);
    useEffect(() => {
        const temporizador = setTimeout(() => definirAdiado(valor.trim()), ESPERA_BUSCA_MS);
        return () => clearTimeout(temporizador);
    }, [valor]);
    return adiado;
}

/** Pull requests e issues dos repositórios GitHub dos projetos Code, no formato da lista do T3. */
export function TelaGitHub({ estado, ponte }: { estado: Estado; ponte?: PonteSelene }) {
    const projetos = estado.projetos.filter((item) => !item.oculto);
    const [preferencias, definirPreferencias] = useState(lerPreferenciasGitHub);
    const [busca, definirBusca] = useState('');
    const buscaAdiada = useBuscaAdiada(busca);
    const [leitura, definirLeitura] = useState<Leitura | null>(null);
    const [lendo, definirLendo] = useState(false);
    const [versao, definirVersao] = useState(0);
    const { tipo, estado: estadoFiltro, envolvimento, ordem } = preferencias;
    const projetoId = projetos.some((item) => item.id === preferencias.projetoId) ? preferencias.projetoId : null;
    const alvos = projetoId ? projetos.filter((item) => item.id === projetoId) : projetos;
    const chaveAlvos = alvos.map((item) => item.id).join(',');

    function alterar(parcial: Partial<PreferenciasGitHub>) {
        if (parcial.tipo && parcial.tipo !== tipo) definirLeitura(null);
        definirPreferencias((anteriores) => {
            const proximas = { ...anteriores, ...parcial };
            salvarPreferenciasGitHub(proximas);
            return proximas;
        });
    }

    useEffect(() => {
        if (!ponte || !alvos.length) return;
        let ativo = true;
        definirLendo(true);
        const consulta = { tipo, estado: estadoFiltro, envolvimento, busca: buscaAdiada };
        void Promise.all(alvos.map((projeto) => ponte.listarGitHub(projeto.id, consulta))).then((resultados) => {
            if (!ativo) return;
            const proxima: Leitura = { itens: [], repositorios: {}, indisponiveis: {}, avisos: {} };
            const respostas: ItemGitHub[][] = [];
            resultados.forEach((resultado, indice) => {
                const projeto = alvos[indice];
                if (!resultado.ok) {
                    proxima.indisponiveis[projeto.id] = resultado.erro;
                    return;
                }
                proxima.repositorios[projeto.id] = resultado.valor.repositorios;
                if (resultado.valor.avisos.length) proxima.avisos[projeto.id] = resultado.valor.avisos.join('\n');
                respostas.push(resultado.valor.itens);
            });
            proxima.itens = unirItensGitHub(respostas);
            definirLeitura(proxima);
            definirLendo(false);
        });
        return () => {
            ativo = false;
        };
    }, [ponte, chaveAlvos, tipo, estadoFiltro, envolvimento, buscaAdiada, versao]);

    const grupos = useMemo(
        () => agruparItensGitHub(ordenarItensGitHub(leitura?.itens ?? [], ordem)),
        [leitura, ordem],
    );
    const erros = Object.values(leitura?.indisponiveis ?? {});
    const todosFalharam = !!leitura && alvos.length > 0 && erros.length === alvos.length;
    const repositoriosSelecionados = projetoId ? leitura?.repositorios[projetoId] : undefined;
    const repositorioSelecionado = repositoriosSelecionados?.length === 1 ? repositoriosSelecionados[0] : undefined;
    const caminhoGitHub = tipo === 'pr' ? 'pulls' : 'issues';
    const buscaRepositorios = repositoriosSelecionados?.map((repositorio) => `repo:${repositorio}`).join(' ');
    const urlGitHub = repositorioSelecionado
        ? `https://github.com/${repositorioSelecionado}/${caminhoGitHub}`
        : buscaRepositorios
          ? `https://github.com/search?q=${encodeURIComponent(`${buscaRepositorios} is:${tipo}`)}&type=${tipo === 'pr' ? 'pullrequests' : 'issues'}`
          : `https://github.com/${caminhoGitHub}`;
    const opcoesProjetos = projetos.map((projeto) => ({
        valor: projeto.id,
        nome: projeto.nome,
        indisponivel: leitura?.indisponiveis[projeto.id],
    }));
    const issue = tipo === 'issue';

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 px-[26px] pb-3 pt-6">
                <div role="tablist" aria-label="Tipo" className="flex h-8 rounded-md border border-borda bg-superficie p-0.5">
                    {(['pr', 'issue'] as TipoItemGitHub[]).map((opcao) => (
                        <button
                            key={opcao}
                            role="tab"
                            aria-selected={tipo === opcao}
                            onClick={() => alterar({ tipo: opcao })}
                            className="rounded-[5px] px-2.5 text-[12px] font-medium text-discreto hover:text-principal
                                aria-selected:bg-selecionado aria-selected:text-principal"
                        >
                            {opcao === 'pr' ? 'Pull requests' : 'Issues'}
                        </button>
                    ))}
                </div>
                <BuscaGitHub valor={busca} alterar={definirBusca} tipo={tipo} />
                <MenuOrdemGitHub ordem={ordem} tipo={tipo} escolher={(valor) => alterar({ ordem: valor })} />
                <MenuFiltrosGitHub
                    tipo={tipo}
                    estado={estadoFiltro}
                    envolvimento={envolvimento}
                    projetoId={projetoId}
                    projetos={opcoesProjetos}
                    escolherEstado={(valor) => alterar({ estado: valor })}
                    escolherEnvolvimento={(valor) => alterar({ envolvimento: valor })}
                    escolherProjeto={(valor) => alterar({ projetoId: valor })}
                />
                <button
                    className={classeBotaoIconeBarra}
                    aria-label="Abrir no GitHub"
                    title="Abrir no GitHub"
                    onClick={() => void ponte?.abrirGitHub(urlGitHub)}
                >
                    <GithubLogoIcon size={16} />
                </button>
                <button
                    className={classeBotaoIconeBarra}
                    aria-label="Atualizar"
                    title="Atualizar"
                    disabled={lendo}
                    onClick={() => definirVersao((anterior) => anterior + 1)}
                >
                    <RefreshCwIcon className={`size-4 ${lendo ? 'motion-safe:animate-spin' : ''}`} />
                </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto px-[14px] pb-6">
                {!todosFalharam &&
                    alvos
                        .filter((projeto) => leitura?.indisponiveis[projeto.id] || leitura?.avisos[projeto.id])
                        .map((projeto) => (
                            <p
                                key={projeto.id}
                                role="status"
                                className="mx-3 mb-3 truncate rounded-md border border-[#6f403b]/60 bg-[#33201f]/50 px-3
                                    py-2 text-[12px] text-[#f0b2ae]"
                                title={leitura?.indisponiveis[projeto.id] || leitura?.avisos[projeto.id]}
                            >
                                {projeto.nome}: {leitura?.indisponiveis[projeto.id] || leitura?.avisos[projeto.id]}
                            </p>
                        ))}
                {todosFalharam ? (
                    <p role="alert" className="mx-3 my-2 text-[12px] text-[#f0b2ae]">
                        {erros[0]}
                    </p>
                ) : !leitura && alvos.length ? (
                    <EsqueletoListaGitHub />
                ) : lendo && busca.trim() && !grupos.length ? (
                    <EsqueletoListaGitHub legenda={`Buscando “${busca.trim()}”`} />
                ) : !grupos.length ? (
                    <VazioGitHub
                        busca={buscaAdiada}
                        filtrado={estadoFiltro !== 'open' || envolvimento !== 'todos' || projetoId !== null}
                        issue={issue}
                        semProjetos={!projetos.length}
                        atualizando={lendo}
                        limparBusca={() => definirBusca('')}
                        atualizar={() => definirVersao((anterior) => anterior + 1)}
                    />
                ) : (
                    <div className={`flex flex-col gap-4 ${lendo ? 'opacity-70' : ''}`}>
                        {grupos.map((grupo) => (
                            <section key={grupo.repositorio}>
                                <CabecalhoGrupoGitHub grupo={grupo} />
                                <ul className="m-0 flex list-none flex-col p-0">
                                    {grupo.itens.map((item) => (
                                        <LinhaItemGitHub
                                            key={`${item.repositorio}#${item.numero}`}
                                            item={item}
                                            issue={issue}
                                            abrir={() => void ponte?.abrirGitHub(item.url)}
                                        />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
