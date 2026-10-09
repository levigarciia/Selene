import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowClockwiseIcon, CheckIcon, DownloadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { descreverAtualizacao, type EstadoAtualizacao } from '../../shared/atualizacoes';

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
            <div
                data-ui="botao-atualizar-sidebar"
                className="ml-auto [[data-ui~=sidebar-recolhida]_&]:ml-0"
                onMouseEnter={abrir}
                onMouseLeave={agendarFechamento}
            >
                <button
                    ref={gatilho}
                    data-ui={[
                        'botao-icone indicador-atualizacao',
                        estado?.fase === 'pronta' ? 'atualizacao-pronta' : '',
                    ].join(' ')}
                    className={[
                        [
                            '[[data-ui~=marca]_&]:ml-auto [[data-ui~=sidebar-recolhida]_[data-ui~=marca]_&]:m-0',
                            [
                                'inline-flex items-center justify-center bg-transparent text-[#a1a5ad]',
                                'rounded-[6px] relative',
                            ].join(' '),
                            'p-[8px] border-0 border-solid border-current',
                            '[&:hover:not(:disabled)]:text-[#e6e7e9] [&:hover:not(:disabled)]:bg-[#24262c]',
                            '[[data-ui~=rodape-entrada]_&]:p-[0]',
                            "[[data-ui~=rodape-sidebar]_&[aria-current='page']]:text-[#94b7a5]",
                            '[@media(width<=760px)]:[[data-ui~=sidebar]_[data-ui~=marca]_&]:hidden',
                        ].join(' '),
                        estado?.fase === 'pronta' ? '[&&]:text-[#94b7a5]' : '',
                    ].join(' ')}
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
                    <Icone
                        size={19}
                        data-ui={estado?.fase === 'verificando' ? 'girando' : ''}
                        className={
                            estado?.fase === 'verificando'
                                ? ['[&&]:animate-[spin_1.2s_linear_infinite]', 'motion-reduce:[&&]:animate-none'].join(
                                      ' ',
                                  )
                                : ''
                        }
                    />
                    {estado?.fase === 'baixando' && (
                        <span
                            data-ui="ponto-atualizacao"
                            className="absolute top-[5px] right-[5px] w-[5px] h-[5px] rounded-full bg-[#94b7a5]"
                        />
                    )}
                </button>
            </div>
            {aberto &&
                createPortal(
                    <div
                        id={id}
                        ref={painel}
                        role="dialog"
                        aria-label="Detalhes da atualização"
                        data-ui="painel-atualizacao"
                        className={[
                            'fixed z-[100] flex flex-col gap-[12px] w-[min(360px,_calc(100vw_-_16px))]',
                            'max-h-[min(440px,_calc(100vh_-_80px))] rounded-[12px] text-[#e4e6e9] bg-[#17191def]',
                            'shadow-[0_12px_40px_#0007] [backdrop-filter:blur(16px)] text-[12px] leading-[1.6]',
                            'wrap-anywhere p-[16px] border border-solid border-[#34373d] [&_header]:flex',
                            '[&_header]:flex-col [&_header]:gap-[5px] [&_progress]:w-full [&_progress]:h-[4px]',
                            '[&_progress]:accent-[#94b7a5]',
                        ].join(' ')}
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
                            {estado && (
                                <span
                                    data-ui="texto-secundario"
                                    className={[
                                        'text-[#a1a5ad] text-[12px] leading-[1.7]',
                                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                        '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                        '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                                        '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                        '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                                    ].join(' ')}
                                >
                                    Versão instalada: {estado.versaoAtual}
                                </span>
                            )}
                            {emAndamento && estado?.progresso !== undefined && (
                                <progress
                                    className="accent-[#94b7a5]"
                                    aria-label="Download da atualização"
                                    value={estado.progresso}
                                    max={100}
                                />
                            )}
                        </header>
                        {notas.length > 0 && (
                            <div
                                data-ui="notas-atualizacao"
                                className={[
                                    [
                                        'min-h-0 overflow-y-auto [overscroll-behavior:contain]',
                                        '[&_section_+_section]:mt-[12px]',
                                    ].join(' '),
                                    '[&_section_+_section]:pt-[12px] [&_section_+_section]:border-t',
                                    '[&_section_+_section]:border-solid [&_section_+_section]:border-t-[#303339]',
                                    '[&_h3]:mb-[7px] [&_h3]:text-[12px] [&_h3]:font-semibold [&_ul]:pl-[17px]',
                                    '[&_ul]:list-disc [&_li_+_li]:mt-[5px]',
                                ].join(' ')}
                            >
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
                                        <button
                                            data-ui="link-release"
                                            className={[
                                                [
                                                    'self-start mt-[8px] text-[#a5abb5]',
                                                    '[text-decoration:underline_dotted]',
                                                    'underline-offset-[3px]',
                                                ].join(' '),
                                                '[&:hover]:text-[#e4e6e9] [&:focus-visible]:text-[#e4e6e9]',
                                            ].join(' ')}
                                            onClick={() => abrirRelease(nota.versao)}
                                        >
                                            {nota.total > nota.itens.length
                                                ? `Ver mais ${nota.total - nota.itens.length} alterações no GitHub`
                                                : 'Ver release no GitHub'}
                                        </button>
                                    </section>
                                ))}
                            </div>
                        )}
                        {notas.length === 0 && estado?.versaoNova && (
                            <p
                                data-ui="texto-secundario"
                                className={[
                                    'text-[#a1a5ad] text-[12px] leading-[1.7]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[#a1a5ad]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:text-[12px]',
                                    '[[data-ui~=usuario-direita]_[data-ui~=conteudo]_&]:leading-[1.7]',
                                    '[[data-ui~=usuario-direita]_&]:text-[#a1a5ad]',
                                    '[[data-ui~=usuario-direita]_&]:text-[12px]',
                                    '[[data-ui~=usuario-direita]_&]:leading-[1.7]',
                                ].join(' ')}
                            >
                                Notas desta versão não foram fornecidas.
                            </p>
                        )}
                        {(notas.length === 0 || !!estado?.releasesOmitidas) && (
                            <button
                                data-ui="link-release"
                                className={[
                                    [
                                        'self-start mt-[8px] text-[#a5abb5]',
                                        '[text-decoration:underline_dotted] underline-offset-[3px]',
                                    ].join(' '),
                                    '[&:hover]:text-[#e4e6e9] [&:focus-visible]:text-[#e4e6e9]',
                                ].join(' ')}
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
