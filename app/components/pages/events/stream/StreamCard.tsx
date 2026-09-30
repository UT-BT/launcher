import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StreamCardProps {
    title: string
    description?: string
    className?: string
    children?: ReactNode
}

export function StreamCard({ title, description, className, children }: StreamCardProps) {
    const titleId = useId()

    return (
        <section aria-labelledby={titleId} className={cn('min-w-0 rounded-xl border border-hairline/10 bg-card/30 p-4 space-y-3', className)}>
            <header className="space-y-0.5">
                <h2 id={titleId} className="text-sm font-semibold text-foreground">{title}</h2>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </header>
            {children}
        </section>
    )
}

export function StreamPlaceholder({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-hairline/10 px-3 py-4 text-xs text-muted-foreground">
            {children}
        </p>
    )
}

export function StreamLoading({ label }: { label: string }) {
    return <p className="text-xs text-muted-foreground">Loading {label}…</p>
}
