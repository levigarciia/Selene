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

    useLayoutEffect(() => {
        if (!aberto || !menu.current || !gatilho.current) return;
        const origem = gatilho.current.getBoundingClientRect();
        const limites = menu.current.getBoundingClientRect();
        menu.current.style.left = `${Math.max(8, Math.min(origem.left, window.innerWidth - limites.width - 8))}px`;
        menu.current.style.bottom = `${window.innerHeight - origem.top + 10}px`;
        menu.current.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    }, [aberto]);

    useEffect(() => {
        if (!aberto) return;
        const fora = (evento: MouseEvent) => {
            if (!raiz.current?.contains(evento.target as Node)) definirAberto(false);
        };
        const fechar = () => definirAberto(false);
        document.addEventListener('mousedown', fora);
        window.addEventListener('resize', fechar);
        return () => {
            document.removeEventListener('mousedown', fora);
            window.removeEventListener('resize', fechar);
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
            gatilho.current?.focus();
        } finally {
            definirSalvando(false);
        }
    }

    return (
        <div
            className="controle-entrada"
            ref={raiz}
            onBlur={(evento) => {
                if (!evento.currentTarget.contains(evento.relatedTarget)) definirAberto(false);
            }}
        >
            <button
                type="button"
                className="gatilho-opcoes-entrada"
                ref={gatilho}
                aria-label={rotulo}
                aria-haspopup="menu"
                aria-expanded={aberto}
                aria-controls={id}
                disabled={desativado || salvando}
                onClick={() => definirAberto(!aberto)}
            >
                {icone}
                <span>{nome}</span>
                <CaretDownIcon size={12} />
            </button>
            {aberto && (
                <div
                    className="menu-opcoes-entrada"
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
