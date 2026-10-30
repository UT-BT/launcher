import { formatCapTime } from '@/app/utils/format'
import type { CapComparison, CapComparisonSector } from '@/app/utils/api'
import { deltaAxis, timeAxis, type DeltaAxis, type TimeAxis } from './chartRules'
import {
    curveRange,
    deltaBands,
    deltaCurves,
    deltaTone,
    isDrawableComparison,
    lonePoint,
    sectorLabel,
    signedGap,
    type CapPoint,
    type DeltaBand,
    type DeltaCurve,
    type DeltaTone,
    type SignedGap,
} from './deltaCurve'

export interface ChartSector {
    index: number
    label: string
    startMs: number
    endMs: number
}

export interface SectorDot {
    index: number
    tMs: number
    deltaMs: number
    tone: DeltaTone
    hollow: boolean
}

export interface RunDeltaChart {
    x: TimeAxis
    y: DeltaAxis
    zeroLineMs: 0
    curves: DeltaCurve[]
    bands: DeltaBand[]
    capPoint: CapPoint | null
    sectors: ChartSector[]
    boundariesMs: number[]
    dots: SectorDot[]
}

export interface SectorBar {
    index: number
    label: string
    deltaMs: number
    tone: DeltaTone
    flagged: boolean
}

export interface SectorBars {
    y: DeltaAxis
    zeroLineMs: 0
    bars: SectorBar[]
}

export interface SectorRow {
    index: number
    label: string
    split: { ms: number; label: string }
    deltaSplit: SignedGap
    deltaTotal: SignedGap
    flagged: boolean
}

export interface ReplayCard {
    kind: 'replay'
    chip: 'REPLAY'
    chart: RunDeltaChart
    bars: SectorBars
    rows: SectorRow[]
    finalGap: SignedGap
    flagged: boolean
}

export interface RoutesDifferCard {
    kind: 'routes_differ'
    chip: 'REPLAY'
    coveragePercent: number
    finalGap: SignedGap
}

export interface ZonesCard {
    kind: 'zones'
    chip: 'ZONES'
    note: string
}

export type RunDeltaCardModel = ReplayCard | RoutesDifferCard | ZonesCard

export interface RunDeltaCardInput {
    comparison: CapComparison | null
    capHasReplay: boolean | undefined
    reference: { alias: string | null; hasReplay: boolean | undefined }
}

function formatSplit(ms: number): string {
    const seconds = ms / 1000
    return seconds < 60 ? seconds.toFixed(3) : formatCapTime(seconds)
}

function chartSectors(sectors: CapComparisonSector[]): ChartSector[] {
    return sectors.map((s, i) => ({
        index: s.index,
        label: sectorLabel(s.index),
        startMs: i === 0 ? 0 : sectors[i - 1].end_ms,
        endMs: s.end_ms,
    }))
}

function replayChart(comparison: CapComparison): RunDeltaChart {
    const [lo, hi] = curveRange(comparison.segments)
    const { sectors } = comparison
    return {
        x: timeAxis(comparison.duration_ms),
        y: deltaAxis(lo, hi),
        zeroLineMs: 0,
        curves: deltaCurves(comparison.segments),
        bands: deltaBands(comparison),
        capPoint: lonePoint(comparison),
        sectors: chartSectors(sectors),
        boundariesMs: sectors.slice(0, -1).map(s => s.end_ms),
        dots: sectors.map(s => ({
            index: s.index,
            tMs: s.end_ms,
            deltaMs: s.delta_total_ms,
            tone: deltaTone(s.delta_split_ms),
            hollow: s.separated,
        })),
    }
}

function sectorBars(sectors: CapComparisonSector[]): SectorBars {
    const splits = sectors.map(s => s.delta_split_ms)
    return {
        y: deltaAxis(Math.min(0, ...splits), Math.max(0, ...splits)),
        zeroLineMs: 0,
        bars: sectors.map(s => ({
            index: s.index,
            label: sectorLabel(s.index),
            deltaMs: s.delta_split_ms,
            tone: deltaTone(s.delta_split_ms),
            flagged: s.separated,
        })),
    }
}

function sectorRows(sectors: CapComparisonSector[]): SectorRow[] {
    return sectors.map(s => ({
        index: s.index,
        label: sectorLabel(s.index),
        split: { ms: s.split_ms, label: formatSplit(s.split_ms) },
        deltaSplit: signedGap(s.delta_split_ms),
        deltaTotal: signedGap(s.delta_total_ms),
        flagged: s.separated,
    }))
}

function zonesNote(input: RunDeltaCardInput): string {
    if (input.capHasReplay !== true) return 'This run has no replay, so this uses zone checkpoints.'
    if (input.reference.hasReplay !== true) {
        const who = input.reference.alias ? `${input.reference.alias}'s run` : 'The other run'
        return `${who} has no replay, so this uses zone checkpoints.`
    }
    return 'The replay comparison is unavailable, so this uses zone checkpoints.'
}

export function buildRunDeltaCard(input: RunDeltaCardInput): RunDeltaCardModel {
    const { comparison } = input
    if (!isDrawableComparison(comparison)) return { kind: 'zones', chip: 'ZONES', note: zonesNote(input) }
    if (comparison.state === 'routes_differ') {
        return {
            kind: 'routes_differ',
            chip: 'REPLAY',
            coveragePercent: Math.round(comparison.coverage * 100),
            finalGap: signedGap(comparison.final_delta_ms),
        }
    }
    const rows = sectorRows(comparison.sectors)
    return {
        kind: 'replay',
        chip: 'REPLAY',
        chart: replayChart(comparison),
        bars: sectorBars(comparison.sectors),
        rows,
        finalGap: signedGap(comparison.final_delta_ms),
        flagged: rows.some(r => r.flagged),
    }
}
