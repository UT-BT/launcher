import { useMemo, useRef, type MouseEvent, type PointerEvent } from 'react'
import { ZoomOut } from 'lucide-react'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useElementSize } from '@/app/components/pages/capDetail/runDelta/chartFrame'
import { REFERENCE_SPEED_STROKE, RUNNER_SPEED_STROKE, SpeedPlot } from '@/app/components/pages/capDetail/runDelta/SpeedPlot'
import { SpeedTable } from '@/app/components/pages/capDetail/runDelta/SpeedTable'
import { rangeZoom, sectorZoom, zoomedSpeed, type SpeedZoom } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import { useRunMotion } from '@/app/components/pages/capDetail/runDelta/useRunMotion'
import type { SpeedModel } from '../model/analysisModel'
import type { PlaybackController } from '../playback/playbackController'
import { runName, RunIdentity } from './RunIdentity'

const CLICK_SLOP_PX = 6
const DIFFERENT_LINE_NOTE = 'Sectors marked with the split icon were run on a different line.'

interface SpeedViewProps {
    speed: SpeedModel
    controller: PlaybackController | null
    onChoose: (capId: string) => void
    onSector: (index: number) => void
}

export function SpeedView({ speed, controller, onChoose, onSector }: SpeedViewProps) {
    const { options, chosen, reference, pair, card } = speed
    const [storedZoom, setZoom] = useNavState<SpeedZoom | null>('compare.speedZoom', null)
    const zoom = storedZoom && storedZoom.pair === pair ? storedZoom : null
    const { motion, loading } = useRunMotion(chosen, reference?.capId ?? null, zoom !== null)
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)
    const pressX = useRef<number | null>(null)
    const duration = card?.chart.x.domainMs[1] ?? 0
    const zoomed = useMemo(
        () => (card && zoom ? zoomedSpeed(card.speed.chart, motion, zoom, duration) : null),
        [card, zoom, motion, duration],
    )
    const chosenRun = options.find(option => option.capId === chosen)

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
        setZoom(zoom?.sector === index ? null : sectorZoom(pair, card.chart.sectors, index))
        onSector(index)
    }

    return (
        <div
            className="run-compare-speed"
            onKeyDown={event => {
                if (event.key === 'Escape' && zoom) setZoom(null)
            }}
        >
            <div role="group" aria-label="Speed run" className="run-compare-speed-runs">
                {options.map(option => (
                    <button
                        key={option.capId}
                        type="button"
                        aria-pressed={option.capId === chosen}
                        aria-label={`Speed for ${runName(option.run)}`}
                        className="run-compare-speed-run"
                        onClick={() => onChoose(option.capId)}
                    >
                        <span className="run-compare-swatch" style={{ background: option.colour }} />
                        <RunIdentity run={option.run} presentation="full" />
                    </button>
                ))}
                {zoomed && (
                    <button type="button" className="run-compare-speed-run" onClick={() => setZoom(null)}>
                        <ZoomOut className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        Reset Zoom
                    </button>
                )}
            </div>
            {card && pair && chosenRun && reference && (
                <>
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
                                onZoomRange={(from, to) => setZoom(rangeZoom(pair, from, to, duration))}
                                onZoomSector={index => setZoom(sectorZoom(pair, card.chart.sectors, index))}
                                onZoomOut={() => setZoom(null)}
                            />
                        )}
                    </div>
                    <ul aria-label="Speed legend" className="run-compare-legend">
                        <li>
                            <span className="run-compare-legend-line" style={{ background: RUNNER_SPEED_STROKE }} />
                            <RunIdentity run={chosenRun.run} />
                        </li>
                        <li>
                            <span className="run-compare-legend-line" style={{ background: REFERENCE_SPEED_STROKE }} />
                            <RunIdentity run={reference} />
                        </li>
                        <li>Horizontal speed in UU/s over the reference&apos;s run time</li>
                        <li>{zoomed ? (loading ? 'Loading every sample…' : 'Press Esc or Reset Zoom to zoom out') : 'Pick a sector to zoom in'}</li>
                    </ul>
                    <SpeedTable
                        speed={card.speed}
                        differentLineNote={card.flagged ? DIFFERENT_LINE_NOTE : null}
                        selectedSector={zoom?.sector ?? null}
                        onSelectSector={selectSector}
                    />
                </>
            )}
        </div>
    )
}
