export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface WeekBucket {
    week: number
    weekEnd: number
    label: string
    rangeLabel: string
    value: number
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }
const SHORT_DAY: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', timeZone: 'UTC' }

export function formatWeekRange(startMs: number, endMs: number): string {
    const start = new Date(startMs)
    const end = new Date(endMs)
    if (start.getUTCFullYear() === end.getUTCFullYear()) {
        return `${start.toLocaleDateString(undefined, SHORT_DAY)} – ${end.toLocaleDateString(undefined, SHORT_DATE)}`
    }
    return `${start.toLocaleDateString(undefined, SHORT_DATE)} – ${end.toLocaleDateString(undefined, SHORT_DATE)}`
}

export const DAY_MS = 24 * 60 * 60 * 1000

export function bucketByDay<T>(
    items: T[],
    getDate: (item: T) => string,
    getValue: (item: T) => number,
): WeekBucket[] {
    const buckets = new Map<number, number>()
    for (const item of items) {
        const ts = new Date(getDate(item)).getTime()
        if (isNaN(ts)) continue
        const day = Math.floor(ts / DAY_MS) * DAY_MS
        buckets.set(day, (buckets.get(day) ?? 0) + getValue(item))
    }
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    return sorted.map(([day, value]) => ({
        week: day,
        weekEnd: day + DAY_MS - 1,
        label: new Date(day).toLocaleDateString(undefined, SHORT_DATE),
        rangeLabel: new Date(day).toLocaleDateString(undefined, SHORT_DATE),
        value,
    }))
}

export function bucketByWeek<T>(
    items: T[],
    getDate: (item: T) => string,
    getValue: (item: T) => number,
): WeekBucket[] {
    const buckets = new Map<number, number>()
    for (const item of items) {
        const ts = new Date(getDate(item)).getTime()
        if (isNaN(ts)) continue
        const week = Math.floor(ts / WEEK_MS) * WEEK_MS
        buckets.set(week, (buckets.get(week) ?? 0) + getValue(item))
    }
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    return sorted.map(([week, value]) => {
        const weekEnd = week + WEEK_MS - 1
        return {
            week,
            weekEnd,
            label: new Date(week).toLocaleDateString(undefined, SHORT_DATE),
            rangeLabel: formatWeekRange(week, weekEnd),
            value,
        }
    })
}

export type ChartBucket = 'hour' | 'day' | 'week' | 'month'

const BUCKET_LADDER: { maxDays: number; bucket: ChartBucket }[] = [
    { maxDays: 2, bucket: 'hour' },
    { maxDays: 62, bucket: 'day' },
    { maxDays: 730, bucket: 'week' },
]

export const MAX_RANGE_YEARS = 20
export const MAX_RANGE_DAYS = 366 * MAX_RANGE_YEARS

export const BUCKET_LABEL: Record<ChartBucket, string> = {
    hour: 'hourly',
    day: 'daily',
    week: 'weekly',
    month: 'monthly',
}

export function bucketForSpanDays(days: number): ChartBucket {
    for (const step of BUCKET_LADDER) {
        if (days <= step.maxDays) return step.bucket
    }
    return 'month'
}

export function asChartBucket(value: string | null | undefined): ChartBucket {
    return value === 'hour' || value === 'day' || value === 'week' || value === 'month' ? value : 'day'
}

export interface RangePreset {
    id: string
    label: string
    days: number
}

export const RANGE_PRESETS: RangePreset[] = [
    { id: 'today', label: 'Today', days: 1 },
    { id: '7d', label: '7d', days: 7 },
    { id: '30d', label: '30d', days: 30 },
    { id: '3m', label: '3m', days: 91 },
    { id: '6m', label: '6m', days: 182 },
    { id: '1y', label: '1y', days: 365 },
    { id: '5y', label: '5y', days: 1825 },
    { id: '10y', label: '10y', days: 3650 },
]

export function presetById(id: string | null): RangePreset | null {
    return RANGE_PRESETS.find((preset) => preset.id === id) ?? null
}

export function isoDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

export function parseIsoDay(value: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const ms = Date.parse(`${value}T00:00:00Z`)
    return Number.isNaN(ms) ? NaN : ms
}

export function presetRange(days: number, nowMs: number): { start: string; end: string } {
    const end = Math.floor(nowMs / DAY_MS) * DAY_MS
    return { start: isoDay(end - Math.max(0, days - 1) * DAY_MS), end: isoDay(end) }
}

export function rangeSpanDays(startIso: string, endIso: string): number {
    const start = parseIsoDay(startIso)
    const end = parseIsoDay(endIso)
    if (Number.isNaN(start) || Number.isNaN(end)) return NaN
    return Math.round((end - start) / DAY_MS) + 1
}

export function validateRange(startIso: string, endIso: string, todayIso: string): string | null {
    const start = parseIsoDay(startIso)
    const end = parseIsoDay(endIso)
    if (Number.isNaN(start)) return 'Pick a valid start date.'
    if (Number.isNaN(end)) return 'Pick a valid end date.'
    if (start > end) return 'Start date must be on or before the end date.'
    const today = parseIsoDay(todayIso)
    if (!Number.isNaN(today) && start > today) return 'Start date must be in the past.'
    const span = Math.round((end - start) / DAY_MS) + 1
    if (span > MAX_RANGE_DAYS) return `Pick a range of ${MAX_RANGE_YEARS} years or less.`
    return null
}

export interface PartialSeriesPoint {
    t: string | null
    label: string
    partial: boolean
    value: number | null
    partialValue: number | null
}

export function splitPartialSeries<T extends { t: string | null; partial?: boolean }>(
    points: T[],
    getValue: (point: T) => number,
    getLabel: (point: T) => string,
): PartialSeriesPoint[] {
    const firstPartial = points.findIndex((point) => point.partial === true)
    const joinIndex = firstPartial > 0 ? firstPartial - 1 : -1
    return points.map((point, index) => {
        const partial = point.partial === true
        const value = getValue(point)
        return {
            t: point.t,
            label: getLabel(point),
            partial,
            value: partial ? null : value,
            partialValue: partial || index === joinIndex ? value : null,
        }
    })
}

export function needsPointMarkers(series: PartialSeriesPoint[]): boolean {
    let solid = 0
    let dashed = 0
    for (const point of series) {
        if (point.value !== null) solid += 1
        if (point.partialValue !== null) dashed += 1
    }
    return solid === 1 || dashed === 1
}
