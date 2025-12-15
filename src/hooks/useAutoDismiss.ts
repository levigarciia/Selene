import { useEffect, useRef, useCallback } from 'react'

export function useAutoDismiss(
    isActive: boolean,
    timeoutMs: number,
    onDismiss: () => void
) {
    const timerRef = useRef<number | null>(null)

    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current)
        }
        if (isActive) {
            timerRef.current = window.setTimeout(() => {
                onDismiss()
            }, timeoutMs)
        }
    }, [isActive, timeoutMs, onDismiss])

    useEffect(() => {
        if (!isActive) {
            if (timerRef.current) window.clearTimeout(timerRef.current)
            return
        }

        resetTimer()

        const handleActivity = () => resetTimer()

        // Listen to global events to detect activity? 
        // Ideally we only care about activity ON the modal or related UI, 
        // but the user said "if I don't interact with IT". 
        // Since the modal is floating, we attach listeners to the window 
        // but we might want to be more specific if "it" means just the app.
        // However, usually "interaction" means any mouse move or click in the app context.

        window.addEventListener('pointermove', handleActivity)
        window.addEventListener('click', handleActivity)
        window.addEventListener('keydown', handleActivity)
        window.addEventListener('scroll', handleActivity, true) // capture phase for scroll

        return () => {
            window.removeEventListener('pointermove', handleActivity)
            window.removeEventListener('click', handleActivity)
            window.removeEventListener('keydown', handleActivity)
            window.removeEventListener('scroll', handleActivity, true)
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [isActive, resetTimer])
}
