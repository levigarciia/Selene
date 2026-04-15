import React from 'react'
import { PanelLeft, SquarePen } from 'lucide-react'

interface RailChatProps {
    onAlternarSidebar: () => void
    onNovaConversa: () => void
    sidebarExpandida?: boolean
    mostrarNovaConversa?: boolean
}

const classeBotao =
    'flex h-9 w-9 items-center justify-center rounded-lg text-[#7f8794] transition-colors hover:bg-white/[0.03] hover:text-[#d8dde7]'

export const RailChat: React.FC<RailChatProps> = ({
    onAlternarSidebar,
    onNovaConversa,
    sidebarExpandida = false,
    mostrarNovaConversa = true,
}) => {
    return (
        <aside className="flex w-[60px] shrink-0 bg-[#090a0c]">
            <div className="flex w-full flex-col items-center gap-4 pt-6">
                <button
                    type="button"
                    onClick={onAlternarSidebar}
                    className={`${classeBotao} ${sidebarExpandida ? 'bg-white/[0.04] text-[#e3e7ef]' : ''}`}
                    aria-label="Alternar navegação"
                >
                    <PanelLeft size={18} strokeWidth={1.7} />
                </button>

                {mostrarNovaConversa && (
                    <button
                        type="button"
                        onClick={onNovaConversa}
                        className={classeBotao}
                        aria-label="Nova conversa"
                    >
                        <SquarePen size={17} strokeWidth={1.7} />
                    </button>
                )}
            </div>
        </aside>
    )
}
