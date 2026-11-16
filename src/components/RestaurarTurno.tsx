import { useState } from 'react';
import type { PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';
import { Modal } from './Modal';

/** Permite revisar os arquivos afetados antes de restaurar a fotografia anterior ao turno. */
export function RestaurarTurno({
    conversaId,
    mensagemId,
    ponte,
    executar,
}: {
    conversaId: string;
    mensagemId: string;
    ponte: PonteSelene;
    executar: Executar;
}) {
    const [previa, definirPrevia] = useState<{ arquivos: string[]; token: string; interrompido: boolean }>();
    const [ocupado, definirOcupado] = useState(false);
    const [restaurado, definirRestaurado] = useState(false);
    async function preparar() {
        const resultado = await executar(() => ponte.prepararRestauracao(conversaId, mensagemId));
        if (resultado) definirPrevia(resultado);
    }
    async function restaurar() {
        if (!previa) return;
        definirOcupado(true);
        try {
            const resultado = await ponte.restaurarTurno(conversaId, mensagemId, previa.token);
            if (!resultado.ok) {
                await executar(async () => resultado);
                return;
            }
            definirRestaurado(true);
            definirPrevia(undefined);
        } finally {
            definirOcupado(false);
        }
    }
    if (restaurado) return <p className="text-xs text-secundario mt-2">Arquivos restaurados.</p>;
    return (
        <>
            <button
                type="button"
                className="text-xs text-secundario mt-2 hover:text-principal"
                onClick={() => void preparar()}
            >
                Restaurar arquivos deste turno
            </button>
            {previa && (
                <Modal titulo="Restaurar arquivos" fechar={() => !ocupado && definirPrevia(undefined)}>
                    <p className="text-sm text-secundario mb-3">
                        Os arquivos abaixo voltarão ao estado anterior ao turno. Arquivos criados nele serão removidos.
                A fotografia pode incluir alterações feitas por outras ferramentas ou pessoas na mesma pasta.
                        {previa.interrompido &&
                            ' O turno foi interrompido. A lista inclui mudanças posteriores ao início dele.'}
                    </p>
                    <ul className="text-xs font-mono max-h-64 overflow-auto mb-4">
                        {previa.arquivos.map((arquivo) => (
                            <li key={arquivo}>{arquivo}</li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        disabled={ocupado || !previa.arquivos.length}
                        className="rounded-lg px-3 py-2 bg-superficie text-sm disabled:opacity-40"
                        onClick={() => void restaurar()}
                    >
                        {ocupado ? 'Restaurando' : 'Confirmar restauração'}
                    </button>
                </Modal>
            )}
        </>
    );
}
