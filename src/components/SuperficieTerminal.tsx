import { useEffect, useRef } from 'react';
import type { PonteSelene } from '../../shared/contratos';
import type { GhosttyTerminalSurface } from '../terminal/ghostty/surface';
import type { GhosttyTheme } from '../terminal/ghostty/core';

const tema: GhosttyTheme = {
    foreground: { r: 0xf5, g: 0xf5, b: 0xf5 },
    background: { r: 0x0a, g: 0x0a, b: 0x0a },
    cursor: { r: 0xf5, g: 0xf5, b: 0xf5 },
    selectionBackground: 'rgba(181, 162, 220, 0.35)',
};

/** Desenha um terminal já aberto no processo principal e encaminha entrada e tamanho. */
export function SuperficieTerminal({
    ponte,
    id,
    visivel,
    focar,
}: {
    ponte: PonteSelene;
    id: string;
    visivel: boolean;
    focar: boolean;
}) {
    const montagem = useRef<HTMLDivElement>(null);
    const superficie = useRef<GhosttyTerminalSurface | null>(null);

    useEffect(() => {
        const elemento = montagem.current;
        if (!elemento) return;
        let descartado = false;
        const pendentes: string[] = [];
        let historicoLido = false;
        const cancelarEventos = ponte.aoEvento((evento) => {
            if (evento.tipo !== 'terminalDados' || evento.id !== id || !historicoLido) return;
            if (superficie.current) superficie.current.write(evento.dados);
            else pendentes.push(evento.dados);
        });
        void (async () => {
            const { GhosttyTerminalSurface } = await import('../terminal/ghostty/surface');
            const historico = await ponte.historicoTerminal(id);
            historicoLido = true;
            const criada = await GhosttyTerminalSurface.create(elemento, {
                theme: tema,
                visible: visivel,
                onData: (dados) => void ponte.escreverTerminal(id, dados),
                onResize: (colunas, linhas) => void ponte.redimensionarTerminal(id, { colunas, linhas }),
                onSelectionChange: () => {},
                beforeKey: () => true,
                onLinkActivate: (texto) => {
                    if (texto.startsWith('https://github.com/')) void ponte.abrirGitHub(texto);
                },
                canActivateLink: (texto) => texto.startsWith('https://github.com/'),
            });
            if (descartado) {
                criada.dispose();
                return;
            }
            superficie.current = criada;
            criada.resetAndWrite(historico.ok ? historico.valor : '');
            for (const trecho of pendentes.splice(0)) criada.write(trecho);
            criada.resendSize();
            if (focar) criada.focus();
        })();
        return () => {
            descartado = true;
            cancelarEventos();
            superficie.current?.dispose();
            superficie.current = null;
        };
    }, [ponte, id]);

    useEffect(() => {
        superficie.current?.setVisible(visivel);
        if (visivel) superficie.current?.fit();
    }, [visivel]);

    return <div ref={montagem} className="relative size-full overflow-hidden" />;
}
