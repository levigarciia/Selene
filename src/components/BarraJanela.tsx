import type { ReactNode } from 'react';
import { ArrowsOutSimpleIcon, MinusIcon, XIcon } from '@phosphor-icons/react';
import type { PonteSelene } from '../../shared/contratos';

/** Mantém os controles nativos disponíveis em todas as telas do aplicativo. */
export function BarraJanela({ children, ponte }: { children: ReactNode; ponte?: PonteSelene }) {
    return (
        <header className="barra-superior">
            <div className="flex items-center gap-3 min-w-0">{children}</div>
            <div className="acoes-janela">
                <button className="botao-icone" onClick={() => ponte?.janela('minimizar')} aria-label="Minimizar">
                    <MinusIcon size={16} />
                </button>
                <button className="botao-icone" onClick={() => ponte?.janela('maximizar')} aria-label="Maximizar">
                    <ArrowsOutSimpleIcon size={15} />
                </button>
                <button className="botao-icone" onClick={() => ponte?.janela('fechar')} aria-label="Fechar janela">
                    <XIcon size={17} />
                </button>
            </div>
        </header>
    );
}
