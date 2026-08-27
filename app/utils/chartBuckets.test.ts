import { describe, expect, it } from 'vitest'
import {
    BUCKET_LABEL,
    DAY_MS,
    MAX_RANGE_DAYS,
    MAX_RANGE_YEARS,
    RANGE_PRESETS,
    asChartBucket,
    bucketForSpanDays,
    formatWeekRange,
    isoDay,
    needsPointMarkers,
    parseIsoDay,
    presetById,
    presetRange,
    rangeSpanDays,
    splitPartialSeries,
    validateRange,
} from './chartBuckets'

const NOW = Date.UTC(2026, 7, 26, 14, 37, 12)
const TODAY = '2026-08-26'

function point(t: string, value: number, partial = false) {
    return { t, value, partial }
}

describe('bucketForSpanDays', () => {
    it('keeps short ranges hourly and long ranges monthly', () => {
        expect(bucketForSpanDays(1)).toBe('hour')
        expect(bucketForSpanDays(2)).toBe('hour')
        expect(bucketForSpanDays(3)).toBe('day')
        expect(bucketForSpanDays(62)).toBe('day')
        expect(bucketForSpanDays(63)).toBe('week')
        expect(bucketForSpanDays(730)).toBe('week')
        expect(bucketForSpanDays(731)).toBe('month')
    })

    it('never asks a ten year range for daily points', () => {
        expect(bucketForSpanDays(365 * 5)).toBe('month')
        expect(bucketForSpanDays(365 * 10)).toBe('month')
        expect(bucketForSpanDays(MAX_RANGE_DAYS)).toBe('month')
    })

    it('labels every bucket it can return', () => {
        for (const preset of RANGE_PRESETS) {
            expect(BUCKET_LABEL[bucketForSpanDays(preset.days)]).toBeTruthy()
        }
    })
})

describe('asChartBucket', () => {
    it('accepts the four server buckets and falls back to day', () => {
        expect(asChartBucket('hour')).toBe('hour')
        expect(asChartBucket('week')).toBe('week')
        expect(asChartBucket('month')).toBe('month')
        expect(asChartBucket('fortnight')).toBe('day')
        expect(asChartBucket(null)).toBe('day')
        expect(asChartBucket(undefined)).toBe('day')
    })
})

describe('presets', () => {
    it('exposes 5 and 10 year shortcuts', () => {
        expect(presetById('5y')?.days).toBe(1825)
        expect(presetById('10y')?.days).toBe(3650)
    })

    it('returns null for an unknown or absent id', () => {
        expect(presetById('42y')).toBeNull()
        expect(presetById(null)).toBeNull()
    })

    it('resolves to whole inclusive UTC days ending today', () => {
        expect(presetRange(1, NOW)).toEqual({ start: TODAY, end: TODAY })
        expect(presetRange(7, NOW)).toEqual({ start: '2026-08-20', end: TODAY })
        expect(presetRange(3650, NOW)).toEqual({ start: '2016-08-29', end: TODAY })
    })

    it('resolves every preset to exactly its own span', () => {
        for (const preset of RANGE_PRESETS) {
            const range = presetRange(preset.days, NOW)
            expect(rangeSpanDays(range.start, range.end)).toBe(preset.days)
            expect(validateRange(range.start, range.end, TODAY)).toBeNull()
        }
    })
})

describe('isoDay and parseIsoDay', () => {
    it('round-trips a UTC day', () => {
        expect(isoDay(NOW)).toBe(TODAY)
        expect(isoDay(parseIsoDay(TODAY))).toBe(TODAY)
    })

    it('rejects anything that is not a bare ISO day', () => {
        expect(parseIsoDay('2026-08-26T00:00:00Z')).toBeNaN()
        expect(parseIsoDay('26/08/2026')).toBeNaN()
        expect(parseIsoDay('')).toBeNaN()
    })
})

describe('rangeSpanDays', () => {
    it('counts both endpoints', () => {
        expect(rangeSpanDays(TODAY, TODAY)).toBe(1)
        expect(rangeSpanDays('2026-08-20', '2026-08-26')).toBe(7)
    })

    it('is unaffected by daylight saving shifts', () => {
        expect(rangeSpanDays('2026-03-01', '2026-04-01')).toBe(32)
        expect(rangeSpanDays('2026-10-01', '2026-11-01')).toBe(32)
    })
})

