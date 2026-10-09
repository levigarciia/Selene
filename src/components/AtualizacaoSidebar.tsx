import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowClockwiseIcon, CheckIcon, DownloadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { descreverAtualizacao, type EstadoAtualizacao } from '../../shared/atualizacoes';
import '../styles/atualizacoes.css';

/** Mostra o estado e as notas das releases ao passar o mouse ou navegar pelo teclado na sidebar. */
export function AtualizacaoSidebar({
    estado,
    verificar,
    abrirRelease,
}: {
    estado?: EstadoAtualizacao;
    verificar: () => void;
    abrirRelease: (versao?: string) => void;
}) {
    const [aberto, definirAberto] = useState(false);
    const gatilho = useRef<HTMLButtonElement>(null);
    const painel = useRef<HTMLDivElement>(null);
    const fechamento = useRef<ReturnType<typeof setTimeout>>(undefined);
    const id = useId();
    const ocupado = !estado || ['desativada', 'verificando', 'baixando', 'pronta'].includes(estado.fase);
    const notas = estado?.notas ?? [];
    const emAndamento = estado?.fase === 'verificando' || estado?.fase === 'baixando';
    const Icone =
        estado?.fase === 'pronta'
            ? CheckIcon
            : estado?.fase === 'baixando'
              ? DownloadSimpleIcon
              : estado?.fase === 'erro'
                ? WarningCircleIcon
                : ArrowClockwiseIcon;

    function abrir() {
        clearTimeout(fechamento.current);
        definirAberto(true);
    }

    function agendarFechamento() {
        clearTimeout(fechamento.current);
        fechamento.current = setTimeout(() => {
            if (!painel.current?.contains(document.activeElement) && document.activeElement !== gatilho.current) {
                definirAberto(false);
            }
        }, 180);
    }

    useLayoutEffect(() => {
        if (!aberto || !painel.current || !gatilho.current) return;
        const origem = gatilho.current.getBoundingClientRect();
        const altura = painel.current.getBoundingClientRect().height;
        const acima = origem.top >= altura + 16;
        painel.current.style.left = `${Math.max(
            8,
            Math.min(origem.left, window.innerWidth - painel.current.getBoundingClientRect().width - 8),
        )}px`;
        painel.current.style.top = `${
            acima ? origem.top - altura - 8 : Math.min(origem.bottom + 8, window.innerHeight - altura - 8)
        }px`;
    }, [aberto, estado]);

    useEffect(() => {
        if (!aberto) return;
        const fecharFora = (evento: MouseEvent) => {
            if (!painel.current?.contains(evento.target as Node) && !gatilho.current?.contains(evento.target as Node)) {
                definirAberto(false);
            }
        };
        const fechar = () => definirAberto(false);
        document.addEventListener('mousedown', fecharFora);
        window.addEventListener('resize', fechar);
        return () => {
            document.removeEventListener('mousedown', fecharFora);
            window.removeEventListener('resize', fechar);
        };
    }, [aberto]);

    useEffect(() => () => clearTimeout(fechamento.current), []);

    return (
        <>
            <div className="botao-atualizar-sidebar" onMouseEnter={abrir} onMouseLeave={agendarFechamento}>
                <button
                    ref={gatilho}
                    className={`botao-icone indicador-atualizacao ${estado?.fase === 'pronta' ? 'atualizacao-pronta' : ''}`}
                    aria-label="Procurar atualizações"
                    aria-haspopup="dialog"
                    aria-expanded={aberto}
                    aria-controls={aberto ? id : undefined}
                    aria-disabled={ocupado}
                    onFocus={abrir}
                    onBlur={agendarFechamento}
                    onClick={() => {
                        abrir();
                        if (!ocupado) verificar();
                    }}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Escape') definirAberto(false);
                        if (evento.key === 'Tab' && !evento.shiftKey && aberto) {
                            evento.preventDefault();
                            painel.current?.querySelector<HTMLButtonElement>('button')?.focus();
                        }
                    }}
                >
                    <Icone size={19} className={estado?.fase === 'verificando' ? 'girando' : ''} />
                    {estado?.fase === 'baixando' && <span className="ponto-atualizacao" />}
                </button>
            </div>
            {aberto &&
                createPortal(
                    <div
                        id={id}
                        ref={painel}
                        role="dialog"
                        aria-label="Detalhes da atualização"
                        className="painel-atualizacao"
                        onMouseEnter={abrir}
                        onMouseLeave={agendarFechamento}
                        onFocus={abrir}
                        onBlur={agendarFechamento}
                        onKeyDown={(evento) => {
                            const botoes = [...(painel.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
                            if (evento.key === 'Tab' && evento.shiftKey && document.activeElement === botoes[0]) {
                                evento.preventDefault();
                                gatilho.current?.focus();
                            }
                            if (evento.key === 'Tab' && !evento.shiftKey && document.activeElement === botoes.at(-1)) {
                                const controles = [
                                    ...document.querySelectorAll<HTMLElement>(
                                        'button, a[href], input, textarea, select, [tabindex="0"]',
                                    ),
                                ].filter(
                                    (elemento) =>
                                        elemento.getClientRects().length &&
                                        !painel.current?.contains(elemento) &&
                                        !elemento.matches(':disabled'),
                                );
                                const proximo = controles[controles.indexOf(gatilho.current!) + 1];
                                if (proximo) {
                                    evento.preventDefault();
                                    proximo.focus();
                                    definirAberto(false);
                                }
                            }
                            if (evento.key === 'Escape') {
                                evento.stopPropagation();
                                gatilho.current?.focus();
                                definirAberto(false);
                            }
                        }}
                    >
                        <header>
                            <strong>
                                {estado ? descreverAtualizacao(estado) : 'Abra o aplicativo para buscar atualizações.'}
                            </strong>
                            {estado && <span className="texto-secundario">Versão instalada: {estado.versaoAtual}</span>}
                            {emAndamento && estado?.progresso !== undefined && (
                                <progress aria-label="Download da atualização" value={estado.progresso} max={100} />
                            )}
                        </header>
                        {notas.length > 0 && (
                            <div className="notas-atualizacao">
                                {notas.map((nota, indice) => (
                                    <section key={nota.versao}>
                                        <h3>
                                            {indice === 0
                                                ? `Novidades da versão ${nota.versao}`
                                                : `Versão ${nota.versao}`}
                                        </h3>
                                        <ul>
                                            {nota.itens.map((item, numero) => (
                                                <li key={numero}>{item}</li>
                                            ))}
                                        </ul>
                                        <button className="link-release" onClick={() => abrirRelease(nota.versao)}>
                                            {nota.total > nota.itens.length
                                                ? `Ver mais ${nota.total - nota.itens.length} alterações no GitHub`
                                                : 'Ver release no GitHub'}
                                        </button>
                                    </section>
                                ))}
                            </div>
                        )}
                        {notas.length === 0 && estado?.versaoNova && (
                            <p className="texto-secundario">Notas desta versão não foram fornecidas.</p>
                        )}
                        {(notas.length === 0 || !!estado?.releasesOmitidas) && (
                            <button
                                className="link-release"
                                onClick={() => abrirRelease(estado?.releasesOmitidas ? undefined : estado?.versaoNova)}
                            >
                                {estado?.releasesOmitidas
                                    ? 'Ver versões anteriores no GitHub'
                                    : 'Ver releases no GitHub'}
                            </button>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
}
