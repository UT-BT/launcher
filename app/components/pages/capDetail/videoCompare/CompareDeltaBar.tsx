import { segmentColor } from '@/app/components/pages/capDetail/capStats'
import { usePointerScrub } from '@/app/hooks/usePointerScrub'

export interface DeltaPoint { x: number; delta: number }

interface CompareDeltaBarProps {
    points: DeltaPoint[]
    duration: number
    master: number
    onScrub: (t: number) => void
    onScrubStart?: () => void
    onScrubEnd?: () => void
}

export function CompareDeltaBar({ points, duration, master, onScrub, onScrubStart, onScrubEnd }: CompareDeltaBarProps) {
    const { trackRef, dur, pointerHandlers } = usePointerScrub(duration, { onScrub, onScrubStart, onScrubEnd })

    const maxAbs = Math.max(1e-3, ...points.map(p => Math.abs(p.delta)))
    const px = (x: number) => Math.min(100, Math.max(0, (x / dur) * 100))
    const py = (d: number) => 50 - (d / maxAbs) * 44
    const cursorPct = Math.min(100, Math.max(0, (master / dur) * 100))

    const areaPath = points.length > 1
        ? `M ${px(points[0].x).toFixed(2)},50 `
            + points.map(p => `L ${px(p.x).toFixed(2)},${py(p.delta).toFixed(2)}`).join(' ')
            + ` L ${px(points[points.length - 1].x).toFixed(2)},50 Z`
        : ''

    return (
        <div className="select-none">
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Scrub both replays via the delta"
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(master)}
                {...pointerHandlers}
                className="relative h-24 rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden touch-none cursor-pointer focus:outline-none focus:border-blue-500/40"
            >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                    {areaPath && <path d={areaPath} fill="rgba(255,255,255,0.035)" />}
                    <line
                        x1={0} y1={50} x2={100} y2={50}
                        stroke="rgba(255,255,255,0.18)" strokeWidth={1}
                        strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
                    />
                    {points.slice(1).map((p, i) => {
                        const prev = points[i]
                        return (
                            <line
                                key={`s${i}`}
                                x1={px(prev.x)} y1={py(prev.delta)} x2={px(p.x)} y2={py(p.delta)}
                                stroke={segmentColor(p.delta - prev.delta)} strokeWidth={2.5}
                                strokeLinecap="round" vectorEffect="non-scaling-stroke"
                            />
                        )
                    })}
                </svg>

                <div
                    className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none"
                    style={{ left: `${cursorPct}%` }}
                />
            </div>

            <div className="flex items-center justify-center gap-3 pt-1.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-red-400" />lost</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400" />gained</span>
            </div>
        </div>
    )
}
