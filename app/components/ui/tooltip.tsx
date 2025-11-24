import { useState, ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    content: string
    children?: ReactNode
    className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div
            className={cn("relative inline-flex items-center", className)}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children || <Info className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />}

            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-popover text-popover-foreground text-xs shadow-md border border-border z-50 animate-in fade-in zoom-in-95 duration-200">
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                </div>
            )}
        </div>
    )
}
