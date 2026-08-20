import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const MEDAL_CLASS: Record<number, string> = {
    1: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
    2: 'bg-white/10 text-white/75 border-white/25',
    3: 'bg-orange-700/25 text-orange-400 border-orange-700/40',
}

export function RankChip({ rank, className }: { rank: number | null | undefined; className?: string }) {
    if (!rank) return null

    return (
        <span className={cn(
            'shrink-0 rounded border px-1 py-px text-[10px] font-bold tabular-nums leading-none',
            MEDAL_CLASS[rank] ?? 'bg-white/5 text-muted-foreground border-white/10',
            className,
        )}>
            #{rank}
        </span>
    )
}

interface TeamMetricRowProps {
    icon: LucideIcon
    label: string
    value: string
    /** Raw total behind `value` — a team on zero gets no rank, however it placed. */
    total: number
    rank?: number | null
    accent: string
    active?: boolean
}

/**
 * One line of the team stat sheet: label on the left, a dotted leader, then the
 * value and its directory rank hard against the right edge.
 */
export function TeamMetricRow({ icon: Icon, label, value, total, rank, accent, active }: TeamMetricRowProps) {
    return (
        <div className={cn(
            'flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5',
            active && 'bg-white/[0.04]',
        )}>
            <Icon className={cn('size-3.5 shrink-0', accent)} />
            <span className={cn(
                'text-[11px] uppercase tracking-wider shrink-0',
                active ? 'text-white/80' : 'text-muted-foreground',
            )}>
                {label}
            </span>
            <span className="flex-1 min-w-3 border-b border-dotted border-white/15" />
            <span className={cn(
                'font-mono font-bold tabular-nums text-sm shrink-0',
                total > 0 ? 'text-foreground' : 'text-muted-foreground',
            )}>
                {value}
            </span>
            <RankChip rank={total > 0 ? rank : null} />
        </div>
    )
}
