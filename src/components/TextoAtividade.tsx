import { useEffect, useRef, type ReactNode } from 'react';

/** Use para destacar texto durante a execução e encerrar o brilho ao concluir a atividade. */
export function TextoAtividade({ ativo, children }: { ativo: boolean; children: ReactNode }) {
    const referencia = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const elemento = referencia.current;
        if (!ativo || !elemento) return;
        const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
        let animacao: Animation | undefined;
        function atualizar() {
            animacao?.cancel();
            if (preferencia.matches) return;
            animacao = elemento!.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], {
                duration: 2000,
                iterations: Infinity,
                easing: 'linear',
            });
        }
        atualizar();
        preferencia.addEventListener('change', atualizar);
        return () => {
            animacao?.cancel();
            preferencia.removeEventListener('change', atualizar);
        };
    }, [ativo]);
    return (
        <span
            ref={referencia}
            data-ui={ativo ? 'texto-em-andamento' : undefined}
            className={
                ativo
                    ? [
                          'bg-[linear-gradient(90deg,#777d85_35%,#f1f3f5_50%,#777d85_65%)]',
                          'bg-[length:250%_100%] bg-clip-text text-transparent',
                          'motion-reduce:bg-none motion-reduce:text-[#b5bbc4]',
                      ].join(' ')
                    : undefined
            }
        >
            {children}
        </span>
    );
}
