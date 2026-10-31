import {
    MOVE_AIR,
    type CapComparisonMotion,
    type CapComparisonSpeedPoint,
    type CapMotionEvent,
    type CapMotionSample,
} from '@/app/utils/api'
import { formatRunTime, type AxisTick, type TimeAxis } from './chartRules'
import type { ChartSector } from './runDeltaCard'
import { speedAxis, type SpeedAxis, type SpeedBand, type SpeedChart } from './runSpeed'

const WINDOW_STEPS_MS = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000]
const MAX_WINDOW_TICKS = 7
const MINUTE_MS = 60000
export const MIN_ZOOM_MS = 1000

export interface SpeedZoom {
    pair: string
    startMs: number
    endMs: number
    sector: number | null
}

export type AirSpan = [startMs: number, endMs: number]

export interface ZoomedSpeed {
    x: TimeAxis
    y: SpeedAxis
    runner: CapComparisonSpeedPoint[][]
    reference: CapComparisonSpeedPoint[][]
    runnerAir: AirSpan[]
    referenceAir: AirSpan[]
    runnerEvents: CapMotionEvent[]
    referenceEvents: CapMotionEvent[]
    bands: SpeedBand[]
    detailed: boolean
}

export function zoomPair(runnerCapId: string, referenceCapId: string): string {
    return `${runnerCapId}|${referenceCapId}`
}

export function sectorZoom(pair: string, sectors: ChartSector[], index: number): SpeedZoom | null {
    const sector = sectors.find(s => s.index === index)
    return sector ? { pair, startMs: sector.startMs, endMs: sector.endMs, sector: index } : null
}

export function rangeZoom(pair: string, fromMs: number, toMs: number, durationMs: number): SpeedZoom {
    const low = Math.min(fromMs, toMs)
    const high = Math.max(fromMs, toMs)
    const span = Math.min(durationMs, Math.max(MIN_ZOOM_MS, high - low))
    const middle = (low + high) / 2
    const startMs = Math.round(Math.min(Math.max(0, middle - span / 2), durationMs - span))
    return { pair, startMs, endMs: Math.round(startMs + span), sector: null }
}

function tickCount(startMs: number, endMs: number, stepMs: number): number {
    return Math.floor(endMs / stepMs) - Math.ceil(startMs / stepMs) + 1
}

function fineLabel(ms: number, durationMs: number): string {
    const tenths = Math.round(ms / 100)
    if (durationMs < MINUTE_MS) return `${(tenths / 10).toFixed(1)}s`
    const minutes = Math.floor(tenths / 600)
    const seconds = (tenths % 600) / 10
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

export function windowTimeAxis(startMs: number, endMs: number, durationMs: number): TimeAxis {
    const stepMs = WINDOW_STEPS_MS.find(step => tickCount(startMs, endMs, step) <= MAX_WINDOW_TICKS)
        ?? WINDOW_STEPS_MS[WINDOW_STEPS_MS.length - 1]
    const ticks: AxisTick[] = []
    for (let ms = Math.ceil(startMs / stepMs) * stepMs; ms <= endMs; ms += stepMs) {
        ticks.push({ ms, label: stepMs < 1000 ? fineLabel(ms, durationMs) : formatRunTime(ms, durationMs) })
    }
    return { domainMs: [startMs, endMs], stepMs, endTick: false, ticks }
}

function clipped<T extends [number, ...number[]]>(segment: T[], startMs: number, endMs: number): T[] {
    return segment.filter(([t], i) => {
        if (t >= startMs && t <= endMs) return true
        if (t < startMs) return (segment[i + 1]?.[0] ?? -Infinity) >= startMs
        return (segment[i - 1]?.[0] ?? Infinity) <= endMs
    })
}

function lines<T extends [number, ...number[]]>(segments: T[][], startMs: number, endMs: number): CapComparisonSpeedPoint[][] {
    return segments
        .map(segment => clipped(segment, startMs, endMs).map(([t, speed]) => [t, speed] as CapComparisonSpeedPoint))
        .filter(segment => segment.length > 0)
}

function airSpans(segments: CapMotionSample[][], startMs: number, endMs: number): AirSpan[] {
    const spans: AirSpan[] = []
    for (const segment of segments) {
        segment.forEach(([t, , state], i) => {
            if (state !== MOVE_AIR) return
            const next = segment[i + 1]?.[0] ?? t
            const from = Math.max(startMs, t)
            const to = Math.min(endMs, next)
            if (to < from) return
            const last = spans[spans.length - 1]
            if (last && last[1] >= from) last[1] = Math.max(last[1], to)
            else spans.push([from, to])
        })
    }
    return spans
}

function eventsIn(events: CapMotionEvent[], startMs: number, endMs: number): CapMotionEvent[] {
    return events.filter(e => e.t_ms >= startMs && e.t_ms <= endMs)
}

function fastest(segments: CapComparisonSpeedPoint[][]): number {
    let max = 0
    for (const segment of segments) for (const [, speed] of segment) if (speed > max) max = speed
    return max
}

export function zoomedSpeed(
    chart: SpeedChart,
    motion: CapComparisonMotion | null,
    zoom: SpeedZoom,
    durationMs: number,
): ZoomedSpeed {
    const { startMs, endMs } = zoom
    const runner = motion ? lines(motion.runner.segments, startMs, endMs) : lines(chart.runner, startMs, endMs)
    const reference = motion ? lines(motion.reference.segments, startMs, endMs) : lines(chart.reference, startMs, endMs)
    return {
        x: windowTimeAxis(startMs, endMs, durationMs),
        y: speedAxis(Math.max(fastest(runner), fastest(reference))),
        runner,
        reference,
        runnerAir: motion ? airSpans(motion.runner.segments, startMs, endMs) : [],
        referenceAir: motion ? airSpans(motion.reference.segments, startMs, endMs) : [],
        runnerEvents: motion ? eventsIn(motion.runner.events, startMs, endMs) : [],
        referenceEvents: motion ? eventsIn(motion.reference.events, startMs, endMs) : [],
        bands: chart.bands.filter(b => b.endMs >= startMs && b.startMs <= endMs),
        detailed: motion !== null,
    }
}
