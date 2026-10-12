import type { Configuracao } from '../../shared/contratos';
import { Linha, Secao, campo } from './PainelConfiguracoes';

export type CamposConfiguracao = {
    configuracao: Configuracao;
    ocupado: boolean;
    alterar: <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) => void;
};

/** Parâmetros aplicados ao próximo envio sem reiniciar o motor. */
export function CamposGeracao({ configuracao, ocupado, alterar }: CamposConfiguracao) {
    return (
        <Secao titulo="Respostas">
            <Linha
                id="config-temperatura"
                titulo="Temperatura"
                descricao="Valores baixos deixam as respostas mais previsíveis. Entre 0 e 2."
                controle={
                    <input
                        type="number"
                        aria-label="Temperatura"
                        min="0"
                        max="2"
                        step="0.1"
                        value={configuracao.temperatura}
                        disabled={ocupado}
                        className={`${campo} w-20 text-right tabular-nums`}
                        onChange={(evento) => alterar('temperatura', Number(evento.target.value))}
                    />
                }
            />
            <Linha
                id="config-instrucao"
                titulo="Instrução"
                descricao="Vale para os modelos locais e do OpenRouter. ChatGPT e Claude usam as instruções do próprio CLI."
            >
                <textarea
                    aria-label="Instrução geral"
                    rows={5}
                    value={configuracao.instrucao}
                    disabled={ocupado}
                    className={`${campo} h-auto w-full resize-y py-2 leading-relaxed`}
                    onChange={(evento) => alterar('instrucao', evento.target.value)}
                />
            </Linha>
        </Secao>
    );
}
