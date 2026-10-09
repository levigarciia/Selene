import { useCallback, useState } from 'react';
import { FolderPlusIcon, SelectionIcon } from '@phosphor-icons/react';
import { IconeProjeto } from './IconeProjeto';
import type { Conversa, Projeto } from '../../shared/contratos';
import { MenuContexto, type PosicaoMenu } from './MenuContexto';

/** Use para escolher o projeto da composição ou abrir o cadastro de uma nova pasta. */
export function SeletorProjeto({
    conversa,
    projetos,
    ocupado,
    escolher,
}: {
    conversa?: Conversa;
    projetos: Projeto[];
    ocupado: boolean;
    escolher: (caminho?: string | null) => Promise<void>;
}) {
    const [menu, definirMenu] = useState<PosicaoMenu | null>(null);
    const fechar = useCallback(() => definirMenu(null), []);
    const projetoAtual = projetos.find((projeto) => projeto.caminho === conversa?.projeto);
    const nome = projetoAtual?.nome ?? conversa?.projeto?.split(/[\\/]/).at(-1) ?? 'Sem projeto';

    function selecionar(caminho?: string | null) {
        fechar();
        menu?.origem.focus();
        void escolher(caminho);
    }

    return (
        <div className="seletor-projeto">
            <button
                type="button"
                className="gatilho-projeto"
                aria-label="Projeto da conversa"
                aria-haspopup="menu"
                aria-expanded={!!menu}
                disabled={ocupado}
                title={conversa?.projeto ?? undefined}
                onClick={(evento) => {
                    if (menu) return fechar();
                    const origem = evento.currentTarget;
                    const limites = origem.getBoundingClientRect();
                    definirMenu({ origem, x: limites.left + limites.width / 2 - 80, y: limites.bottom + 5 });
                }}
            >
                <IconeProjeto projeto={projetoAtual} tamanho={16} />
                {nome}
            </button>
            {menu && !ocupado && (
                <MenuContexto posicao={menu} fechar={fechar} titulo="Projeto da conversa" classe="menu-projetos">
                    <button role="menuitemradio" aria-checked={!conversa?.projeto} onClick={() => selecionar(null)}>
                        <SelectionIcon size={16} /> Sem projeto
                    </button>
                    {projetos.map((projeto) => (
                        <button
                            key={projeto.id}
                            role="menuitemradio"
                            aria-checked={conversa?.projeto === projeto.caminho}
                            title={projeto.caminho}
                            onClick={() => selecionar(projeto.caminho)}
                        >
                            <IconeProjeto projeto={projeto} tamanho={16} />{' '}
                            <span className="truncate">{projeto.nome}</span>
                        </button>
                    ))}
                    <div className="separador-menu-projetos" role="separator" />
                    <button role="menuitem" onClick={() => selecionar()}>
                        <FolderPlusIcon size={16} /> Adicionar projeto
                    </button>
                </MenuContexto>
            )}
        </div>
    );
}
