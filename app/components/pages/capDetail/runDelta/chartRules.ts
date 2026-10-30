export interface AxisTick {
    ms: number
    label: string
}

export interface TimeAxis {
    domainMs: [number, number]
    stepMs: number
    endTick: boolean
    ticks: AxisTick[]
}

export interface DeltaAxis {
    domainMs: [number, number]
    stepMs: number
    ticks: AxisTick[]
}

const TIME_STEPS_MS = [500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000]
const MAX_TIME_TICKS = 7
const MINUTE_MS = 60000
const MIN_DELTA_STEP_MS = 10
const DELTA_INTERVALS = 5

function timeTickValues(durationMs: number, stepMs: number): { values: number[]; endTick: boolean } {
    const values: number[] = []
    for (let t = 0; t <= durationMs; t += stepMs) values.push(t)
    const remainder = durationMs - values[values.length - 1]
    const endTick = 20 * remainder > 9 * stepMs
    if (endTick) values.push(durationMs)
    return { values, endTick }
}

export function formatRunTime(ms: number, durationMs: number): string {
    if (durationMs < MINUTE_MS) {
        const tenths = Math.floor((ms + 50) / 100)
        return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}s`
    }
    const seconds = Math.floor((ms + 500) / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function timeAxis(durationMs: number): TimeAxis {
    const duration = Math.max(0, durationMs)
    const fallbackStep = TIME_STEPS_MS[TIME_STEPS_MS.length - 1]
    const stepMs = TIME_STEPS_MS.find(step => timeTickValues(duration, step).values.length <= MAX_TIME_TICKS) ?? fallbackStep
    const { values, endTick } = timeTickValues(duration, stepMs)
    return {
        domainMs: [0, duration],
        stepMs,
        endTick,
        ticks: values.map(ms => ({ ms, label: formatRunTime(ms, duration) })),
    }
}

function deltaStep(spanMs: number): number {
    for (let magnitude = MIN_DELTA_STEP_MS; ; magnitude *= 10) {
        for (const factor of [1, 2, 5]) {
            const step = factor * magnitude
            if (DELTA_INTERVALS * step >= spanMs) return step
        }
    }
}

function deltaDecimals(stepMs: number): number {
    if (stepMs < 100) return 2
    if (stepMs < 1000) return 1
    return 0
}

export function formatGapTick(ms: number, stepMs: number): string {
    const body = (Math.abs(ms) / 1000).toFixed(deltaDecimals(stepMs))
    if (ms > 0) return `+${body}s`
    if (ms < 0) return `−${body}s`
    return `${body}s`
}

export function deltaAxis(minDeltaMs: number, maxDeltaMs: number): DeltaAxis {
    const lo = Math.min(0, minDeltaMs)
    const hi = Math.max(0, maxDeltaMs)
    const stepMs = deltaStep(hi - lo)
    const pad = (stepMs * 3) / 20
    const domainMs: [number, number] = [lo - pad, hi + pad]
    const ticks: AxisTick[] = []
    for (let k = Math.ceil(domainMs[0] / stepMs); k * stepMs <= domainMs[1]; k++) {
        const ms = k * stepMs || 0
        ticks.push({ ms, label: formatGapTick(ms, stepMs) })
    }
    return { domainMs, stepMs, ticks }
}
