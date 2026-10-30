import { useLayoutEffect, useRef, useState } from 'react'
import { DELTA_COLORS } from '@/app/components/pages/capDetail/capStats'
import type { CapComparisonPoint } from '@/app/utils/api'
import type { AxisTick } from './chartRules'
import type { DeltaTone } from './deltaCurve'
import type { RunDeltaChart as RunDeltaChartModel } from './runDeltaCard'

const TONE_STROKE: Record<DeltaTone, string> = {
    ahead: DELTA_COLORS.gained,
    behind: DELTA_COLORS.lost,
    even: DELTA_COLORS.neutral,
}

const TONE_AREA: Record<DeltaTone, string> = {
    ahead: `${DELTA_COLORS.gained}24`,
    behind: `${DELTA_COLORS.lost}24`,
    even: 'transparent',
}

const HAIRLINE = (alpha: number) => `rgb(var(--hairline-rgb) / ${alpha})`

const MARGIN = { left: 52, right: 16, top: 18, bottom: 22 }
const TICK_LENGTH = 4
const LABEL_CHAR_PX = 6
const LABEL_GAP_PX = 6

interface RunDeltaChartProps {
    chart: RunDeltaChartModel
    referenceLabel: string
    description: string
}

function useElementSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
    const [size, setSize] = useState({ width: 0, height: 0 })
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const measure = () => {
            const { width, height } = el.getBoundingClientRect()
            setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
    }, [ref])
    return size
}

function pathOf(points: CapComparisonPoint[], x: (ms: number) => number, y: (ms: number) => number, close = false): string {
    const d = points.map(([t, delta], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(delta).toFixed(1)}`).join(' ')
    return close ? `${d} Z` : d
}

function readableTimeLabels(ticks: AxisTick[], x: (ms: number) => number): AxisTick[] {
    const kept: AxisTick[] = []
    let leftEdge = Infinity
    for (const tick of [...ticks].reverse()) {
        const half = (tick.label.length * LABEL_CHAR_PX) / 2
        const center = x(tick.ms)
        if (center + half + LABEL_GAP_PX > leftEdge) continue
        kept.push(tick)
        leftEdge = center - half
    }
    return kept
}

export default function RunDeltaChart({ chart, referenceLabel, description }: RunDeltaChartProps) {
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)

    const left = MARGIN.left
    const right = Math.max(left + 1, width - MARGIN.right)
    const top = MARGIN.top
    const bottom = Math.max(top + 1, height - MARGIN.bottom)
    const [t0, t1] = chart.x.domainMs
    const [lo, hi] = chart.y.domainMs
    const x = (ms: number) => left + ((ms - t0) / Math.max(1, t1 - t0)) * (right - left)
    const y = (ms: number) => top + ((hi - ms) / Math.max(1, hi - lo)) * (bottom - top)

    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg p-2 h-full flex flex-col min-h-0">
            <div className="px-1 pb-1.5 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                Cumulative · vs {referenceLabel}
            </div>
            <div ref={plotRef} className="flex-1 min-h-[180px] relative">
                {width > 0 && height > 0 && (
                    <svg
                        width={width}
                        height={height}
                        role="img"
                        aria-label={description}
                        className="absolute inset-0 block font-mono"
                    >
                        {chart.boundariesMs.map(ms => (
                            <line key={`b${ms}`} x1={x(ms)} x2={x(ms)} y1={top} y2={bottom} stroke={HAIRLINE(0.06)} />
                        ))}
                        {chart.y.ticks.map(tick => (
                            <line
                                key={`g${tick.ms}`}
                                x1={left} x2={right} y1={y(tick.ms)} y2={y(tick.ms)}
                                stroke={HAIRLINE(0.06)} strokeDasharray="3 3"
                            />
                        ))}
                        {chart.curves.map((curve, i) => (
                            <path key={`a${i}`} d={pathOf(curve.area, x, y, true)} fill={TONE_AREA[curve.tone]} stroke="none" />
                        ))}
                        <line
                            x1={left} x2={right} y1={y(chart.zeroLineMs)} y2={y(chart.zeroLineMs)}
                            stroke={HAIRLINE(0.3)} strokeDasharray="4 4"
                        />
                        <line x1={left} x2={left} y1={top} y2={bottom} stroke={HAIRLINE(0.22)} />
                        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke={HAIRLINE(0.22)} />
                        {chart.y.ticks.map(tick => (
                            <line
                                key={`yt${tick.ms}`}
                                x1={left - TICK_LENGTH} x2={left} y1={y(tick.ms)} y2={y(tick.ms)}
                                stroke={HAIRLINE(0.22)}
                            />
                        ))}
                        {chart.x.ticks.map(tick => (
                            <line
                                key={`xt${tick.ms}`}
                                x1={x(tick.ms)} x2={x(tick.ms)} y1={bottom} y2={bottom + TICK_LENGTH}
                                stroke={HAIRLINE(0.22)}
                            />
                        ))}
                        {chart.curves.map((curve, i) => (
                            <path
                                key={`c${i}`}
                                d={pathOf(curve.points, x, y)}
                                fill="none"
                                stroke={TONE_STROKE[curve.tone]}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        ))}
                        {chart.dots.map(dot => (
                            <circle
                                key={`d${dot.index}`}
                                cx={x(dot.tMs)}
                                cy={y(dot.deltaMs)}
                                r={3.5}
                                fill={TONE_STROKE[dot.tone]}
                                stroke="var(--card)"
                                strokeWidth={1}
                            />
                        ))}
                        <g fontSize={10} fill={HAIRLINE(0.5)}>
                            {chart.y.ticks.map(tick => (
                                <text key={`yl${tick.ms}`} x={left - TICK_LENGTH - 3} y={y(tick.ms)} textAnchor="end" dominantBaseline="middle">
                                    {tick.label}
                                </text>
                            ))}
                            {readableTimeLabels(chart.x.ticks, x).map(tick => (
                                <text key={`xl${tick.ms}`} x={x(tick.ms)} y={height - 4} textAnchor="middle">
                                    {tick.label}
                                </text>
                            ))}
                        </g>
                        <g fontSize={9} fill={HAIRLINE(0.38)}>
                            {chart.sectors.map(sector => (
                                <text key={`s${sector.index}`} x={(x(sector.startMs) + x(sector.endMs)) / 2} y={top - 6} textAnchor="middle">
                                    {sector.label}
                                </text>
                            ))}
                        </g>
                    </svg>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 pt-1 text-[10px] text-muted-foreground shrink-0">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-[3px] rounded-sm" style={{ background: DELTA_COLORS.gained }} />ahead
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-[3px] rounded-sm" style={{ background: DELTA_COLORS.lost }} />behind
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-[7px] rounded-full" style={{ background: DELTA_COLORS.neutral }} />sector split
                </span>
                <span>x = {referenceLabel}&apos;s run time</span>
            </div>
        </div>
    )
}
