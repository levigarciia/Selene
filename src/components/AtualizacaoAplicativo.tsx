import type { PonteSelene } from '../../shared/contratos';
import { descreverAtualizacao, type EstadoAtualizacao } from '../../shared/atualizacoes';
import type { Executar } from './Configuracoes';

/** Use na área Geral para consultar a versão e o andamento das atualizações automáticas. */
export function AtualizacaoAplicativo({
    estado,
    ponte,
    executar,
}: {
    estado?: EstadoAtualizacao;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    if (!estado) return null;
    const ocupado = ['desativada', 'verificando', 'baixando', 'pronta'].includes(estado.fase);
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <span>Selene {estado.versaoAtual}</span>
                <span className="texto-secundario" role="status">
                    {descreverAtualizacao(estado)}
                </span>
            </div>
            <button
                type="button"
                className="botao"
                disabled={!ponte || ocupado}
                onClick={() => void executar(() => ponte!.verificarAtualizacao())}
            >
                Buscar atualização
            </button>
        </div>
    );
}
