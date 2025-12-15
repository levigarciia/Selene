import { useState, useRef, useEffect } from 'react'

const ATALHO_PADRAO = 'Control+Alt+X'
const ATALHO_SCREENSHOT_PADRAO = 'Control+Alt+S'

export function useShortcuts(
    onTriggerGrammar: (textoSelecionadoGlobal?: string) => void,
    onTriggerScreenshot: () => void,
    exibirToast: (mensagem: string) => void
) {
    const [atalhoGramatical, setAtalhoGramatical] = useState(() => localStorage.getItem('selene_atalho_gramatical') || ATALHO_PADRAO)
    const [atalhoScreenshot, setAtalhoScreenshot] = useState(
        () => localStorage.getItem('selene_atalho_screenshot') || ATALHO_SCREENSHOT_PADRAO
    )

    const ultimoAtalhoGlobalRef = useRef<number>(0)
    const ignorarAtalhoTecladoRef = useRef(false)

    // Persistência e Registro Electron
    useEffect(() => {
        localStorage.setItem('selene_atalho_gramatical', atalhoGramatical)
        window.electronAPI?.registrarAtalhoGramatical?.(atalhoGramatical)
    }, [atalhoGramatical])

    useEffect(() => {
        localStorage.setItem('selene_atalho_screenshot', atalhoScreenshot)
        window.electronAPI?.registrarAtalhoScreenshot?.(atalhoScreenshot)
    }, [atalhoScreenshot])

    // Listeners
    useEffect(() => {
        const removerAtalho = window.electronAPI?.onAtalhoGramatical?.((textoSelecionadoGlobal?: string) => {
            ultimoAtalhoGlobalRef.current = Date.now()
            ignorarAtalhoTecladoRef.current = true
            window.setTimeout(() => {
                ignorarAtalhoTecladoRef.current = false
            }, 1400)
            onTriggerGrammar(textoSelecionadoGlobal)
        })

        const removerAtalhoScreenshot = window.electronAPI?.onAtalhoScreenshot?.(() => {
            console.log('[screenshot] onAtalhoScreenshot recebido')
            exibirToast('Atalho de screenshot recebido')
            onTriggerScreenshot()
        })

        return () => {
            removerAtalho?.()
            removerAtalhoScreenshot?.()
        }
    }, [onTriggerGrammar, onTriggerScreenshot, exibirToast])

    return {
        atalhoGramatical, setAtalhoGramatical,
        atalhoScreenshot, setAtalhoScreenshot
    }
}
