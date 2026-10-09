import { useState, type ReactNode } from 'react';
import { CaretDownIcon, PlusIcon } from '@phosphor-icons/react';
import type { Conversa } from '../../shared/contratos';
import type { ProjetoChat } from '../../shared/projetosChat';
import { IconeProjeto } from './IconeProjeto';

/** Agrupa os chats por espaço e mantém o projeto acessível mesmo antes da primeira conversa. */
export function ProjetosChatSidebar({
    projetos,
    conversas,
    recolhida,
    termo,
    abrir,
    criar,
    renderizar,
}: {
    projetos: ProjetoChat[];
    conversas: Conversa[];
    recolhida: boolean;
    termo: string;
    abrir: (id: string) => void;
    criar: (id: string) => void;
    renderizar: (conversa: Conversa) => ReactNode;
}) {
    const [fechados, definirFechados] = useState<Set<string>>(new Set());
    return projetos.map((projeto) => {
        const itens = conversas.filter((item) => item.projetoChatId === projeto.id);
        if (termo && !itens.length && !projeto.nome.toLocaleLowerCase('pt-BR').includes(termo)) return null;
        const aberto = !!termo || !fechados.has(projeto.id);
        return (
            <section
                key={projeto.id}
                data-ui="grupo-projeto-chat"
                className="mb-3"
                aria-label={`Projeto de Chat ${projeto.nome}`}
            >
                <div className="flex items-center gap-1 px-1 py-1">
                    {!recolhida && (
                        <button
                            className="rounded p-1 text-discreto hover:text-principal"
                            aria-label={`Conversas de ${projeto.nome}`}
                            aria-expanded={aberto}
                            onClick={() =>
                                definirFechados((anteriores) => {
                                    const novos = new Set(anteriores);
                                    if (novos.has(projeto.id)) novos.delete(projeto.id);
                                    else novos.add(projeto.id);
                                    return novos;
                                })
                            }
                        >
                            <CaretDownIcon size={12} className={aberto ? '' : '-rotate-90'} />
                        </button>
                    )}
                    <button
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left
                    text-xs text-secundario hover:bg-hover hover:text-principal"
                        onClick={() => abrir(projeto.id)}
                        aria-label={`Abrir projeto ${projeto.nome}`}
                        title={projeto.nome}
                    >
                        <IconeProjeto projeto={projeto} tamanho={17} />
                        {!recolhida && <span className="truncate">{projeto.nome}</span>}
                    </button>
                    {!recolhida && (
                        <button
                            className="rounded p-1 text-discreto hover:text-principal"
                            aria-label={`Novo chat em ${projeto.nome}`}
                            onClick={() => criar(projeto.id)}
                        >
                            <PlusIcon size={15} />
                        </button>
                    )}
                </div>
                {aberto && !recolhida && <div className="ml-3 border-l border-borda pl-1">{itens.map(renderizar)}</div>}
            </section>
        );
    });
}
