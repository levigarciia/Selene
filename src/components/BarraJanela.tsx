import type { ReactNode } from 'react';
import { ArrowsOutSimpleIcon, MinusIcon, XIcon } from '@phosphor-icons/react';
import type { PonteSelene } from '../../shared/contratos';

/** Mantém os controles nativos disponíveis em todas as telas do aplicativo. */
export function BarraJanela({ children, ponte }: { children: ReactNode; ponte?: PonteSelene }) {
    return (
        <header
            data-ui="barra-superior"
            className={[
                'flex items-center justify-between min-h-[56px] pr-[16px] pl-[30px] border-b',
                'border-solid border-b-[#222429] text-[12px] [-webkit-app-region:drag] py-0',
            ].join(' ')}
        >
            <div className="flex items-center gap-3 min-w-0">{children}</div>
            <div data-ui="acoes-janela" className="flex items-center gap-[4px]">
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-[#a1a5ad] rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                    ].join(' ')}
                    onClick={() => ponte?.janela('minimizar')}
                    aria-label="Minimizar"
                >
                    <MinusIcon size={16} />
                </button>
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-[#a1a5ad] rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                    ].join(' ')}
                    onClick={() => ponte?.janela('maximizar')}
                    aria-label="Maximizar"
                >
                    <ArrowsOutSimpleIcon size={15} />
                </button>
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-[#a1a5ad] rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-[#e6e7e9]',
                        '[&:hover:not(:disabled)]:bg-[#24262c] [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                    ].join(' ')}
                    onClick={() => ponte?.janela('fechar')}
                    aria-label="Fechar janela"
                >
                    <XIcon size={17} />
                </button>
            </div>
        </header>
    );
}
