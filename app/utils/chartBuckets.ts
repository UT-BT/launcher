export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface WeekBucket {
    week: number
    weekEnd: number
    label: string
    rangeLabel: string
    value: number
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' }

export function formatWeekRange(startMs: number, endMs: number): string {
    const start = new Date(startMs)
    const end = new Date(endMs)
    if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} – ${end.toLocaleDateString(undefined, SHORT_DATE)}`
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
