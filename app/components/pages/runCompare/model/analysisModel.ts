import { deltaAxis } from '@/app/components/pages/capDetail/runDelta/chartRules'
import { curveRange, sectorLabel, signedGap, type DeltaBand, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { buildRunDeltaCard, type ReplayCard } from '@/app/components/pages/capDetail/runDelta/runDeltaCard'
import { zoomPair } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import { equalSectorEndsMs } from '@/app/components/pages/capDetail/runDelta/videoStrip'
import type { CapCheckpoint, CapComparisonPoint } from '@/app/utils/api'
import { comparisonKey, type LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import type { CueModel, CuePoint } from './cueModel'
import type { Lane, LanesModel, Rung } from './laneModel'
import { formatRaceTime, type RaceModel } from './raceModel'
import { isSideReference } from './referenceModel'

export const RUN_COLOURS = ['#38bdf8', '#fbbf24', '#e879f9', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#818cf8', '#facc15', '#2dd4bf'] as const

export interface AnalysisRun {
    capId: string
    run: SoloRun
    colour: string
    reference: boolean
    rung: Rung | null
}

export interface CumulativeLine {
    capId: string
    colour: string
    segments: CapComparisonPoint[][]
    bands: DeltaBand[]
    dots: CapComparisonPoint[]
    cap: CapComparisonPoint
}

export interface CumulativeModel {
    endMs: number
    domainMs: [number, number]
    gridMs: number[]
    lines: CumulativeLine[]
    timeOnly: string[]
}

export type MatrixRowKind = 'sector' | 'zone' | 'cap'

export interface MatrixCell {
    valueMs: number
    value: string
    delta: SignedGap | null
    best: boolean
}

export interface MatrixRow {
    key: string
    kind: MatrixRowKind
    label: string
    atMs: number
    cue: CuePoint | null
    cells: (MatrixCell | null)[]
}

export interface SpeedModel {
    options: AnalysisRun[]
    chosen: string | null
    reference: SoloRun | null
    pair: string | null
    card: ReplayCard | null
    highlighted: string | null
}

export interface AnalysisModel {
    runs: AnalysisRun[]
    cumulative: CumulativeModel
    matrix: MatrixRow[]
    speed: SpeedModel
}

const EMPTY_SPEED: SpeedModel = { options: [], chosen: null, reference: null, pair: null, card: null, highlighted: null }

export const EMPTY_ANALYSIS: AnalysisModel = {
    runs: [],
    cumulative: { endMs: 0, domainMs: [0, 0], gridMs: [], lines: [], timeOnly: [] },
    matrix: [],
    speed: EMPTY_SPEED,
}

const CAP_KEY = 'cap'

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

function formatSplit(ms: number): string {
    return ms < 60000 ? (ms / 1000).toFixed(3) : formatRaceTime(ms / 1000)
}

interface Column {
    lane: Lane
    partner: SoloRun
    sideReference: boolean
}

function drawn(column: Column): boolean {
    return !column.sideReference && (column.lane.rung === 'replay' || column.lane.rung === 'zones')
}

function composeCumulative(columns: readonly Column[], runs: readonly AnalysisRun[]): CumulativeModel {
    const lines = columns.flatMap((column, i): CumulativeLine[] => {
        if (!drawn(column)) return []
        const { lane } = column
        return [{
            capId: lane.capId,
            colour: runs[i].colour,
            segments: lane.curves.map(curve => curve.points),
            bands: lane.bands,
            dots: lane.splits.map(split => [split.endMs, split.deltaTotalMs]),
            cap: [lane.capMs, lane.finalGap.ms],
        }]
    })
    const [lo, hi] = curveRange(lines.flatMap(line => [...line.segments, ...line.bands.map(band => band.connector), [line.cap]]))
    const axis = deltaAxis(lo, hi)
    return {
        endMs: Math.max(0, ...columns.map(column => column.lane.capMs)),
        domainMs: axis.domainMs,
        gridMs: axis.ticks.map(tick => tick.ms),
        lines,
        timeOnly: columns.filter(column => !column.sideReference && column.lane.rung === 'time').map(column => column.lane.capId),
    }
}

function sectorCell(column: Column, index: number): MatrixCell | null {
    if (column.sideReference) {
        const ends = equalSectorEndsMs(column.lane.capMs)
        const splitMs = ends[index] - (index === 0 ? 0 : ends[index - 1])
        return { valueMs: splitMs, value: formatSplit(splitMs), delta: null, best: false }
    }
    const split = column.lane.rung === 'replay' ? column.lane.splits[index] : undefined
    return split ? { valueMs: split.splitMs, value: formatSplit(split.splitMs), delta: signedGap(split.deltaSplitMs), best: false } : null
}

function sideOf(column: Column): string {
    return column.sideReference ? column.lane.capId : column.partner.capId
}

function markBest(cells: (MatrixCell | null)[], columns: readonly Column[]): (MatrixCell | null)[] {
    const fastest = new Map<string, { ms: number; count: number }>()
    cells.forEach((cell, i) => {
        if (!cell) return
        const side = sideOf(columns[i])
        const seen = fastest.get(side)
        fastest.set(side, { ms: Math.min(seen?.ms ?? Infinity, cell.valueMs), count: (seen?.count ?? 0) + 1 })
    })
    return cells.map((cell, i) => {
        const side = cell ? fastest.get(sideOf(columns[i])) : undefined
        return cell && side && side.count > 1 && cell.valueMs === side.ms ? { ...cell, best: true } : cell
    })
}

function firstCrossing(checkpoints: readonly CapCheckpoint[], zone: string): number | null {
    const crossing = checkpoints.find(checkpoint => checkpoint.zone === zone)
    return crossing ? msOf(crossing.cumulative) : null
}

function zoneCell(column: Column, zone: string): MatrixCell | null {
    if (!column.sideReference && column.lane.rung !== 'zones') return null
    const ownMs = firstCrossing(column.lane.run.checkpoints, zone)
    if (ownMs === null) return null
    if (column.sideReference) return { valueMs: ownMs, value: formatRaceTime(ownMs / 1000), delta: null, best: false }
    const referenceMs = firstCrossing(column.partner.checkpoints, zone)
    return referenceMs === null ? null : { valueMs: ownMs, value: formatRaceTime(ownMs / 1000), delta: signedGap(ownMs - referenceMs), best: false }
}

function capCell({ lane, partner }: Column): MatrixCell {
    return { valueMs: lane.capMs, value: formatRaceTime(lane.capMs / 1000), delta: partner.capId === lane.capId ? null : lane.finalGap, best: false }
}

function composeMatrix(columns: readonly Column[], cues: CueModel, lead: SoloRun): MatrixRow[] {
    const ends = equalSectorEndsMs(msOf(lead.timeSeconds))
    const sectors = ends.map((_, i): MatrixRow => {
        const label = sectorLabel(i + 1)
        const cue = cues.sectors.find(point => point.key === label) ?? null
        return { key: label, kind: 'sector', label, atMs: i === 0 ? 0 : ends[i - 1], cue, cells: markBest(columns.map(column => sectorCell(column, i)), columns) }
    })
    const zones = cues.zones.map((point): MatrixRow => ({
        key: point.key,
        kind: 'zone',
        label: point.label,
        atMs: point.atMs,
        cue: point,
        cells: columns.map(column => zoneCell(column, point.label)),
    }))
    const cap: MatrixRow = { key: CAP_KEY, kind: 'cap', label: 'Cap', atMs: msOf(lead.timeSeconds), cue: null, cells: columns.map(capCell) }
    return [...sectors, ...zones, cap]
}

function composeSpeed(columns: readonly Column[], runs: readonly AnalysisRun[], comparisons: LoadedComparisons, speedRun: string | null): SpeedModel {
    const options = runs.filter((_, i) => !columns[i].sideReference && columns[i].lane.rung === 'replay')
    const chosen = options.find(option => option.capId === speedRun) ?? options[0]
    if (!chosen) return EMPTY_SPEED
    const { partner } = columns[runs.indexOf(chosen)]
    const comparison = comparisons.get(comparisonKey({ runner: chosen.capId, reference: partner.capId })) ?? null
    const card = buildRunDeltaCard({ comparison, capHasReplay: true, reference: { alias: partner.alias, hasReplay: true } })
    return {
        options,
        chosen: chosen.capId,
        reference: partner,
        pair: zoomPair(chosen.capId, partner.capId),
        card: card.kind === 'replay' ? card : null,
        highlighted: chosen.capId === speedRun ? speedRun : null,
    }
}

export function composeAnalysis(race: RaceModel, lanes: LanesModel, cues: CueModel, comparisons: LoadedComparisons, speedRun: string | null): AnalysisModel {
    const byId = new Map(race.runs.map(raceRun => [raceRun.run.capId, raceRun.run]))
    const lead = byId.get(race.reference ?? '')
    if (!lead) return EMPTY_ANALYSIS
    const columns = lanes.lanes.map((lane): Column => ({
        lane,
        partner: byId.get(race.references.partners.get(lane.capId) ?? '') ?? lane.run,
        sideReference: isSideReference(race.references, lane.capId),
    }))
    const runs = columns.map(({ lane, sideReference }, i): AnalysisRun => ({
        capId: lane.capId,
        run: lane.run,
        colour: RUN_COLOURS[i % RUN_COLOURS.length],
        reference: sideReference,
        rung: lane.rung,
    }))
    return {
        runs,
        cumulative: composeCumulative(columns, runs),
        matrix: composeMatrix(columns, cues, lead),
        speed: composeSpeed(columns, runs, comparisons, speedRun),
    }
}

export function withTileHighlight(race: RaceModel, capId: string | null): RaceModel {
    if (capId === null || !race.tiles.some(tile => tile.id === capId)) return race
    const tiles = race.tiles.map(tile => (tile.id === capId ? { ...tile, highlighted: true } : tile))
    const byId = new Map(tiles.map(tile => [tile.id, tile]))
    return {
        ...race,
        tiles,
        layout: { ...race.layout, placed: race.layout.placed.map(placed => ({ ...placed, slot: byId.get(placed.slot.id) ?? placed.slot })) },
    }
}
