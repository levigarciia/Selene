import { useLayoutEffect, useRef } from 'react';

/** Use na conversa para mover a entrada e revelar a primeira mensagem sem atrasar o envio. */
export function useTransicaoPrimeiroEnvio(inicial: boolean, conversaId: string | null) {
    const tela = useRef<HTMLDivElement>(null);
    const anterior = useRef<{ inicial: boolean; id: string | null; caixa: DOMRect } | null>(null);

    useLayoutEffect(() => {
        const elemento = tela.current;
        const entrada = elemento?.querySelector<HTMLElement>('[data-ui~="area-entrada"]');
        if (!elemento || !entrada) return;
        const caixa = entrada.getBoundingClientRect();
        const origem = anterior.current;
        anterior.current = { inicial, id: conversaId, caixa };
        if (inicial || !origem?.inicial || origem.id !== conversaId) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const temporizacao = { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
        const movimento = entrada.animate(
            [
                { transform: `translate(${origem.caixa.left - caixa.left}px, ${origem.caixa.top - caixa.top}px)` },
                { transform: 'translate(0, 0)' },
            ],
            temporizacao,
        );
        const mensagem = elemento.querySelector<HTMLElement>('[data-ui~="mensagem-usuario"]');
        const aparicao = mensagem?.animate(
            [
                { opacity: 0, transform: 'translateY(36px)' },
                { opacity: 1, transform: 'translateY(0)' },
            ],
            { ...temporizacao, delay: 90, fill: 'backwards' },
        );
        return () => {
            movimento.cancel();
            aparicao?.cancel();
        };
    }, [inicial, conversaId]);

    useLayoutEffect(() => {
        if (!inicial) return;
        const entrada = tela.current?.querySelector<HTMLElement>('[data-ui~="area-entrada"]');
        if (!entrada) return;
        const observador = new ResizeObserver(() => {
            anterior.current = { inicial, id: conversaId, caixa: entrada.getBoundingClientRect() };
        });
        observador.observe(entrada);
        if (tela.current) observador.observe(tela.current);
        return () => observador.disconnect();
    }, [inicial, conversaId]);

    return tela;
}
