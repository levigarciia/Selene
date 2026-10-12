import { useEffect, useRef, useState } from 'react';
import {
    esquemaConfiguracao,
    type Configuracao,
    type Estado,
    type PonteSelene,
    type Resultado,
} from '../../shared/contratos';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { ProvedoresConfiguracoes } from './ProvedoresConfiguracoes';
import { CamposGeracao } from './CamposGeracao';
import { ConfiguracaoMotor } from './ConfiguracaoMotor';
import { ModelosConfiguracoes } from './ModelosConfiguracoes';
import { AtualizacaoAplicativo } from './AtualizacaoAplicativo';
import { ConfiguracaoAcessoWeb } from './ConfiguracaoAcessoWeb';
import { ConfiguracaoMemoria } from './ConfiguracaoMemoria';
import { Secao, useAlvoBusca } from './PainelConfiguracoes';
import type { SecaoConfiguracoes } from './secoesConfiguracoes';

export type Executar = <T>(operacao: () => Promise<Resultado<T>>) => Promise<T | undefined>;

/** Conteúdo das configurações; a navegação fica na sidebar própria. Alterações válidas são salvas sozinhas. */
export function Configuracoes({
    estado: estadoExterno,
    ponte,
    executar,
    secao,
    alvo,
    concluirAlvo,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    secao: SecaoConfiguracoes;
    alvo: string | null;
    concluirAlvo: () => void;
}) {
    const [estado, definirEstadoTela] = useState(estadoExterno);
    const [configuracao, definirConfiguracao] = useState<Configuracao>(estadoExterno.configuracao);
    const ultimaSalva = useRef(estadoExterno.configuracao);
    const rolagem = useRef<HTMLElement>(null);
    const [hardware, definirHardware] = useState<HardwareLocal>();
    const [consultando, definirConsultando] = useState(false);
    const [erroHardware, definirErroHardware] = useState('');
    const [salvando, definirSalvando] = useState(false);
    useAlvoBusca(alvo, concluirAlvo);
    useEffect(() => {
        if (!alvo) rolagem.current?.scrollTo({ top: 0 });
    }, [secao]);
    useEffect(() => {
        const anteriorSalva = ultimaSalva.current;
        definirConfiguracao((anterior) =>
            JSON.stringify(anterior) === JSON.stringify(anteriorSalva) ? estadoExterno.configuracao : anterior,
        );
        ultimaSalva.current = estadoExterno.configuracao;
        definirEstadoTela((anterior) => ({ ...estadoExterno, modelos: anterior.modelos }));
    }, [estadoExterno]);
    async function consultarHardware() {
        if (!ponte) return;
        definirConsultando(true);
        definirErroHardware('');
        try {
            const resultado = await ponte.consultarHardware();
            if (resultado.ok) definirHardware(resultado.valor);
            else definirErroHardware(resultado.erro);
        } catch {
            definirErroHardware('Não foi possível consultar o hardware.');
        } finally {
            definirConsultando(false);
        }
    }
    useEffect(() => {
        void consultarHardware();
    }, [ponte, estado.configuracao.backend]);
    const ocupado = !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    const alterado = JSON.stringify(configuracao) !== JSON.stringify(estado.configuracao);
    const valido = esquemaConfiguracao.safeParse(configuracao).success;
    useEffect(() => {
        if (!ponte || !alterado || !valido || ocupado || salvando) return;
        const temporizador = setTimeout(async () => {
            definirSalvando(true);
            try {
                await executar(() => ponte.configurar(configuracao));
            } finally {
                definirSalvando(false);
            }
        }, 700);
        return () => clearTimeout(temporizador);
    }, [configuracao, alterado, valido, ocupado, salvando, ponte]);
    const alterar = <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) =>
        definirConfiguracao((anterior) => ({ ...anterior, [chave]: valor }));
    const campos = { configuracao, ocupado, alterar };
    const atividades = estado.downloads.filter((item) => ['baixando', 'verificando'].includes(item.fase));
    return (
        <div data-ui="tela-configuracoes" className="flex min-h-0 w-full min-w-0 flex-col">
            <section
                ref={rolagem}
                data-ui="conteudo-configuracoes"
                aria-label="Configurações"
                className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]"
            >
                <div
                    className={`mx-auto flex w-full ${secao === 'provedores' ? 'max-w-[60rem]' : 'max-w-[42rem]'} flex-col gap-8 px-6 pt-8 pb-16 max-sm:px-3`}
                >
                    {secao === 'provedores' && alterado && (
                        <p role="status" className="-mb-4 px-4 text-right text-xs text-discreto">
                            {!valido ? 'Valor inválido, não salvo' : salvando ? 'Salvando' : 'Alterações pendentes'}
                        </p>
                    )}
                    {atividades.length > 0 && (
                        <Secao titulo="Downloads">
                            {atividades.map((item) => (
                                <div key={item.catalogoId} className="flex items-center gap-3 px-4 py-3 text-xs">
                                    <span className="min-w-0 flex-1 truncate text-sm">{item.catalogoId}</span>
                                    <span role="status" className="text-secundario tabular-nums">
                                        {item.fase === 'verificando'
                                            ? 'Verificando'
                                            : `${Math.floor((item.recebido / Math.max(1, item.total)) * 100)}%`}
                                    </span>
                                    <button
                                        className="text-secundario hover:text-principal"
                                        type="button"
                                        onClick={() => executar(() => ponte!.cancelarDownload(item.catalogoId))}
                                    >
                                        Cancelar download
                                    </button>
                                </div>
                            ))}
                        </Secao>
                    )}
                    {secao === 'geral' && (
                        <Secao titulo="Sobre">
                            <AtualizacaoAplicativo estado={estado.atualizacao} ponte={ponte} executar={executar} />
                        </Secao>
                    )}
                    {secao === 'modelos' && (
                        <ModelosConfiguracoes estado={estado} ponte={ponte} executar={executar} hardware={hardware} />
                    )}
                    {secao === 'provedores' && (
                        <ProvedoresConfiguracoes
                            ponte={ponte}
                            executar={executar}
                            ocupado={ocupado}
                            openrouterConfigurado={!!estado.openrouterConfigurado}
                            modelos={estado.modelos}
                            adicionarModelo={async (entrada) => {
                                if (!ponte) return false;
                                const cadastrado = await executar(async () => {
                                    const resultado = await ponte.adicionarModeloAssinatura(entrada);
                                    if (resultado.ok && resultado.valor) {
                                        definirEstadoTela((anterior) => ({
                                            ...anterior,
                                            modelos: anterior.modelos.some((modelo) => modelo.id === resultado.valor.id)
                                                ? anterior.modelos
                                                : [...anterior.modelos, resultado.valor],
                                        }));
                                    }
                                    return resultado;
                                });
                                return !!cadastrado;
                            }}
                            alvo={alvo}
                            removerModelo={async (id) => {
                                if (!ponte) return;
                                const removido = await executar(() => ponte.removerModelo(id));
                                if (removido !== undefined)
                                    definirEstadoTela((anterior) => ({
                                        ...anterior,
                                        modelos: anterior.modelos.filter((modelo) => modelo.id !== id),
                                    }));
                            }}
                            respostas={<CamposGeracao {...campos} />}
                            motor={
                                <ConfiguracaoMotor
                                    {...campos}
                                    estado={estado}
                                    ponte={ponte}
                                    executar={executar}
                                    hardware={hardware}
                                    consultando={consultando}
                                    erroHardware={erroHardware}
                                    consultar={consultarHardware}
                                />
                            }
                        />
                    )}
                    {secao === 'memoria' && (
                        <ConfiguracaoMemoria
                            {...campos}
                            memorias={estado.memorias}
                            openrouterConfigurado={!!estado.openrouterConfigurado}
                            ponte={ponte}
                            executar={executar}
                        />
                    )}
                    {secao === 'web' &&<ConfiguracaoAcessoWeb ponte={ponte} executar={executar} />}
                </div>
            </section>
        </div>
    );
}
