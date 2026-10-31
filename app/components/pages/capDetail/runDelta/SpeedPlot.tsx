import { useId, useState } from 'react'
import type { CapComparisonSpeedPoint, CapMotionEvent } from '@/app/utils/api'
import { DeltaAxisMarks, DeltaGrid, TICK_LENGTH, readableTimeLabels, type PlotBox } from './chartFrame'
import { HAIRLINE } from './deltaStyles'
import type { RunDeltaChart } from './runDeltaCard'
import type { SpeedChart } from './runSpeed'
import type { AirSpan, ZoomedSpeed } from './speedZoom'

export const RUNNER_SPEED_STROKE = 'var(--accent-400)'
export const REFERENCE_SPEED_STROKE = HAIRLINE(0.55)
export const RUN_CAP_UU_S = 400
export const STRAFE_DODGE_UU_S = 721

const OVERVIEW_MARGIN = { left: 52, right: 16, top: 18, bottom: 22 }
const DETAIL_MARGIN = { left: 52, right: 16, top: 40, bottom: 34 }
const MIN_BAND_PX = 3
const MIN_DRAG_PX = 6
const MARKER_SIZE = 4.5
const MIN_MARKER_GAP_PX = 2 * MARKER_SIZE

interface SpeedPlotProps {
    chart: SpeedChart
    zoomed: ZoomedSpeed | null
    frame: Pick<RunDeltaChart, 'sectors' | 'boundariesMs'>
    width: number
    height: number
    description: string
    onZoomRange: (fromMs: number, toMs: number) => void
    onZoomSector: (index: number) => void
    onZoomOut: () => void
}

