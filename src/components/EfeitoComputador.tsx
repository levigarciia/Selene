/** Exibe a sinalização nativa em janelas transparentes que não recebem foco nem eventos de entrada. */
export function EfeitoComputador({ tipo }: { tipo: string }) {
    if (tipo === 'cursor')
        return (
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                    <filter id="brilho">
                        <feGaussianBlur stdDeviation="4" />
                    </filter>
                </defs>
                <path
                    d="M10 8 L10 39 L18 31 L25 44 L31 41 L24 28 L37 28 Z"
                    fill="#a78bfa"
                    opacity="0.8"
                    filter="url(#brilho)"
                />
                <path
                    d="M10 8 L10 39 L18 31 L25 44 L31 41 L24 28 L37 28 Z"
                    fill="#c4b5fd"
                    stroke="#faf5ff"
                    strokeWidth="1.5"
                />
            </svg>
        );
    return (
        <div
            className="pointer-events-none fixed inset-0 overflow-hidden rounded-[12px]
        border-[3px] border-violet-400/80 shadow-[inset_0_0_28px_8px_#8b5cf680]
        motion-safe:animate-pulse"
            aria-hidden="true"
        >
            <span
                className="absolute left-1/2 top-[10px] -translate-x-1/2 rounded-full bg-violet-950/90
            px-[14px] py-[5px] text-[12px] text-violet-100"
            >
                Selene está usando o computador
            </span>
        </div>
    );
}
