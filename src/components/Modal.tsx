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
        <dialog ref={referencia} className="modal" onCancel={fechar} aria-labelledby={tituloId}>
            <header className="flex items-center justify-between gap-4 mb-6">
                <h2 id={tituloId}>{titulo}</h2>
                <button className="botao-icone" onClick={fechar} aria-label="Fechar diálogo">
                    <XIcon size={18} />
                </button>
            </header>
            {children}
        </dialog>
    );
}