function pathOf(points: CapComparisonSpeedPoint[], x: (ms: number) => number, y: (speed: number) => number): string {
    return points.map(([t, speed], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(speed).toFixed(1)}`).join(' ')
}

export function markerPath(event: CapMotionEvent, cx: number, cy: number): string {
    const s = MARKER_SIZE
    if (event.kind === 'kick') return `M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`
    if (event.kind === 'jump') {
        return `M${cx - s} ${cy}a${s} ${s} 0 1 0 ${2 * s} 0a${s} ${s} 0 1 0 ${-2 * s} 0`
    }
    switch (event.direction) {
        case 'L': return `M${cx - s} ${cy}L${cx + s} ${cy - s}L${cx + s} ${cy + s}Z`
        case 'R': return `M${cx + s} ${cy}L${cx - s} ${cy - s}L${cx - s} ${cy + s}Z`
        case 'B': return `M${cx} ${cy + s}L${cx - s} ${cy - s}L${cx + s} ${cy - s}Z`
        default: return `M${cx} ${cy - s}L${cx - s} ${cy + s}L${cx + s} ${cy + s}Z`
    }
}

export function spacedMarkers(events: CapMotionEvent[], x: (ms: number) => number): CapMotionEvent[] {
    const shown: CapMotionEvent[] = []
    let lastX = -Infinity
    for (const event of events) {
        const at = x(event.t_ms)
        if (at - lastX < MIN_MARKER_GAP_PX) continue
        shown.push(event)
        lastX = at
    }
    return shown
}

function Markers({ events, x, cy, color, run }: {
    events: CapMotionEvent[]
    x: (ms: number) => number
    cy: number
    color: string
    run: string
}) {
    return (
        <g fill={color} data-run={run}>
            {spacedMarkers(events, x).map(event => (
                <path key={`${event.t_ms}-${event.kind}`} d={markerPath(event, x(event.t_ms), cy)} data-kind={event.kind} />
            ))}
        </g>
    )
}

function AirLane({ spans, x, top, color }: { spans: AirSpan[]; x: (ms: number) => number; top: number; color: string }) {
    return (
        <g fill={color}>
            {spans.map(([from, to]) => (
                <rect key={from} x={x(from)} y={top} width={Math.max(1, x(to) - x(from))} height={4} rx={1} />
            ))}
        </g>
    )
}

export function SpeedPlot({
    chart, zoomed, frame, width, height, description, onZoomRange, onZoomSector, onZoomOut,
}: SpeedPlotProps) {
    const clipId = useId()
    const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
    const detailed = zoomed?.detailed ?? false
    const margin = detailed ? DETAIL_MARGIN : OVERVIEW_MARGIN
    const box: PlotBox = {
        left: margin.left,
        right: Math.max(margin.left + 1, width - margin.right),
        top: margin.top,
        bottom: Math.max(margin.top + 1, height - margin.bottom),
    }
    const xAxis = zoomed ? zoomed.x : chart.x
    const yAxis = zoomed ? zoomed.y : chart.y
    const [t0, t1] = xAxis.domainMs
    const [, top] = yAxis.domain
    const x = (ms: number) => box.left + ((ms - t0) / Math.max(1, t1 - t0)) * (box.right - box.left)
    const msAt = (px: number) => t0 + ((px - box.left) / Math.max(1, box.right - box.left)) * (t1 - t0)
    const y = (speed: number) => box.bottom - (speed / Math.max(1, top)) * (box.bottom - box.top)
    const yTicks = yAxis.ticks.map(tick => ({ ms: tick.value, label: tick.label }))
    const runner = zoomed ? zoomed.runner : chart.runner
    const reference = zoomed ? zoomed.reference : chart.reference
    const bands = zoomed ? zoomed.bands : chart.bands
    const guides = [RUN_CAP_UU_S, STRAFE_DODGE_UU_S].filter(speed => speed < top)
    const sectors = frame.sectors.filter(s => s.endMs > t0 && s.startMs < t1)

    const pointerX = (event: React.PointerEvent<SVGRectElement>) => {
        const svg = event.currentTarget.ownerSVGElement
        const left = svg ? svg.getBoundingClientRect().left : 0
        return Math.min(box.right, Math.max(box.left, event.clientX - left))
    }

    return (
        <svg width={width} height={height} role="img" aria-label={description} className="absolute inset-0 block font-mono select-none">
            <defs>
                <clipPath id={clipId}>
                    <rect x={box.left} y={box.top} width={box.right - box.left} height={box.bottom - box.top} />
                </clipPath>
            </defs>
            {frame.boundariesMs.filter(ms => ms > t0 && ms < t1).map(ms => (
                <line key={`b${ms}`} x1={x(ms)} x2={x(ms)} y1={box.top} y2={box.bottom} stroke={HAIRLINE(0.06)} />
            ))}
            <DeltaGrid ticks={yTicks} box={box} y={y} />
            <g clipPath={`url(#${clipId})`}>
                {bands.map(band => {
                    const x0 = x(band.startMs)
                    const x1 = x0 + Math.max(MIN_BAND_PX, x(band.endMs) - x0)
                    return (
                        <g key={`band${band.startMs}`}>
                            <rect x={x0} y={box.top} width={x1 - x0} height={box.bottom - box.top} fill={HAIRLINE(0.05)} />
                            <line x1={x0} x2={x0} y1={box.top} y2={box.bottom} stroke={HAIRLINE(0.22)} strokeDasharray="2 3" />
                            <line x1={x1} x2={x1} y1={box.top} y2={box.bottom} stroke={HAIRLINE(0.22)} strokeDasharray="2 3" />
                        </g>
                    )
                })}
                {guides.map(speed => (
                    <line
                        key={`g${speed}`}
                        x1={box.left} x2={box.right} y1={y(speed)} y2={y(speed)}
                        stroke={HAIRLINE(0.28)} strokeDasharray="6 4"
                        data-guide={speed}
                    />
                ))}
                {reference.map((segment, i) => (
                    <path
                        key={`r${i}`}
                        d={pathOf(segment, x, y)}
                        fill="none"
                        stroke={REFERENCE_SPEED_STROKE}
                        strokeWidth={detailed ? 1.25 : 1.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                ))}
                {runner.map((segment, i) => (
                    <path
                        key={`s${i}`}
                        d={pathOf(segment, x, y)}
                        fill="none"
                        stroke={RUNNER_SPEED_STROKE}
                        strokeWidth={detailed ? 1.5 : 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                ))}
            </g>
            <DeltaAxisMarks ticks={yTicks} box={box} y={y} />
            {!detailed && xAxis.ticks.map(tick => (
                <line
                    key={`xt${tick.ms}`}
                    x1={x(tick.ms)} x2={x(tick.ms)} y1={box.bottom} y2={box.bottom + TICK_LENGTH}
                    stroke={HAIRLINE(0.22)}
                />
            ))}
            {zoomed && detailed && (
                <>
                    <Markers events={zoomed.runnerEvents} x={x} cy={box.top - 18} color={RUNNER_SPEED_STROKE} run="runner" />
                    <Markers events={zoomed.referenceEvents} x={x} cy={box.top - 7} color={REFERENCE_SPEED_STROKE} run="reference" />
                    <AirLane spans={zoomed.runnerAir} x={x} top={box.bottom + 3} color={RUNNER_SPEED_STROKE} />
                    <AirLane spans={zoomed.referenceAir} x={x} top={box.bottom + 9} color={REFERENCE_SPEED_STROKE} />
                </>
            )}
            <g fontSize={10} fill={HAIRLINE(0.5)}>
                {readableTimeLabels(xAxis.ticks, x).map(tick => (
                    <text key={`xl${tick.ms}`} x={x(tick.ms)} y={height - 4} textAnchor="middle">
                        {tick.label}
                    </text>
                ))}
            </g>
            <g fontSize={9} fill={HAIRLINE(0.38)}>
                {sectors.map(sector => (
                    <text
                        key={`sl${sector.index}`}
                        x={(x(Math.max(t0, sector.startMs)) + x(Math.min(t1, sector.endMs))) / 2}
                        y={detailed ? box.top - 28 : box.top - 6}
                        textAnchor="middle"
                        role="button"
                        tabIndex={0}
                        aria-label={`Zoom to sector ${sector.index}`}
                        className="cursor-pointer hover:fill-foreground focus-visible:outline-none"
                        onClick={() => onZoomSector(sector.index)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                onZoomSector(sector.index)
                            }
                        }}
                    >
                        {sector.label}
                    </text>
                ))}
            </g>
            <rect
                x={box.left}
                y={box.top}
                width={box.right - box.left}
                height={box.bottom - box.top}
                fill="transparent"
                className="cursor-crosshair"
                onPointerDown={event => {
                    if (event.pointerType !== 'mouse' || event.button !== 0) return
                    event.currentTarget.setPointerCapture(event.pointerId)
                    const px = pointerX(event)
                    setDrag({ from: px, to: px })
                }}
                onPointerMove={event => {
                    if (drag) setDrag({ from: drag.from, to: pointerX(event) })
                }}
                onPointerUp={event => {
                    if (!drag) return
                    const to = pointerX(event)
                    setDrag(null)
                    if (Math.abs(to - drag.from) >= MIN_DRAG_PX) onZoomRange(msAt(drag.from), msAt(to))
                }}
                onPointerCancel={() => setDrag(null)}
                onDoubleClick={() => {
                    if (zoomed) onZoomOut()
                }}
            />
            {drag && Math.abs(drag.to - drag.from) >= MIN_DRAG_PX && (
                <rect
                    x={Math.min(drag.from, drag.to)}
                    y={box.top}
                    width={Math.abs(drag.to - drag.from)}
                    height={box.bottom - box.top}
                    fill={HAIRLINE(0.08)}
                    stroke={HAIRLINE(0.3)}
                    pointerEvents="none"
                />
            )}
        </svg>
    )
}
