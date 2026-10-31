import { useMemo, useRef } from 'react'
import { Split, ZoomOut } from 'lucide-react'
import { DELTA_COLORS } from '@/app/components/pages/capDetail/capStats'
import type { CapComparisonMotion, CapComparisonPoint, CapMotionEvent } from '@/app/utils/api'
import {
    DeltaAxisMarks,
    DeltaGrid,
    TICK_LENGTH,
    deltaScale,
    readableTimeLabels,
    useElementSize,
    type PlotBox,
} from './chartFrame'
import { ChartViewToggle, type ChartView } from './ChartViewToggle'
import { HAIRLINE, TONE_AREA, TONE_STROKE } from './deltaStyles'
import type { ReplayCard, RunDeltaChart as RunDeltaChartModel } from './runDeltaCard'
import { SectorBarsPlot } from './SectorBarsPlot'
import { REFERENCE_SPEED_STROKE, RUNNER_SPEED_STROKE, RUN_CAP_UU_S, STRAFE_DODGE_UU_S, SpeedPlot, markerPath } from './SpeedPlot'
import { rangeZoom, sectorZoom, zoomedSpeed, type SpeedZoom, type ZoomedSpeed } from './speedZoom'
import { SPEED_SPLIT_NOTE } from './runDeltaCopy'

const MARGIN = { left: 52, right: 16, top: 18, bottom: 22 }
const MIN_BAND_PX = 3
const VIEW_TITLES: Record<ChartView, string> = { cumulative: 'Cumulative', sectors: 'Per sector', speed: 'Speed' }

export interface SpeedDetail {
    pair: string
    zoom: SpeedZoom | null
    motion: CapComparisonMotion | null
    loading: boolean
    onZoom: (zoom: SpeedZoom | null) => void
}

interface RunDeltaChartProps {
    card: ReplayCard
    view: ChartView
    onViewChange: (view: ChartView) => void
    referenceLabel: string
    speedDetail: SpeedDetail
}

const MARKER_LEGEND: { label: string; event: CapMotionEvent }[] = [
    { label: 'dodge, pointing its way', event: { t_ms: 0, kind: 'dodge', direction: 'F' } },
    { label: 'jump', event: { t_ms: 0, kind: 'jump', direction: null } },
    { label: 'kicker', event: { t_ms: 0, kind: 'kick', direction: null } },
]

