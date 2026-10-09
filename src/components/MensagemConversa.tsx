import { CaretRightIcon, InfoIcon } from '@phosphor-icons/react';
import { lazy, memo, Suspense, useState } from 'react';
import type { Mensagem, PonteSelene } from '../../shared/contratos';
import { montarAtividade } from '../../shared/atividade';
import type { Executar } from './Configuracoes';
import { AcaoConversa } from './AcaoConversa';
import { ImagemConversa } from './ImagemConversa';

const TextoMarkdown = lazy(() => import('./TextoMarkdown'));

function Texto({ texto }: { texto: string }) {
    if (!texto.trim()) return null;
    return (
        <div className="markdown">
            <Suspense fallback={<p>{texto}</p>}>
                <TextoMarkdown texto={texto} />
            </Suspense>
        </div>
    );
}

/** Apresenta ações na ordem real e recolhe o trabalho anterior à resposta final no modo Code. */
export const MensagemConversa = memo(function MensagemConversa({
    mensagem,
    modo = 'chat',
    ponte,
    executar,
}: {
    mensagem: Mensagem;
    modo?: 'chat' | 'code';
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [mostrarTokens, definirMostrarTokens] = useState(false);
    const tokens = mensagem.desempenho?.tokensPorSegundo;
    const recolher =
        modo === 'code' &&
        mensagem.papel === 'assistant' &&
        mensagem.estado === 'concluida' &&
        mensagem.acoes.length > 0;
    const inicioFinal = recolher ? (mensagem.inicioTextoFinal ?? 0) : mensagem.texto.length;
    const atividade = montarAtividade(mensagem, inicioFinal).map((bloco, indice) =>
        bloco.tipo === 'texto' ? (
            <Texto key={`texto-${indice}`} texto={bloco.texto} />
        ) : (
            <AcaoConversa key={bloco.acao.id} acao={bloco.acao} ponte={ponte} executar={executar} />
        ),
    );
    const segundos = mensagem.concluidoEm
        ? Math.max(0, Math.round((Date.parse(mensagem.concluidoEm) - Date.parse(mensagem.criadoEm)) / 1000))
        : 0;
    const duracao = segundos >= 60 ? `${Math.floor(segundos / 60)} min ${segundos % 60} s` : `${segundos} s`;
    return (
        <article
            id={`mensagem-${mensagem.id}`}
            className={`mensagem ${
                mensagem.papel === 'user' ? 'mensagem-usuario mensagem-usuario-alinhado-direita' : ''
            }`}
        >
            <div className="autor">{mensagem.papel === 'user' ? 'Você' : 'Selene'}</div>
            <div className="conteudo-mensagem">
                {!!mensagem.imagens?.length && (
                    <div className="imagens-mensagem">
                        {mensagem.imagens.map((imagem) => (
                            <ImagemConversa key={imagem.id} imagem={imagem} ponte={ponte} />
                        ))}
                    </div>
                )}
                {!!mensagem.compactacoes?.length && (
                    <details className="compactacao-contexto">
                        <summary>Contexto compactado automaticamente</summary>
                        {mensagem.compactacoes.map((item, indice) => (
                            <p key={indice}>
                                Estimativa: {item.tokensAntes.toLocaleString('pt-BR')} para{' '}
                                {item.tokensDepois.toLocaleString('pt-BR')} tokens. Histórico preservado.
                            </p>
                        ))}
                    </details>
                )}
                {recolher ? (
                    <>
                        <details className="historico-tarefa">
                            <summary>
                                Trabalhou{mensagem.concluidoEm ? ` por ${duracao}` : ''}
                                <span>{mensagem.acoes.length} ações</span>
                                <CaretRightIcon size={13} />
                            </summary>
                            <div className="atividade-tarefa">{atividade}</div>
                        </details>
                        <Texto texto={mensagem.texto.slice(inicioFinal)} />
                    </>
                ) : (
                    <div className="atividade-tarefa">{atividade}</div>
                )}
                {mensagem.estado === 'gerando' && mensagem.acoes.at(-1)?.estado !== 'executando' && (
                    <span className="texto-secundario indicador-geracao" role="status">
                        {mensagem.faseContexto === 'compactando' ? (
                            'Compactando contexto'
                        ) : mensagem.acoes.at(-1)?.estado === 'aguardando' ? (
                            'Aguardando sua decisão'
                        ) : (
                            <span className="texto-em-andamento">Trabalhando</span>
                        )}
                    </span>
                )}
                {mensagem.estado === 'interrompida' && <span className="texto-secundario">Interrompida</span>}
                {mensagem.estado === 'erro' && <span className="texto-erro">A tarefa não foi concluída</span>}
                {mensagem.papel === 'assistant' && !!tokens && (
                    <div className="velocidade-mensagem">
                        <button
                            className="botao-icone botao-icone-tokens"
                            onClick={() => definirMostrarTokens(!mostrarTokens)}
                            aria-label={mostrarTokens ? 'Esconder tokens por segundo' : 'Mostrar tokens por segundo'}
                        >
                            <InfoIcon size={14} />
                        </button>
                        {mostrarTokens && (
                            <span role="tooltip">
                                {tokens.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tokens/s
                            </span>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
});
