import type { CapComparison, CapComparisonPoint } from '@/app/utils/api'
import { deltaAxis, type DeltaAxis } from './chartRules'
import {
    SECTOR_COUNT,
    curveRange,
    deltaBands,
    deltaCurves,
    isDrawableComparison,
    lonePoint,
    sectorLabel,
    signedGap,
    type CapPoint,
    type DeltaBand,
    type DeltaCurve,
    type SignedGap,
} from './deltaCurve'

export interface StripLane {
    ticksMs: number[]
    capMs: number
}

interface StripPiece {
    from: CapComparisonPoint
    to: CapComparisonPoint
    differentLine: boolean
}

export interface VideoStrip {
    spanMs: number
    y: DeltaAxis
    zeroLineMs: 0
    curves: DeltaCurve[]
    bands: DeltaBand[]
    capPoint: CapPoint | null
    runner: StripLane
    reference: StripLane
    runnerSectorEndsMs: number[]
    referenceSectorEndsMs: number[]
    finalDeltaMs: number
    pieces: StripPiece[]
}

export interface RunnerReadout {
    label: string
    sector: number
    differentLine: boolean
    atCap: boolean
    gap: SignedGap
}

export interface ReferenceReadout {
    label: string
    sector: number
    atCap: boolean
}

const DIFFERENT_LINE = 'Different line'

function toRunnerTime([t, d]: CapComparisonPoint): CapComparisonPoint {
    return [t + d, d]
}

export function equalSectorEndsMs(durationMs: number): number[] {
    return Array.from({ length: SECTOR_COUNT }, (_, i) => Math.floor(((i + 1) * durationMs + SECTOR_COUNT / 2) / SECTOR_COUNT))
}

function stripPieces(comparison: CapComparison, bands: DeltaBand[]): StripPiece[] {
    const onLine = comparison.segments.flatMap(segment =>
        segment.slice(1).map((point, i) => ({
            from: toRunnerTime(segment[i]),
            to: toRunnerTime(point),
            differentLine: false,
        })),
    )
    const offLine = bands.map(b => ({ from: b.connector[0], to: b.connector[1], differentLine: true }))
    return [...onLine, ...offLine].sort((a, b) => a.from[0] - b.from[0] || Number(a.differentLine) - Number(b.differentLine))
}

export function buildVideoStrip(comparison: CapComparison | null): VideoStrip | null {
    if (!isDrawableComparison(comparison) || comparison.state !== 'aligned') return null
    const [lo, hi] = curveRange(comparison.segments)
    const bands = deltaBands(comparison).map(b => {
        const from = toRunnerTime(b.connector[0])
        const to = toRunnerTime(b.connector[1])
        return { startMs: from[0], endMs: to[0], connector: [from, to] as [CapComparisonPoint, CapComparisonPoint], rejoined: b.rejoined }
    })
    const cap = lonePoint(comparison)
    const runnerSectorEndsMs = comparison.sectors.map(s => s.end_ms + s.delta_total_ms)
    const referenceSectorEndsMs = comparison.sectors.map(s => s.end_ms)
    return {
        spanMs: Math.max(comparison.runner.cap_time_ms, comparison.reference.cap_time_ms),
        y: deltaAxis(lo, hi),
        zeroLineMs: 0,
        curves: deltaCurves(comparison.segments.map(segment => segment.map(toRunnerTime))),
        bands,
        capPoint: cap && { ...cap, tMs: cap.tMs + cap.deltaMs },
        runner: { ticksMs: runnerSectorEndsMs.slice(0, -1), capMs: comparison.runner.cap_time_ms },
        reference: { ticksMs: referenceSectorEndsMs.slice(0, -1), capMs: comparison.reference.cap_time_ms },
        runnerSectorEndsMs,
        referenceSectorEndsMs,
        finalDeltaMs: comparison.final_delta_ms,
        pieces: stripPieces(comparison, bands),
    }
}

function sectorAt(endsMs: number[], timeMs: number): number {
    const next = endsMs.findIndex(end => timeMs < end)
    return next < 0 ? endsMs.length : next + 1
}

function gapAt(pieces: StripPiece[], timeMs: number): { deltaMs: number; differentLine: boolean } {
    let passed: StripPiece | null = null
    for (const piece of pieces) {
        const [x0, d0] = piece.from
        const [x1, d1] = piece.to
        if (x0 > timeMs) break
        if (timeMs <= x1) {
            const deltaMs = x1 === x0 ? d1 : d0 + ((timeMs - x0) / (x1 - x0)) * (d1 - d0)
            return { deltaMs, differentLine: piece.differentLine }
        }
        passed = piece
    }
    if (passed) return { deltaMs: passed.to[1], differentLine: false }
    return { deltaMs: pieces[0]?.from[1] ?? 0, differentLine: false }
}

export function runnerReadout(strip: VideoStrip, runnerTimeMs: number): RunnerReadout {
    if (runnerTimeMs >= strip.runner.capMs) {
        return { label: sectorLabel(SECTOR_COUNT), sector: SECTOR_COUNT, differentLine: false, atCap: true, gap: signedGap(strip.finalDeltaMs) }
    }
    const sector = sectorAt(strip.runnerSectorEndsMs, runnerTimeMs)
    const { deltaMs, differentLine } = gapAt(strip.pieces, runnerTimeMs)
    return {
        label: differentLine ? DIFFERENT_LINE : sectorLabel(sector),
        sector,
        differentLine,
        atCap: false,
        gap: signedGap(Math.round(deltaMs) || 0),
    }
}

export function referenceReadout(strip: VideoStrip, referenceTimeMs: number): ReferenceReadout {
    const sector = sectorAt(strip.referenceSectorEndsMs, referenceTimeMs)
    return { label: sectorLabel(sector), sector, atCap: referenceTimeMs >= strip.reference.capMs }
}
