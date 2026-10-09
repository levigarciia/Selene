import { useEffect, useRef, useState } from 'react';
import { ChatCircleIcon, CpuIcon, StackIcon } from '@phosphor-icons/react';
import type { Configuracao, Estado, PonteSelene, Resultado } from '../../shared/contratos';
import { CamposGeracao } from './CamposGeracao';
import { ConfiguracaoMotor } from './ConfiguracaoMotor';
import { ModelosConfiguracoes } from './ModelosConfiguracoes';
import { AtualizacaoAplicativo } from './AtualizacaoAplicativo';

export type Executar = <T>(operacao: () => Promise<Resultado<T>>) => Promise<T | undefined>;
type Secao = 'geral' | 'modelos' | 'motor';

/** Mantém configurações em uma tela com áreas independentes para geração, modelos e motor. */
export function Configuracoes({
    estado,
    ponte,
    executar,
}: {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [secao, definirSecao] = useState<Secao>('geral');
    const [configuracao, definirConfiguracao] = useState<Configuracao>(estado.configuracao);
    const ultimaSalva = useRef(estado.configuracao);
    useEffect(() => {
        const anteriorSalva = ultimaSalva.current;
        definirConfiguracao((anterior) =>
            JSON.stringify(anterior) === JSON.stringify(anteriorSalva) ? estado.configuracao : anterior,
        );
        ultimaSalva.current = estado.configuracao;
    }, [estado.configuracao]);
    const [salvando, definirSalvando] = useState(false);
    const [salvou, definirSalvou] = useState(false);
    const ocupado = salvando || !!estado.conversaEmExecucao || ['instalando', 'carregando'].includes(estado.motor.fase);
    const alterado = JSON.stringify(configuracao) !== JSON.stringify(estado.configuracao);
    const alterar = <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) => {
        definirConfiguracao((anterior) => ({ ...anterior, [chave]: valor }));
        definirSalvou(false);
    };
    const campos = { configuracao, ocupado, alterar };
    return (
        <div className="tela-configuracoes">
            <nav className="navegacao-configuracoes" aria-label="Seções das configurações">
                {(
                    [
                        { id: 'geral', nome: 'Geral', Icone: ChatCircleIcon },
                        { id: 'modelos', nome: 'Modelos', Icone: StackIcon },
                        { id: 'motor', nome: 'Motor', Icone: CpuIcon },
                    ] as const
                ).map(({ id, nome, Icone }) => (
                    <button key={id} aria-current={secao === id ? 'page' : undefined} onClick={() => definirSecao(id)}>
                        <Icone size={18} />
                        {nome}
                    </button>
                ))}
            </nav>
            <section className="conteudo-configuracoes" aria-label="Configurações">
                {secao === 'modelos' ? (
                    <ModelosConfiguracoes estado={estado} ponte={ponte} executar={executar} />
                ) : (
                    <form
                        className="formulario-config"
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
                                <AtualizacaoAplicativo estado={estado.atualizacao} ponte={ponte} executar={executar} />
                            </>
                        ) : (
                            <ConfiguracaoMotor {...campos} estado={estado} ponte={ponte} executar={executar} />
                        )}
                        <div className="rodape-configuracoes">
                            <span className="texto-secundario" role="status">
                                {salvou ? 'Configurações salvas' : alterado ? 'Alterações não salvas' : ''}
                            </span>
                            <button type="submit" className="botao botao-primario" disabled={ocupado || !alterado}>
                                {salvando ? 'Salvando' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
