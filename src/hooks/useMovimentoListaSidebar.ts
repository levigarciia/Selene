import { useCallback, useRef } from 'react';
import { criarMovimentoListaSidebar } from '../utils/movimentoListaSidebar';

const ehCopiaInerte = (no: Node) => no instanceof HTMLElement && no.inert;

function alteraEstrutura(registro: MutationRecord) {
    if (registro.target instanceof Element && registro.target.closest('[data-ui~="linha-sidebar"]')) return false;
    const nos = [...registro.addedNodes, ...registro.removedNodes];
    return !nos.every(ehCopiaInerte);
}

/**
 * Use como `ref` do contêiner rolável da sidebar para animar entradas, saídas e reordenações das linhas.
 * Mudanças de conteúdo dentro de uma linha e mudanças de largura do contêiner não disparam animação.
 */
export function useMovimentoListaSidebar<T extends HTMLElement>() {
    const limpar = useRef<(() => void) | null>(null);
    return useCallback((contenedor: T | null) => {
        limpar.current?.();
        limpar.current = null;
        if (!contenedor) return;
        const movimento = criarMovimentoListaSidebar(contenedor);
        let largura = contenedor.clientWidth;
        movimento.atualizar(false);
        const observador = new MutationObserver((registros) => {
            if (!registros.some(alteraEstrutura)) return;
            const larguraAtual = contenedor.clientWidth;
            movimento.atualizar(larguraAtual === largura);
            largura = larguraAtual;
        });
        observador.observe(contenedor, { childList: true, subtree: true });
        limpar.current = () => {
            observador.disconnect();
            movimento.descartar();
        };
    }, []);
}
