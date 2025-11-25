import { useState, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    content: string
    children?: ReactNode
    className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const triggerRef = useRef<HTMLDivElement>(null)

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.top - 10, // 10px offset above
                left: rect.left + rect.width / 2
            })
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
                    className="fixed z-[9999] w-64 p-3 rounded-lg bg-popover text-popover-foreground text-xs shadow-md border border-border animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                </div>,
                document.body
            )}
        </>
    )
}
