import { useEffect, type ReactNode } from 'react';

/** Campo no tamanho "sm" das configurações do T3 Code. */
export const campo = [
    'h-8 rounded-lg border border-borda bg-fundo px-2.5 text-[13px] text-principal outline-none',
    'placeholder:text-discreto focus:border-white/20 disabled:opacity-50',
].join(' ');

export const botaoSecundario = [
    'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-borda',
    'bg-white/[0.03] px-3 text-[13px] text-principal hover:bg-white/[0.07] disabled:opacity-40',
].join(' ');

export const botaoPequeno = [
    'inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs',
    'text-secundario hover:bg-white/[0.06] hover:text-principal disabled:opacity-40',
].join(' ');

/** Superfície de cartão compartilhada, com divisórias entre as linhas. */
export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={[
                'relative rounded-xl border border-white/[0.07] bg-white/[0.015] text-principal',
                '[&>*+*]:border-t [&>*+*]:border-white/[0.06]',
                className,
            ].join(' ')}
        >
            {children}
        </div>
    );
}

/** Seção com título discreto e sem descrição; a explicação fica em cada linha. */
export function Secao({
    id,
    titulo,
    acaoTitulo,
    acao,
    children,
}: {
    id?: string;
    titulo: string;
    acaoTitulo?: ReactNode;
    acao?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section id={id} tabIndex={id ? -1 : undefined} className="flex flex-col gap-2.5 outline-none">
            <div className="flex min-h-7 items-center justify-between gap-4 px-4 max-sm:px-3">
                <div className="flex min-w-0 items-center gap-1">
                    <h2 className="text-sm font-normal text-principal/70">{titulo}</h2>
                    {acaoTitulo}
                </div>
                <div className="flex min-h-7 items-center justify-end">{acao}</div>
            </div>
            <Cartao>{children}</Cartao>
        </section>
    );
}

/** Uma configuração: título e descrição à esquerda, controle à direita; `children` ocupa a largura toda abaixo. */
export function Linha({
    id,
    titulo,
    descricao,
    estado,
    controle,
    children,
}: {
    id?: string;
    titulo: ReactNode;
    descricao?: ReactNode;
    estado?: ReactNode;
    controle?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div
            id={id}
            tabIndex={id ? -1 : undefined}
            data-ui="linha-config"
            className={`px-4 outline-none max-sm:px-3 ${children ? 'pt-3 pb-3' : 'py-3'}`}
        >
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
                <div className="min-w-0 flex flex-col gap-1">
                    <h3 className="flex min-h-5 items-center gap-1.5 text-sm font-medium text-principal">{titulo}</h3>
                    {descricao && <p className="max-w-xl text-xs leading-normal text-discreto">{descricao}</p>}
                    {estado && <div className="pt-0.5 text-xs text-secundario">{estado}</div>}
                </div>
                {controle && <div className="flex min-w-0 shrink-0 items-center gap-2 sm:justify-end">{controle}</div>}
            </div>
            {children && <div className="pt-3">{children}</div>}
        </div>
    );
}

/** Interruptor no formato do T3 Code. */
export function Alternar({
    rotulo,
    marcado,
    desativado,
    alterar,
}: {
    rotulo: string;
    marcado: boolean;
    desativado?: boolean;
    alterar: (marcado: boolean) => void;
}) {
    return (
        <input
            type="checkbox"
            role="switch"
            aria-label={rotulo}
            checked={marcado}
            disabled={desativado}
            onChange={(evento) => alterar(evento.target.checked)}
            className={[
                'relative h-[18px] w-8 shrink-0 cursor-pointer appearance-none rounded-full bg-white/15 transition-colors',
                'checked:bg-[#3b6cf6] disabled:cursor-default disabled:opacity-40',
                "after:absolute after:left-[3px] after:top-[3px] after:size-3 after:rounded-full after:bg-white after:content-['']",
                'after:transition-transform checked:after:translate-x-[14px]',
            ].join(' ')}
        />
    );
}

/** Indicador de estado usado em provedores e no motor. */
export function Ponto({ tom }: { tom: 'ok' | 'neutro' | 'erro' }) {
    return (
        <span
            className={`size-1.5 shrink-0 rounded-full ${
                tom === 'ok' ? 'bg-sucesso' : tom === 'erro' ? 'bg-[#eab1aa]' : 'bg-discreto'
            }`}
        />
    );
}

/** Rola até o alvo de uma busca e destaca a linha brevemente. */
export function useAlvoBusca(alvo: string | null, concluir: () => void) {
    useEffect(() => {
        if (!alvo) return;
        const id = alvo;
        let quadro = requestAnimationFrame(() => (quadro = requestAnimationFrame(rolar)));
        function rolar() {
            const elemento = document.getElementById(id);
            if (!elemento) return;
            elemento.scrollIntoView({ block: 'center', behavior: 'smooth' });
            elemento.focus({ preventScroll: true });
            elemento.animate([{ backgroundColor: 'rgb(181 162 220 / 14%)' }, { backgroundColor: 'transparent' }], {
                duration: 1400,
                easing: 'ease-out',
            });
            concluir();
        }
        return () => cancelAnimationFrame(quadro);
    }, [alvo]);
}
