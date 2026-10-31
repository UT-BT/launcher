import type { CapComparison, CapComparisonSector, CapComparisonSpeedPoint } from '@/app/utils/api'
import { timeAxis, type TimeAxis } from './chartRules'
import { sectorLabel, signedGap, type DeltaTone, type SignedGap } from './deltaCurve'

const SPEED_STEPS = [50, 100, 200, 250, 500, 1000, 2000]
const MAX_SPEED_INTERVALS = 5
const SPEED_HEADROOM = 1.05

export interface SpeedTick {
    value: number
    label: string
}

export interface SpeedAxis {
    domain: [number, number]
    step: number
    ticks: SpeedTick[]
}

export interface SpeedBand {
    startMs: number
    endMs: number
}

export interface SpeedChart {
    x: TimeAxis
    y: SpeedAxis
    runner: CapComparisonSpeedPoint[][]
    reference: CapComparisonSpeedPoint[][]
    bands: SpeedBand[]
}

export interface SpeedGap {
    value: number
    label: string
    tone: DeltaTone
}

export interface SpeedRow {
    index: number
    label: string
    runnerSpeed: number
    speedGap: SpeedGap
    fromSpeed: SignedGap
    fromLine: SignedGap
    flagged: boolean
}

export interface SpeedTotals {
    runnerSpeed: number
    referenceSpeed: number
    speedGap: SpeedGap
    runnerDistance: number
    referenceDistance: number
    fromSpeed: SignedGap
    fromLine: SignedGap
}

export interface RunSpeed {
    chart: SpeedChart
    rows: SpeedRow[]
    totals: SpeedTotals
}

export function speedAxis(maxSpeed: number): SpeedAxis {
    const top = Math.max(0, maxSpeed) * SPEED_HEADROOM
    const step = SPEED_STEPS.find(s => Math.ceil(top / s) <= MAX_SPEED_INTERVALS) ?? SPEED_STEPS[SPEED_STEPS.length - 1]
    const intervals = Math.max(1, Math.ceil(top / step))
    const ticks = Array.from({ length: intervals + 1 }, (_, i) => ({ value: i * step, label: String(i * step) }))
    return { domain: [0, intervals * step], step, ticks }
}

function timeWeighted(speedsAndTimes: [number, number][]): number {
    const time = sum(speedsAndTimes.map(([, ms]) => Math.max(0, ms)))
    return time > 0 ? Math.round(sum(speedsAndTimes.map(([speed, ms]) => speed * Math.max(0, ms))) / time) : 0
}

function speedGap(runner: number, reference: number): SpeedGap {
    const value = runner - reference
    const tone: DeltaTone = value > 0 ? 'ahead' : value < 0 ? 'behind' : 'even'
    return { value, label: value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0', tone }
}

function referenceSlice(sectors: CapComparisonSector[], i: number): number {
    return sectors[i].end_ms - (i === 0 ? 0 : sectors[i - 1].end_ms)
}

function maxSpeed(lines: CapComparisonSpeedPoint[][][]): number {
    let max = 0
    for (const segments of lines) {
        for (const segment of segments) {
            for (const [, speed] of segment) if (speed > max) max = speed
        }
    }
    return max
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

export function runSpeed(comparison: CapComparison): RunSpeed {
    const { sectors, speed } = comparison
    const rows = sectors.map(s => ({
        index: s.index,
        label: sectorLabel(s.index),
        runnerSpeed: s.runner_speed_uu_s,
        speedGap: speedGap(s.runner_speed_uu_s, s.reference_speed_uu_s),
        fromSpeed: signedGap(s.delta_speed_ms),
        fromLine: signedGap(s.delta_line_ms),
        flagged: s.separated,
    }))
    const runnerDistance = sum(sectors.map(s => s.runner_distance_uu))
    const referenceDistance = sum(sectors.map(s => s.reference_distance_uu))
    const runnerSpeed = timeWeighted(sectors.map(s => [s.runner_speed_uu_s, s.split_ms]))
    const referenceSpeed = timeWeighted(sectors.map((s, i) => [s.reference_speed_uu_s, referenceSlice(sectors, i)]))

    return {
        chart: {
            x: timeAxis(comparison.duration_ms),
            y: speedAxis(maxSpeed([speed.runner, speed.reference])),
            runner: speed.runner,
            reference: speed.reference,
            bands: comparison.separations.map(s => ({ startMs: s.start_ms, endMs: s.end_ms })),
        },
        rows,
        totals: {
            runnerSpeed,
            referenceSpeed,
            speedGap: speedGap(runnerSpeed, referenceSpeed),
            runnerDistance,
            referenceDistance,
            fromSpeed: signedGap(sum(sectors.map(s => s.delta_speed_ms))),
            fromLine: signedGap(sum(sectors.map(s => s.delta_line_ms))),
        },
    }
}
