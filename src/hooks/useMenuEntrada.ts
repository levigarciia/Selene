import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Estado e posicionamento dos menus da barra de entrada: abre acima do gatilho, acompanha redimensionamentos e
 * fecha ao clicar fora ou quando o controle fica desativado.
 */
export function useMenuEntrada(desativado: boolean, focarAoAbrir: string) {
    const [aberto, definirAberto] = useState(false);
    const raiz = useRef<HTMLDivElement>(null);
    const gatilho = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const abertoPorToque = useRef(false);

    useLayoutEffect(() => {
        if (!aberto || !menu.current || !gatilho.current) return;
        const posicionar = () => {
            if (!menu.current || !gatilho.current) return;
            const origem = gatilho.current.getBoundingClientRect();
            const limites = menu.current.getBoundingClientRect();
            const esquerda = Math.max(8, Math.min(origem.left, window.innerWidth - limites.width - 8));
            menu.current.style.left = `${esquerda}px`;
            menu.current.style.bottom = `${window.innerHeight - origem.top + 10}px`;
        };
        posicionar();
        if (!abertoPorToque.current) {
            menu.current.querySelector<HTMLElement>(focarAoAbrir)?.focus({ preventScroll: true });
        }
        window.addEventListener('resize', posicionar);
        window.visualViewport?.addEventListener('resize', posicionar);
        return () => {
            window.removeEventListener('resize', posicionar);
            window.visualViewport?.removeEventListener('resize', posicionar);
        };
    }, [aberto, focarAoAbrir]);

    useEffect(() => {
        if (!aberto) return;
        const fora = (evento: PointerEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) definirAberto(false);
        };
        document.addEventListener('pointerdown', fora);
        return () => document.removeEventListener('pointerdown', fora);
    }, [aberto]);

    useEffect(() => {
        if (desativado) definirAberto(false);
    }, [desativado]);

    return { aberto, definirAberto, raiz, gatilho, menu, abertoPorToque };
}
