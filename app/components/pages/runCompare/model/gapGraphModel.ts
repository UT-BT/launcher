import { deltaAxis } from '@/app/components/pages/capDetail/runDelta/chartRules'
import { curveRange, type DeltaBand } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { CapComparisonPoint } from '@/app/utils/api'
import { RUN_COLOURS } from './analysisModel'
import type { CompareModel } from './compareModel'
import type { Lane } from './laneModel'
import { onFocusSide, type SideOption } from './referenceModel'
import type { TeamRow } from './teamModel'

export interface GapSeries {
    key: string
    colour: string
    lane: Lane
    row: TeamRow | null
    drawn: boolean
    pending: boolean
    segments: CapComparisonPoint[][]
    bands: DeltaBand[]
    dots: CapComparisonPoint[]
    cap: CapComparisonPoint
}

export interface GapGraph {
    series: GapSeries[]
    domainMs: [number, number]
    gridMs: number[]
    elsewhere: SideOption[]
}

function isDrawn(lane: Lane): boolean {
    return !lane.reference && (lane.trace.kind === 'strip' || lane.trace.kind === 'steps')
}

function seriesOf(key: string, lane: Lane, colour: string, row: TeamRow | null): GapSeries {
    return {
        key,
        colour,
        lane,
        row,
        drawn: isDrawn(lane),
        pending: !lane.reference && lane.rung === null && row === null,
        segments: lane.curves.map(curve => curve.points),
        bands: lane.bands,
        dots: lane.splits.filter(split => split.endMs < lane.capMs).map(split => [split.endMs, split.deltaTotalMs]),
        cap: [lane.capMs, lane.finalGap.ms],
    }
}

export function composeGapGraph(series: GapSeries[]): GapGraph {
    const drawn = series.filter(line => line.drawn)
    const [lo, hi] = curveRange(drawn.flatMap(line => [...line.segments, ...line.bands.map(band => band.connector), [line.cap]]))
    const axis = deltaAxis(lo, hi)
    return { series, domainMs: axis.domainMs, gridMs: axis.ticks.map(tick => tick.ms), elsewhere: [] }
}

export function gapGraphOf(model: Pick<CompareModel, 'lanes' | 'analysis' | 'teams' | 'race'>): GapGraph {
    const rows = model.teams.rows.filter(row => row.lane)
    if (rows.length > 0) return composeGapGraph(rows.flatMap(row => (row.lane ? [seriesOf(row.teamCapId, row.lane, row.colour, row)] : [])))
    const { sides } = model.race
    const colours = new Map(model.analysis.runs.map(run => [run.capId, run.colour]))
    const shown = model.lanes.lanes.filter(lane => onFocusSide(sides, lane.run))
    const graph = composeGapGraph(shown.map((lane, i) => seriesOf(lane.capId, lane, colours.get(lane.capId) ?? RUN_COLOURS[i % RUN_COLOURS.length], null)))
    return { ...graph, elsewhere: sides.options.filter(option => option.side !== sides.focus) }
}
