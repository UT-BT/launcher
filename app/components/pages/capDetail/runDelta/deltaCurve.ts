import { formatSignedDelta } from '@/app/components/pages/capDetail/capStats'
import type { CapComparison, CapComparisonPoint } from '@/app/utils/api'

export type DeltaTone = 'ahead' | 'behind' | 'even'

export interface SignedGap {
    ms: number
    label: string
    tone: DeltaTone
}

export interface DeltaCurve {
    tone: DeltaTone
    points: CapComparisonPoint[]
    area: CapComparisonPoint[]
}

export interface DeltaBand {
    startMs: number
    endMs: number
    connector: [CapComparisonPoint, CapComparisonPoint]
    rejoined: boolean
}

export interface CapPoint {
    tMs: number
    deltaMs: number
    tone: DeltaTone
}

export const SECTOR_COUNT = 10

export function sectorLabel(index: number): string {
    return `S${index}`
}

export function deltaTone(ms: number): DeltaTone {
    if (ms < 0) return 'ahead'
    if (ms > 0) return 'behind'
    return 'even'
}

export function signedGap(ms: number): SignedGap {
    return { ms, label: formatSignedDelta(ms / 1000), tone: deltaTone(ms) }
}

export function isDrawableComparison(comparison: CapComparison | null): comparison is CapComparison {
    if (!comparison) return false
    if (comparison.runner.team !== comparison.reference.team) return false
    if (comparison.state !== 'aligned') return Number.isFinite(comparison.coverage)
    return comparison.sectors.length === SECTOR_COUNT && comparison.segments.some(s => s.length > 0)
}

function closeArea(points: CapComparisonPoint[]): CapComparisonPoint[] {
    const first = points[0]
    const last = points[points.length - 1]
    return [
        ...(first[1] !== 0 ? [[first[0], 0] as CapComparisonPoint] : []),
        ...points,
        ...(last[1] !== 0 ? [[last[0], 0] as CapComparisonPoint] : []),
    ]
}

function splitAtZero(segment: CapComparisonPoint[]): DeltaCurve[] {
    const runs: { sign: number; points: CapComparisonPoint[] }[] = []
    let current: { sign: number; points: CapComparisonPoint[] } | null = null
    for (const point of segment) {
        const sign = Math.sign(point[1])
        if (!current) {
            current = { sign, points: [point] }
            continue
        }
        if (sign !== 0 && current.sign !== 0 && sign !== current.sign) {
            const prev = current.points[current.points.length - 1]
            const cut: CapComparisonPoint = prev[1] === 0
                ? prev
                : [prev[0] + ((point[0] - prev[0]) * prev[1]) / (prev[1] - point[1]), 0]
            if (cut !== prev) current.points.push(cut)
            runs.push(current)
            current = { sign, points: [cut, point] }
            continue
        }
        if (current.sign === 0) current.sign = sign
        current.points.push(point)
    }
    if (current) runs.push(current)
    return runs
        .filter(run => run.points.length > 1)
        .map(run => ({
            tone: deltaTone(run.sign),
            points: run.points,
            area: closeArea(run.points),
        }))
}

export function deltaCurves(segments: CapComparisonPoint[][]): DeltaCurve[] {
    return segments.flatMap(splitAtZero)
}

export function deltaBands(comparison: CapComparison): DeltaBand[] {
    return comparison.separations.map(s => ({
        startMs: s.start_ms,
        endMs: s.end_ms,
        connector: [[s.start_ms, s.start_delta_ms], [s.end_ms, s.end_delta_ms]],
        rejoined: s.rejoined,
    }))
}

export function lonePoint(comparison: CapComparison): CapPoint | null {
    const last = comparison.separations[comparison.separations.length - 1]
    if (!last || last.rejoined) return null
    return { tMs: comparison.duration_ms, deltaMs: comparison.final_delta_ms, tone: deltaTone(comparison.final_delta_ms) }
}

export function curveRange(segments: CapComparisonPoint[][]): [number, number] {
    let lo = 0
    let hi = 0
    for (const segment of segments) {
        for (const [, d] of segment) {
            if (d < lo) lo = d
            if (d > hi) hi = d
        }
    }
    return [lo, hi]
}
