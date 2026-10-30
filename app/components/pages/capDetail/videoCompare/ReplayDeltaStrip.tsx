import { DELTA_COLORS } from '@/app/components/pages/capDetail/capStats'
import type { DeltaTone } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { VideoStrip } from '@/app/components/pages/capDetail/runDelta/videoStrip'
import type { CapComparisonPoint } from '@/app/utils/api'
import { usePointerScrub } from '@/app/hooks/usePointerScrub'

interface ReplayDeltaStripProps {
    strip: VideoStrip
    runnerName: string
    runnerOffset: number
    duration: number
    master: number
    onScrub: (t: number) => void
    onScrubStart?: () => void
    onScrubEnd?: () => void
}

const TONE_COLORS: Record<DeltaTone, string> = {
    ahead: DELTA_COLORS.gained,
    behind: DELTA_COLORS.lost,
    even: DELTA_COLORS.neutral,
}

const HAIRLINE = (alpha: number) => `rgb(var(--hairline-rgb) / ${alpha})`
const BAND_FILL = HAIRLINE(0.05)
const CONNECTOR_STROKE = HAIRLINE(0.4)
const ZERO_STROKE = HAIRLINE(0.18)
const TICK_STROKE = HAIRLINE(0.3)

export function ReplayDeltaStrip({
    strip, runnerName, runnerOffset, duration, master, onScrub, onScrubStart, onScrubEnd,
}: ReplayDeltaStripProps) {
    const { trackRef, dur, pointerHandlers } = usePointerScrub(duration, { onScrub, onScrubStart, onScrubEnd })

    const [lo, hi] = strip.y.domainMs
    const px = (runnerMs: number) => ((runnerMs / 1000 + runnerOffset) / dur) * 100
    const py = (deltaMs: number) => ((hi - deltaMs) / (hi - lo)) * 100
    const path = (points: CapComparisonPoint[]) =>
        points.map(([t, d], i) => `${i === 0 ? 'M' : 'L'} ${px(t).toFixed(3)},${py(d).toFixed(3)}`).join(' ')
    const zeroY = py(strip.zeroLineMs)
    const cursorPct = Math.min(100, Math.max(0, (master / dur) * 100))
    const capPoint = strip.capPoint

    return (
        <div className="select-none">
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label={`Scrub both replays via ${runnerName}'s delta`}
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(master)}
                {...pointerHandlers}
                className="relative h-24 rounded-lg bg-hairline/[0.02] border border-hairline/5 overflow-hidden touch-none cursor-pointer focus:outline-none focus:border-accent-500/40"
            >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                    {strip.bands.map(b => (
                        <rect
                            key={`band-${b.startMs}`}
                            x={px(b.startMs)} y={0}
                            width={Math.max(0, px(b.endMs) - px(b.startMs))} height={100}
                            fill={BAND_FILL}
                        />
                    ))}
                    {strip.curves.map((c, i) => (
                        <path key={`area-${i}`} d={`${path(c.area)} Z`} fill={TONE_COLORS[c.tone]} fillOpacity={0.14} />
                    ))}
                    <line
                        x1={0} y1={zeroY} x2={100} y2={zeroY}
                        stroke={ZERO_STROKE} strokeWidth={1}
                        strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
                    />
                    {strip.bands.map(b => (
                        <line
                            key={`connector-${b.startMs}`}
                            x1={px(b.connector[0][0])} y1={py(b.connector[0][1])}
                            x2={px(b.connector[1][0])} y2={py(b.connector[1][1])}
                            stroke={CONNECTOR_STROKE} strokeWidth={1.5}
                            strokeDasharray="2 3" vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    {strip.curves.map((c, i) => (
                        <path
                            key={`curve-${i}`}
                            d={path(c.points)}
                            fill="none"
                            stroke={TONE_COLORS[c.tone]} strokeWidth={2.5}
                            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    {strip.runner.ticksMs.map(t => (
                        <line
                            key={`tick-${t}`}
                            x1={px(t)} y1={90} x2={px(t)} y2={100}
                            stroke={TICK_STROKE} strokeWidth={1} vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </svg>

                {capPoint && (
                    <div
                        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                        style={{ left: `${px(capPoint.tMs)}%`, top: `${py(capPoint.deltaMs)}%`, backgroundColor: TONE_COLORS[capPoint.tone] }}
                    />
                )}

                <div
                    className="absolute top-0 bottom-0 w-px bg-hairline/80 pointer-events-none"
                    style={{ left: `${cursorPct}%` }}
                />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ backgroundColor: TONE_COLORS.ahead }} />ahead
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ backgroundColor: TONE_COLORS.behind }} />behind
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2.5 rounded-sm border border-dashed border-hairline/30 bg-hairline/[0.07]" />different line
                </span>
                <span>ticks = {runnerName}&apos;s sector splits</span>
            </div>
        </div>
    )
}