function pathOf(points: CapComparisonPoint[], x: (ms: number) => number, y: (ms: number) => number, close = false): string {
    const d = points.map(([t, delta], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)} ${y(delta).toFixed(1)}`).join(' ')
    return close ? `${d} Z` : d
}

function cumulativeDescription(card: ReplayCard, referenceLabel: string): string {
    const bands = card.chart.bands.length
    const lines = bands === 0 ? '' : `, with ${bands} different-line ${bands === 1 ? 'section' : 'sections'}`
    return `Gap to ${referenceLabel} over the run${lines}, ${card.finalGap.label} at the cap`
}

function CumulativePlot({ chart, width, height, description }: {
    chart: RunDeltaChartModel
    width: number
    height: number
    description: string
}) {
    const box: PlotBox = {
        left: MARGIN.left,
        right: Math.max(MARGIN.left + 1, width - MARGIN.right),
        top: MARGIN.top,
        bottom: Math.max(MARGIN.top + 1, height - MARGIN.bottom),
    }
    const [t0, t1] = chart.x.domainMs
    const x = (ms: number) => box.left + ((ms - t0) / Math.max(1, t1 - t0)) * (box.right - box.left)
    const y = deltaScale(chart.y, box)

    return (
        <svg width={width} height={height} role="img" aria-label={description} className="absolute inset-0 block font-mono">
            {chart.boundariesMs.map(ms => (
                <line key={`b${ms}`} x1={x(ms)} x2={x(ms)} y1={box.top} y2={box.bottom} stroke={HAIRLINE(0.06)} />
            ))}
            <DeltaGrid ticks={chart.y.ticks} box={box} y={y} />
            {chart.bands.map(band => {
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
            {chart.curves.map((curve, i) => (
                <path key={`a${i}`} d={pathOf(curve.area, x, y, true)} fill={TONE_AREA[curve.tone]} stroke="none" />
            ))}
            <line
                x1={box.left} x2={box.right} y1={y(chart.zeroLineMs)} y2={y(chart.zeroLineMs)}
                stroke={HAIRLINE(0.3)} strokeDasharray="4 4"
            />
            <DeltaAxisMarks ticks={chart.y.ticks} box={box} y={y} />
            {chart.x.ticks.map(tick => (
                <line
                    key={`xt${tick.ms}`}
                    x1={x(tick.ms)} x2={x(tick.ms)} y1={box.bottom} y2={box.bottom + TICK_LENGTH}
                    stroke={HAIRLINE(0.22)}
                />
            ))}
            {chart.bands.map(band => (
                <line
                    key={`con${band.startMs}`}
                    x1={x(band.connector[0][0])} y1={y(band.connector[0][1])}
                    x2={x(band.connector[1][0])} y2={y(band.connector[1][1])}
                    stroke={HAIRLINE(0.4)} strokeWidth={1.5} strokeDasharray="2 3"
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
                    fill={dot.hollow ? 'var(--card)' : TONE_STROKE[dot.tone]}
                    stroke={dot.hollow ? TONE_STROKE[dot.tone] : 'var(--card)'}
                    strokeWidth={dot.hollow ? 1.5 : 1}
                />
            ))}
            {chart.capPoint && (
                <circle
                    cx={x(chart.capPoint.tMs)}
                    cy={y(chart.capPoint.deltaMs)}
                    r={4}
                    fill={TONE_STROKE[chart.capPoint.tone]}
                    stroke="var(--card)"
                    strokeWidth={1}
                />
            )}
            <g fontSize={10} fill={HAIRLINE(0.5)}>
                {readableTimeLabels(chart.x.ticks, x).map(tick => (
                    <text key={`xl${tick.ms}`} x={x(tick.ms)} y={height - 4} textAnchor="middle">
                        {tick.label}
                    </text>
                ))}
            </g>
            <g fontSize={9} fill={HAIRLINE(0.38)}>
                {chart.sectors.map(sector => (
                    <text key={`s${sector.index}`} x={(x(sector.startMs) + x(sector.endMs)) / 2} y={box.top - 6} textAnchor="middle">
                        {sector.label}
                    </text>
                ))}
            </g>
        </svg>
    )
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            {swatch}
            {children}
        </span>
    )
}

function CumulativeLegend({ referenceLabel }: { referenceLabel: string }) {
    return (
        <>
            <LegendItem swatch={<span className="w-2.5 h-[3px] rounded-sm" style={{ background: DELTA_COLORS.gained }} />}>ahead</LegendItem>
            <LegendItem swatch={<span className="w-2.5 h-[3px] rounded-sm" style={{ background: DELTA_COLORS.lost }} />}>behind</LegendItem>
            <LegendItem swatch={<span className="size-2.5 rounded-sm bg-hairline/[0.07] border border-dashed border-hairline/30" />}>
                different line
            </LegendItem>
            <LegendItem swatch={<span className="size-[7px] rounded-full" style={{ background: DELTA_COLORS.neutral }} />}>sector split</LegendItem>
            <span>x = {referenceLabel}&apos;s run time</span>
        </>
    )
}

function MarkerSwatch({ event }: { event: CapMotionEvent }) {
    return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
            <path d={markerPath(event, 5, 5)} fill="currentColor" />
        </svg>
    )
}

function DetailLegend({ zoomed, loading }: { zoomed: ZoomedSpeed | null; loading: boolean }) {
    if (!zoomed) {
        return <span>click a sector or drag across the chart to zoom into every sample</span>
    }
    if (!zoomed.detailed) {
        return <span>{loading ? 'loading every sample…' : 'sample detail unavailable, showing the smoothed speed'}</span>
    }
    return (
        <>
            <span>double-click the chart or press Esc to zoom out</span>
            {MARKER_LEGEND.map(item => (
                <LegendItem key={item.label} swatch={<MarkerSwatch event={item.event} />}>{item.label}</LegendItem>
            ))}
            <LegendItem swatch={<span className="w-2.5 h-1 rounded-sm bg-hairline/40" />}>in the air</LegendItem>
            <LegendItem swatch={<span className="w-2.5 border-t border-dashed border-hairline/50" />}>
                {RUN_CAP_UU_S} run cap · {STRAFE_DODGE_UU_S} strafe-dodge peak
            </LegendItem>
        </>
    )
}

function SpeedLegend({ card, referenceLabel, zoomed, loading }: {
    card: ReplayCard
    referenceLabel: string
    zoomed: ZoomedSpeed | null
    loading: boolean
}) {
    const { totals } = card.speed
    return (
        <>
            <LegendItem swatch={<span className="w-2.5 h-[3px] rounded-sm" style={{ background: RUNNER_SPEED_STROKE }} />}>
                this run · {totals.runnerSpeed} avg
            </LegendItem>
            <LegendItem swatch={<span className="w-2.5 h-[3px] rounded-sm" style={{ background: REFERENCE_SPEED_STROKE }} />}>
                {referenceLabel} · {totals.referenceSpeed} avg
            </LegendItem>
            {card.flagged && (
                <LegendItem swatch={<span className="size-2.5 rounded-sm bg-hairline/[0.07] border border-dashed border-hairline/30" />}>
                    different line
                </LegendItem>
            )}
            <span>horizontal speed in UU/s · x = {referenceLabel}&apos;s run time</span>
            <DetailLegend zoomed={zoomed} loading={loading} />
            {!zoomed && <span className="hidden xl:inline">{SPEED_SPLIT_NOTE}</span>}
        </>
    )
}

function speedDescription(card: ReplayCard, referenceLabel: string): string {
    const { totals } = card.speed
    return `Horizontal speed over the run against ${referenceLabel}: this run averages ${totals.runnerSpeed} UU/s, ${referenceLabel} ${totals.referenceSpeed} UU/s`
}

function Legend({ card, view, referenceLabel, zoomed, loading }: {
    card: ReplayCard
    view: ChartView
    referenceLabel: string
    zoomed: ZoomedSpeed | null
    loading: boolean
}) {
    if (view === 'cumulative') return <CumulativeLegend referenceLabel={referenceLabel} />
    if (view === 'speed') return <SpeedLegend card={card} referenceLabel={referenceLabel} zoomed={zoomed} loading={loading} />
    return <SectorLegend flagged={card.flagged} />
}

function zoomTitle(zoom: SpeedZoom, zoomed: ZoomedSpeed): string {
    if (zoom.sector !== null) return `S${zoom.sector}`
    const ticks = zoomed.x.ticks
    return ticks.length > 1 ? `${ticks[0].label}–${ticks[ticks.length - 1].label}` : 'zoomed'
}

function SectorLegend({ flagged }: { flagged: boolean }) {
    return (
        <>
            <LegendItem swatch={<span className="size-2 rounded-sm" style={{ background: DELTA_COLORS.gained }} />}>gained</LegendItem>
            <LegendItem swatch={<span className="size-2 rounded-sm" style={{ background: DELTA_COLORS.lost }} />}>lost</LegendItem>
            {flagged && (
                <LegendItem swatch={<Split className="size-3" strokeWidth={2} aria-hidden="true" />}>different line</LegendItem>
            )}
        </>
    )
}

export default function RunDeltaChart({ card, view, onViewChange, referenceLabel, speedDetail }: RunDeltaChartProps) {
    const plotRef = useRef<HTMLDivElement>(null)
    const { width, height } = useElementSize(plotRef)
    const ready = width > 0 && height > 0
    const { pair, zoom, motion, loading, onZoom } = speedDetail
    const duration = card.chart.x.domainMs[1]
    const zoomed = useMemo(
        () => (view === 'speed' && zoom ? zoomedSpeed(card.speed.chart, motion, zoom, duration) : null),
        [view, zoom, card.speed.chart, motion, duration],
    )

    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg p-2 h-full flex flex-col min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1 pb-1.5 shrink-0">
                <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {VIEW_TITLES[view]}{zoom && zoomed ? ` · ${zoomTitle(zoom, zoomed)}` : ''} · vs {referenceLabel}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {zoomed && (
                        <button
                            type="button"
                            onClick={() => onZoom(null)}
                            className="inline-flex items-center gap-1 h-8 lg:h-6 px-2.5 lg:px-2 rounded border text-[11px] lg:text-[10px] font-medium transition-colors cursor-pointer bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                        >
                            <ZoomOut className="size-3" strokeWidth={2} aria-hidden="true" />
                            Reset zoom
                        </button>
                    )}
                    <ChartViewToggle view={view} onChange={onViewChange} />
                </div>
            </div>
            <div ref={plotRef} className="flex-1 min-h-[180px] relative">
                {ready && view === 'cumulative' && (
                    <CumulativePlot
                        chart={card.chart}
                        width={width}
                        height={height}
                        description={cumulativeDescription(card, referenceLabel)}
                    />
                )}
                {ready && view === 'sectors' && (
                    <SectorBarsPlot
                        bars={card.bars}
                        width={width}
                        height={height}
                        description={`Time gained or lost per sector against ${referenceLabel}`}
                    />
                )}
                {ready && view === 'speed' && (
                    <SpeedPlot
                        chart={card.speed.chart}
                        zoomed={zoomed}
                        frame={card.chart}
                        width={width}
                        height={height}
                        description={speedDescription(card, referenceLabel)}
                        onZoomRange={(from, to) => onZoom(rangeZoom(pair, from, to, duration))}
                        onZoomSector={index => onZoom(sectorZoom(pair, card.chart.sectors, index))}
                        onZoomOut={() => onZoom(null)}
                    />
                )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 pt-1 text-[10px] text-muted-foreground shrink-0">
                <Legend card={card} view={view} referenceLabel={referenceLabel} zoomed={zoomed} loading={loading} />
            </div>
        </div>
    )
}
