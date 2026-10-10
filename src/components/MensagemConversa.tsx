import { TextoAtividade } from './TextoAtividade';
import { ArrowsClockwiseIcon, CaretRightIcon, InfoIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { lazy, memo, Suspense, useState } from 'react';
import type { Mensagem, PonteSelene } from '../../shared/contratos';
import { agruparAtividade } from '../../shared/atividade';
import { GrupoAcoesConversa } from './GrupoAcoesConversa';
import type { Executar } from './Configuracoes';
import { AcaoConversa } from './AcaoConversa';
import { ImagemConversa } from './ImagemConversa';
import { EditorMensagem } from './EditorMensagem';
import { NavegadorConversa } from './NavegadorConversa';
import type { PreviaNavegador } from '../../shared/web';

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
                '[[data-ui~=usuario-direita]_[data-ui~=atividade-tarefa]_>_&]:my-0',
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

/** Apresenta o texto e recolhe sequências concluídas na ordem real da conversa. */
export const MensagemConversa = memo(function MensagemConversa({
    mensagem,
    modo = 'chat',
    emExecucao = false,
    ponte,
    executar,
    reenviar,
    regerar,
    edicaoDesativada = false,
    previaNavegador,
}: {
    mensagem: Mensagem;
    modo?: 'chat' | 'code';
    emExecucao?: boolean;
    ponte?: PonteSelene;
    executar: Executar;
    reenviar?: (mensagemId: string, texto: string) => Promise<boolean>;
    regerar?: (mensagemId: string) => Promise<void>;
    edicaoDesativada?: boolean;
    previaNavegador?: PreviaNavegador;
}) {
    const [mostrarTokens, definirMostrarTokens] = useState(false);
    const [editando, definirEditando] = useState(false);
    const tokens = mensagem.desempenho?.tokensPorSegundo;
    const gerando = emExecucao && mensagem.estado === 'gerando' && !mensagem.concluidoEm;
    const atividade = agruparAtividade(mensagem).map((bloco, indice) =>
        bloco.tipo === 'texto' ? (
            <Texto key={`texto-${indice}`} texto={bloco.texto} />
        ) : bloco.tipo === 'grupo' ? (
            <GrupoAcoesConversa
                key={`grupo-${bloco.acoes[0]!.id}`}
                acoes={bloco.acoes}
                ponte={ponte}
                executar={executar}
            />
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
    const mostrarNavegador = gerando
        && previaNavegador?.origem === 'navegador'
        && mensagem.acoes.some((acao) => acao.nome === 'controlar_navegador');
    const painelNavegador = mostrarNavegador ? (
        <NavegadorConversa previa={previaNavegador} ponte={ponte} executar={executar} />
    ) : null;
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
                    'relative group/mensagem',
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
                {editando && reenviar && modo === 'chat' && mensagem.papel === 'user' ? (
                    <EditorMensagem
                        texto={mensagem.texto}
                        possuiImagens={!!mensagem.imagens?.length}
                        ocupado={edicaoDesativada}
                        cancelar={() => definirEditando(false)}
                        reenviar={(texto) => reenviar(mensagem.id, texto)}
                    />
                ) : (
                    <div data-ui="atividade-tarefa" className="">
                        {atividade}
                        {painelNavegador}
                    </div>
                )}
                {modo === 'chat' && mensagem.papel === 'user' && reenviar && !editando && (
                    <button
                        type="button"
                        data-ui="editar-mensagem"
                        aria-label="Editar e reenviar mensagem"
                        title="Editar e reenviar mensagem"
                        disabled={edicaoDesativada}
                        onClick={() => definirEditando(true)}
                        className={[
                            'absolute top-full right-0 grid place-items-center rounded-[6px] size-[24px]',
                            'opacity-0 pointer-events-none group-hover/mensagem:opacity-100',
                            'group-hover/mensagem:pointer-events-auto focus-visible:opacity-100',
                            'focus-visible:pointer-events-auto text-secundario hover:text-principal hover:bg-hover',
                        ].join(' ')}
                    >
                        <PencilSimpleIcon size={14} />
                    </button>
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
                {gerando && mensagem.faseGeracao === 'ligandoModelo' && (
                    <div role="status" data-ui="ligando-modelo" className="text-[13px] pt-[8px]">
                        <TextoAtividade ativo>Ligando modelo</TextoAtividade>
                    </div>
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
                    mensagem.faseGeracao !== 'ligandoModelo' &&
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
                {mensagem.papel === 'assistant' && (!!tokens || (modo === 'chat' && regerar && !gerando)) && (
                    <div
                        data-ui="velocidade-mensagem"
                        className={[
                            'flex items-center gap-[8px] mt-[8px] text-[11px] opacity-0 pointer-events-none',
                            'group-hover/mensagem:opacity-100 group-hover/mensagem:pointer-events-auto',
                            'focus-within:opacity-100 focus-within:pointer-events-auto',
                        ].join(' ')}
                    >
                        {!!tokens && (
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
                                aria-label={
                                    mostrarTokens ? 'Esconder tokens por segundo' : 'Mostrar tokens por segundo'
                                }
                            >
                                <InfoIcon size={14} />
                            </button>
                        )}
                        {modo === 'chat' && regerar && !gerando && (
                            <button
                                type="button"
                                aria-label="Regerar mensagem"
                                title="Regerar mensagem"
                                disabled={edicaoDesativada}
                                onClick={() => void regerar(mensagem.id)}
                                className={[
                                    'inline-flex items-center justify-center rounded-[6px] p-[8px] text-secundario',
                                    'hover:text-principal hover:bg-hover disabled:opacity-40',
                                ].join(' ')}
                            >
                                <ArrowsClockwiseIcon size={14} />
                            </button>
                        )}
                        {mostrarTokens && !!tokens && (
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
