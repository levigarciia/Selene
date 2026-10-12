import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DotsThreeIcon } from '@phosphor-icons/react';
import { MenuContexto, type PosicaoMenu } from './MenuContexto';

export interface AcaoMenuGitHub {
    nome: string;
    executar: () => void;
    icone?: ReactNode;
    desativada?: boolean;
}

/** Oferece ações do GitHub em um menu acessível, sem recortar o menu na rolagem da lista. */
export function MenuAcoesGitHub({
    rotulo,
    acoes,
    noHover = false,
}: {
    rotulo: string;
    acoes: AcaoMenuGitHub[];
    noHover?: boolean;
}) {
    const [posicao, definirPosicao] = useState<PosicaoMenu | null>(null);
    return (
        <>
            <button
                aria-label={rotulo}
                aria-haspopup="menu"
                aria-expanded={!!posicao}
                title={rotulo}
                className={[
                    'rounded-md p-1 text-discreto hover:bg-hover hover:text-principal',
                    noHover && !posicao
                        ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
                        : '',
                ].join(' ')}
                onClick={(evento) => {
                    const origem = evento.currentTarget;
                    const retangulo = origem.getBoundingClientRect();
                    definirPosicao(posicao ? null : { origem, x: retangulo.right - 220, y: retangulo.bottom + 4 });
                }}
            >
                <DotsThreeIcon size={18} weight="bold" />
            </button>
            {posicao &&
                createPortal(
                    <MenuContexto
                        posicao={posicao}
                        titulo={rotulo}
                        fechar={() => definirPosicao(null)}
                        classe="min-w-[220px]"
                    >
                        {acoes.map((acao) => (
                            <button
                                key={acao.nome}
                                role="menuitem"
                                disabled={acao.desativada}
                                className="flex w-full items-center gap-2 text-left disabled:opacity-40"
                                onClick={() => {
                                    definirPosicao(null);
                                    acao.executar();
                                }}
                            >
                                {acao.icone}
                                {acao.nome}
                            </button>
                        ))}
                    </MenuContexto>,
                    document.body,
                )}
        </>
    );
}
