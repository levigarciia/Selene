import { MenuContexto, type PosicaoMenu } from './MenuContexto';
import { DownloadSimpleIcon, TrashIcon, CheckIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type { Conversa } from '../../shared/contratos';

export type PosicaoMenuConversa = PosicaoMenu & { conversa: Conversa };

/** Oferece ações da conversa com navegação por teclado e posicionamento dentro da janela. */
export function MenuConversa({
    menu,
    ocupado,
    fechar,
    exportar,
    excluir,
    concluir,
}: {
    menu: PosicaoMenuConversa;
    ocupado: boolean;
    fechar: () => void;
    exportar: (id: string) => void;
    excluir: (conversa: Conversa) => void;
    concluir: (conversa: Conversa) => void;
}) {
    return (
        <MenuContexto posicao={menu} fechar={fechar} titulo={`Ações de ${menu.conversa.titulo}`}>
            {menu.conversa.modo === 'code' && !!menu.conversa.mensagens.length && (
                <button
                    role="menuitem"
                    disabled={ocupado}
                    onClick={() => {
                        fechar();
                        concluir(menu.conversa);
                    }}
                >
                    {menu.conversa.concluida ? <ArrowCounterClockwiseIcon size={17} /> : <CheckIcon size={17} />}
                    {menu.conversa.concluida ? 'Retomar conversa' : 'Concluir conversa'}
                </button>
            )}
            {!!menu.conversa.mensagens.length && (
                <button
                    role="menuitem"
                    onClick={() => {
                        fechar();
                        exportar(menu.conversa.id);
                    }}
                >
                    <DownloadSimpleIcon size={17} /> Exportar conversa
                </button>
            )}
            <button
                role="menuitem"
                className="texto-erro"
                disabled={ocupado}
                onClick={() => {
                    fechar();
                    excluir(menu.conversa);
                }}
            >
                <TrashIcon size={17} /> Excluir conversa
            </button>
        </MenuContexto>
    );
}
