import { cn } from '@/lib/utils'
import type { PickBanSessionStatus } from '@/app/utils/api'
import { pickBanStatusBadge, type PickBanStatusTone } from '../pickBanStatus'

const TONE_CLASS: Record<PickBanStatusTone, string> = {
    idle: 'border-hairline/10 bg-hairline/5 text-muted-foreground',
    ready: 'border-accent-500/40 bg-accent-500/15 text-accent-200',
    live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    paused: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    done: 'border-hairline/20 bg-hairline/10 text-foreground',
}

export function PickBanStatusChip({ status, className }: { status: PickBanSessionStatus; className?: string }) {
    const { label, tone } = pickBanStatusBadge(status)

    return (
        <span className={cn('inline-flex shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', TONE_CLASS[tone], className)}>
            {label}
        </span>
    )
}
