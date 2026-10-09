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
            data-ui={`menu-conversa ${classe === 'menu-projetos' ? 'menu-projetos' : ''}`}
            className={[
                [
                    'fixed z-[80] w-[210px] rounded-[9px] bg-[#1a1c20] shadow-[0_12px_36px_#0006] p-[5px]',
                    'border border-solid border-[#353940] [&_button]:w-full [&_button]:flex',
                    '[&_button]:items-center [&_button]:gap-[10px] [&_button]:rounded-[5px]',
                    '[&_button]:bg-transparent [&_button]:text-left [&_button]:text-[12px] [&_button]:px-[12px]',
                    '[&_button]:py-[11px] [&_button]:border-0 [&_button]:border-solid',
                    '[&_button]:border-current [&_button:hover:not(:disabled)]:bg-[#2b2e34]',
                ].join(' '),
                classe === 'menu-projetos'
                    ? [
                          '[&&]:w-[160px]',
                          '[&&]:max-h-[min(360px,_calc(100dvh_-_16px))]',
                          '[&&]:overflow-y-auto [&&]:rounded-[12px]',
                          '[&&]:bg-[#111] [&&]:text-[#e6e6e6]',
                          '[&&]:p-[4px] [&&]:border-[#2b2b2b]',
                          [
                              '[&_button]:gap-[8px] [&_button]:min-h-[28px] [&_button]:text-[13px]',
                              '[&_button]:rounded-[7px]',
                          ].join(' '),
                          [
                              '[&_button]:px-[8px] [&_button]:py-[6px] [&_button_svg]:shrink-0',
                              '[&_button_svg]:text-[#a4a4a8]',
                          ].join(' '),
                          "[&_button[aria-checked='true']]:bg-[#262626] [&_button[aria-checked='true']]:outline-none",
                          '[&_button:focus-visible]:bg-[#262626] [&_button:focus-visible]:outline-none',
                          '[&_button:hover:not(:disabled)]:bg-[#262626] [&_button:hover:not(:disabled)]:outline-none',
                      ].join(' ')
                    : '',
            ].join(' ')}
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
