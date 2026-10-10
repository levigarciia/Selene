import { TextoAtividade } from './TextoAtividade';
import { CaretRightIcon } from '@phosphor-icons/react';
import { IconeAcao, escolherIconeAcao } from './IconeAcao';
import type { Acao, PonteSelene } from '../../shared/contratos';
import type { Executar } from './Configuracoes';

const nomes: Record<string, string> = {
    listar_arquivos: 'Explorando',
    ler_arquivo: 'Lendo',
    escrever_arquivo: 'Escrevendo',
    editar_arquivo: 'Editando',
    executar_terminal: 'Executando',
    atualizar_plano: 'Atualizando tarefas',
    pesquisar_web: 'Pesquisando',
    ler_pagina_web: 'Lendo página',
    controlar_navegador: 'Usando navegador',
};
const nomesConcluidos: Record<string, string> = {
    listar_arquivos: 'Explorou',
    ler_arquivo: 'Leu',
    escrever_arquivo: 'Escreveu',
    editar_arquivo: 'Editou',
    executar_terminal: 'Executou',
    atualizar_plano: 'Atualizou tarefas',
    pesquisar_web: 'Pesquisou',
    ler_pagina_web: 'Leu página',
    controlar_navegador: 'Usou navegador',
};
const estados: Record<Acao['estado'], string> = {
    preparando: 'Preparando ação',
    aguardando: 'Aguardando aprovação',
    executando: 'Em andamento',
    concluida: 'Concluída',
    recusada: 'Recusada',
    erro: 'Erro',
    interrompida: 'Interrompida',
};

