import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementSize } from '@/app/components/pages/capDetail/runDelta/chartFrame'
import { HAIRLINE } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { REFERENCE_SPEED_STROKE, RUNNER_SPEED_STROKE, SPEED_PLOT_INSET } from '@/app/components/pages/capDetail/runDelta/SpeedPlot'
import type { SpeedChart } from '@/app/components/pages/capDetail/runDelta/runSpeed'
import type { SpeedZoom } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import type { CapComparisonSpeedPoint } from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { resizedWindow, runMsOf, shiftedWindow, spanOf, windowAround } from '../model/speedWindow'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'

const HANDLE_PX = 8
const KEY_STEP = 0.1
const PAD_Y = 4

type Drag = { kind: 'move' | 'start' | 'end'; pointerId: number; originMs: number; zoom: SpeedZoom }

function pathOf(points: CapComparisonSpeedPoint[], x: (ms: number) => number, y: (speed: number) => number): string {
    return points.map(([t, speed], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(speed).toFixed(1)}`).join(' ')
}

function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)} s`
}

interface SpeedPlayheadProps {
    controller: PlaybackController | null
    referenceId: string
    domainMs: [number, number]
    className?: string
}

export function SpeedPlayhead({ controller, referenceId, domainMs: [t0, t1], className }: SpeedPlayheadProps) {
    const select = useCallback((state: PlaybackState) => runMsOf(state, referenceId), [referenceId])
    const ms = usePlaybackSelector(controller, select)
    if (ms < t0 || ms > t1) return null
    const fraction = (ms - t0) / Math.max(1, t1 - t0)
    const { left, right } = SPEED_PLOT_INSET
    return <span aria-hidden="true" className={cn('run-compare-playhead', className)} style={{ left: `calc(${left}px + ${fraction} * (100% - ${left + right}px))` }} />
}

interface SpeedOverviewProps {
    chart: SpeedChart
    boundariesMs: number[]
    pair: string
    window: SpeedZoom | null
    defaultSpanMs: number
    controller: PlaybackController | null
    referenceId: string
    onWindow: (zoom: SpeedZoom | null) => void
}

export function SpeedOverview({ chart, boundariesMs, pair, window: shown, defaultSpanMs, controller, referenceId, onWindow }: SpeedOverviewProps) {
    const frameRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(frameRef)
    const [drag, setDrag] = useState<Drag | null>(null)
    const [, durationMs] = chart.x.domainMs
    const [, top] = chart.y.domain
    const { left, right } = SPEED_PLOT_INSET
    const span = Math.max(1, width - left - right)
    const x = (ms: number) => left + (ms / Math.max(1, durationMs)) * span
    const y = (speed: number) => height - PAD_Y - (speed / Math.max(1, top)) * Math.max(1, height - 2 * PAD_Y)

    const msAt = (clientX: number) => {
        const rect = frameRef.current?.getBoundingClientRect()
        if (!rect) return 0
        return Math.min(durationMs, Math.max(0, ((clientX - rect.left - left) / span) * durationMs))
    }

    const begin = (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || durationMs <= 0) return
        const ms = msAt(event.clientX)
        const px = x(ms)
        let zoom = shown
        let kind: Drag['kind'] = 'move'
        if (zoom && Math.abs(px - x(zoom.startMs)) <= HANDLE_PX) kind = 'start'
        else if (zoom && Math.abs(px - x(zoom.endMs)) <= HANDLE_PX) kind = 'end'
        else if (!zoom || ms < zoom.startMs || ms > zoom.endMs) {
            zoom = windowAround(pair, ms, zoom ? spanOf(zoom, durationMs) : defaultSpanMs, durationMs)
            onWindow(zoom)
        }
        if (!zoom) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ kind, pointerId: event.pointerId, originMs: ms, zoom })
    }

    const move = (event: PointerEvent<HTMLDivElement>) => {
        if (!drag || drag.pointerId !== event.pointerId) return
        const ms = msAt(event.clientX)
        onWindow(drag.kind === 'move' ? shiftedWindow(drag.zoom, ms - drag.originMs, durationMs) : resizedWindow(drag.zoom, drag.kind, ms, durationMs))
    }

    const end = (event: PointerEvent<HTMLDivElement>) => {
        if (drag?.pointerId === event.pointerId) setDrag(null)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = (shown ? spanOf(shown, durationMs) : defaultSpanMs) * KEY_STEP
        const moves: Record<string, () => SpeedZoom | null> = {
            ArrowLeft: () => (shown ? shiftedWindow(shown, -step, durationMs) : null),
            ArrowRight: () => (shown ? shiftedWindow(shown, step, durationMs) : null),
            Home: () => (shown ? shiftedWindow(shown, -durationMs, durationMs) : null),
            End: () => (shown ? shiftedWindow(shown, durationMs, durationMs) : null),
        }
        const next = moves[event.key]?.()
        if (!next) return
        event.preventDefault()
        onWindow(next)
    }

    return (
        <div
            ref={frameRef}
            role="slider"
            tabIndex={0}
            aria-label="Zoomed part of the run"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationMs)}
            aria-valuenow={Math.round(shown?.startMs ?? 0)}
            aria-valuetext={shown ? `${seconds(shown.startMs)} to ${seconds(shown.endMs)}` : 'Whole run'}
            className={cn('run-compare-speed-overview', drag && 'is-dragging')}
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={onKeyDown}
        >
            {width > 0 && height > 0 && (
                <svg width={width} height={height} aria-hidden="true">
                    {boundariesMs.map(ms => (
                        <line key={ms} x1={x(ms)} x2={x(ms)} y1={0} y2={height} stroke={HAIRLINE(0.08)} />
                    ))}
                    {chart.reference.map((segment, i) => (
                        <path key={`r${i}`} d={pathOf(segment, x, y)} fill="none" stroke={REFERENCE_SPEED_STROKE} strokeWidth={1} strokeLinejoin="round" />
                    ))}
                    {chart.runner.map((segment, i) => (
                        <path key={`s${i}`} d={pathOf(segment, x, y)} fill="none" stroke={RUNNER_SPEED_STROKE} strokeWidth={1.25} strokeLinejoin="round" />
                    ))}
                    {shown && (
                        <>
                            <rect x={left} y={0} width={Math.max(0, x(shown.startMs) - left)} height={height} fill="var(--color-card)" fillOpacity={0.6} />
                            <rect x={x(shown.endMs)} y={0} width={Math.max(0, left + span - x(shown.endMs))} height={height} fill="var(--color-card)" fillOpacity={0.6} />
                            <rect
                                className="run-compare-speed-brush"
                                x={x(shown.startMs)}
                                y={0.5}
                                width={Math.max(2, x(shown.endMs) - x(shown.startMs))}
                                height={height - 1}
                                rx={3}
                            />
                            <rect className="run-compare-speed-handle" x={x(shown.startMs) - 2} y={height / 2 - 7} width={4} height={14} rx={2} />
                            <rect className="run-compare-speed-handle" x={x(shown.endMs) - 2} y={height / 2 - 7} width={4} height={14} rx={2} />
                        </>
                    )}
                </svg>
            )}
            <SpeedPlayhead controller={controller} referenceId={referenceId} domainMs={chart.x.domainMs} />
        </div>
    )
}
