import { useEffect, useRef, useState } from 'react';
import { esquemaPerfilModelo, type Configuracao, type Modelo, type PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { CamposPerfilMotor } from './CamposPerfilMotor';

/** Permite substituir apenas os parâmetros de execução de um modelo e retornar às preferências gerais. */
export function PerfilModelo({
    modelo,
    configuracao,
    ocupado,
    ponte,
    executar,
}: {
    modelo: Modelo;
    configuracao: Configuracao;
    ocupado: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const salvo = esquemaPerfilModelo.strip().parse(modelo.perfil ?? configuracao);
    const assinatura = JSON.stringify(salvo);
    const ultimaSalva = useRef(assinatura);
    const [perfil, definirPerfil] = useState(salvo);
    const [salvando, definirSalvando] = useState(false);
    const [mensagem, definirMensagem] = useState('');
    useEffect(() => {
        const anteriorSalvo = ultimaSalva.current;
        definirPerfil((anterior) => (JSON.stringify(anterior) === anteriorSalvo ? JSON.parse(assinatura) : anterior));
        ultimaSalva.current = assinatura;
    }, [assinatura]);
    const alterado = JSON.stringify(perfil) !== assinatura;
    const valido = esquemaPerfilModelo.safeParse(perfil).success;
    const botao = 'rounded-md border border-borda px-3 py-2 text-xs hover:bg-hover disabled:opacity-40';
    return (
        <div
            className="flex flex-col gap-4 text-xs [&_label]:flex [&_label]:flex-col [&_label]:gap-2
            [&_input:not([type=checkbox])]:bg-[#0d0f12] [&_input:not([type=checkbox])]:p-2
            [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-borda
            [&_input]:rounded-md [&_select]:bg-[#0d0f12] [&_select]:p-2 [&_select]:border
            [&_select]:border-borda [&_select]:rounded-md"
        >
            <span className="text-secundario">{modelo.perfil ? 'Perfil próprio' : 'Usando preferências gerais'}</span>
            <CamposPerfilMotor
                perfil={perfil}
                ocupado={ocupado || salvando}
                alterar={(valor) => {
                    definirPerfil(valor);
                    definirMensagem('');
                }}
            />
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className={botao}
                    disabled={ocupado || salvando || !valido || (!alterado && !!modelo.perfil)}
                    onClick={async () => {
                        definirSalvando(true);
                        try {
                            await executar(async () => {
                                const resultado = await ponte!.configurarModelo(modelo.id, perfil);
                                if (resultado.ok) definirMensagem('Perfil salvo. Aplicado na próxima carga.');
                                return resultado;
                            });
                        } finally {
                            definirSalvando(false);
                        }
                    }}
                >
                    {salvando ? 'Salvando' : 'Salvar perfil'}
                </button>
                {modelo.perfil && (
                    <button
                        type="button"
                        className={botao}
                        disabled={ocupado || salvando}
                        onClick={async () => {
                            definirSalvando(true);
                            try {
                                await executar(async () => {
                                    const resultado = await ponte!.configurarModelo(modelo.id, null);
                                    if (resultado.ok) {
                                        definirPerfil(esquemaPerfilModelo.strip().parse(configuracao));
                                        definirMensagem('Preferências gerais restauradas.');
                                    }
                                    return resultado;
                                });
                            } finally {
                                definirSalvando(false);
                            }
                        }}
                    >
                        Usar preferências gerais
                    </button>
                )}
            </div>
            <span role="status" className="text-secundario">
                {mensagem || (alterado ? 'Perfil não salvo' : '')}
            </span>
        </div>
    );
}
