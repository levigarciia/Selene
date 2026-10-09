import type { Configuracao } from '../../shared/contratos';

export type CamposConfiguracao = {
    configuracao: Configuracao;
    ocupado: boolean;
    alterar: <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) => void;
};

/** Edita os parâmetros aplicados ao próximo envio sem reiniciar o motor. */
export function CamposGeracao({ configuracao, ocupado, alterar }: CamposConfiguracao) {
    return (
        <>
            <h2>Geração</h2>
            <p className="texto-secundario">A resposta usa automaticamente o espaço disponível no contexto.</p>
            <div className="grid grid-cols-2 gap-5">
                <label>
                    Temperatura
                    <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={configuracao.temperatura}
                        disabled={ocupado}
                        onChange={(evento) => alterar('temperatura', Number(evento.target.value))}
                    />
                </label>
            </div>
            <label>
                Instrução geral
                <textarea
                    rows={7}
                    value={configuracao.instrucao}
                    disabled={ocupado}
                    onChange={(evento) => alterar('instrucao', evento.target.value)}
                />
            </label>
        </>
    );
}
