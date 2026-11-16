import { useLayoutEffect, useRef } from 'react';

const seletores = {
    simbolo: '[data-ui="simbolo-selene"]',
    titulo: '[data-ui="hero-conversa"] h1',
    detalhe: '[data-ui="detalhe-hero"]',
    entrada: '[data-ui="area-entrada"]',
    topbar: '[data-ui="conteudo-topbar"]',
    opcoes: '[data-ui="opcoes-code"]',
    pullRequest: '[data-ui="entrada-pr-sidebar"]',
};
type Fotografia = { caixa: DOMRect; copia?: Element; fontSize: string; color: string };

function fotografar() {
    const resultado = new Map<string, Fotografia>();
    for (const [chave, seletor] of Object.entries(seletores)) {
        const elemento = [...document.querySelectorAll(seletor)].find((item) => item.getBoundingClientRect().width);
        if (!elemento) continue;
        resultado.set(chave, {
            caixa: elemento.getBoundingClientRect(),
            copia: !['simbolo', 'entrada'].includes(chave) ? (elemento.cloneNode(true) as Element) : undefined,
            fontSize: getComputedStyle(elemento).fontSize,
            color: getComputedStyle(elemento).color,
        });
    }
    return resultado;
}

/** Capture antes de alternar o modo para animar a interface desde suas posições reais. */
export function useTransicaoModo(modo: 'chat' | 'code') {
    const origem = useRef<ReturnType<typeof fotografar> | null>(null);
    const animacoes = useRef<Animation[]>([]);
    const copias = useRef<Element[]>([]);

    function limpar() {
        animacoes.current.forEach((animacao) => animacao.cancel());
        copias.current.forEach((copia) => copia.remove());
        animacoes.current = [];
        copias.current = [];
    }

    useLayoutEffect(() => {
        const anteriores = origem.current;
        origem.current = null;
        if (!anteriores) return;
        const tempo = { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
        for (const [chave, seletor] of Object.entries(seletores)) {
            const elemento = [...document.querySelectorAll(seletor)].find((item) => item.getBoundingClientRect().width);
            const anterior = anteriores.get(chave);
            if (!anterior) continue;
            if (elemento && ['opcoes', 'pullRequest'].includes(chave)) continue;
            const caixa = elemento?.getBoundingClientRect() ?? anterior.caixa;
            const x = anterior.caixa.left - caixa.left;
            const y = anterior.caixa.top - caixa.top;
            const trocaTexto = !!anterior.copia;
            if (elemento)
                animacoes.current.push(
                    elemento.animate(
                        [
                            { transform: `translate(${x}px, ${y}px)`, opacity: trocaTexto ? 0 : 1 },
                            { transform: 'translate(0, 0)', opacity: 1 },
                        ],
                        tempo,
                    ),
                );
            if (!anterior.copia) continue;
            const copia = anterior.copia;
            copia.setAttribute('aria-hidden', 'true');
            copia.setAttribute('inert', '');
            for (const item of [copia, ...copia.querySelectorAll('*')]) {
                item.removeAttribute('id');
                item.removeAttribute('data-ui');
                item.removeAttribute('autofocus');
            }
            copia.classList.add('fixed', 'pointer-events-none', 'z-50', 'm-0');
            for (const classe of [...copia.classList]) {
                if (classe.includes('starting:') || classe.includes('transition-')) copia.classList.remove(classe);
            }
            copia.setAttribute('data-transicao-saida', chave);
            (elemento?.parentElement ?? document.body).append(copia);
            copias.current.push(copia);
            const posicao = {
                fontSize: anterior.fontSize,
                color: anterior.color,
                left: `${anterior.caixa.left}px`,
                top: `${anterior.caixa.top}px`,
                width: `${anterior.caixa.width}px`,
                height: `${anterior.caixa.height}px`,
            };
            const saida = copia.animate(
                [
                    { ...posicao, opacity: 1, transform: 'translate(0, 0)' },
                    {
                        ...posicao,
                        opacity: 0,
                        transform: elemento ? `translate(${-x}px, ${-y}px)` : 'translateX(-16px)',
                    },
                ],
                { ...tempo, fill: 'both' },
            );
            saida.onfinish = () => copia.remove();
            animacoes.current.push(saida);
        }
    }, [modo]);

    useLayoutEffect(() => limpar, []);

    return () => {
        const fotografia = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : fotografar();
        limpar();
        origem.current = fotografia;
    };
}
