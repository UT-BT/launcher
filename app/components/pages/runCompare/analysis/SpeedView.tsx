import { useCallback, useMemo, useRef, type MouseEvent, type PointerEvent } from 'react'
import { LocateFixed, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useElementSize } from '@/app/components/pages/capDetail/runDelta/chartFrame'
import { markerPath, REFERENCE_SPEED_STROKE, RUNNER_SPEED_STROKE, SpeedPlot } from '@/app/components/pages/capDetail/runDelta/SpeedPlot'
import { SpeedTable } from '@/app/components/pages/capDetail/runDelta/SpeedTable'
import { rangeZoom, sectorZoom, zoomedSpeed, type SpeedZoom, type ZoomedSpeed } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import { useRunMotion } from '@/app/components/pages/capDetail/runDelta/useRunMotion'
import type { CapMotionEvent } from '@/app/utils/api'
import { cn } from '@/lib/utils'
import type { SpeedModel } from '../model/analysisModel'
import { canZoomIn, followSpanMs, followStep, runMsOf, windowAround, zoomStep } from '../model/speedWindow'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'
import { runName, RunIdentity } from './RunIdentity'
import { SpeedOverview, SpeedPlayhead } from './SpeedOverview'

const CLICK_SLOP_PX = 6
const DIFFERENT_LINE_NOTE = 'Sectors with the split icon took another line.'
const POINTER_HINT = 'Drag across the chart or pick a sector to see every sample, like dodges and jumps'
const TOUCH_HINT = 'Tap the strip to see every sample'

const MARKERS: { label: string; event: CapMotionEvent }[] = [
    { label: 'Dodge, pointing its way', event: { t_ms: 0, kind: 'dodge', direction: 'F' } },
    { label: 'Jump', event: { t_ms: 0, kind: 'jump', direction: null } },
    { label: 'Kicker', event: { t_ms: 0, kind: 'kick', direction: null } },
]

function DetailKey({ zoomed, loading }: { zoomed: ZoomedSpeed | null; loading: boolean }) {
    if (!zoomed) return null
    if (loading) return <li>Loading every sample…</li>
    if (!zoomed.detailed) return <li>Sample detail unavailable, showing the smoothed speed</li>
    return (
        <>
            <li className="text-foreground">Every sample</li>
            {MARKERS.map(({ label, event }) => (
                <li key={label}>
                    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true"><path d={markerPath(event, 5, 5)} fill="currentColor" /></svg>
                    {label}
                </li>
            ))}
            <li><span className="run-compare-speed-air" />In the air</li>
        </>
    )
}

interface SpeedViewProps {
    speed: SpeedModel
    controller: PlaybackController | null
    onChoose: (capId: string) => void
    onSector: (index: number) => void
    heading?: 'h2' | 'h3'
}

