import React, { useState, useEffect } from 'react'

interface ScreenshotOverlayProps {
    isActive: boolean
    onComplete: (region: { x: number; y: number; width: number; height: number } | null) => void
    onCancel: () => void
}

export const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ isActive, onComplete, onCancel }) => {
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
    const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const containerRef = React.useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isActive) {
            // Reset estado a cada ativação para limpar retângulo antigo
            setStartPos(null)
            setCurrentPos(null)
            setIsDragging(false)

            // Force interactive mode when active
            window.electronAPI?.setIgnoreMouseEvents(false)
            if (window.electronAPI?.requestWindowFocus) {
                window.electronAPI.requestWindowFocus()
            }
            // Reforço extra para garantir que não volte a pass-through
            window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 30)
            window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 90)
            window.setTimeout(() => window.electronAPI?.setIgnoreMouseEvents(false), 180)
            
            document.body.style.cursor = 'crosshair'
            
            // Force focus on container
            setTimeout(() => {
                containerRef.current?.focus()
            }, 50)
            
            // Reinforce interactive mode after a short delay
            setTimeout(() => {
                 window.electronAPI?.setIgnoreMouseEvents(false)
            }, 100)

        } else {
            document.body.style.cursor = 'default'
        }
    }, [isActive])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isActive) return
            if (e.key === 'Escape') {
                onCancel()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isActive, onCancel])

    const getRect = () => {
        if (!startPos || !currentPos) return null
        const x = Math.min(startPos.x, currentPos.x)
        const y = Math.min(startPos.y, currentPos.y)
        const width = Math.abs(currentPos.x - startPos.x)
        const height = Math.abs(currentPos.y - startPos.y)
        return { x, y, width, height }
    }

    const rect = getRect()

    if (!isActive) return null

    return (
        <div
            ref={containerRef}
            tabIndex={-1} // Make focusable
            className="fixed inset-0 z-[9999] w-screen h-screen bg-black/40 backdrop-blur-[1px] pointer-events-auto outline-none cursor-crosshair"
            style={{ pointerEvents: 'auto' }} // Inline style to be super sure
            onMouseEnter={() => {
                console.log('[ScreenshotOverlay] Mouse Enter - Forcing interactive')
                window.electronAPI?.setIgnoreMouseEvents(false)
                containerRef.current?.focus()
            }}
            onMouseDown={(e) => {
                console.log('[ScreenshotOverlay] Mouse Down at', e.clientX, e.clientY)
                e.stopPropagation()
                // e.preventDefault() // Don't prevent default, might block focus
                setStartPos({ x: e.clientX, y: e.clientY })
                setCurrentPos({ x: e.clientX, y: e.clientY })
                setIsDragging(true)
            }}
            onMouseMove={(e) => {
                e.stopPropagation()
                if (isDragging) {
                    setCurrentPos({ x: e.clientX, y: e.clientY })
                }
            }}
            onMouseUp={(e) => {
                e.stopPropagation()
                if (isDragging && rect && rect.width > 5 && rect.height > 5) {
                    setIsDragging(false)
                    onComplete(rect)
                } else {
                    setIsDragging(false)
                    setStartPos(null)
                    setCurrentPos(null)
                    // If just a click without drag, maybe user wants to focus?
                    containerRef.current?.focus()
                }
            }}
        >
            {rect && (
                <div
                    className="absolute border-2 border-purple-500 bg-purple-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] "
                    style={{
                        left: rect.x,
                        top: rect.y,
                        width: rect.width,
                        height: rect.height
                    }}
                >
                    <div className="absolute -top-6 left-0 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded">
                        {Math.round(rect.width)} x {Math.round(rect.height)}
                    </div>
                </div>
            )}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-medium">
                Selecione uma área para capturar (ESC para cancelar)
            </div>
        </div>
    )
}
