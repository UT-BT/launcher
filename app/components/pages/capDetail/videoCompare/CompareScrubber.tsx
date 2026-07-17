import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { usePointerScrub } from '@/app/hooks/usePointerScrub'

export interface ScrubTick { t: number; isCap: boolean }

export interface ScrubLane {
    alias: string
    ticks: ScrubTick[]
    tickColor: string
    capColor: string
    textColor: string
}

interface CompareScrubberProps {
    master: number
    duration: number
    lanes: ScrubLane[]
    onScrub: (t: number) => void
    onScrubStart?: () => void
    onScrubEnd?: () => void
}

export function CompareScrubber({
    master, duration, lanes, onScrub, onScrubStart, onScrubEnd,
}: CompareScrubberProps) {
    const { trackRef, dur, pointerHandlers } = usePointerScrub(duration, { onScrub, onScrubStart, onScrubEnd })

    const pct = (t: number) => Math.min(100, Math.max(0, (t / dur) * 100))
    const cursorPct = pct(master)
    const laneCount = Math.max(1, lanes.length)

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

    return (
        <div className="select-none">
            <div className="flex items-center justify-between gap-2 px-0.5 pb-1 text-[10px] uppercase tracking-wider">
                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap min-w-0">
                    {lanes.map((lane, i) => (
                        <span key={i} className={cn('inline-flex items-center gap-1 truncate', lane.textColor)}>
                            <span className={cn('inline-block size-1.5 rounded-full shrink-0', lane.capColor)} />
                            {lane.alias}
                        </span>
                    ))}
                </div>
                <span className="font-mono tabular-nums text-muted-foreground normal-case shrink-0">
                    {formatCapTime(Math.max(0, master))} / {formatCapTime(dur)}
                </span>
            </div>

            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Scrub all replays"
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(master)}
                {...pointerHandlers}
                onKeyDown={onKeyDown}
                className="relative h-12 rounded-lg bg-hairline/[0.02] border border-hairline/5 overflow-hidden touch-none cursor-pointer focus:outline-none focus:border-accent-500/40"
            >
                <div className="absolute left-0 right-0 top-1/2 h-px bg-hairline/5" />
                {lanes.map((lane, li) => (
                    <Fragment key={li}>
                        {lane.ticks.map((tk, i) => (
                            <div
                                key={i}
                                className={cn('absolute w-px', tk.isCap ? lane.capColor : lane.tickColor)}
                                style={{
                                    left: `${pct(tk.t)}%`,
                                    top: `${(li / laneCount) * 100}%`,
                                    height: `${(1 / laneCount) * 100}%`,
                                }}
                            >
                                {tk.isCap && (
                                    <div className={cn('absolute -left-[2px] top-0 size-[5px] rounded-full', lane.capColor)} />
                                )}
                            </div>
                        ))}
                    </Fragment>
                ))}

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
