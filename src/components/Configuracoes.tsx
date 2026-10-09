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
        <div
            data-ui="tela-configuracoes"
            className={[
                'grid grid-cols-[160px_minmax(0,_1fr)] gap-[44px] w-full min-h-0 px-[40px] py-[38px]',
                '[@media(width<=1000px)]:grid-cols-[122px_minmax(0,_1fr)]',
                '[@media(width<=1000px)]:gap-[20px] [@media(width<=1000px)]:px-[20px]',
                '[@media(width<=1000px)]:py-[28px]',
            ].join(' ')}
        >
            <nav
                data-ui="navegacao-configuracoes"
                className={[
                    'flex flex-col gap-[6px] [&_button]:flex [&_button]:items-center [&_button]:gap-[11px]',
                    '[&_button]:rounded-[7px] [&_button]:bg-transparent [&_button]:text-[#a1a5ad]',
                    '[&_button]:text-left [&_button]:text-[13px] [&_button]:px-[14px] [&_button]:py-[12px]',
                    '[&_button]:border-0 [&_button]:border-solid [&_button]:border-current',
                    '[&_button:hover]:bg-[#202328] [&_button:hover]:text-[#e5e9e7]',
                    "[&_button[aria-current='page']]:bg-[#202328] [&_button[aria-current='page']]:text-[#e5e9e7]",
                ].join(' ')}
                aria-label="Seções das configurações"
            >
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
            <section
                data-ui="conteudo-configuracoes"
                className={[
                    'overflow-y-auto min-w-0 max-w-[800px] pt-0 pb-[24px] px-[6px] [&_h2]:text-[19px]',
                    '[&_h2]:font-medium [&_h2]:mt-0 [&_h2]:mb-[28px] [&_h2]:mx-0 [&_textarea]:resize-y',
                    '[&_textarea]:leading-[1.7]',
                ].join(' ')}
                aria-label="Configurações"
            >
                {secao === 'modelos' ? (
                    <ModelosConfiguracoes estado={estado} ponte={ponte} executar={executar} />
                ) : (
                    <form
                        data-ui="formulario-config"
                        className={[
                            '[[data-ui~=conteudo-configuracoes]_&]:mt-[0]',
                            '[[data-ui~=conteudo-configuracoes]_&]:gap-[28px]',
                            '[[data-ui~=conteudo-configuracoes]_&_h2]:mb-0 flex flex-col gap-[17px] mt-[25px]',
                            '[&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-[12px]',
                            '[&_label]:text-[#b9bec6] [&_input]:bg-[#0d0f12] [&_input]:text-[#e6e7e9]',
                            '[&_input]:rounded-[7px] [&_input]:w-full [&_input]:p-[9px] [&_input]:border',
                            '[&_input]:border-solid [&_input]:border-[#363a42] [&_select]:bg-[#0d0f12]',
                            '[&_select]:text-[#e6e7e9] [&_select]:rounded-[7px] [&_select]:w-full [&_select]:p-[9px]',
                            '[&_select]:border [&_select]:border-solid [&_select]:border-[#363a42]',
                            '[&_textarea]:bg-[#0d0f12] [&_textarea]:text-[#e6e7e9] [&_textarea]:rounded-[7px]',
                            '[&_textarea]:w-full [&_textarea]:p-[9px] [&_textarea]:border [&_textarea]:border-solid',
                            '[&_textarea]:border-[#363a42]',
                        ].join(' ')}
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
                        <div
                            data-ui="rodape-configuracoes"
                            className={[
                                'flex justify-between items-center gap-[16px] border-t border-solid',
                                'border-t-[#272a30] pt-[24px] text-[12px]',
                            ].join(' ')}
                        >
                            <span
                                data-ui="texto-secundario"
                                className={[
                                    'text-[#a1a5ad] text-[12px] leading-[1.7]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                    '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                                    '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                    '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                                ].join(' ')}
                                role="status"
                            >
                                {salvou ? 'Configurações salvas' : alterado ? 'Alterações não salvas' : ''}
                            </span>
                            <button
                                type="submit"
                                data-ui="botao botao-primario"
                                className={[
                                    'inline-flex items-center justify-center gap-[9px] bg-[#d8e5dd] rounded-[8px]',
                                    'whitespace-nowrap text-[#18241e] px-[14px] py-[9px] border border-solid',
                                    'border-transparent [&:hover:not(:disabled)]:bg-[#c0d5c8]',
                                    [
                                        '[[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                        '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    ].join(' '),
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                                ].join(' ')}
                                disabled={ocupado || !alterado}
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
