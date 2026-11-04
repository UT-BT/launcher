import { useCallback, useRef, type PointerEvent } from 'react'
import { useElementSize } from '@/app/components/pages/capDetail/runDelta/chartFrame'
import { formatGapTick } from '@/app/components/pages/capDetail/runDelta/chartRules'
import type { SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { HAIRLINE, TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { CapComparisonPoint } from '@/app/utils/api'
import { cn } from '@/lib/utils'
import { RunIdentity } from '../analysis/RunIdentity'
import type { CuePoint } from '../model/cueModel'
import type { GapGraph as GapGraphModel, GapSeries } from '../model/gapGraphModel'
import { liveDelta, SIDE_TAGS } from '../model/laneModel'
import { sameTeamDelta, teamDeltaAt } from '../model/teamVersus'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { SideTag } from '../stage/Tags'
import { TeamLabel } from '../stage/TeamLabel'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'

const TOUCH_SLOP_PX = 8
const PAD_PX = 6

interface Scale {
    x: (ms: number) => number
    y: (ms: number) => number
}

type Gesture =
    | { kind: 'touch'; pointerId: number; x: number; y: number }
    | { kind: 'scrub'; pointerId: number }

function pathOf(points: CapComparisonPoint[], { x, y }: Scale): string {
    return points.map(([t, delta], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(delta).toFixed(1)}`).join(' ')
}

function gapAt(line: GapSeries, state: PlaybackState): SignedGap | null {
    if (line.lane.reference) return null
    if (line.row) return teamDeltaAt(line.row, state)
    return liveDelta(line.lane, state.runTimes[line.key] ?? state.t)?.gap ?? null
}

function KeyGap({ line, controller }: { line: GapSeries; controller: PlaybackController | null }) {
    const select = useCallback((state: PlaybackState) => gapAt(line, state), [line])
    const gap = usePlaybackSelector(controller, select, sameTeamDelta)
    if (line.lane.reference) return <span className="run-compare-gap-key-baseline">Baseline</span>
    return <span className={cn('run-compare-gap-key-value font-mono tabular-nums', gap ? TONE_TEXT[gap.tone] : 'text-muted-foreground')}>{gap?.label ?? '–'}</span>
}

function KeyEntry({ line, controller }: { line: GapSeries; controller: PlaybackController | null }) {
    const { lane, row } = line
    return (
        <li className={cn('run-compare-gap-key-entry', lane.reference && 'is-baseline')}>
            <span
                aria-hidden
                className={cn('run-compare-gap-key-mark', lane.reference && 'is-baseline', !lane.reference && !line.drawn && 'is-hollow')}
                style={lane.reference ? undefined : { borderColor: line.colour, background: line.drawn ? line.colour : undefined }}
            />
            {row ? <TeamLabel row={row} withTitle={false} className="min-w-0" /> : <RunIdentity run={lane.run} withTitle={false} />}
            {!row && <SideTag side={lane.run.side} label={lane.sideLabel} />}
            <span className="run-compare-gap-key-fill" />
            <KeyGap line={line} controller={controller} />
        </li>
    )
}

function playheadOf(state: PlaybackState): number {
    return state.t
}

interface Mark {
    key: string
    colour: string
    ms: number
}

function sameMarks(a: readonly Mark[], b: readonly Mark[]): boolean {
    return a.length === b.length && a.every((mark, i) => mark.key === b[i].key && mark.ms === b[i].ms)
}

function Playhead({ controller, end, lines, y }: { controller: PlaybackController | null; end: number; lines: readonly GapSeries[]; y: (ms: number) => number }) {
    const t = usePlaybackSelector(controller, playheadOf)
    const select = useCallback(
        (state: PlaybackState) => lines.flatMap((line): Mark[] => {
            const gap = gapAt(line, state)
            return gap ? [{ key: line.key, colour: line.colour, ms: gap.ms }] : []
        }),
        [lines],
    )
    const marks = usePlaybackSelector(controller, select, sameMarks)
    const fraction = end > 0 ? Math.min(1, Math.max(0, t / end)) : 0
    return (
        <span aria-hidden className="run-compare-gap-playhead" style={{ left: `${fraction * 100}%` }}>
            {marks.map(mark => (
                <span key={mark.key} className="run-compare-gap-mark" style={{ top: y(mark.ms), background: mark.colour }} />
            ))}
        </span>
    )
}

function seekFrom(event: PointerEvent<HTMLElement>, controller: PlaybackController | null, end: number) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!controller || rect.width <= 0) return
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    controller.seek(fraction * end)
}

function isSideways(gesture: { x: number; y: number }, event: PointerEvent<HTMLElement>): boolean {
    const dx = Math.abs(event.clientX - gesture.x)
    return dx >= TOUCH_SLOP_PX && dx > Math.abs(event.clientY - gesture.y)
}

interface PlotProps {
    graph: GapGraphModel
    controller: PlaybackController | null
    end: number
    sectors: readonly CuePoint[]
}

function Plot({ graph, controller, end, sectors }: PlotProps) {
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)
    const gesture = useRef<Gesture | null>(null)
    const endMs = end * 1000
    const [lo, hi] = graph.domainMs
    const scale: Scale = {
        x: ms => (Math.min(ms, endMs) / Math.max(1, endMs)) * width,
        y: ms => PAD_PX + ((hi - ms) / Math.max(1, hi - lo)) * Math.max(1, height - 2 * PAD_PX),
    }
    const stepMs = graph.gridMs.length > 1 ? graph.gridMs[1] - graph.gridMs[0] : 1000
    const drawn = graph.series.filter(line => line.drawn)

    const beginScrub = (event: PointerEvent<HTMLElement>) => {
        if (!controller) return
        gesture.current = { kind: 'scrub', pointerId: event.pointerId }
        event.currentTarget.setPointerCapture(event.pointerId)
        controller.beginScrub()
        seekFrom(event, controller, end)
    }

    return (
        <div
            ref={plotRef}
            className="run-compare-gap-plot"
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
            {width > 0 && height > 0 && endMs > 0 && (
                <svg width={width} height={height} aria-hidden="true">
                    {sectors.map(point => (
                        <line key={point.key} x1={scale.x(point.atMs)} x2={scale.x(point.atMs)} y1={0} y2={height} stroke={HAIRLINE(0.06)} />
                    ))}
                    {graph.gridMs.filter(ms => ms !== 0).map(ms => (
                        <line key={`g${ms}`} x1={0} x2={width} y1={scale.y(ms)} y2={scale.y(ms)} stroke={HAIRLINE(0.06)} strokeDasharray="3 3" />
                    ))}
                    {drawn.flatMap(line => line.bands.map(band => {
                        const x0 = scale.x(band.startMs)
                        return (
                            <rect
                                key={`band${line.key}${band.startMs}`}
                                x={x0}
                                y={0}
                                width={Math.max(3, scale.x(band.endMs) - x0)}
                                height={height}
                                fill={line.colour}
                                fillOpacity={0.08}
                            />
                        )
                    }))}
                    <line x1={0} x2={width} y1={scale.y(0)} y2={scale.y(0)} stroke={HAIRLINE(0.35)} strokeDasharray="4 4" />
                    {drawn.flatMap(line => line.bands.map(({ connector: [from, to] }) => (
                        <line
                            key={`con${line.key}${from[0]}`}
                            x1={scale.x(from[0])} y1={scale.y(from[1])}
                            x2={scale.x(to[0])} y2={scale.y(to[1])}
                            stroke={line.colour} strokeWidth={1.5} strokeDasharray="2 3"
                        />
                    )))}
                    {drawn.map(line => (
                        <g key={line.key} data-run={line.key} stroke={line.colour} fill={line.colour}>
                            {line.segments.map((points, i) => (
                                <path key={i} d={pathOf(points, scale)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            ))}
                            {line.dots.map(([t, delta]) => (
                                <circle key={t} cx={scale.x(t)} cy={scale.y(delta)} r={2.25} stroke="none" />
                            ))}
                            <circle cx={scale.x(line.cap[0])} cy={scale.y(line.cap[1])} r={3.5} stroke="var(--color-card)" strokeWidth={1} />
                        </g>
                    ))}
                </svg>
            )}
            <ol aria-hidden="true" className="run-compare-gap-ticks font-mono tabular-nums">
                {height > 0 && graph.gridMs.map(ms => (
                    <li key={ms} style={{ top: scale.y(ms) }}>{formatGapTick(ms, stepMs)}</li>
                ))}
            </ol>
            {height > 0 && <Playhead controller={controller} end={end} lines={drawn} y={scale.y} />}
        </div>
    )
}

interface GapGraphProps {
    graph: GapGraphModel
    controller: PlaybackController | null
    end: number
    sectors: readonly CuePoint[]
}

function elsewhereNote(graph: GapGraphModel): string | null {
    if (graph.elsewhere.length === 0) return null
    return graph.elsewhere
        .map(option => `${option.runs} ${SIDE_TAGS[option.side].toLowerCase()} ${option.runs === 1 ? 'run' : 'runs'} on the other route`)
        .join(' · ')
}

export function GapGraph({ graph, controller, end, sectors }: GapGraphProps) {
    const note = elsewhereNote(graph)
    if (!graph.series.some(line => line.drawn || line.pending)) {
        return note ? <p className="run-compare-gap-alone">Red and blue take different routes, so these runs are compared by their final times.</p> : null
    }
    return (
        <div className="run-compare-gap-graph">
            <div className="run-compare-gap-side">
                <ol aria-label="Gap to the baseline" className="run-compare-gap-key">
                    {graph.series.map(line => <KeyEntry key={line.key} line={line} controller={controller} />)}
                </ol>
                {note && <p className="run-compare-gap-elsewhere">{note}</p>}
            </div>
            <Plot graph={graph} controller={controller} end={end} sectors={sectors} />
        </div>
    )
}
