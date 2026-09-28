import { cn } from '@/lib/utils'

export function LiveDot({ className }: { className?: string }) {
    return (
        <span aria-hidden className={cn('relative flex size-2.5 shrink-0 rounded-full', className)}>
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative size-2.5 rounded-full bg-emerald-400" />
        </span>
    )
}