export function SpeedView({ speed, controller, onChoose, onSector, heading: Heading = 'h2' }: SpeedViewProps) {
    const { options, chosen, reference, pair, card } = speed
    const [storedZoom, setStoredZoom] = useNavState<SpeedZoom | null>('compare.speedZoom', null)
    const [storedFollow, setFollow] = useNavState<boolean>('compare.speedFollow', false)
    const stored = storedZoom && storedZoom.pair === pair ? storedZoom : null
    const duration = card?.chart.x.domainMs[1] ?? 0
    const referenceId = reference?.capId ?? null
    const follow = storedFollow && pair !== null && referenceId !== null && duration > 0
    const span = followSpanMs(stored, duration)
    const selectFollow = useCallback(
        (state: PlaybackState) => (follow && referenceId ? followStep(runMsOf(state, referenceId)) : null),
        [follow, referenceId],
    )
    const followMs = usePlaybackSelector(controller, selectFollow)
    const zoom = useMemo(
        () => (follow && pair && followMs !== null ? windowAround(pair, followMs, span, duration) : stored),
        [follow, pair, followMs, span, duration, stored],
    )
    const { motion, loading } = useRunMotion(chosen, referenceId, zoom !== null)
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)
    const pressX = useRef<number | null>(null)
    const zoomed = useMemo(
        () => (card && zoom ? zoomedSpeed(card.speed.chart, motion, zoom, duration) : null),
        [card, zoom, motion, duration],
    )
    const chosenRun = options.find(option => option.capId === chosen)

    const playheadMs = () => (controller && referenceId ? runMsOf(controller.getState(), referenceId) : duration / 2)

    const choose = (next: SpeedZoom | null) => {
        setFollow(false)
        setStoredZoom(next)
    }

    const wholeRun = () => choose(null)

    const step = (direction: 'in' | 'out') => {
        if (!pair) return
        const next = zoomStep(pair, zoom, direction, playheadMs(), duration)
        if (next === null) wholeRun()
        else setStoredZoom(next)
    }

    const toggleFollow = () => {
        if (!pair) return
        if (follow) {
            choose(zoom)
            return
        }
        if (!stored) setStoredZoom(windowAround(pair, playheadMs(), followSpanMs(null, duration), duration))
        setFollow(true)
    }

    const seek = (event: MouseEvent<HTMLDivElement>) => {
        const moved = pressX.current === null || Math.abs(event.clientX - pressX.current) >= CLICK_SLOP_PX
        if (!controller || !card || moved || !(event.target instanceof SVGRectElement) || event.target.getAttribute('fill') !== 'transparent') return
        const rect = event.target.getBoundingClientRect()
        const [t0, t1] = (zoomed ?? card.speed.chart).x.domainMs
        const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)))
        controller.seek((t0 + fraction * (t1 - t0)) / 1000)
    }

    const selectSector = (index: number) => {
        if (!card || !pair) return
        choose(zoom?.sector === index ? null : sectorZoom(pair, card.chart.sectors, index))
        onSector(index)
    }

    return (
        <div
            className="run-compare-panel run-compare-speed"
            onKeyDown={event => {
                if (event.key === 'Escape' && zoom) wholeRun()
            }}
        >
            <div className="run-compare-panel-head">
                <Heading>Speed</Heading>
                <div className="run-compare-speed-runs">
                    <div role="group" aria-label="Speed run" className="run-compare-segmented">
                        {options.map(option => (
                            <button
                                key={option.capId}
                                type="button"
                                aria-pressed={option.capId === chosen}
                                aria-label={`Speed for ${runName(option.run)}`}
                                className="run-compare-segment"
                                onClick={() => onChoose(option.capId)}
                            >
                                <span className="run-compare-swatch" style={{ background: option.colour }} />
                                <RunIdentity run={option.run} withTitle={false} />
                            </button>
                        ))}
                    </div>
                    {reference && <span className="run-compare-speed-versus">vs {runName(reference)}</span>}
                </div>
                {card && pair && (
                    <div role="group" aria-label="Speed zoom" className="run-compare-speed-tools">
                        <button type="button" aria-label="Zoom In" title="Zoom In" className="run-compare-speed-tool" disabled={!canZoomIn(zoom, duration)} onClick={() => step('in')}>
                            <ZoomIn className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Zoom Out" title="Zoom Out" className="run-compare-speed-tool" disabled={!zoom} onClick={() => step('out')}>
                            <ZoomOut className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button type="button" className="run-compare-speed-tool" disabled={!zoom} onClick={wholeRun}>
                            <Maximize2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            Whole Run
                        </button>
                        <button type="button" aria-pressed={follow} className={cn('run-compare-speed-tool', follow && 'is-on')} onClick={toggleFollow}>
                            <LocateFixed className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            Follow Video
                        </button>
                    </div>
                )}
            </div>
            {card && pair && chosenRun && reference && (
                <div className="run-compare-panel-body">
                    <div
                        ref={plotRef}
                        className="run-compare-speed-plot"
                        onPointerDown={(event: PointerEvent<HTMLDivElement>) => { pressX.current = event.clientX }}
                        onClick={seek}
                    >
                        {width > 0 && height > 0 && (
                            <SpeedPlot
                                chart={card.speed.chart}
                                zoomed={zoomed}
                                frame={card.chart}
                                width={width}
                                height={height}
                                description={`Horizontal speed of ${runName(chosenRun.run)} against ${runName(reference)}`}
                                names={{ runner: runName(chosenRun.run), reference: runName(reference) }}
                                onZoomRange={(from, to) => choose(rangeZoom(pair, from, to, duration))}
                                onZoomSector={index => choose(sectorZoom(pair, card.chart.sectors, index))}
                                onZoomOut={wholeRun}
                            />
                        )}
                        <SpeedPlayhead controller={controller} referenceId={reference.capId} domainMs={(zoomed ?? card.speed.chart).x.domainMs} className="run-compare-speed-playhead" />
                        {!zoom && (
                            <p className="run-compare-speed-hint">
                                <ZoomIn className="size-3.5 flex-none" strokeWidth={2} aria-hidden="true" />
                                <span className="is-pointer">{POINTER_HINT}</span>
                                <span className="is-touch">{TOUCH_HINT}</span>
                            </p>
                        )}
                    </div>
                    <SpeedOverview
                        chart={card.speed.chart}
                        boundariesMs={card.chart.boundariesMs}
                        pair={pair}
                        window={zoom}
                        defaultSpanMs={followSpanMs(null, duration)}
                        controller={controller}
                        referenceId={reference.capId}
                        onWindow={choose}
                    />
                    <ul aria-label="Speed legend" className="run-compare-legend">
                        <li>
                            <span className="run-compare-legend-line" style={{ background: RUNNER_SPEED_STROKE }} />
                            <RunIdentity run={chosenRun.run} withTitle={false} />
                        </li>
                        <li>
                            <span className="run-compare-legend-line" style={{ background: REFERENCE_SPEED_STROKE }} />
                            <RunIdentity run={reference} withTitle={false} />
                        </li>
                        <li>Horizontal speed in UU/s over the baseline&apos;s run time</li>
                        <DetailKey zoomed={zoomed} loading={loading} />
                    </ul>
                    <SpeedTable
                        speed={card.speed}
                        differentLineNote={card.flagged ? DIFFERENT_LINE_NOTE : null}
                        selectedSector={zoom?.sector ?? null}
                        onSelectSector={selectSector}
                    />
                </div>
            )}
        </div>
    )
}
