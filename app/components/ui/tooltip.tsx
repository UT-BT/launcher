import { useState, useRef, useLayoutEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type TooltipSide = 'top' | 'bottom' | 'right'

interface TooltipProps {
    content: ReactNode
    children?: ReactNode
    className?: string
    side?: TooltipSide
}

const EDGE_PAD = 8
const GAP = 10

const ARROW_CLASS: Record<TooltipSide, string> = {
    top: 'top-full -translate-x-1/2 -mt-[5px] border-t-popover/95',
    bottom: 'bottom-full -translate-x-1/2 -mb-[5px] border-b-popover/95',
    right: 'right-full -translate-y-1/2 -mr-[5px] border-r-popover/95',
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [placed, setPlaced] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowOffset: 0 })
    const [resolvedSide, setResolvedSide] = useState<TooltipSide>(side)
    const triggerRef = useRef<HTMLSpanElement>(null)
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

        let nextSide: TooltipSide = side
        if (side === 'top' && trigger.top - GAP - tip.height < topBound) {
            nextSide = 'bottom'
        } else if (side === 'bottom' && trigger.bottom + GAP + tip.height > vh - EDGE_PAD) {
            nextSide = 'top'
        }

        const maxLeft = Math.max(EDGE_PAD, vw - EDGE_PAD - tip.width)
        const middle = trigger.top + trigger.height / 2
        const center = trigger.left + trigger.width / 2

        let top: number
        let left: number
        if (nextSide === 'right') {
            top = Math.min(Math.max(middle - tip.height / 2, topBound), Math.max(topBound, vh - EDGE_PAD - tip.height))
            left = Math.min(trigger.right + GAP, maxLeft)
        } else {
            top = nextSide === 'bottom' ? trigger.bottom + GAP : trigger.top - GAP - tip.height
            left = Math.min(Math.max(center - tip.width / 2, EDGE_PAD), maxLeft)
        }
        const arrowOffset = nextSide === 'right'
            ? Math.min(Math.max(middle - top, 12), tip.height - 12)
            : Math.min(Math.max(center - left, 12), tip.width - 12)

        setResolvedSide(nextSide)
        setCoords({ top, left, arrowOffset })
        setPlaced(true)
    }, [isVisible, side, content])

    return (
        <>
            <span
                ref={triggerRef}
                className={cn("relative inline-flex items-center", className)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={hide}
                onFocus={() => setIsVisible(true)}
                onBlur={hide}
            >
                {children || <Info className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />}
            </span>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className={cn(
                        "fixed z-[9999] w-max max-w-[280px] px-3 py-1.5 rounded-md bg-popover/95 text-foreground/90 text-xs font-bold tracking-tight shadow-2xl border border-hairline/10 pointer-events-none backdrop-blur-sm",
                        !placed && "opacity-0"
                    )}
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                    <div
                        className={cn('absolute border-[5px] border-transparent', ARROW_CLASS[resolvedSide])}
                        style={resolvedSide === 'right' ? { top: coords.arrowOffset } : { left: coords.arrowOffset }}
                    />
                </div>,
                document.body
            )}
        </>
    )
}
