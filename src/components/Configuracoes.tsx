import { useEffect, useRef, useState } from 'react';
import { ChatCircleIcon, CpuIcon, StackIcon, GlobeIcon } from '@phosphor-icons/react';
import type { Configuracao, Estado, PonteSelene, Resultado } from '../../shared/contratos';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { ConfiguracaoOpenRouter } from './ConfiguracaoOpenRouter';
import { CamposGeracao } from './CamposGeracao';
import { ConfiguracaoMotor } from './ConfiguracaoMotor';
import { ModelosConfiguracoes } from './ModelosConfiguracoes';
import { AtualizacaoAplicativo } from './AtualizacaoAplicativo';
import { ConfiguracaoAcessoWeb } from './ConfiguracaoAcessoWeb';

export type Executar = <T>(operacao: () => Promise<Resultado<T>>) => Promise<T | undefined>;
type Secao = 'geral' | 'modelos' | 'motor' | 'web';

/** Reúne modelos, motor e preferências com detalhes disponíveis sob demanda. */
export function Configuracoes({
    estado,
    ponte,
    executar,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [secao, definirSecao] = useState<Secao>('modelos');
    const [configuracao, definirConfiguracao] = useState<Configuracao>(estado.configuracao);
    const ultimaSalva = useRef(estado.configuracao);
    const [hardware, definirHardware] = useState<HardwareLocal>();
    const [consultando, definirConsultando] = useState(false);
    const [erroHardware, definirErroHardware] = useState('');
    const [salvando, definirSalvando] = useState(false);
    const [salvou, definirSalvou] = useState(false);
    useEffect(() => {
        const anteriorSalva = ultimaSalva.current;
        definirConfiguracao((anterior) =>
            JSON.stringify(anterior) === JSON.stringify(anteriorSalva) ? estado.configuracao : anterior,
        );
        ultimaSalva.current = estado.configuracao;
    }, [estado.configuracao]);
    useEffect(() => {
        let ativo = true;
        if (!ponte) return;
        definirConsultando(true);
        definirHardware(undefined);
        definirErroHardware('');
        ponte
            ?.consultarHardware()
            .then((resultado) => {
                if (!ativo) return;
                if (resultado.ok) definirHardware(resultado.valor);
                else definirErroHardware(resultado.erro);
            })
            .catch(() => {
                if (ativo) definirErroHardware('Não foi possível consultar o hardware.');
            })
            .finally(() => {
                if (ativo) definirConsultando(false);
            });
        return () => {
            ativo = false;
        };
    }, [ponte, estado.configuracao.backend]);
    const ocupado = salvando || !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    const alterado = JSON.stringify(configuracao) !== JSON.stringify(estado.configuracao);
    const alterar = <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) => {
        definirConfiguracao((anterior) => ({ ...anterior, [chave]: valor }));
        definirSalvou(false);
    };
    const campos = { configuracao, ocupado, alterar };
    const atividades = estado.downloads.filter((item) => ['baixando', 'verificando'].includes(item.fase));
    return (
        <div
            data-ui="tela-configuracoes"
            className="w-full min-h-0 max-w-[1060px] mx-auto px-8 py-7 flex flex-col gap-6 max-sm:px-4"
        >
            <nav
                data-ui="navegacao-configuracoes"
                aria-label="Seções das configurações"
                className="flex flex-wrap gap-1 border-b border-borda pb-3"
            >
                {(
                    [
                        { id: 'modelos', nome: 'Modelos', Icone: StackIcon },
                        { id: 'motor', nome: 'Motor', Icone: CpuIcon },
                        { id: 'geral', nome: 'Geral', Icone: ChatCircleIcon },
                        { id: 'web', nome: 'Acesso web', Icone: GlobeIcon },
                    ] as const
                ).map(({ id, nome, Icone }) => (
                    <button
                        key={id}
                        aria-current={secao === id ? 'page' : undefined}
                        onClick={() => definirSecao(id)}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-secundario
                            hover:bg-hover hover:text-principal aria-[current=page]:bg-hover
                            aria-[current=page]:text-principal"
                    >
                        <Icone size={16} />
                        {nome}
                    </button>
                ))}
            </nav>
            {atividades.length > 0 && (
                <div aria-label="Atividades" className="flex flex-col gap-2 text-xs">
                    {atividades.map((item) => (
                        <div key={item.catalogoId} className="flex flex-wrap items-center gap-3">
                            <span>{item.catalogoId}</span>
                            <span role="status" className="text-secundario">
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
                </div>
            )}
            {secao !== 'motor' && estado.motor.fase === 'erro' && (
                <button className="text-left text-xs text-[#eab1aa]" onClick={() => definirSecao('motor')}>
                    O motor precisa de atenção. Ver diagnóstico
                </button>
            )}
            <section
                data-ui="conteudo-configuracoes"
                aria-label="Configurações"
                className="overflow-y-auto min-w-0 pb-5 [&_h2]:text-base [&_h2]:font-medium [&_h2]:mb-4"
            >
                {secao === 'web' ? (
                    <ConfiguracaoAcessoWeb ponte={ponte} executar={executar} />
                ) : secao === 'modelos' ? (
                    <ModelosConfiguracoes estado={estado} ponte={ponte} executar={executar} hardware={hardware} />
                ) : (
                    <form
                        data-ui="formulario-config"
                        className="flex max-w-[680px] flex-col gap-5
                        [&_label]:flex [&_label]:flex-col [&_label]:gap-2 [&_label]:text-xs
                        [&_input:not([type=checkbox])]:bg-[#0d0f12] [&_input:not([type=checkbox])]:p-2
                        [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-borda
                        [&_input]:rounded-md [&_select]:bg-[#0d0f12] [&_select]:p-2 [&_select]:rounded-md
                        [&_select]:border [&_select]:border-borda [&_textarea]:bg-[#0d0f12]
                        [&_textarea]:p-2 [&_textarea]:border [&_textarea]:border-borda [&_textarea]:rounded-md"
                        onSubmit={async (evento) => {
                            evento.preventDefault();
                            definirSalvando(true);
                            try {
                                await executar(async () => {
                                    const resultado = await ponte!.configurar(configuracao);
                                    if (resultado.ok) definirSalvou(true);
                                    return resultado;
                                });
                            } finally {
                                definirSalvando(false);
                            }
                        }}
                    >
                        {secao === 'geral' ? (
                            <>
                                <CamposGeracao {...campos} />
                                <ConfiguracaoOpenRouter
                                    configurado={!!estado.openrouterConfigurado}
                                    ocupado={ocupado}
                                    ponte={ponte}
                                    executar={executar}
                                />
                                <AtualizacaoAplicativo estado={estado.atualizacao} ponte={ponte} executar={executar} />
                            </>
                        ) : (
                            <ConfiguracaoMotor
                                {...campos}
                                estado={estado}
                                ponte={ponte}
                                executar={executar}
                                hardware={hardware}
                                consultando={consultando}
                                erroHardware={erroHardware}
                                consultar={async () => {
                                    definirConsultando(true);
                                    definirErroHardware('');
                                    try {
                                        await executar(async () => {
                                            const resultado = await ponte!.consultarHardware();
                                            if (resultado.ok) definirHardware(resultado.valor);
                                            else definirErroHardware(resultado.erro);
                                            return resultado;
                                        });
                                    } finally {
                                        definirConsultando(false);
                                    }
                                }}
                            />
                        )}
                        <div className="flex justify-between items-center gap-4 border-t border-borda pt-4 text-xs">
                            <span role="status" className="text-secundario">
                                {salvou ? 'Configurações salvas' : alterado ? 'Alterações não salvas' : ''}
                            </span>
                            <button
                                type="submit"
                                disabled={ocupado || !alterado}
                                className="rounded-md bg-[#e0d8ef] text-[#251b38] px-4 py-2 disabled:opacity-40"
                            >
                                {salvando ? 'Salvando' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
