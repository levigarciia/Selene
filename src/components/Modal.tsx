import { useEffect, useId, useRef, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react';

/** Exibe um diálogo com foco contido e fechamento pelo teclado. */
export function Modal({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: ReactNode }) {
    const referencia = useRef<HTMLDialogElement>(null);
    const tituloId = useId();
    useEffect(() => {
        const dialogo = referencia.current;
        dialogo?.showModal();
        return () => dialogo?.close();
    }, []);
    return (
        <dialog
            ref={referencia}
            data-ui="modal"
            className={[
                'bg-superficie text-principal rounded-[15px] w-[min(580px,_90vw)] max-h-[85dvh] overflow-y-auto',
                'p-[25px] m-auto border border-solid border-[#393d45]',
                '[&::backdrop]:bg-[rgb(0_0_0_/_65%)] [&_h2]:font-[550] [&_h2]:text-[17px]',
            ].join(' ')}
            onCancel={fechar}
            aria-labelledby={tituloId}
        >
            <header className="flex items-center justify-between gap-4 mb-6">
                <h2 id={tituloId}>{titulo}</h2>
                <button
                    data-ui="botao-icone"
                    className={[
                        '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                        'inline-flex items-center justify-center bg-transparent text-secundario rounded-[6px] p-[8px]',
                        'border-0 border-solid border-current [&:hover:not(:disabled)]:text-principal',
                        '[&:hover:not(:disabled)]:bg-hover [[data-ui~=rodape-entrada]_&]:p-0',
                        "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#b5a2dc]",
                        '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                    ].join(' ')}
                    onClick={fechar}
                    aria-label="Fechar diálogo"
                >
                    <XIcon size={18} />
                </button>
            </header>
            {children}
        </dialog>
    );
}
