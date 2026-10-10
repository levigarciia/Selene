import type { PerfilModelo } from '../../shared/contratos';

/** Compartilha os limites de execução entre as preferências gerais e os perfis de modelo. */
export function CamposPerfilMotor({
    perfil,
    ocupado,
    alterar,
}: {
    perfil: PerfilModelo;
    ocupado: boolean;
    alterar: (perfil: PerfilModelo) => void;
}) {
    return (
        <>
            <label>
                Processamento
                <select
                    aria-label="Processamento"
                    value={perfil.backend}
                    disabled={ocupado}
                    onChange={(evento) =>
                        alterar({ ...perfil, backend: evento.target.value as PerfilModelo['backend'] })
                    }
                >
                    <option value="auto">Automático</option>
                    <option value="rocm">GPU AMD com ROCm</option>
                    <option value="vulkan">GPU com Vulkan</option>
                    <option value="cpu">CPU</option>
                </select>
            </label>
            <details className="text-xs">
                <summary className="cursor-pointer py-2 text-secundario">Avançado</summary>
                <div className="flex flex-col gap-4 pt-3">
                    <label className="[&&]:flex-row items-center">
                        <input
                            type="checkbox"
                            checked={perfil.limitesAutomaticos}
                            disabled={ocupado}
                            onChange={(evento) => alterar({ ...perfil, limitesAutomaticos: evento.target.checked })}
                        />
                        Ajustar memória automaticamente
                    </label>
                    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                        <label>
                            Contexto
                            <input
                                type="number"
                                min={2048}
                                max={16777216}
                                step={1}
                                value={Number.isFinite(perfil.contexto) ? perfil.contexto : ''}
                                disabled={ocupado || perfil.limitesAutomaticos}
                                onChange={(evento) => alterar({ ...perfil, contexto: evento.target.valueAsNumber })}
                            />
                        </label>
                        <label>
                            Camadas na GPU
                            <input
                                type="number"
                                min={0}
                                max={999}
                                step={1}
                                value={Number.isFinite(perfil.camadasGpu) ? perfil.camadasGpu : ''}
                                disabled={ocupado || perfil.limitesAutomaticos || perfil.backend === 'cpu'}
                                onChange={(evento) => alterar({ ...perfil, camadasGpu: evento.target.valueAsNumber })}
                            />
                        </label>
                    </div>
                    <p className="text-secundario">
                        {perfil.limitesAutomaticos
                            ? 'O motor define contexto e camadas conforme a memória disponível.'
                            : 'Os limites manuais serão aplicados na próxima carga.'}
                    </p>
                </div>
            </details>
        </>
    );
}
