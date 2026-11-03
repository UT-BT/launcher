import { useRef, type MouseEvent } from 'react'
import { useElementSize } from '@/app/components/pages/capDetail/runDelta/chartFrame'
import { HAIRLINE } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { CapComparisonPoint } from '@/app/utils/api'
import type { CumulativeModel } from '../model/analysisModel'
import type { PlaybackController } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'

const INSET_PX = 6

interface Scale {
    x: (ms: number) => number
    y: (ms: number) => number
}

function pathOf(points: CapComparisonPoint[], { x, y }: Scale): string {
    return points.map(([t, delta], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(delta).toFixed(1)}`).join(' ')
}

function playheadOf(state: { t: number }): number {
    return state.t
}

function Playhead({ controller, endMs }: { controller: PlaybackController | null; endMs: number }) {
    const t = usePlaybackSelector(controller, playheadOf)
    const fraction = endMs > 0 ? Math.min(1, Math.max(0, (t * 1000) / endMs)) : 0
    return <span className="run-compare-playhead" style={{ left: `calc(${INSET_PX}px + ${fraction} * (100% - ${2 * INSET_PX}px))` }} />
}

interface CumulativeChartProps {
    cumulative: CumulativeModel
    controller: PlaybackController | null
}

export function CumulativeChart({ cumulative, controller }: CumulativeChartProps) {
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)
    const { endMs, domainMs: [lo, hi], gridMs, lines } = cumulative
    const span = Math.max(1, width - 2 * INSET_PX)
    const scale: Scale = {
        x: ms => INSET_PX + (Math.min(ms, endMs) / Math.max(1, endMs)) * span,
        y: ms => ((hi - ms) / Math.max(1, hi - lo)) * height,
    }

    const seek = (event: MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        if (!controller || endMs <= 0 || rect.width <= 2 * INSET_PX) return
        const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left - INSET_PX) / (rect.width - 2 * INSET_PX)))
        controller.seek((fraction * endMs) / 1000)
    }

    return (
        <div ref={plotRef} className="run-compare-cumulative" onClick={seek}>
            {width > 0 && height > 0 && (
                <svg width={width} height={height} role="img" aria-label="Gap of each run to its reference over its own run time">
                    {gridMs.map(ms => (
                        <line key={`g${ms}`} x1={0} x2={width} y1={scale.y(ms)} y2={scale.y(ms)} stroke={HAIRLINE(0.06)} strokeDasharray="3 3" />
                    ))}
                    {lines.flatMap(line => line.bands.map(band => {
                        const x0 = scale.x(band.startMs)
                        return (
                            <rect
                                key={`band${line.capId}${band.startMs}`}
                                x={x0}
                                y={0}
                                width={Math.max(3, scale.x(band.endMs) - x0)}
                                height={height}
                                fill={line.colour}
                                fillOpacity={0.08}
                            />
                        )
                    }))}
                    <line x1={0} x2={width} y1={scale.y(0)} y2={scale.y(0)} stroke={HAIRLINE(0.3)} strokeDasharray="4 4" />
                    {lines.flatMap(line => line.bands.map(({ connector: [from, to] }) => (
                        <line
                            key={`con${line.capId}${from[0]}`}
                            x1={scale.x(from[0])} y1={scale.y(from[1])}
                            x2={scale.x(to[0])} y2={scale.y(to[1])}
                            stroke={line.colour} strokeWidth={1.5} strokeDasharray="2 3"
                        />
                    )))}
                    {lines.map(line => (
                        <g key={line.capId} data-run={line.capId} stroke={line.colour} fill={line.colour}>
                            {line.segments.map((points, i) => (
                                <path key={i} d={pathOf(points, scale)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            ))}
                            {line.dots.map(([t, delta]) => (
                                <circle key={t} cx={scale.x(t)} cy={scale.y(delta)} r={2.5} stroke="none" />
                            ))}
                            <circle cx={scale.x(line.cap[0])} cy={scale.y(line.cap[1])} r={4} stroke="var(--color-card)" strokeWidth={1} />
                        </g>
                    ))}
                </svg>
            )}
            <Playhead controller={controller} endMs={endMs} />
        </div>
    )
}
