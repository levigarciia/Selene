import React from 'react'
import { Copy, Minus, X } from 'lucide-react'
import seleneLogo from '/tray-icon.png'

interface BarraSuperiorChatProps {
    janelaMaximizada?: boolean
    onMinimizarJanela: () => void
    onAlternarMaximizacaoJanela: () => void
    onFecharJanela: () => void
}

export const BarraSuperiorChat: React.FC<BarraSuperiorChatProps> = ({
    janelaMaximizada = false,
    onMinimizarJanela,
    onAlternarMaximizacaoJanela,
    onFecharJanela,
}) => {
    return (
        <header
            className="flex h-[58px] items-center justify-between border-b border-white/[0.06] bg-[#090a0c] pl-6 pr-2 text-[#f2f3f7]"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center gap-2.5 text-[14px] font-semibold tracking-[0.01em] text-[#e4e8f0]">
                <img src={seleneLogo} alt="Selene" className="h-[15px] w-[15px] object-contain opacity-90" />
                <span>Selene</span>
            </div>

            <div
                className="flex items-center"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.05] bg-[#101216]">
                    <button
                        type="button"
                        onClick={onMinimizarJanela}
                        className="flex h-9 w-10 items-center justify-center text-[#8f97a5] transition-colors hover:bg-white/[0.06] hover:text-[#eef2f8]"
                        aria-label="Minimizar janela"
                        title="Minimizar"
                    >
                        <Minus size={15} />
                    </button>

                    <button
                        type="button"
                        onClick={onAlternarMaximizacaoJanela}
                        className="flex h-9 w-10 items-center justify-center border-l border-white/[0.06] text-[#8f97a5] transition-colors hover:bg-white/[0.06] hover:text-[#eef2f8]"
                        aria-label={janelaMaximizada ? 'Restaurar janela' : 'Maximizar janela'}
                        title={janelaMaximizada ? 'Restaurar' : 'Maximizar'}
                    >
                        {janelaMaximizada ? (
                            <Copy size={13} />
                        ) : (
                            <div className="h-3.5 w-3.5 rounded-[3px] border border-current" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onFecharJanela}
                        className="flex h-9 w-10 items-center justify-center border-l border-white/[0.06] text-[#9da4b0] transition-colors hover:bg-[#b42318] hover:text-white"
                        aria-label="Fechar janela"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>
        </header>
    )
}
