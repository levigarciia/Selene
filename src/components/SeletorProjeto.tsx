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
        <div data-ui="seletor-projeto" className="max-w-[min(360px,_100%)]">
            <button
                type="button"
                data-ui="gatilho-projeto"
                className={[
                    'max-w-full overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-[#dedee0]',
                    [
                        'text-[14px] font-semibold [text-decoration:underline] underline-offset-[3px] flex',
                        'items-center',
                    ].join(' '),
                    'gap-[7px] p-0 border-0 border-solid border-current',
                ].join(' ')}
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
                            <IconeProjeto projeto={projeto} tamanho={16} />
                            {''}
                            <span className="truncate">{projeto.nome}</span>
                        </button>
                    ))}
                    <div
                        data-ui="separador-menu-projetos"
                        className="h-[1px] bg-[#242424] mx-[8px] my-[5px]"
                        role="separator"
                    />
                    <button role="menuitem" onClick={() => selecionar()}>
                        <FolderPlusIcon size={16} /> Adicionar projeto
                    </button>
                </MenuContexto>
            )}
        </div>
    );
}
