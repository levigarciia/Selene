import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

export type PosicaoMenu = { x: number; y: number; origem: HTMLElement };

/** Use para oferecer ações por mouse ou teclado, mantendo o menu e o foco dentro da janela. */
export function MenuContexto({
    posicao,
    titulo,
    fechar,
    children,
    classe,
}: {
    posicao: PosicaoMenu;
    titulo: string;
    fechar: () => void;
    children: ReactNode;
    classe?: string;
}) {
    const raiz = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const elemento = raiz.current!;
        const tamanho = elemento.getBoundingClientRect();
        elemento.style.left = `${Math.max(8, Math.min(posicao.x, window.innerWidth - tamanho.width - 8))}px`;
        elemento.style.top = `${Math.max(8, Math.min(posicao.y, window.innerHeight - tamanho.height - 8))}px`;
        const selecionado = elemento.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
        (selecionado ?? elemento.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    }, [posicao]);
    useEffect(() => {
        const fora = (evento: MouseEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) fechar();
        };
        const sair = (evento: KeyboardEvent) => {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                fechar();
                posicao.origem.focus();
            }
            if (evento.key === 'Tab') fechar();
        };
        window.addEventListener('mousedown', fora);
        window.addEventListener('keydown', sair);
        window.addEventListener('resize', fechar);
        return () => {
            window.removeEventListener('mousedown', fora);
            window.removeEventListener('keydown', sair);
            window.removeEventListener('resize', fechar);
        };
    }, [fechar, posicao]);
    return (
        <div
            ref={raiz}
            className={`menu-conversa ${classe ?? ''}`}
            role="menu"
            aria-label={titulo}
            onKeyDown={(evento) => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;
                evento.preventDefault();
                const itens = [...raiz.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
                const proximo =
                    evento.key === 'Home'
                        ? 0
                        : evento.key === 'End'
                          ? itens.length - 1
                          : (atual + (evento.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
                itens[proximo]?.focus();
            }}
        >
            {children}
        </div>
    );
}