describe('validateRange', () => {
    it('accepts a sane range', () => {
        expect(validateRange('2026-08-01', '2026-08-26', TODAY)).toBeNull()
    })

    it('rejects a reversed range', () => {
        expect(validateRange('2026-08-26', '2026-08-01', TODAY)).toMatch(/before/)
    })

    it('rejects a start in the future', () => {
        expect(validateRange('2026-09-01', '2026-09-30', TODAY)).toMatch(/past/)
    })

    it('rejects an unparseable date', () => {
        expect(validateRange('nope', '2026-08-26', TODAY)).toMatch(/start/)
        expect(validateRange('2026-08-26', 'nope', TODAY)).toMatch(/end/)
    })

    it('rejects a span over the server limit', () => {
        const tooEarly = isoDay(parseIsoDay(TODAY) - MAX_RANGE_DAYS * DAY_MS)
        expect(validateRange(tooEarly, TODAY, TODAY)).toContain(String(MAX_RANGE_YEARS))
    })

    it('accepts a span exactly at the limit', () => {
        const limit = isoDay(parseIsoDay(TODAY) - (MAX_RANGE_DAYS - 1) * DAY_MS)
        expect(validateRange(limit, TODAY, TODAY)).toBeNull()
    })
})

describe('splitPartialSeries', () => {
    const label = (p: { t: string | null }) => p.t ?? ''
    const value = (p: { value: number }) => p.value

    it('leaves a fully complete series on the solid line', () => {
        const out = splitPartialSeries(
            [point('a', 1), point('b', 2), point('c', 3)],
            value,
            label,
        )
        expect(out.map((p) => p.value)).toEqual([1, 2, 3])
        expect(out.map((p) => p.partialValue)).toEqual([null, null, null])
    })

    it('moves the trailing partial bucket onto its own line', () => {
        const out = splitPartialSeries(
            [point('a', 10), point('b', 12), point('c', 4, true)],
            value,
            label,
        )
        expect(out.map((p) => p.value)).toEqual([10, 12, null])
        expect(out.map((p) => p.partialValue)).toEqual([null, 12, 4])
    })

    it('repeats the last complete bucket so the two lines join with no gap', () => {
        const out = splitPartialSeries(
            [point('a', 10), point('b', 12, true), point('c', 4, true)],
            value,
            label,
        )
        expect(out[0].partialValue).toBe(10)
        expect(out.map((p) => p.value)).toEqual([10, null, null])
    })

    it('handles a series that is partial from the very first bucket', () => {
        const out = splitPartialSeries([point('a', 5, true)], value, label)
        expect(out.map((p) => p.value)).toEqual([null])
        expect(out.map((p) => p.partialValue)).toEqual([5])
    })

    it('keeps zero buckets as zero rather than dropping them', () => {
        const out = splitPartialSeries(
            [point('a', 0), point('b', 0), point('c', 7)],
            value,
            label,
        )
        expect(out).toHaveLength(3)
        expect(out.map((p) => p.value)).toEqual([0, 0, 7])
    })

    it('carries the bucket timestamp, label and partial flag through', () => {
        const out = splitPartialSeries([point('a', 1), point('b', 2, true)], value, label)
        expect(out.map((p) => p.t)).toEqual(['a', 'b'])
        expect(out.map((p) => p.label)).toEqual(['a', 'b'])
        expect(out.map((p) => p.partial)).toEqual([false, true])
    })

    it('handles an empty series', () => {
        expect(splitPartialSeries([], value, label)).toEqual([])
    })
})

describe('formatWeekRange', () => {
    it('labels a UTC week with its own UTC days, not the local ones', () => {
        const monday = Date.UTC(2026, 7, 24)
        const label = formatWeekRange(monday, monday + 7 * DAY_MS - 1)
        expect(label).toContain('24')
        expect(label).toContain('30')
        expect(label).not.toContain('31')
    })

    it('spells out both years when a week crosses new year', () => {
        const monday = Date.UTC(2026, 11, 28)
        const label = formatWeekRange(monday, monday + 7 * DAY_MS - 1)
        expect(label).toContain('2026')
        expect(label).toContain('2027')
    })
})

describe('needsPointMarkers', () => {
    const label = (p: { t: string | null }) => p.t ?? ''
    const value = (p: { value: number }) => p.value

    it('marks a lone partial bucket that would otherwise draw nothing', () => {
        const out = splitPartialSeries([point('a', 5, true)], value, label)
        expect(out.map((p) => p.value)).toEqual([null])
        expect(out.map((p) => p.partialValue)).toEqual([5])
        expect(needsPointMarkers(out)).toBe(true)
    })

    it('marks a lone complete bucket too', () => {
        expect(needsPointMarkers(splitPartialSeries([point('a', 5)], value, label))).toBe(true)
    })

    it('marks a two bucket series whose second bucket is partial', () => {
        const out = splitPartialSeries([point('a', 5), point('b', 1, true)], value, label)
        expect(needsPointMarkers(out)).toBe(true)
    })

    it('leaves an ordinary series to draw plain lines', () => {
        const solid = splitPartialSeries([point('a', 1), point('b', 2), point('c', 3)], value, label)
        expect(needsPointMarkers(solid)).toBe(false)

        const trailing = splitPartialSeries(
            [point('a', 1), point('b', 2), point('c', 3, true)],
            value,
            label,
        )
        expect(needsPointMarkers(trailing)).toBe(false)
    })

    it('asks for nothing on an empty series', () => {
        expect(needsPointMarkers([])).toBe(false)
    })
})
