import { TextoAtividade } from './TextoAtividade';
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
        <div
            data-ui="markdown"
            className={[
                '[[data-ui~=mensagem-usuario]_&]:bg-selecionado',
                '[[data-ui~=mensagem-usuario]_&]:rounded-[12px] [[data-ui~=mensagem-usuario]_&]:px-[18px]',
                '[[data-ui~=mensagem-usuario]_&]:py-[14px] wrap-anywhere [&_p]:mt-0 [&_p]:mb-[14px]',
                '[&_p]:mx-0 [&_p:last-child]:mb-0 [&_ul]:pl-[24px] [&_ul]:list-disc [&_ul]:mx-0',
                '[&_ul]:my-[10px] [&_ol]:pl-[24px] [&_ol]:list-decimal [&_ol]:mx-0 [&_ol]:my-[10px]',
                '[&_pre]:bg-[#090a0c] [&_pre]:rounded-[9px] [&_pre]:overflow-auto [&_pre]:text-[12px]',
                '[&_pre]:p-[16px] [&_pre]:mx-0 [&_pre]:my-[14px] [&_pre]:border [&_pre]:border-solid',
                '[&_pre]:border-[#2a2d33] [&_code]:font-mono',
                '[&_code]:text-[#ddd5e6] [&_:not(pre)_>_code]:bg-[#25282e] [&_:not(pre)_>_code]:rounded-[4px]',
                '[&_:not(pre)_>_code]:px-[5px] [&_:not(pre)_>_code]:py-[2px] [&_h1]:text-[18px]',
                '[&_h1]:font-semibold [&_h1]:mt-[20px] [&_h1]:mb-[10px] [&_h1]:mx-0 [&_h2]:text-[18px]',
                '[&_h2]:font-semibold [&_h2]:mt-[20px] [&_h2]:mb-[10px] [&_h2]:mx-0 [&_h3]:text-[18px]',
                '[&_h3]:font-semibold [&_h3]:mt-[20px] [&_h3]:mb-[10px] [&_h3]:mx-0',
                '[&_blockquote]:border-l-[2px] [&_blockquote]:border-solid',
                '[&_blockquote]:border-l-[#6a557f] [&_blockquote]:pl-[16px] [&_blockquote]:text-[#b0b7c0]',
                '[&_blockquote]:mx-0 [&_blockquote]:my-[15px] [&_table]:border-collapse',
                '[&_table]:text-[12px] [&_table]:w-full [&_th]:text-left [&_th]:p-[7px] [&_th]:border',
                '[&_th]:border-solid [&_th]:border-[#35383f] [&_td]:text-left [&_td]:p-[7px]',
                '[&_td]:border [&_td]:border-solid [&_td]:border-[#35383f]',
                '[[data-ui~=atividade-tarefa]_>_&]:mx-0 [[data-ui~=atividade-tarefa]_>_&]:my-[14px]',
                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:bg-selecionado',
                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:rounded-[12px]',
                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-principal',
                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:px-[18px]',
                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:py-[14px]',
                '[[data-ui~=raciocinio-mensagem]_&]:max-h-[240px]',
                '[[data-ui~=raciocinio-mensagem]_&]:overflow-y-auto',
                '[[data-ui~=raciocinio-mensagem]_&]:pr-[8px]',
            ].join(' ')}
        >
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
    emExecucao = false,
    ponte,
    executar,
}: {
    mensagem: Mensagem;
    modo?: 'chat' | 'code';
    emExecucao?: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const [mostrarTokens, definirMostrarTokens] = useState(false);
    const tokens = mensagem.desempenho?.tokensPorSegundo;
    const gerando = emExecucao && mensagem.estado === 'gerando' && !mensagem.concluidoEm;
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
            <AcaoConversa
                key={bloco.acao.id}
                acao={bloco.acao}
                emExecucao={gerando}
                ponte={ponte}
                executar={executar}
            />
        ),
    );
    const segundos = mensagem.concluidoEm
        ? Math.max(0, Math.round((Date.parse(mensagem.concluidoEm) - Date.parse(mensagem.criadoEm)) / 1000))
        : 0;
    const duracao = segundos >= 60 ? `${Math.floor(segundos / 60)} min ${segundos % 60} s` : `${segundos} s`;
    return (
        <article
            id={`mensagem-${mensagem.id}`}
            data-ui={`mensagem ${mensagem.papel === 'user' ? 'mensagem-usuario usuario-direita' : ''}`}
            className={[
                'mb-[35px] text-[14px] leading-[1.8]',
                mensagem.papel === 'user'
                    ? ['[&&]:flex', '[&&]:flex-col', '[&&]:items-end', '[&&]:gap-[8px]'].join(' ')
                    : '',
            ].join(' ')}
        >
            <div
                data-ui="autor"
                className={[
                    'text-secundario text-[11px] mb-[9px]',
                    '[[data-ui~=usuario-direita]_&]:text-right',
                    '[[data-ui~=usuario-direita]_&]:text-[#b5a2dc]',
                    '[[data-ui~=usuario-direita]_&]:mb-[4px]',
                ].join(' ')}
            >
                {mensagem.papel === 'user' ? 'Você' : 'Selene'}
            </div>
            <div
                data-ui="conteudo"
                className={[
                    '[[data-ui~=usuario-direita]_&]:flex',
                    '[[data-ui~=usuario-direita]_&]:flex-col',
                    '[[data-ui~=usuario-direita]_&]:gap-[12px]',
                    '[[data-ui~=usuario-direita]_&]:items-end',
                ].join(' ')}
            >
                {!!mensagem.imagens?.length && (
                    <div data-ui="imagens-mensagem" className="flex flex-wrap gap-[10px] mb-[12px]">
                        {mensagem.imagens.map((imagem) => (
                            <ImagemConversa key={imagem.id} imagem={imagem} ponte={ponte} />
                        ))}
                    </div>
                )}
                {!!mensagem.compactacoes?.length && (
                    <details
                        data-ui="compactacao-contexto"
                        className="mb-[12px] text-secundario text-[12px] [&_summary]:cursor-pointer"
                    >
                        <summary>Contexto compactado automaticamente</summary>
                        {mensagem.compactacoes.map((item, indice) => (
                            <p key={indice}>
                                Estimativa: {item.tokensAntes.toLocaleString('pt-BR')} para{''}
                                {item.tokensDepois.toLocaleString('pt-BR')} tokens. Histórico preservado.
                            </p>
                        ))}
                    </details>
                )}
                {!!mensagem.raciocinio && (
                    <details
                        data-ui="raciocinio-mensagem"
                        className={[
                            'text-[var(--texto-secundario,_#9299a3)] text-[13px] mt-[10px] mb-[18px] mx-0',
                            '[&_>_summary]:flex [&_>_summary]:items-center [&_>_summary]:gap-[8px]',
                            '[&_>_summary]:cursor-pointer [&_>_summary]:list-none',
                            '[&_>_summary::-webkit-details-marker]:hidden',
                            '[&[open]_>_summary_svg]:[transform:rotate(90deg)]',
                        ].join(' ')}
                        open={gerando && mensagem.faseGeracao === 'raciocinando'}
                    >
                        <summary>
                            <TextoAtividade ativo={gerando && mensagem.faseGeracao === 'raciocinando'}>
                                {gerando && mensagem.faseGeracao === 'raciocinando' ? 'Raciocinando' : 'Raciocínio'}
                            </TextoAtividade>
                            <CaretRightIcon size={13} />
                        </summary>
                        <Texto texto={mensagem.raciocinio} />
                    </details>
                )}
                {recolher ? (
                    <>
                        <details
                            data-ui="historico-tarefa"
                            className={[
                                '[&_summary::-webkit-details-marker]:hidden [&[open]_>_summary_svg]:rotate-90',
                                'mb-[16px] [&_>_summary]:flex [&_>_summary]:items-center [&_>_summary]:gap-[8px]',
                                '[&_>_summary]:text-secundario [&_>_summary]:text-[12px] [&_>_summary]:cursor-pointer',
                                '[&_>_summary]:pt-[4px] [&_>_summary]:pb-[12px] [&_>_summary]:border-b',
                                '[&_>_summary]:border-solid [&_>_summary]:border-b-[#22252a]',
                                '[&_>_summary]:px-0 [&_>_summary_span]:text-[11px]',
                            ].join(' ')}
                        >
                            <summary>
                                Trabalhou{mensagem.concluidoEm ? ` por ${duracao}` : ''}
                                <span>{mensagem.acoes.length} ações</span>
                                <CaretRightIcon size={13} />
                            </summary>
                            <div data-ui="atividade-tarefa" className="">
                                {atividade}
                            </div>
                        </details>
                        <Texto texto={mensagem.texto.slice(inicioFinal)} />
                    </>
                ) : (
                    <div data-ui="atividade-tarefa" className="">
                        {atividade}
                    </div>
                )}
                {gerando && mensagem.faseContexto === 'compactando' && (
                    <span
                        data-ui="texto-secundario indicador-geracao"
                        className={[
                            'text-secundario text-[12px] leading-[1.7] block pt-[8px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:block',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pt-[8px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:block',
                            '[[data-ui~=usuario-direita]_&]:pt-[8px]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                        role="status"
                    >
                        Compactando contexto
                    </span>
                )}
                {gerando && mensagem.acoes.at(-1)?.estado === 'aguardando' && (
                    <span
                        data-ui="texto-secundario indicador-geracao"
                        className={[
                            'text-secundario text-[12px] leading-[1.7] block pt-[8px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:block',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pt-[8px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:block',
                            '[[data-ui~=usuario-direita]_&]:pt-[8px]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                        role="status"
                    >
                        Aguardando sua decisão
                    </span>
                )}
                {gerando &&
                    !mensagem.texto.trim() &&
                    !mensagem.raciocinio &&
                    !mensagem.acoes.length &&
                    !mensagem.faseContexto && (
                        <span
                            data-ui="texto-secundario indicador-geracao"
                            className={[
                                'text-secundario text-[12px] leading-[1.7] block pt-[8px]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:block',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pt-[8px]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                '[[data-ui~=usuario-direita]_&]:block',
                                '[[data-ui~=usuario-direita]_&]:pt-[8px]',
                                '[[data-ui~=usuario-direita]_&]:text-secundario',
                                '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                            ].join(' ')}
                            role="status"
                            aria-label="Preparando resposta"
                        >
                            ···
                        </span>
                    )}
                {mensagem.estado === 'interrompida' && (
                    <span
                        data-ui="texto-secundario"
                        className={[
                            'text-secundario text-[12px] leading-[1.7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                            '[[data-ui~=usuario-direita]_&]:text-secundario',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                        ].join(' ')}
                    >
                        Interrompida
                    </span>
                )}
                {mensagem.estado === 'erro' && (
                    <span
                        data-ui="texto-erro"
                        className={[
                            'text-[#e9aaa7] text-[12px]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        ].join(' ')}
                    >
                        A tarefa não foi concluída
                    </span>
                )}
                {mensagem.papel === 'assistant' && !!tokens && (
                    <div data-ui="velocidade-mensagem" className="flex items-center gap-[8px] mt-[8px] text-[11px]">
                        <button
                            data-ui="botao-icone botao-icone-tokens"
                            className={[
                                '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                [
                                    'inline-flex items-center justify-center bg-transparent text-secundario',
                                    'rounded-[6px] p-[8px]',
                                ].join(' '),
                                'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                                '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                                '[[data-ui~=velocidade-mensagem]_&]:inline-flex',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-secundario',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-borda',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&:hover:not(:disabled)]:bg-hover',
                                '[[data-ui~=usuario-direita]_&]:text-secundario',
                                '[[data-ui~=usuario-direita]_&]:border-borda',
                                '[[data-ui~=usuario-direita]_&:hover:not(:disabled)]:text-principal',
                                '[[data-ui~=usuario-direita]_&:hover:not(:disabled)]:bg-hover',
                                "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                            ].join(' ')}
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
