import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import type { NavParams } from '@/app/components/navigation/NavigationContext'

export interface SectionAccent {
    tick: string
}

interface SpotlightSectionProps {
    title: string
    accent: SectionAccent
    actionLabel?: string
    onAction?: () => void
    actionView?: string
    actionParams?: NavParams
    className?: string
    children: ReactNode
}

export function SpotlightSection({ title, accent, actionLabel, onAction, actionView, actionParams, className, children }: SpotlightSectionProps) {
    const actionClass = 'h-7 shrink-0 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest gap-2 bg-hairline/5 border border-hairline/5'
    return (
        <section className={cn('group/section flex flex-col', className)}>
            <header className="flex items-center justify-between gap-3 mb-3 pr-1 h-8 shrink-0">
                <h2 className="flex items-center gap-2.5 min-w-0">
                    <span className={cn('h-5 w-1 rounded-full shrink-0', accent.tick)} aria-hidden />
                    <span className="text-sm sm:text-base font-black uppercase tracking-[0.08em] sm:tracking-[0.14em] leading-none truncate drop-shadow-sm text-foreground">
                        {title}
                    </span>
                </h2>
                {actionLabel && onAction && (actionView ? (
                    <Button asChild variant="ghost" size="sm" className={actionClass}>
                        <NavLink view={actionView} params={actionParams} onActivate={onAction}>
                            {actionLabel} <ChevronRight className="size-3" />
                        </NavLink>
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" onClick={onAction} className={actionClass}>
                        {actionLabel} <ChevronRight className="size-3" />
                    </Button>
                ))}
            </header>
            {children}
        </section>
    )
}