/** Exibe uma ação no fluxo da conversa, com detalhes e decisão quando exigida. */
export function AcaoConversa({
    acao,
    emExecucao = false,
    ponte,
    executar,
}: {
    acao: Acao;
    emExecucao?: boolean;
    ponte?: PonteSelene;
    executar: Executar;
}) {
    const detalhe =
        acao.argumentos.comando ??
        acao.argumentos.caminho ??
        acao.argumentos.consulta ??
        acao.argumentos.url ??
        acao.argumentos.acao;
    const escrita = ['escrever_arquivo', 'editar_arquivo'].includes(acao.nome);
    const conteudo = acao.argumentos.conteudo ?? acao.argumentos.novo;
    const previa = acao.previa || (escrita && typeof conteudo === 'string' ? conteudo : undefined);
    const mostrandoEscrita = escrita && acao.estado === 'preparando';
    return (
        <div
            data-ui={`acao ${acao.estado === 'aguardando' ? 'acao-pendente' : ''}`}
            data-estado={acao.estado}
            className={[
                [
                    'text-secundario mx-0 my-[10px] [&_summary]:flex [&_summary]:gap-[10px]',
                    '[&_summary]:items-center [&_summary]:cursor-pointer [&_summary]:text-[12px]',
                    '[&_summary]:px-0 [&_summary]:py-[4px] [&_summary_>_span:first-of-type]:overflow-hidden',
                    '[&_summary_>_span:first-of-type]:text-ellipsis',
                    '[&_summary_>_span:first-of-type]:whitespace-nowrap [&_summary::-webkit-details-marker]:hidden',
                    '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:max-h-[320px] [&_pre]:overflow-auto',
                    '[&_pre]:bg-[#0c0d10] [&_pre]:text-[11px]',
                    '[&_pre]:font-mono [&_pre]:mt-0 [&_pre]:mb-[12px]',
                    '[&_pre]:p-[14px] [&_pre]:mx-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:inline-block',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:bg-superficie',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:rounded-[9px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:mx-[8px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:my-[4px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-[1px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-solid',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:border-[#30333a]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:flex',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:gap-[10px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:items-center',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:cursor-pointer',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:text-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:px-[14px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_summary]:py-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:whitespace-pre-wrap',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:wrap-anywhere',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:max-h-[320px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:overflow-auto',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:bg-[#0c0d10]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:text-[11px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:font-mono',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mt-[0]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mb-[12px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:p-[14px]',
                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_pre]:mx-[12px]',
                    '[[data-ui~=usuario-direita]_&]:inline-block',
                    '[[data-ui~=usuario-direita]_&]:bg-superficie',
                    '[[data-ui~=usuario-direita]_&]:rounded-[9px]',
                    '[[data-ui~=usuario-direita]_&]:mx-[8px]',
                    '[[data-ui~=usuario-direita]_&]:my-[4px]',
                    '[[data-ui~=usuario-direita]_&]:border-[1px]',
                    '[[data-ui~=usuario-direita]_&]:border-solid',
                    '[[data-ui~=usuario-direita]_&]:border-[#30333a]',
                    '[[data-ui~=usuario-direita]_&_summary]:flex',
                    '[[data-ui~=usuario-direita]_&_summary]:gap-[10px]',
                    '[[data-ui~=usuario-direita]_&_summary]:items-center',
                    '[[data-ui~=usuario-direita]_&_summary]:cursor-pointer',
                    '[[data-ui~=usuario-direita]_&_summary]:text-[12px]',
                    '[[data-ui~=usuario-direita]_&_summary]:px-[14px]',
                    '[[data-ui~=usuario-direita]_&_summary]:py-[12px]',
                    '[[data-ui~=usuario-direita]_&_pre]:whitespace-pre-wrap',
                    '[[data-ui~=usuario-direita]_&_pre]:wrap-anywhere',
                    '[[data-ui~=usuario-direita]_&_pre]:max-h-[320px]',
                    '[[data-ui~=usuario-direita]_&_pre]:overflow-auto',
                    '[[data-ui~=usuario-direita]_&_pre]:bg-[#0c0d10]',
                    '[[data-ui~=usuario-direita]_&_pre]:text-[11px]',
                    '[[data-ui~=usuario-direita]_&_pre]:font-mono',
                    '[[data-ui~=usuario-direita]_&_pre]:mt-[0]',
                    '[[data-ui~=usuario-direita]_&_pre]:mb-[12px]',
                    '[[data-ui~=usuario-direita]_&_pre]:p-[14px]',
                    '[[data-ui~=usuario-direita]_&_pre]:mx-[12px]',
                ].join(' '),
                acao.estado === 'aguardando' ? '[&&]:border-[#8c75ad]' : '',
            ].join(' ')}
        >
            <details open={acao.estado === 'aguardando' || mostrandoEscrita ? true : undefined}>
                <summary>
                    <IconeAcao
                        nome={escolherIconeAcao(acao)}
                        className={[
                            'size-[15px] shrink-0',
                            acao.estado === 'erro' ? 'text-[#e9aaa7]' : '',
                            acao.estado === 'aguardando' ? 'text-[#c4b8d6]' : '',
                            ['recusada', 'interrompida'].includes(acao.estado) ? 'opacity-50' : '',
                        ].join(' ')}
                    />
                    <TextoAtividade ativo={emExecucao && ['preparando', 'executando'].includes(acao.estado)}>
                        {(acao.estado === 'concluida' ? nomesConcluidos[acao.nome] : nomes[acao.nome]) ?? acao.nome}
                        {typeof detalhe === 'string' ? ` ${detalhe}` : ''}
                    </TextoAtividade>
                    {!['preparando', 'executando', 'concluida'].includes(acao.estado) && (
                        <span
                            data-ui="estado-acao"
                            className="text-[10px] ml-auto whitespace-nowrap [@media(width<=560px)]:hidden"
                        >
                            {estados[acao.estado]}
                        </span>
                    )}
                    <CaretRightIcon
                        data-ui="seta-detalhes"
                        className="[[data-ui~=acao]_details[open]_&]:[transform:rotate(90deg)]"
                        size={12}
                    />
                </summary>
                <pre data-ui="previa-acao">
                    {previa ?? (mostrandoEscrita ? 'Preparando conteúdo…' : JSON.stringify(acao.argumentos, null, 4))}
                </pre>
                {acao.resultado && (
                    <pre
                        data-ui="resultado-acao"
                        className={[
                            'text-[#c4b8d6]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#c4b8d6]',
                            '[[data-ui~=usuario-direita]_&]:text-[#c4b8d6]',
                        ].join(' ')}
                    >
                        {acao.resultado}
                    </pre>
                )}
            </details>
            {emExecucao && acao.estado === 'aguardando' && (
                <div
                    data-ui="aprovacao"
                    className={[
                        'flex justify-end gap-[9px] pt-0 pb-[12px] items-center px-[12px] [&_p]:text-[11px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:flex',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:justify-end',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:gap-[9px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pt-[0]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:pb-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:items-center',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:px-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&_p]:text-[11px]',
                        '[[data-ui~=usuario-direita]_&]:flex',
                        '[[data-ui~=usuario-direita]_&]:justify-start',
                        '[[data-ui~=usuario-direita]_&]:gap-[9px]',
                        '[[data-ui~=usuario-direita]_&]:pt-[0]',
                        '[[data-ui~=usuario-direita]_&]:pb-[12px]',
                        '[[data-ui~=usuario-direita]_&]:items-center',
                        '[[data-ui~=usuario-direita]_&]:px-[12px]',
                        '[[data-ui~=usuario-direita]_&_p]:text-[11px]',
                    ].join(' ')}
                >
                    <button
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-superficie rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-borda',
                            '[&:hover:not(:disabled)]:bg-hover [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={!ponte}
                        onClick={() => executar(() => ponte!.aprovar(acao.id, false))}
                    >
                        Recusar
                    </button>
                    <button
                        data-ui="botao botao-primario"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#e0d8ef] rounded-[8px]',
                            'whitespace-nowrap text-[#251b38] px-[14px] py-[9px] border border-solid',
                            'border-transparent [&:hover:not(:disabled)]:bg-[#cec0e5]',
                            '[[data-ui~=lista-projetos]_>_&]:mb-[12px] [[data-ui~=lista-projetos]_>_&]:justify-start',
                            '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={!ponte}
                        onClick={() => executar(() => ponte!.aprovar(acao.id, true))}
                    >
                        Aprovar
                    </button>
                </div>
            )}
        </div>
    );
}
