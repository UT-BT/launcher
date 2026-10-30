import { cn } from '@/lib/utils'

interface RunDeltaChipProps {
    chip: 'REPLAY' | 'ZONES'
}

export function RunDeltaChip({ chip }: RunDeltaChipProps) {
    return (
        <span
            className={cn(
                'px-1.5 py-px rounded border text-[9px] font-semibold uppercase tracking-[0.06em] leading-normal',
                chip === 'REPLAY'
                    ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                    : 'bg-hairline/5 border-hairline/15 text-muted-foreground',
            )}
        >
            {chip === 'REPLAY' ? 'Replay' : 'Zones'}
        </span>
    )
}
