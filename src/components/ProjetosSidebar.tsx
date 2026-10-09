import { useState, type ReactNode } from 'react';
import { CaretDownIcon, PlusIcon } from '@phosphor-icons/react';
import type { Conversa, Projeto } from '../../shared/contratos';
import { IconeProjeto } from './IconeProjeto';

/** Organiza conversas atuais por projeto e mantém projetos vazios acessíveis para iniciar trabalho. */
export function ProjetosSidebar({
    projetos,
    conversas,
    recolhida,
    termo,
    criar,
    renderizar,
}: {
    projetos: Projeto[];
    conversas: Conversa[];
    recolhida: boolean;
    termo: string;
    criar: (id: string) => void;
    renderizar: (conversa: Conversa) => ReactNode;
}) {
    const [fechados, definirFechados] = useState<Set<string>>(new Set());
    return projetos.map((projeto) => {
        const itens = conversas.filter((item) => item.projetoId === projeto.id || item.projeto === projeto.caminho);
        if (
            termo &&
            !itens.length &&
            !`${projeto.nome} ${projeto.caminho}`.toLocaleLowerCase('pt-BR').includes(termo)
        ) {
            return null;
        }
        const aberto = !!termo || !fechados.has(projeto.id);
        return (
            <section
                data-ui="grupo-projeto"
                className="mb-[12px]"
                key={projeto.id}
                aria-label={`Projeto ${projeto.nome}`}
            >
                <div data-ui="cabecalho-projeto" className="flex items-center gap-[4px] px-[6px] py-[4px]">
                    <button
                        data-ui="titulo-projeto"
                        className={[
                            'flex items-center gap-[7px] flex-1 min-w-0 bg-transparent text-[#a1a5ad] text-[12px]',
                            'text-left px-0 py-[6px] border-0 border-solid border-current [&_svg]:shrink-0',
                        ].join(' ')}
                        title={projeto.caminho}
                        aria-label={recolhida ? `Novo chat em ${projeto.nome}` : `Projeto ${projeto.nome}`}
                        aria-expanded={recolhida ? undefined : aberto}
                        onClick={() => {
                            if (recolhida) return criar(projeto.id);
                            definirFechados((anteriores) => {
                                const novos = new Set(anteriores);
                                if (novos.has(projeto.id)) novos.delete(projeto.id);
                                else novos.add(projeto.id);
                                return novos;
                            });
                        }}
                    >
                        {!recolhida && (
                            <CaretDownIcon
                                size={12}
                                data-ui={aberto ? '' : 'grupo-fechado'}
                                className={aberto ? '' : '[&&]:[transform:rotate(-90deg)]'}
                            />
                        )}
                        <IconeProjeto projeto={projeto} tamanho={16} />
                        {!recolhida && <span className="truncate">{projeto.nome}</span>}
                    </button>
                    {!recolhida && (
                        <button
                            data-ui="botao-icone"
                            className={[
                                '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                                [
                                    'inline-flex items-center justify-center bg-transparent text-[#a1a5ad]',
                                    'rounded-[6px] p-[8px]',
                                ].join(' '),
                                'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                                '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                                "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                                '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                            ].join(' ')}
                            aria-label={`Novo chat em ${projeto.nome}`}
                            onClick={() => criar(projeto.id)}
                        >
                            <PlusIcon size={15} />
                        </button>
                    )}
                </div>
                {(aberto || recolhida) && itens.map(renderizar)}
            </section>
        );
    });
}
