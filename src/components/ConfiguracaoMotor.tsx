import type { Estado, PerfilModelo, PonteSelene } from '../../shared/contratos';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { diagnosticarMotor } from '../../shared/diagnosticoMotor';
import type { Executar } from './Configuracoes';
import type { CamposConfiguracao } from './CamposGeracao';
import { Alternar, Linha, Ponto, Secao, botaoPequeno, botaoSecundario, campo } from './PainelConfiguracoes';

const gigabytes = (valor: number) => `${(valor / 1024 ** 3).toFixed(1)} GB`;

/** Estado, hardware e limites padrão do motor local, sem expor a saída técnica como estado principal. */
export function ConfiguracaoMotor({
    estado,
    ponte,
    executar,
    configuracao,
    ocupado,
    alterar,
    hardware,
    consultando,
    consultar,
    erroHardware,
}: CamposConfiguracao & {
    estado: Estado;
    ponte?: PonteSelene;
    executar: Executar;
    hardware?: HardwareLocal;
    consultando: boolean;
    consultar: () => Promise<void>;
    erroHardware: string;
}) {
    const backend = estado.configuracao.backend === 'auto' ? estado.motor.backendAtivo : estado.configuracao.backend;
    const instalado = backend ? estado.motor.instalado[backend] : false;
    const erro = estado.motor.fase === 'erro';
    const diagnostico = erro ? diagnosticarMotor(estado.motor.detalhe) : undefined;
    const modelo = estado.modelos.find((item) => item.id === estado.motor.modeloId);
    const alterado = JSON.stringify(configuracao) !== JSON.stringify(estado.configuracao);
    const trabalhando = ['instalando', 'carregando'].includes(estado.motor.fase);
    const manual = !configuracao.limitesAutomaticos;
    return (
        <>
            <Secao titulo="Motor">
                <Linha
                    id="config-motor"
                    titulo={
                        <>
                            <Ponto tom={erro ? 'erro' : estado.motor.fase === 'pronto' ? 'ok' : 'neutro'} />
                            <span role={erro ? 'alert' : 'status'} className={erro ? 'text-[#eab1aa]' : ''}>
                                {diagnostico?.causa ?? estado.motor.detalhe}
                            </span>
                        </>
                    }
                    descricao={
                        diagnostico?.sugestao ??
                        (estado.motor.contextoDisponivel
                            ? `${estado.motor.contextoDisponivel.toLocaleString('pt-BR')} tokens de contexto${
                                  estado.motor.dispositivo ? `. ${estado.motor.dispositivo}` : ''
                              }`
                            : modelo
                              ? modelo.nome
                              : 'Carregue um modelo na seção Modelos.')
                    }
                    estado={
                        estado.motor.recarregamentoPendente
                            ? 'As alterações serão aplicadas na próxima carga ou envio.'
                            : undefined
                    }
                    controle={
                        trabalhando ? (
                            <button
                                type="button"
                                className={botaoSecundario}
                                onClick={() => executar(() => ponte!.cancelar())}
                            >
                                Cancelar
                            </button>
                        ) : (
                            <>
                                {!instalado && (
                                    <button
                                        type="button"
                                        className={botaoSecundario}
                                        disabled={ocupado || alterado}
                                        onClick={() =>
                                            executar(() => ponte!.instalarMotor(estado.configuracao.backend))
                                        }
                                    >
                                        Instalar motor
                                    </button>
                                )}
                                {modelo && (
                                    <button
                                        type="button"
                                        className={botaoSecundario}
                                        disabled={ocupado || alterado}
                                        onClick={() => executar(() => ponte!.carregarModelo(modelo.id))}
                                    >
                                        {erro ? 'Tentar novamente' : 'Recarregar'}
                                    </button>
                                )}
                                {estado.motor.fase === 'pronto' && (
                                    <button
                                        type="button"
                                        className={botaoSecundario}
                                        disabled={ocupado}
                                        onClick={() => executar(() => ponte!.pararMotor())}
                                    >
                                        Descarregar
                                    </button>
                                )}
                            </>
                        )
                    }
                >
                    {(trabalhando && estado.motor.progresso !== undefined) || diagnostico ? (
                        <div className="flex flex-col gap-3">
                            {trabalhando && estado.motor.progresso !== undefined && (
                                <progress
                                    className="h-1 w-full overflow-hidden rounded-full accent-[#b5a2dc]"
                                    value={estado.motor.progresso}
                                    max={100}
                                    aria-label="Progresso do motor"
                                />
                            )}
                            {diagnostico && (
                                <details className="text-xs">
                                    <summary className="cursor-pointer text-secundario">Detalhes técnicos</summary>
                                    <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-fundo p-3 whitespace-pre-wrap break-all text-secundario">
                                        {estado.motor.detalhe}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ) : undefined}
                </Linha>
                <Linha
                    id="config-hardware"
                    titulo="Hardware"
                    descricao={
                        erroHardware ? (
                            <span role="alert" className="text-[#eab1aa]">
                                {erroHardware}
                            </span>
                        ) : hardware ? (
                            <span aria-label="Hardware detectado">
                                {hardware.gpu?.nome ?? hardware.processador}
                                {hardware.gpu ? ` · ${gigabytes(hardware.gpu.memoria)} de VRAM` : ''} ·{' '}
                                {gigabytes(hardware.ramLivre)} de RAM livre de {gigabytes(hardware.ramTotal)}
                                {hardware.aviso ? `. ${hardware.aviso}` : ''}
                            </span>
                        ) : (
                            'Consultando'
                        )
                    }
                    controle={
                        <button
                            type="button"
                            className={botaoPequeno}
                            disabled={consultando}
                            onClick={() => void consultar()}
                        >
                            {consultando ? 'Consultando' : 'Atualizar'}
                        </button>
                    }
                />
            </Secao>
            <Secao titulo="Execução padrão">
                <Linha
                    id="config-processamento"
                    titulo="Processamento"
                    descricao={
                        modelo?.perfil
                            ? `${modelo.nome} usa um perfil próprio, editável em Modelos.`
                            : 'Onde o modelo roda. Modelos podem ter um perfil próprio.'
                    }
                    controle={
                        <select
                            aria-label="Processamento"
                            value={configuracao.backend}
                            disabled={ocupado}
                            className={`${campo} pr-7`}
                            onChange={(evento) => alterar('backend', evento.target.value as PerfilModelo['backend'])}
                        >
                            <option value="auto">Automático</option>
                            <option value="rocm">GPU AMD com ROCm</option>
                            <option value="vulkan">GPU com Vulkan</option>
                            <option value="cpu">CPU</option>
                        </select>
                    }
                />
                <Linha
                    titulo="Ajustar memória automaticamente"
                    descricao="O motor define contexto e camadas conforme a memória disponível."
                    controle={
                        <Alternar
                            rotulo="Ajustar memória automaticamente"
                            marcado={configuracao.limitesAutomaticos}
                            desativado={ocupado}
                            alterar={(marcado) => alterar('limitesAutomaticos', marcado)}
                        />
                    }
                />
                {manual && (
                    <>
                        <Linha
                            titulo="Contexto"
                            descricao="Tokens mantidos na memória. Aplicado na próxima carga."
                            controle={
                                <input
                                    type="number"
                                    aria-label="Contexto"
                                    min={2048}
                                    max={16777216}
                                    step={1}
                                    value={Number.isFinite(configuracao.contexto) ? configuracao.contexto : ''}
                                    disabled={ocupado}
                                    className={`${campo} w-28 text-right tabular-nums`}
                                    onChange={(evento) => alterar('contexto', evento.target.valueAsNumber)}
                                />
                            }
                        />
                        <Linha
                            titulo="Camadas na GPU"
                            descricao="Quantas camadas do modelo ficam na placa de vídeo."
                            controle={
                                <input
                                    type="number"
                                    aria-label="Camadas na GPU"
                                    min={0}
                                    max={999}
                                    step={1}
                                    value={Number.isFinite(configuracao.camadasGpu) ? configuracao.camadasGpu : ''}
                                    disabled={ocupado || configuracao.backend === 'cpu'}
                                    className={`${campo} w-20 text-right tabular-nums`}
                                    onChange={(evento) => alterar('camadasGpu', evento.target.valueAsNumber)}
                                />
                            }
                        />
                    </>
                )}
            </Secao>
        </>
    );
}
