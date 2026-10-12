import { PushPinIcon, TrashIcon } from '@phosphor-icons/react';
import type { Configuracao, PonteSelene } from '../../shared/contratos';
import type { Memoria } from '../../shared/memoria';
import type { Executar } from './Configuracoes';
import { Alternar, Linha, Secao, botaoPequeno } from './PainelConfiguracoes';

/** Liga a memória, controla a extração gratuita e permite revisar o que a Selene guardou. */
export function ConfiguracaoMemoria({
    configuracao,
    alterar,
    ocupado,
    memorias,
    openrouterConfigurado,
    ponte,
    executar,
}: {
    configuracao: Configuracao;
    alterar: <K extends keyof Configuracao>(chave: K, valor: Configuracao[K]) => void;
    ocupado: boolean;
    memorias: Memoria[];
    openrouterConfigurado: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const ordenadas = [...memorias].sort(
        (a, b) => Number(b.fixada) - Number(a.fixada) || b.criadoEm.localeCompare(a.criadoEm),
    );
    return (
        <>
            <Secao titulo="Memória">
                <Linha
                    id="config-memoria"
                    titulo="Lembrar entre conversas"
                    descricao="O modelo salva fatos duráveis sobre você e recebe os mais relevantes a cada mensagem."
                    controle={
                        <Alternar
                            rotulo="Lembrar entre conversas"
                            marcado={configuracao.memoria}
                            desativado={ocupado}
                            alterar={(valor) => alterar('memoria', valor)}
                        />
                    }
                />
                <Linha
                    id="config-extracao-memoria"
                    titulo="Extração gratuita"
                    descricao={
                        openrouterConfigurado
                            ? 'A cada 4 mensagens em modelos OpenRouter, o roteador gratuito revisa a conversa.'
                            : 'Disponível ao configurar a chave do OpenRouter.'
                    }
                    controle={
                        <Alternar
                            rotulo="Extração gratuita"
                            marcado={configuracao.extracaoMemoria}
                            desativado={ocupado || !configuracao.memoria || !openrouterConfigurado}
                            alterar={(valor) => alterar('extracaoMemoria', valor)}
                        />
                    }
                />
            </Secao>
            <Secao titulo={`Memórias salvas (${memorias.length})`}>
                {ordenadas.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-discreto">Nenhuma memória salva.</p>
                ) : (
                    ordenadas.map((memoria) => (
                        <div key={memoria.id} className="flex items-center gap-3 px-4 py-2.5 max-sm:px-3">
                            <span className="min-w-0 flex-1 text-[13px] text-principal">{memoria.texto}</span>
                            <span className="shrink-0 text-xs text-discreto">{memoria.categoria}</span>
                            <button
                                type="button"
                                className={`${botaoPequeno} ${memoria.fixada ? 'text-principal' : ''}`}
                                aria-label={memoria.fixada ? 'Desafixar' : 'Fixar'}
                                aria-pressed={memoria.fixada}
                                title={memoria.fixada ? 'Sempre enviada' : 'Enviada quando relevante'}
                                onClick={() => executar(() => ponte!.fixarMemoria(memoria.id, !memoria.fixada))}
                            >
                                <PushPinIcon size={14} weight={memoria.fixada ? 'fill' : 'regular'} />
                            </button>
                            <button
                                type="button"
                                className={botaoPequeno}
                                aria-label="Apagar memória"
                                onClick={() => executar(() => ponte!.removerMemoria(memoria.id))}
                            >
                                <TrashIcon size={14} />
                            </button>
                        </div>
                    ))
                )}
            </Secao>
        </>
    );
}
