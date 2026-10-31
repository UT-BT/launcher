import { useLayoutEffect, useState } from 'react'
import type { AxisTick, DeltaAxis } from './chartRules'
import { HAIRLINE } from './deltaStyles'

export const TICK_LENGTH = 4

const LABEL_CHAR_PX = 6
const LABEL_GAP_PX = 6

export function readableTimeLabels(ticks: AxisTick[], x: (ms: number) => number): AxisTick[] {
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

export interface PlotBox {
    left: number
    right: number
    top: number
    bottom: number
}

export function useElementSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
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

export function deltaScale(axis: DeltaAxis, box: PlotBox): (ms: number) => number {
    const [lo, hi] = axis.domainMs
    return ms => box.top + ((hi - ms) / Math.max(1, hi - lo)) * (box.bottom - box.top)
}

export function DeltaGrid({ ticks, box, y }: { ticks: AxisTick[]; box: PlotBox; y: (ms: number) => number }) {
    return (
        <>
            {ticks.map(tick => (
                <line
                    key={`g${tick.ms}`}
                    x1={box.left} x2={box.right} y1={y(tick.ms)} y2={y(tick.ms)}
                    stroke={HAIRLINE(0.06)} strokeDasharray="3 3"
                />
            ))}
        </>
    )
}

export function DeltaAxisMarks({ ticks, box, y }: { ticks: AxisTick[]; box: PlotBox; y: (ms: number) => number }) {
    return (
        <>
            <line x1={box.left} x2={box.left} y1={box.top} y2={box.bottom} stroke={HAIRLINE(0.22)} />
            <line x1={box.left} x2={box.right} y1={box.bottom} y2={box.bottom} stroke={HAIRLINE(0.22)} />
            {ticks.map(tick => (
                <line
                    key={`yt${tick.ms}`}
                    x1={box.left - TICK_LENGTH} x2={box.left} y1={y(tick.ms)} y2={y(tick.ms)}
                    stroke={HAIRLINE(0.22)}
                />
            ))}
            <g fontSize={10} fill={HAIRLINE(0.5)}>
                {ticks.map(tick => (
                    <text key={`yl${tick.ms}`} x={box.left - TICK_LENGTH - 3} y={y(tick.ms)} textAnchor="end" dominantBaseline="middle">
                        {tick.label}
                    </text>
                ))}
            </g>
        </>
    )
}
