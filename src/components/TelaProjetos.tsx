import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Projeto, Resultado } from '../../shared/contratos';
import type { useSelene } from '../hooks/useSelene';
import { possuiRascunho } from '../../shared/rascunhos';
import { IconeProjeto } from './IconeProjeto';
import { EscolherIconeProjeto } from './EscolherIconeProjeto';

/** Gerencia a identidade e as conversas dos projetos sem descartar a composição em andamento. */
export function TelaProjetos({
    dados,
    projetoId,
    selecionarProjeto,
    adicionar,
    criar,
    selecionarConversa,
}: {
    dados: ReturnType<typeof useSelene>;
    projetoId: string | null;
    selecionarProjeto: (id: string) => void;
    adicionar: () => void;
    criar: (projeto: Projeto) => void;
    selecionarConversa: (id: string) => void;
}) {
    const [ocupado, definirOcupado] = useState(false);
    const [mensagem, definirMensagem] = useState('');
    const projetos = dados.estado.projetos;
    const projeto = projetos.find((item) => item.id === projetoId) ?? projetos[0];
    const conversas = dados.estado.conversas.filter(
        (item) =>
            projeto &&
            item.modo === 'code' &&
            (item.projetoId === projeto.id || item.projeto === projeto.caminho) &&
            (item.mensagens.length || possuiRascunho(item)),
    );

    async function executar(operacao: () => Promise<Resultado<unknown>>) {
        if (ocupado) return;
        definirOcupado(true);
        definirMensagem('');
        try {
            if (!dados.ponte) throw new Error('Gerencie os projetos no aplicativo desktop.');
            const resultado = await operacao();
            if (!resultado.ok) throw new Error(resultado.erro);
        } catch (erro) {
            definirMensagem(erro instanceof Error ? erro.message : 'Não foi possível atualizar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <div
            data-ui="tela-projetos"
            className={[
                'grid grid-cols-[210px_minmax(0,_1fr)] flex-1 min-h-0 gap-[36px] overflow-hidden p-[30px]',
                '[&_input]:bg-[#141517] [&_input]:text-[#e6e7e9] [&_input]:rounded-[7px] [&_input]:min-w-0',
                '[&_input]:w-full [&_input]:px-[12px] [&_input]:py-[10px] [&_input]:border',
                '[&_input]:border-solid [&_input]:border-[#292b30] [&_h2]:text-[14px] [&_h2]:font-medium',
                '[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:mx-0',
                '[@media(width<=900px)]:grid-cols-[160px_minmax(0,_1fr)]',
                '[@media(width<=900px)]:gap-[20px] [@media(width<=900px)]:p-[20px]',
                '[@media(width<=600px)]:flex [@media(width<=600px)]:flex-col',
                '[@media(width<=600px)]:overflow-y-auto [@media(width<=600px)]:px-[16px]',
                '[@media(width<=600px)]:py-[20px]',
            ].join(' ')}
        >
            <nav
                data-ui="lista-projetos"
                className={[
                    'flex flex-col items-stretch gap-[6px] overflow-y-auto pr-[20px] border-r',
                    'border-solid border-r-[#2b2e34] [@media(width<=600px)]:flex-row',
                    '[@media(width<=600px)]:shrink-0 [@media(width<=600px)]:overflow-x-auto',
                    '[@media(width<=600px)]:min-h-[48px] [@media(width<=600px)]:pt-0',
                    '[@media(width<=600px)]:pb-[16px] [@media(width<=600px)]:border-r-0',
                    '[@media(width<=600px)]:[border-right-style:solid]',
                    '[@media(width<=600px)]:border-r-[currentColor] [@media(width<=600px)]:border-b',
                    '[@media(width<=600px)]:[border-bottom-style:solid]',
                    '[@media(width<=600px)]:border-b-[#2b2e34] [@media(width<=600px)]:px-0',
                    '[@media(width<=600px)]:[&_>_button]:shrink-0',
                ].join(' ')}
                aria-label="Projetos cadastrados"
            >
                <button
                    data-ui="botao"
                    className={[
                        'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                        'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                        '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                        '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                        '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                    ].join(' ')}
                    onClick={adicionar}
                >
                    <PlusIcon size={16} /> Adicionar projeto
                </button>
                {projetos.map((item) => (
                    <button
                        key={item.id}
                        data-ui="linha-projeto-gerenciamento"
                        className={[
                            [
                                'flex items-center gap-[10px] bg-transparent rounded-[7px] text-[#a1a5ad]',
                                'text-left min-w-0',
                            ].join(' '),
                            'p-[12px] border-0 border-solid border-current [&:hover]:bg-[#1b1d21]',
                            "[&:hover]:text-[#e6e7e9] [&[aria-current='page']]:bg-[#1b1d21]",
                            "[&[aria-current='page']]:text-[#e6e7e9]",
                        ].join(' ')}
                        aria-current={item.id === projeto?.id ? 'page' : undefined}
                        onClick={() => {
                            definirMensagem('');
                            selecionarProjeto(item.id);
                        }}
                    >
                        <IconeProjeto projeto={item} tamanho={20} />
                        <span className="truncate">{item.nome}</span>
                    </button>
                ))}
            </nav>
            {projeto ? (
                <div
                    data-ui="detalhes-projeto"
                    className={[
                        'overflow-y-auto max-w-[700px] pt-0 pr-[8px] pb-[24px] pl-0 min-w-0 w-full',
                        '[@media(width<=600px)]:overflow-visible [@media(width<=600px)]:shrink-0',
                    ].join(' ')}
                    key={projeto.id}
                >
                    <form
                        data-ui="nome-projeto-formulario"
                        className="flex items-end gap-[12px] [@media(width<=600px)]:flex-wrap"
                        onSubmit={(evento) => {
                            evento.preventDefault();
                            const nome = new FormData(evento.currentTarget).get('nome')?.toString().trim();
                            if (nome && nome !== projeto.nome)
                                void executar(() => dados.ponte!.alterarProjeto(projeto.id, nome));
                        }}
                    >
                        <label
                            data-ui="campo"
                            className={[
                                '[[data-ui~=tela-projetos]_&]:flex [[data-ui~=tela-projetos]_&]:flex-col',
                                '[[data-ui~=tela-projetos]_&]:gap-[9px] [[data-ui~=tela-projetos]_&]:min-w-0',
                                '[[data-ui~=tela-projetos]_&]:text-[#a1a5ad] [[data-ui~=tela-projetos]_&]:text-[12px]',
                                '[[data-ui~=nome-projeto-formulario]_&]:flex-1',
                                '[[data-ui~=iniciais-projeto-formulario]_&]:max-w-[120px]',
                                '[@media(width<=600px)]:[[data-ui~=nome-projeto-formulario]_&]:[flex-basis:100%]',
                            ].join(' ')}
                        >
                            Nome do projeto
                            <input
                                name="nome"
                                key={projeto.nome}
                                defaultValue={projeto.nome}
                                required
                                maxLength={100}
                                disabled={ocupado}
                            />
                        </label>
                        <button
                            data-ui="botao"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                    '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                ].join(' '),
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado}
                        >
                            Salvar nome
                        </button>
                    </form>
                    <label
                        data-ui="campo caminho-projeto"
                        className={[
                            '[[data-ui~=tela-projetos]_&]:flex [[data-ui~=tela-projetos]_&]:flex-col',
                            '[[data-ui~=tela-projetos]_&]:gap-[9px] [[data-ui~=tela-projetos]_&]:min-w-0',
                            '[[data-ui~=tela-projetos]_&]:text-[#a1a5ad] [[data-ui~=tela-projetos]_&]:text-[12px]',
                            '[[data-ui~=nome-projeto-formulario]_&]:flex-1 mt-[20px]',
                            '[[data-ui~=iniciais-projeto-formulario]_&]:max-w-[120px]',
                            '[@media(width<=600px)]:[[data-ui~=nome-projeto-formulario]_&]:[flex-basis:100%]',
                        ].join(' ')}
                    >
                        Pasta
                        <input readOnly value={projeto.caminho} />
                    </label>
                    <EscolherIconeProjeto
                        key={`${projeto.id}:${projeto.icone?.tipo}`}
                        projeto={projeto}
                        ocupado={ocupado}
                        salvar={(icone) => executar(() => dados.ponte!.salvarIconeProjeto(projeto.id, icone))}
                        importar={() => executar(() => dados.ponte!.importarIconeProjeto(projeto.id))}
                    />
                    <section
                        data-ui="conversas-projeto"
                        className={[
                            'pt-[28px] pb-0 border-t border-solid border-t-[#292b30] px-0 mx-0',
                            'my-[28px]',
                        ].join(' ')}
                        aria-label="Conversas do projeto"
                    >
                        <div
                            data-ui="cabecalho-conversas-projeto"
                            className="flex items-center justify-between flex-wrap gap-[12px] mb-[8px] [&_h2]:m-0"
                        >
                            <h2>Conversas</h2>
                            <button
                                data-ui="botao"
                                className={[
                                    'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                                    'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                                    '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    [
                                        '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                        '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                    ].join(' '),
                                    '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                                ].join(' ')}
                                onClick={() => criar(projeto)}
                            >
                                Nova conversa neste projeto
                            </button>
                        </div>
                        {conversas.map((conversa) => (
                            <button
                                data-ui="conversa-no-projeto"
                                className={[
                                    [
                                        'flex justify-between gap-[16px] w-full border-t-0',
                                        'border-t-[currentColor] border-r-0',
                                    ].join(' '),
                                    'border-r-[currentColor] border-b border-b-[#222429] border-l-0',
                                    [
                                        'border-l-[currentColor] bg-transparent text-[#b3b8c0] text-left',
                                        'items-center px-0 py-[12px]',
                                    ].join(' '),
                                    [
                                        'border-solid [&:hover]:text-[#e6e7e9] [&_.truncate]:min-w-0',
                                        '[&_small]:text-[#94b7a5]',
                                    ].join(' '),
                                ].join(' ')}
                                key={conversa.id}
                                onClick={() => selecionarConversa(conversa.id)}
                            >
                                <span className="truncate">{conversa.titulo}</span>
                                {possuiRascunho(conversa) && <small>Rascunho</small>}
                            </button>
                        ))}
                    </section>
                    <button
                        data-ui="botao texto-erro"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap text-[#e9aaa7] text-[12px] px-[14px] py-[9px] border border-solid',
                            'border-[#2b2e34] [&:hover:not(:disabled)]:bg-[#272a30]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                            '[[data-ui~=usuario-direita]_&]:text-[#e9aaa7]',
                            '[[data-ui~=usuario-direita]_&]:text-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:mb-[12px] [[data-ui~=lista-projetos]_>_&]:justify-start',
                            '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={ocupado}
                        title="Preserva arquivos e conversas"
                        onClick={() => void executar(() => dados.ponte!.removerProjeto(projeto.id))}
                    >
                        Remover da lista
                    </button>
                    {mensagem && (
                        <p
                            data-ui="aviso-erro"
                            className={[
                                [
                                    'flex justify-between items-center gap-[12px] text-[#f0b2ae]',
                                    'bg-[#33201f] rounded-[9px]',
                                ].join(' '),
                                'mb-[12px] text-[12px] max-h-[150px] overflow-auto wrap-anywhere p-[12px] border',
                                'border-solid border-[#6f403b]',
                            ].join(' ')}
                            role="alert"
                        >
                            {mensagem}
                        </p>
                    )}
                    {ocupado && (
                        <span
                            data-ui="texto-secundario"
                            className={[
                                'text-[#a1a5ad] text-[12px] leading-[1.7]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                                '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                            ].join(' ')}
                            role="status"
                        >
                            Salvando projeto
                        </span>
                    )}
                </div>
            ) : (
                <p
                    data-ui="texto-secundario"
                    className={[
                        'text-[#a1a5ad] text-[12px] leading-[1.7]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                    ].join(' ')}
                >
                    Adicione um projeto para começar.
                </p>
            )}
        </div>
    );
}
