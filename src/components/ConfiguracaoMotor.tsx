import { DownloadSimpleIcon, PlayIcon, StopIcon } from '@phosphor-icons/react';
import type { Estado, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import type { CamposConfiguracao } from './CamposGeracao';

/** Separa o estado do motor dos parâmetros que serão aplicados na próxima carga. */
export function ConfiguracaoMotor({
    estado,
    ponte,
    executar,
    configuracao,
    ocupado,
    alterar,
}: CamposConfiguracao & { estado: Estado; ponte?: PonteSelene; executar: Executar }) {
    const backend = estado.configuracao.backend === 'auto' ? estado.motor.backendAtivo : estado.configuracao.backend;
    const instalado = backend ? estado.motor.instalado[backend] : false;
    return (
        <>
            <h2>Motor local</h2>
            <div
                data-ui="estado-motor-config"
                className={[
                    'flex flex-col gap-[14px] pb-[26px] border-b border-solid',
                    'border-b-hover text-[12px] wrap-anywhere',
                ].join(' ')}
            >
                <p role="status">{estado.motor.detalhe}</p>
                {estado.motor.dispositivo && (
                    <p
                        data-ui="texto-secundario"
                        className={[
                            'text-secundario text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        {estado.motor.dispositivo}
                    </p>
                )}
                {estado.motor.recarregamentoPendente && (
                    <p
                        data-ui="texto-secundario"
                        className={[
                            'text-secundario text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        Os novos parâmetros serão aplicados no próximo envio ou ao recarregar.
                    </p>
                )}
                <div className="flex flex-wrap gap-3">
                    {['instalando', 'carregando'].includes(estado.motor.fase) ? (
                        <button
                            type="button"
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-superficie rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-borda',
                                '[&:hover:not(:disabled)]:bg-hover [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            onClick={() => executar(() => ponte!.cancelar())}
                        >
                            Cancelar
                        </button>
                    ) : (
                        <button
                            type="button"
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-superficie rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-borda',
                                '[&:hover:not(:disabled)]:bg-hover [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado || instalado}
                            onClick={() => executar(() => ponte!.instalarMotor(estado.configuracao.backend))}
                        >
                            <DownloadSimpleIcon size={16} /> {instalado ? 'Motor instalado' : 'Instalar motor'}
                        </button>
                    )}
                    {estado.motor.fase === 'pronto' && (
                        <>
                            <button
                                type="button"
                                data-ui="botao"
                                className={[
                                    'inline-flex items-center justify-center gap-[9px] bg-superficie rounded-[8px]',
                                    'whitespace-nowrap px-[14px] py-[9px] border border-solid border-borda',
                                    '[&:hover:not(:disabled)]:bg-hover [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    [
                                        '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                        '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                    ].join(' '),
                                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                                ].join(' ')}
                                disabled={ocupado}
                                onClick={() => executar(() => ponte!.carregarModelo(estado.motor.modeloId!))}
                            >
                                <PlayIcon size={16} /> Recarregar modelo
                            </button>
                            <button
                                type="button"
                                data-ui="botao"
                                className={[
                                    'inline-flex items-center justify-center gap-[9px] bg-superficie rounded-[8px]',
                                    'whitespace-nowrap px-[14px] py-[9px] border border-solid border-borda',
                                    '[&:hover:not(:disabled)]:bg-hover [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    [
                                        '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                        '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                    ].join(' '),
                                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                                ].join(' ')}
                                disabled={ocupado}
                                onClick={() => executar(() => ponte!.pararMotor())}
                            >
                                <StopIcon size={16} /> Descarregar modelo
                            </button>
                        </>
                    )}
                </div>
                {estado.motor.fase === 'instalando' && (
                    <progress
                        className="accent-[#b5a2dc]"
                        value={estado.motor.progresso ?? 0}
                        max={100}
                        aria-label="Download do motor"
                    />
                )}
            </div>
            <p
                data-ui="texto-secundario"
                className={[
                    'text-secundario text-[12px] leading-[1.7]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                    '[[data-ui~=usuario-direita]_&]:text-secundario',
                    '[[data-ui~=usuario-direita]_&]:text-[12px]',
                    '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                ].join(' ')}
            >
                Contexto automático
                {estado.motor.contextoDisponivel
                    ? `: ${estado.motor.contextoDisponivel.toLocaleString('pt-BR')} tokens`
                    : ': definido ao carregar o modelo'}
                .
            </p>
            <div className="grid grid-cols-2 gap-5">
                <label>
                    Processamento
                    <select
                        aria-label="Processamento"
                        value={configuracao.backend}
                        disabled={ocupado}
                        onChange={(evento) => alterar('backend', evento.target.value as typeof configuracao.backend)}
                    >
                        <option value="auto">Automático</option>
                        <option value="rocm">GPU AMD com ROCm</option>
                        <option value="vulkan">GPU com Vulkan</option>
                        <option value="cpu">CPU</option>
                    </select>
                </label>
                <label>
                    Camadas na GPU
                    <input
                        type={configuracao.limitesAutomaticos ? 'text' : 'number'}
                        min="0"
                        max="999"
                        value={configuracao.limitesAutomaticos ? 'Automáticas' : configuracao.camadasGpu}
                        disabled={ocupado || configuracao.limitesAutomaticos}
                        onChange={(evento) => alterar('camadasGpu', Number(evento.target.value))}
                    />
                </label>
            </div>
        </>
    );
}
