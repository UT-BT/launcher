import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { usePointerScrub } from '@/app/hooks/usePointerScrub'

export interface ScrubTick { t: number; isCap: boolean }

interface CompareScrubberProps {
    master: number
    duration: number
    ticksA: ScrubTick[]
    ticksB: ScrubTick[]
    onScrub: (t: number) => void
    onScrubStart?: () => void
    onScrubEnd?: () => void
    aliasA: string
    aliasB: string
}

export function CompareScrubber({
    master, duration, ticksA, ticksB, onScrub, onScrubStart, onScrubEnd, aliasA, aliasB,
}: CompareScrubberProps) {
    const { trackRef, dur, pointerHandlers } = usePointerScrub(duration, { onScrub, onScrubStart, onScrubEnd })

    const pct = (t: number) => Math.min(100, Math.max(0, (t / dur) * 100))
    const cursorPct = pct(master)

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        let next: number | null = null
        if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = dur
        if (next == null) return
        e.preventDefault()
        onScrubStart?.()
        onScrub(Math.min(dur, Math.max(0, next)))
        onScrubEnd?.()
    }

    const renderTicks = (ticks: ScrubTick[], side: 'top' | 'bottom', color: string, capColor: string) => (
        ticks.map((tk, i) => (
            <div
                key={`${side}${i}`}
                className={cn(
                    'absolute w-px',
                    side === 'top' ? 'top-0' : 'bottom-0',
                    tk.isCap ? `h-[58%] ${capColor}` : `h-[40%] ${color}`,
                )}
                style={{ left: `${pct(tk.t)}%` }}
            >
                {tk.isCap && (
                    <div
                        className={cn(
                            'absolute -left-[2px] size-[5px] rounded-full',
                            side === 'top' ? 'top-0' : 'bottom-0',
                            capColor,
                        )}
                    />
                )}
            </div>
        ))
    )

    return (
        <div className="select-none">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-0.5 pb-1 text-[10px] uppercase tracking-wider gap-2">
                <span className="text-blue-300/80 truncate">{aliasA}</span>
                <span className="font-mono tabular-nums text-muted-foreground normal-case shrink-0 text-center">
                    {formatCapTime(Math.max(0, master))} / {formatCapTime(dur)}
                </span>
                <span className="text-amber-300/80 truncate text-right">{aliasB}</span>
            </div>

            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Scrub both replays"
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(master)}
                {...pointerHandlers}
                onKeyDown={onKeyDown}
                className="relative h-12 rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden touch-none cursor-pointer focus:outline-none focus:border-blue-500/40"
            >
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/5" />
                {renderTicks(ticksA, 'top', 'bg-blue-400/40', 'bg-blue-300')}
                {renderTicks(ticksB, 'bottom', 'bg-amber-400/40', 'bg-amber-300')}

                <div
                    className="absolute top-0 bottom-0 w-px bg-white pointer-events-none"
                    style={{ left: `${cursorPct}%` }}
                >
                    <div className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-white" />
                    <div className="absolute -bottom-[3px] -left-[3px] size-[7px] rounded-full bg-white" />
                </div>
            </div>
        </div>
    )
}
