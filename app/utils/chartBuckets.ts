export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface WeekBucket {
    week: number
    label: string
    value: number
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
    return sorted.map(([week, value]) => ({
        week,
        label: new Date(week).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        value,
    }))
}
