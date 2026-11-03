import { useRef, type PointerEvent } from 'react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { HAIRLINE, TONE_AREA, TONE_STROKE } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { CapComparisonPoint } from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { Lane } from '../model/laneModel'
import { formatRaceTime } from '../model/raceModel'
import type { PlaybackController } from '../playback/playbackController'

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 100
const TOUCH_SLOP_PX = 8

interface LaneScale {
    x: (ms: number) => number
    y: (ms: number) => number
}

function scaleOf(lane: Lane, endMs: number): LaneScale {
    const [lo, hi] = lane.domainMs
    return {
        x: ms => (Math.min(ms, endMs) / Math.max(1, endMs)) * VIEW_WIDTH,
        y: ms => ((hi - ms) / Math.max(1, hi - lo)) * VIEW_HEIGHT,
    }
}

function pathOf(points: CapComparisonPoint[], { x, y }: LaneScale, close = false): string {
    const d = points.map(([t, delta], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(delta).toFixed(1)}`).join(' ')
    return close ? `${d} Z` : d
}

function percent(value: number, of: number): string {
    return `${(value / of) * 100}%`
}

function seekFrom(event: PointerEvent<HTMLElement>, controller: PlaybackController | null, end: number) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!controller || rect.width <= 0) return
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    controller.seek(fraction * end)
}

type LaneGesture =
    | { kind: 'touch'; pointerId: number; x: number; y: number }
    | { kind: 'scrub'; pointerId: number }

function isSideways(gesture: { x: number; y: number }, event: PointerEvent<HTMLElement>): boolean {
    const dx = Math.abs(event.clientX - gesture.x)
    return dx >= TOUCH_SLOP_PX && dx > Math.abs(event.clientY - gesture.y)
}

interface PlotProps {
    lane: Lane
    controller: PlaybackController | null
    end: number
}

function LanePlot({ lane, controller, end }: PlotProps) {
    const endMs = end * 1000
    const scale = scaleOf(lane, endMs)
    const zero = scale.y(0)
    const capped = endMs > 0 && lane.capMs <= endMs
    const gesture = useRef<LaneGesture | null>(null)

    const beginScrub = (event: PointerEvent<HTMLElement>) => {
        if (!controller) return
        gesture.current = { kind: 'scrub', pointerId: event.pointerId }
        event.currentTarget.setPointerCapture(event.pointerId)
        controller.beginScrub()
        seekFrom(event, controller, end)
    }

    return (
        <div
            className="run-compare-lane-plot"
            onPointerDown={event => {
                if (!controller || end <= 0 || !event.isPrimary) return
                if (event.pointerType === 'touch') {
                    gesture.current = { kind: 'touch', pointerId: event.pointerId, x: event.clientX, y: event.clientY }
                } else if (event.button === 0) {
                    beginScrub(event)
                }
            }}
            onPointerMove={event => {
                const current = gesture.current
                if (current?.pointerId !== event.pointerId) return
                if (current.kind === 'scrub') seekFrom(event, controller, end)
                else if (isSideways(current, event)) beginScrub(event)
            }}
            onPointerUp={event => {
                const current = gesture.current
                if (current?.kind !== 'touch' || current.pointerId !== event.pointerId) return
                gesture.current = null
                seekFrom(event, controller, end)
            }}
            onPointerCancel={event => {
                if (gesture.current?.kind === 'touch' && gesture.current.pointerId === event.pointerId) gesture.current = null
            }}
            onLostPointerCapture={event => {
                if (gesture.current?.kind !== 'scrub' || gesture.current.pointerId !== event.pointerId) return
                gesture.current = null
                controller?.endScrub()
            }}
        >
            <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                {lane.bands.map(band => (
                    <rect
                        key={`band${band.startMs}`}
                        x={scale.x(band.startMs)}
                        y={0}
                        width={Math.max(2, scale.x(band.endMs) - scale.x(band.startMs))}
                        height={VIEW_HEIGHT}
                        fill={HAIRLINE(0.08)}
                    />
                ))}
                {lane.curves.map((curve, i) => (
                    <path key={`a${i}`} d={pathOf(curve.area, scale, true)} fill={TONE_AREA[curve.tone]} stroke="none" />
                ))}
                <line
                    x1={0} x2={scale.x(Math.min(lane.capMs, endMs))} y1={zero} y2={zero}
                    stroke={HAIRLINE(0.3)} strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
                />
                {lane.bands.map(band => (
                    <line
                        key={`con${band.startMs}`}
                        x1={scale.x(band.connector[0][0])} y1={scale.y(band.connector[0][1])}
                        x2={scale.x(band.connector[1][0])} y2={scale.y(band.connector[1][1])}
                        stroke={HAIRLINE(0.45)} strokeWidth={1.5} strokeDasharray="2 3" vectorEffect="non-scaling-stroke"
                    />
                ))}
                {lane.curves.map((curve, i) => (
                    <path
                        key={`c${i}`}
                        d={pathOf(curve.points, scale)}
                        fill="none"
                        stroke={TONE_STROKE[curve.tone]}
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </svg>
            {lane.marks && lane.marks.length > 0 && (
                <ol aria-label="Crossings" className="run-compare-lane-marks">
                    {lane.marks.map(mark => (
                        <li
                            key={`${mark.kind}:${mark.label}`}
                            className={cn('run-compare-lane-mark', mark.kind === 'cap' && 'is-cap')}
                            style={{ left: percent(scale.x(mark.atMs), VIEW_WIDTH) }}
                        >
                            <span className="sr-only">{`${mark.label} at ${formatRaceTime(mark.atMs / 1000)}`}</span>
                        </li>
                    ))}
                </ol>
            )}
            {capped && (
                <span
                    className="run-compare-lane-cap"
                    style={{
                        left: percent(scale.x(lane.capMs), VIEW_WIDTH),
                        top: percent(scale.y(lane.finalGap.ms), VIEW_HEIGHT),
                        background: TONE_STROKE[lane.finalGap.tone],
                    }}
                />
            )}
        </div>
    )
}

function LaneLabel({ lane }: { lane: Lane }) {
    const { run } = lane
    return (
        <div className="run-compare-lane-label run-compare-row">
            <PlayerInfo userId={run.user} alias={run.alias} title={run.title} size="sm" className="min-w-0" />
            <span className="font-mono tabular-nums text-foreground">{formatRaceTime(run.timeSeconds)}</span>
            {lane.reference && <span className="run-compare-badge is-reference">REF</span>}
            {lane.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
        </div>
    )
}

interface DeltaLanesProps {
    lanes: readonly Lane[]
    controller: PlaybackController | null
    end: number
}

export function DeltaLanes({ lanes, controller, end }: DeltaLanesProps) {
    if (lanes.length === 0) return null
    return (
        <ol aria-label="Lanes" className="run-compare-lanes">
            {lanes.map(lane => (
                <li key={lane.capId} className="run-compare-track run-compare-lane">
                    <LaneLabel lane={lane} />
                    <LanePlot lane={lane} controller={controller} end={end} />
                </li>
            ))}
        </ol>
    )
}
