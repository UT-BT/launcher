import { useState, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    content: string
    children?: ReactNode
    className?: string
    side?: 'top' | 'bottom'
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const triggerRef = useRef<HTMLDivElement>(null)

    const getZoom = () => {
        const zoom = parseFloat(document.documentElement.style.zoom)
        return isNaN(zoom) ? 1 : zoom / 100
    }

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const zoom = getZoom()
            const rect = triggerRef.current.getBoundingClientRect()
            if (side === 'bottom') {
                setCoords({
                    top: (rect.bottom / zoom) + 10,
                    left: (rect.left / zoom) + (rect.width / zoom) / 2
                })
            } else {
                setCoords({
                    top: (rect.top / zoom) - 10,
                    left: (rect.left / zoom) + (rect.width / zoom) / 2
                })
            }
            setIsVisible(true)
        }
    }

    return (
        <>
            <div
                ref={triggerRef}
                className={cn("relative inline-flex items-center", className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children || <Info className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />}
            </div>

            {isVisible && createPortal(
                <div
                    className="fixed z-[9999] w-max max-w-[280px] px-3 py-1.5 rounded-md bg-[#0a0a0a]/95 text-white/90 text-xs font-bold tracking-tight shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200 pointer-events-none backdrop-blur-sm"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: side === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
                    }}
                >
                    {content}
                    {side === 'bottom' ? (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-[5px] border-[5px] border-transparent border-b-[#0a0a0a]/95" />
                    ) : (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-[5px] border-transparent border-t-[#0a0a0a]/95" />
                    )}
                </div>,
                document.body
            )}
        </>
    )
}
