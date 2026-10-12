import type { PonteSelene } from '../../shared/contratos';
import { descreverAtualizacao, type EstadoAtualizacao } from '../../shared/atualizacoes';
import type { Executar } from './Configuracoes';
import { Linha, botaoSecundario } from './PainelConfiguracoes';

/** Versão instalada e andamento das atualizações automáticas. */
export function AtualizacaoAplicativo({
    estado,
    ponte,
    executar,
}: {
    estado?: EstadoAtualizacao;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    if (!estado)
        return <Linha id="config-versao" titulo="Versão" descricao="Atualizações indisponíveis neste ambiente." />;
    const ocupado = ['desativada', 'verificando', 'baixando', 'reiniciando'].includes(estado.fase);
    return (
        <Linha
            id="config-versao"
            titulo={
                <>
                    Selene
                    <code className="text-xs font-normal text-discreto">v{estado.versaoAtual}</code>
                </>
            }
            descricao={<span role="status">{descreverAtualizacao(estado)}</span>}
            controle={
                <button
                    type="button"
                    className={botaoSecundario}
                    disabled={!ponte || ocupado}
                    onClick={() =>
                        void executar(() =>
                            estado.fase === 'pronta' ? ponte!.reiniciarAtualizacao() : ponte!.verificarAtualizacao(),
                        )
                    }
                >
                    {estado.fase === 'pronta' ? 'Reiniciar e atualizar' : 'Buscar atualização'}
                </button>
            }
        />
    );
}
