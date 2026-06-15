import { useRef, useEffect } from 'react'

type RegiaoModal = { x: number; y: number; width: number; height: number }

export function useWindowManagement(dependencias: ReadonlyArray<unknown>) {
    const modalRef = useRef<HTMLDivElement | null>(null)
    const overlayProativoRef = useRef<HTMLDivElement | null>(null)
    const toolbarRef = useRef<HTMLDivElement | null>(null)
    const configuracoesRef = useRef<HTMLDivElement | null>(null)
    const gramaticalRef = useRef<HTMLDivElement | null>(null)
    const menuDropdownRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        let rafId: number | null = null
        const resizeObservers: ResizeObserver[] = []
        const mutationObservers: MutationObserver[] = []

        const enviarRegioes = () => {
            if (!window.electronAPI?.updateModalRegions) return

            const regioes: RegiaoModal[] = []
            const adicionar = (el: HTMLElement | null) => {
                if (!el) return
                const rect = el.getBoundingClientRect()
                regioes.push({
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                })
            }

            adicionar(modalRef.current)
            adicionar(overlayProativoRef.current)
            adicionar(toolbarRef.current)
            adicionar(configuracoesRef.current)
            adicionar(gramaticalRef.current)
            adicionar(menuDropdownRef.current)

            window.electronAPI.updateModalRegions(regioes)
        }

        const agendarEnvio = () => {
            if (rafId !== null) return
            rafId = window.requestAnimationFrame(() => {
                rafId = null
                enviarRegioes()
            })
        }

        const registrarObservadores = (el: HTMLElement | null) => {
            if (!el) return
            const resizeObserver = new ResizeObserver(() => agendarEnvio())
            resizeObserver.observe(el)
            resizeObservers.push(resizeObserver)

            const mutationObserver = new MutationObserver(() => agendarEnvio())
            mutationObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class'] })
            mutationObservers.push(mutationObserver)
        }

        registrarObservadores(modalRef.current)
        registrarObservadores(overlayProativoRef.current)
        registrarObservadores(toolbarRef.current)
        registrarObservadores(configuracoesRef.current)
        registrarObservadores(gramaticalRef.current)
        registrarObservadores(menuDropdownRef.current)

        window.addEventListener('resize', agendarEnvio)
        window.addEventListener('pointermove', agendarEnvio)

        agendarEnvio()
        const timeoutId = window.setTimeout(agendarEnvio, 120)
        const intervalId = window.setInterval(agendarEnvio, 500)

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId)
            }
            window.clearTimeout(timeoutId)
            window.clearInterval(intervalId)
            window.removeEventListener('resize', agendarEnvio)
            window.removeEventListener('pointermove', agendarEnvio)
            resizeObservers.forEach((obs) => obs.disconnect())
            mutationObservers.forEach((obs) => obs.disconnect())
            window.electronAPI?.updateModalRegions([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencias)

    return {
        modalRef,
        overlayProativoRef,
        toolbarRef,
        configuracoesRef,
        gramaticalRef,
        menuDropdownRef
    }
}
