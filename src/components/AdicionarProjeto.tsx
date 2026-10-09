import { useState } from 'react';
import { FolderOpenIcon, GitBranchIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { useSelene } from '../hooks/useSelene';
import type { NovoProjeto, Projeto } from '../../shared/contratos';
import { Modal } from './Modal';

/** Abre pastas, cria projetos por nome e clona repositórios com cadastro independente das conversas. */
export function AdicionarProjeto({
    dados,
    fechar,
    selecionar,
}: {
    dados: ReturnType<typeof useSelene>;
    fechar: () => void;
    selecionar: (projeto: Projeto) => void;
}) {
    const [tipo, definirTipo] = useState<'criar' | 'clonar' | null>(null);
    const [valor, definirValor] = useState('');
    const [ocupado, definirOcupado] = useState(false);
    const [erro, definirErro] = useState('');

    async function adicionar(entrada: NovoProjeto) {
        if (ocupado) return;
        definirOcupado(true);
        definirErro('');
        try {
            if (!dados.ponte) throw new Error('Projetos estão disponíveis no aplicativo desktop.');
            const resultado = await dados.ponte.adicionarProjeto(entrada);
            if (!resultado.ok) throw new Error(resultado.erro);
            if (!resultado.valor) return;
            if (resultado.valor.aviso) dados.definirErro(resultado.valor.aviso);
            selecionar(resultado.valor);
            fechar();
        } catch (erro) {
            definirErro(erro instanceof Error ? erro.message : 'Não foi possível adicionar o projeto.');
        } finally {
            definirOcupado(false);
        }
    }

    return (
        <Modal
            titulo="Projetos"
            fechar={() => {
                if (!ocupado) fechar();
            }}
        >
            {tipo ? (
                <form
                    onSubmit={(evento) => {
                        evento.preventDefault();
                        void adicionar(tipo === 'criar' ? { tipo, nome: valor } : { tipo, url: valor });
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
                        {tipo === 'criar' ? 'Nome do projeto' : 'URL HTTPS do repositório'}
                        <input
                            autoFocus
                            value={valor}
                            disabled={ocupado}
                            required
                            maxLength={tipo === 'criar' ? 100 : 2000}
                            onChange={(evento) => definirValor(evento.target.value)}
                        />
                    </label>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
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
                            onClick={() => definirTipo(null)}
                        >
                            Voltar
                        </button>
                        <button
                            data-ui="botao botao-primario"
                            className={[
                                'inline-flex items-center justify-center gap-[9px] bg-[#d8e5dd] rounded-[8px]',
                                'whitespace-nowrap text-[#18241e] px-[14px] py-[9px] border border-solid',
                                'border-transparent [&:hover:not(:disabled)]:bg-[#c0d5c8]',
                                [
                                    '[[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                                    '[[data-ui~=lista-projetos]_>_&]:justify-start',
                                ].join(' '),
                                '[[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                                '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                            ].join(' ')}
                            disabled={ocupado || !valor.trim()}
                        >
                            {ocupado ? 'Preparando projeto' : tipo === 'criar' ? 'Criar projeto' : 'Clonar repositório'}
                        </button>
                    </div>
                </form>
            ) : (
                <div
                    data-ui="opcoes-projetos"
                    className="grid gap-[10px] [&_>_button]:justify-start [&_>_button]:gap-[10px]"
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
                        disabled={ocupado}
                        onClick={() => void adicionar({ tipo: 'pasta' })}
                    >
                        <FolderOpenIcon size={18} /> Abrir pasta existente
                    </button>
                    <button
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                            '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('criar');
                            definirValor('');
                        }}
                    >
                        <PlusIcon size={18} /> Novo projeto
                    </button>
                    <button
                        data-ui="botao"
                        className={[
                            'inline-flex items-center justify-center gap-[9px] bg-[#1b1d22] rounded-[8px]',
                            'whitespace-nowrap px-[14px] py-[9px] border border-solid border-[#2b2e34]',
                            '[&:hover:not(:disabled)]:bg-[#272a30] [[data-ui~=lista-projetos]_>_&]:mb-[12px]',
                            '[[data-ui~=lista-projetos]_>_&]:justify-start [[data-ui~=lista-projetos]_>_&]:gap-[8px]',
                            '[@media(width<=600px)]:[[data-ui~=lista-projetos]_>_&]:m-[0]',
                        ].join(' ')}
                        disabled={ocupado}
                        onClick={() => {
                            definirTipo('clonar');
                            definirValor('');
                        }}
                    >
                        <GitBranchIcon size={18} /> Clonar repositório
                    </button>
                    {dados.estado.projetos.map((projeto) => (
                        <div
                            data-ui="projeto-cadastrado"
                            className={[
                                'grid grid-cols-[minmax(0,_1fr)_auto] gap-[6px_10px] border-t border-solid',
                                'border-t-[#2b2e34] pt-[12px] [&_input]:min-w-0 [&_input]:bg-transparent',
                                '[&_input]:text-inherit [&_input]:border-0 [&_input]:border-solid',
                                '[&_input]:border-current [&_small]:col-[1_/_-1] [&_small]:overflow-hidden',
                                '[&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[#858990]',
                            ].join(' ')}
                            key={projeto.id}
                        >
                            <input
                                aria-label={`Nome de ${projeto.nome}`}
                                defaultValue={projeto.nome}
                                key={`${projeto.id}:${projeto.nome}`}
                                disabled={ocupado}
                                onBlur={(evento) => {
                                    const nome = evento.target.value.trim();
                                    if (nome && nome !== projeto.nome) {
                                        void dados.executar(() => dados.ponte!.alterarProjeto(projeto.id, nome));
                                    }
                                }}
                            />
                            <button
                                data-ui="botao-icone"
                                className={[
                                    [
                                        '[[data-ui~=marca]_&]:ml-auto',
                                        '[[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                    ].join(' '),
                                    [
                                        'inline-flex items-center justify-center bg-transparent',
                                        'text-[#a1a5ad] rounded-[6px] p-[8px]',
                                    ].join(' '),
                                    'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                    '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                    "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#94b7a5]",
                                    '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                                ].join(' ')}
                                aria-label={`Remover projeto ${projeto.nome}`}
                                title="Remover da lista e preservar os arquivos as conversas"
                                disabled={ocupado}
                                onClick={() => void dados.executar(() => dados.ponte!.removerProjeto(projeto.id))}
                            >
                                <TrashIcon size={17} />
                            </button>
                            <small title={projeto.caminho}>{projeto.caminho}</small>
                        </div>
                    ))}
                </div>
            )}
            {ocupado && (
                <p
                    data-ui="texto-secundario mt-4"
                    className={[
                        'mt-4 text-[#a1a5ad] text-[12px] leading-[1.7]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                    ].join(' ')}
                    role="status"
                >
                    Preparando projeto
                </p>
            )}
            {erro && (
                <p
                    data-ui="aviso-erro mt-4"
                    className={[
                        'mt-4 flex justify-between items-center gap-[12px] text-[#f0b2ae] bg-[#33201f] rounded-[9px]',
                        'mb-[12px] text-[12px] max-h-[150px] overflow-auto wrap-anywhere p-[12px] border',
                        'border-solid border-[#6f403b]',
                    ].join(' ')}
                    role="alert"
                >
                    {erro}
                </p>
            )}
        </Modal>
    );
}
