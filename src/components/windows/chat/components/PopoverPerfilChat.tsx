import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Settings2, Sparkles, UserRound } from 'lucide-react'

interface PopoverPerfilChatProps {
    aberto: boolean
    onClose: () => void
    onAbrirPerfil: () => void
    onAbrirPersonalizacao: () => void
    onAbrirConfiguracao: () => void
    className?: string
    areaAncoraRef?: React.RefObject<HTMLElement | null>
}

interface ItemMenuProps {
    titulo: string
    icone: React.ElementType
    onClick: () => void
    /** Exibe chevron indicando submenu */
    temSubmenu?: boolean
}

const ItemMenu: React.FC<ItemMenuProps> = ({ titulo, icone: Icone, onClick, temSubmenu }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-[#c9d0da] transition-colors hover:bg-white/[0.07] hover:text-white"
    >
        <Icone size={15} className="shrink-0 text-[#7b8391] transition-colors group-hover:text-[#c9d0da]" />
        <span className="flex-1">{titulo}</span>
        {temSubmenu && (
            <ChevronRight size={14} className="shrink-0 text-[#4a525e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#7b8391]" />
        )}
    </button>
)

export const PopoverPerfilChat: React.FC<PopoverPerfilChatProps> = ({
    aberto,
    onClose,
    onAbrirPerfil,
    onAbrirPersonalizacao,
    onAbrirConfiguracao,
    className = 'bottom-full left-0 mb-3 w-[220px]',
    areaAncoraRef,
}) => {
    const popoverRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!aberto) return

        const handlePointerDown = (event: MouseEvent) => {
            const alvo = event.target as Node
            if (popoverRef.current?.contains(alvo)) return
            if (areaAncoraRef?.current?.contains(alvo)) return
            onClose()
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [aberto, areaAncoraRef, onClose])

    return (
        <AnimatePresence>
            {aberto && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute z-30 rounded-xl border border-white/[0.07] bg-[#111318] p-1.5 shadow-[0_16px_60px_rgba(0,0,0,0.5)] ${className}`}
                >
                    <ItemMenu titulo="Personalização" icone={Sparkles} onClick={onAbrirPersonalizacao} />
                    <ItemMenu titulo="Perfil" icone={UserRound} onClick={onAbrirPerfil} />
                    <ItemMenu titulo="Configurações" icone={Settings2} onClick={onAbrirConfiguracao} />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
