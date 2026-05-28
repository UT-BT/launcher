import { useState, useRef, useLayoutEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    content: ReactNode
    children?: ReactNode
    className?: string
    side?: 'top' | 'bottom'
}

const EDGE_PAD = 8
const GAP = 10

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [placed, setPlaced] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowLeft: 0 })
    const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom'>(side)
    const triggerRef = useRef<HTMLDivElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)

    const hide = () => {
        setIsVisible(false)
        setPlaced(false)
    }

    // Position by the tooltip's own top-left edge (no positioning transform):
    // the `animate-in` enter keyframe interpolates `transform`, so any inline
    // translate would get animated, sliding the tooltip in from the corner.
    useLayoutEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current) return

        const trigger = triggerRef.current.getBoundingClientRect()
        const tip = tooltipRef.current.getBoundingClientRect()
        const vw = document.documentElement.clientWidth
        const vh = document.documentElement.clientHeight
        // The custom titlebar sits over the top of the viewport; treat its
        // bottom edge as the real top boundary so tooltips never tuck under it.
        const titlebar = document.querySelector('.window-titlebar')
        const topBound = (titlebar ? titlebar.getBoundingClientRect().bottom : 0) + EDGE_PAD

        let nextSide: 'top' | 'bottom' = side
        if (side === 'top' && trigger.top - GAP - tip.height < topBound) {
            nextSide = 'bottom'
        } else if (side === 'bottom' && trigger.bottom + GAP + tip.height > vh - EDGE_PAD) {
            nextSide = 'top'
        }

        const top = nextSide === 'bottom' ? trigger.bottom + GAP : trigger.top - GAP - tip.height

        const center = trigger.left + trigger.width / 2
        const maxLeft = Math.max(EDGE_PAD, vw - EDGE_PAD - tip.width)
        const left = Math.min(Math.max(center - tip.width / 2, EDGE_PAD), maxLeft)
        // Keep the arrow pointing at the trigger even when the box is clamped.
        const arrowLeft = Math.min(Math.max(center - left, 12), tip.width - 12)

        setResolvedSide(nextSide)
        setCoords({ top, left, arrowLeft })
        setPlaced(true)
    }, [isVisible, side, content])

    return (
        <>
            <div
                ref={triggerRef}
                className={cn("relative inline-flex items-center", className)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={hide}
            >
                {children || <Info className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />}
            </div>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className={cn(
                        "fixed z-[9999] w-max max-w-[280px] px-3 py-1.5 rounded-md bg-[#0a0a0a]/95 text-white/90 text-xs font-bold tracking-tight shadow-2xl border border-white/10 pointer-events-none backdrop-blur-sm",
                        !placed && "opacity-0"
                    )}
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                    {resolvedSide === 'bottom' ? (
                        <div className="absolute bottom-full -translate-x-1/2 -mb-[5px] border-[5px] border-transparent border-b-[#0a0a0a]/95" style={{ left: coords.arrowLeft }} />
                    ) : (
                        <div className="absolute top-full -translate-x-1/2 -mt-[5px] border-[5px] border-transparent border-t-[#0a0a0a]/95" style={{ left: coords.arrowLeft }} />
                    )}
                </div>,
                document.body
            )}
        </>
    )
}
