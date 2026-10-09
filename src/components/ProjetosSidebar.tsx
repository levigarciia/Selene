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
            <section className="grupo-projeto" key={projeto.id} aria-label={`Projeto ${projeto.nome}`}>
                <div className="cabecalho-projeto">
                    <button
                        className="titulo-projeto"
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
                        {!recolhida && <CaretDownIcon size={12} className={aberto ? '' : 'grupo-fechado'} />}
                        <IconeProjeto projeto={projeto} tamanho={16} />
                        {!recolhida && <span className="truncate">{projeto.nome}</span>}
                    </button>
                    {!recolhida && (
                        <button
                            className="botao-icone"
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
