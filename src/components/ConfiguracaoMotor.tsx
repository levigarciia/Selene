import type { Estado, PonteSelene } from '../../shared/contratos';
import type { HardwareLocal } from '../../shared/compatibilidadeModelo';
import { diagnosticarMotor } from '../../shared/diagnosticoMotor';
import type { Executar } from './Configuracoes';
import type { CamposConfiguracao } from './CamposGeracao';
import { CamposPerfilMotor } from './CamposPerfilMotor';

const botao = 'rounded-md border border-borda px-3 py-2 text-xs hover:bg-hover disabled:opacity-40';
const gigabytes = (valor: number) => `${(valor / 1024 ** 3).toFixed(1)} GB`;

/** Apresenta hardware, operação e recuperação sem expor a saída técnica como estado principal. */
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
    return (
        <>
            <div className="flex justify-between items-center gap-4">
                <h2 className="[&&]:mb-0">Motor</h2>
                <button
                    type="button"
                    className="text-xs text-secundario hover:text-principal"
                    disabled={consultando}
                    onClick={() => void consultar()}
                >
                    {consultando ? 'Consultando hardware' : 'Atualizar hardware'}
                </button>
            </div>
            {hardware && (
                <div className="text-xs flex flex-col gap-2 text-secundario" aria-label="Hardware detectado">
                    <span>{hardware.gpu?.nome ?? hardware.processador}</span>
                    <span>
                        {hardware.gpu ? `${gigabytes(hardware.gpu.memoria)} de VRAM total. ` : ''}
                        {gigabytes(hardware.ramLivre)} de RAM livre, {gigabytes(hardware.ramTotal)} no total
                    </span>
                    {hardware.aviso && <span>{hardware.aviso}</span>}
                </div>
            )}
            {erroHardware && (
                <p role="alert" className="text-xs text-[#eab1aa]">
                    {erroHardware}
                </p>
            )}
            <div data-ui="estado-motor-config" className="flex flex-col gap-3 border-y border-borda py-4 text-xs">
                <p role={erro ? 'alert' : 'status'}>{diagnostico?.causa ?? estado.motor.detalhe}</p>
                {diagnostico && (
                    <>
                        <p className="text-secundario">{diagnostico.sugestao}</p>
                        <details>
                            <summary className="cursor-pointer text-secundario">Detalhes técnicos</summary>
                            <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-secundario">
                                {estado.motor.detalhe}
                            </pre>
                        </details>
                    </>
                )}
                {estado.motor.contextoDisponivel && (
                    <span className="text-secundario">
                        {estado.motor.contextoDisponivel.toLocaleString('pt-BR')} tokens de contexto
                        {estado.motor.dispositivo ? `. ${estado.motor.dispositivo}` : ''}
                    </span>
                )}
                {estado.motor.recarregamentoPendente && (
                    <p className="text-secundario">As alterações serão aplicadas na próxima carga ou envio.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {['instalando', 'carregando'].includes(estado.motor.fase) ? (
                        <button type="button" className={botao} onClick={() => executar(() => ponte!.cancelar())}>
                            Cancelar
                        </button>
                    ) : (
                        <>
                            {!instalado && (
                                <button
                                    type="button"
                                    className={botao}
                                    disabled={ocupado || alterado}
                                    onClick={() => executar(() => ponte!.instalarMotor(estado.configuracao.backend))}
                                >
                                    Instalar motor
                                </button>
                            )}
                            {modelo && (
                                <button
                                    type="button"
                                    className={botao}
                                    disabled={ocupado || alterado}
                                    onClick={() => executar(() => ponte!.carregarModelo(modelo.id))}
                                >
                                    {erro ? 'Tentar novamente' : 'Recarregar modelo'}
                                </button>
                            )}
                            {estado.motor.fase === 'pronto' && (
                                <button
                                    type="button"
                                    className={botao}
                                    disabled={ocupado}
                                    onClick={() => executar(() => ponte!.pararMotor())}
                                >
                                    Descarregar modelo
                                </button>
                            )}
                        </>
                    )}
                </div>
                {estado.motor.progresso !== undefined && ['instalando', 'carregando'].includes(estado.motor.fase) && (
                    <progress
                        className="w-full accent-[#b5a2dc]"
                        value={estado.motor.progresso}
                        max={100}
                        aria-label="Progresso do motor"
                    />
                )}
            </div>
            {modelo?.perfil && (
                <p className="text-xs text-secundario">
                    {modelo.nome} usa um perfil próprio. Edite esse perfil na área Modelos.
                </p>
            )}
            <CamposPerfilMotor
                perfil={configuracao}
                ocupado={ocupado}
                alterar={(perfil) => {
                    alterar('backend', perfil.backend);
                    alterar('limitesAutomaticos', perfil.limitesAutomaticos);
                    alterar('contexto', perfil.contexto);
                    alterar('camadasGpu', perfil.camadasGpu);
                }}
            />
        </>
    );
}
