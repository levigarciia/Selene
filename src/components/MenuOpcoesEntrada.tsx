import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';

type Opcao = { valor: string; nome: string; descricao?: string };

/** Permite escolher controles da conversa com foco, navegação por teclado e fechamento fora do menu. */
export function MenuOpcoesEntrada({
    rotulo,
    nome,
    icone,
    valor,
    opcoes,
    desativado,
    alterar,
}: {
    rotulo: string;
    nome: string;
    icone: ReactNode;
    valor: string;
    opcoes: Opcao[];
    desativado: boolean;
    alterar: (valor: string) => Promise<void>;
}) {
    const [aberto, definirAberto] = useState(false);
    const [salvando, definirSalvando] = useState(false);
    const id = useId();
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
            menu.current.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
        }
        window.addEventListener('resize', posicionar);
        window.visualViewport?.addEventListener('resize', posicionar);
        return () => {
            window.removeEventListener('resize', posicionar);
            window.visualViewport?.removeEventListener('resize', posicionar);
        };
    }, [aberto]);

    useEffect(() => {
        if (!aberto) return;
        const fora = (evento: PointerEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) definirAberto(false);
        };
        document.addEventListener('pointerdown', fora);
        return () => {
            document.removeEventListener('pointerdown', fora);
        };
    }, [aberto]);

    useEffect(() => {
        if (desativado) definirAberto(false);
    }, [desativado]);

    async function escolher(escolha: string) {
        if (salvando || desativado) return;
        definirSalvando(true);
        try {
            await alterar(escolha);
            definirAberto(false);
            if (!abertoPorToque.current) gatilho.current?.focus({ preventScroll: true });
        } finally {
            definirSalvando(false);
        }
    }

    return (
        <div
            data-ui="controle-entrada"
            className={[
                'min-w-0 border-l border-solid border-l-[#2b2d31] pl-[10px]',
                '[@media(width<=760px)]:[order:1] [@media(width<=760px)]:border-l-0',
                '[@media(width<=760px)]:[border-left-style:solid]',
                '[@media(width<=760px)]:border-l-[currentColor] [@media(width<=760px)]:p-0',
            ].join(' ')}
            ref={raiz}
            onBlur={(evento) => {
                if (evento.relatedTarget && !evento.currentTarget.contains(evento.relatedTarget)) {
                    definirAberto(false);
                }
            }}
        >
            <button
                type="button"
                data-ui="gatilho-opcoes-entrada"
                className={[
                    'flex items-center gap-[7px] shrink-0 bg-transparent text-secundario text-[12px] px-0',
                    'py-[7px] border-0 border-solid border-current [&:hover]:text-principal',
                ].join(' ')}
                ref={gatilho}
                aria-label={rotulo}
                aria-haspopup="menu"
                aria-expanded={aberto}
                aria-controls={id}
                disabled={desativado || salvando}
                onPointerDown={(evento) => {
                    abertoPorToque.current = evento.pointerType === 'touch';
                }}
                onClick={(evento) => {
                    if (evento.detail === 0) abertoPorToque.current = false;
                    definirAberto(!aberto);
                }}
            >
                {icone}
                <span>{nome}</span>
                <CaretDownIcon size={12} />
            </button>
            {aberto && (
                <div
                    data-ui="menu-opcoes-entrada"
                    className={[
                        'fixed z-[30] w-[min(290px,_calc(100vw_-_16px))] bg-superficie rounded-[12px]',
                        'shadow-[0_12px_36px_#0006] p-[5px] border border-solid border-[#30333a] [&_button]:flex',
                        '[&_button]:items-center [&_button]:justify-between [&_button]:gap-[12px] [&_button]:w-full',
                        '[&_button]:rounded-[7px] [&_button]:bg-transparent [&_button]:text-[#d1d5dd]',
                        '[&_button]:text-left [&_button]:text-[12px] [&_button]:p-[10px] [&_button]:border-0',
                        '[&_button]:border-solid [&_button]:border-current [&_button:hover]:bg-borda',
                        '[&_button:focus-visible]:bg-borda [&_button_>_svg]:shrink-0',
                        '[&_button_>_svg]:text-[#b5a2dc] [&_small]:block [&_small]:mt-[5px] [&_small]:text-secundario',
                        '[&_small]:text-[11px] [&_small]:leading-[1.5]',
                    ].join(' ')}
                    ref={menu}
                    role="menu"
                    aria-label={rotulo}
                    id={id}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Escape') {
                            evento.preventDefault();
                            definirAberto(false);
                            gatilho.current?.focus();
                            return;
                        }
                        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;
                        evento.preventDefault();
                        const itens = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                        const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
                        const proximo =
                            evento.key === 'Home'
                                ? 0
                                : evento.key === 'End'
                                  ? itens.length - 1
                                  : (atual + (evento.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
                        itens[proximo]?.focus();
                    }}
                >
                    {opcoes.map((opcao) => (
                        <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={valor === opcao.valor}
                            key={opcao.valor}
                            disabled={salvando}
                            onClick={() => void escolher(opcao.valor)}
                        >
                            <span>
                                <span>{opcao.nome}</span>
                                {opcao.descricao && <small>{opcao.descricao}</small>}
                            </span>
                            {valor === opcao.valor && <CheckIcon size={16} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
