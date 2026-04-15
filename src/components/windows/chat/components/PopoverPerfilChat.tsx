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

interface ItemMenuPerfilProps {
    titulo: string
    descricao: string
    icone: React.ElementType
    onClick: () => void
}

const ItemMenuPerfil: React.FC<ItemMenuPerfilProps> = ({
    titulo,
    descricao,
    icone: Icone,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
    >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-[#dce2ec] transition-colors group-hover:border-white/[0.1] group-hover:bg-white/[0.05]">
            <Icone size={17} />
        </span>

        <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-white">{titulo}</span>
            <span className="mt-0.5 block text-[11px] leading-5 text-[#7b8391]">{descricao}</span>
        </span>

        <ChevronRight size={15} className="shrink-0 text-[#66707f] transition-transform group-hover:translate-x-0.5 group-hover:text-[#cfd5df]" />
    </button>
)

export const PopoverPerfilChat: React.FC<PopoverPerfilChatProps> = ({
    aberto,
    onClose,
    onAbrirPerfil,
    onAbrirPersonalizacao,
    onAbrirConfiguracao,
    className = 'bottom-full left-0 mb-3 w-[304px]',
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
            if (event.key === 'Escape') {
                onClose()
            }
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className={`absolute z-30 rounded-[26px] border border-white/[0.07] bg-[#111318] p-2.5 shadow-[0_22px_80px_rgba(0,0,0,0.48)] ${className}`}
                >
                    <div className="space-y-1">
                        <ItemMenuPerfil
                            titulo="Perfil"
                            descricao="Defina nome, foto, ocupação e mais sobre você."
                            icone={UserRound}
                            onClick={onAbrirPerfil}
                        />
                        <ItemMenuPerfil
                            titulo="Personalização"
                            descricao="Gerencie assistentes e memórias no mesmo fluxo."
                            icone={Sparkles}
                            onClick={onAbrirPersonalizacao}
                        />
                        <ItemMenuPerfil
                            titulo="Configuração"
                            descricao="Chaves API, latência, transcrição e opções avançadas."
                            icone={Settings2}
                            onClick={onAbrirConfiguracao}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
