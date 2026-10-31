import { Split } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_TEXT } from './deltaStyles'
import type { RoutesDifferCard } from './runDeltaCard'
import { routesDifferSummary } from './runDeltaCopy'

interface RoutesDifferViewProps {
    card: RoutesDifferCard
    referenceLabel: string
}

export function RoutesDifferView({ card, referenceLabel }: RoutesDifferViewProps) {
    return (
        <div className="p-3 xl:h-[460px]">
            <div className="h-full min-h-[280px] rounded-lg bg-hairline/[0.02] border border-hairline/5 flex flex-col items-center justify-center gap-2.5 px-5 py-8 text-center">
                <Split className="size-7 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Routes differ for most of the run</span>
                <span className="text-xs text-muted-foreground max-w-[22rem]">
                    {routesDifferSummary(card.coveragePercent, referenceLabel)}
                </span>
                <div className="flex flex-col items-center gap-0.5 mt-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">At the cap</span>
                    <span className={cn('text-2xl font-bold font-mono tabular-nums', TONE_TEXT[card.finalGap.tone])}>
                        {card.finalGap.label}
                    </span>
                </div>
            </div>
        </div>
    )
}
