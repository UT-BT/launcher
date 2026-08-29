import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCapTime, formatDelta, displayMapName, formatAddedDate, formatTimeAgo, isNew, parseApiDate } from './format'

describe('formatCapTime', () => {
    it('rounds float64 representation error up to the stored millisecond', () => {
        expect(formatCapTime(73.6)).toBe('01:13.600')
        expect(formatCapTime(73.59999999999999)).toBe('01:13.600')
    })

    it('formats exact API values verbatim', () => {
        expect(formatCapTime(Number('73.600'))).toBe('01:13.600')
        expect(formatCapTime(Number('73.599'))).toBe('01:13.599')
        expect(formatCapTime(12.345)).toBe('00:12.345')
    })

    it('carries a rounded-up millisecond into the seconds field', () => {
        expect(formatCapTime(59.9995)).toBe('01:00.000')
        expect(formatCapTime(59.999)).toBe('00:59.999')
    })

    it('rounds sub-millisecond values to zero', () => {
        expect(formatCapTime(0.0004)).toBe('00:00.000')
        expect(formatCapTime(0)).toBe('00:00.000')
    })

    it('formats hours', () => {
        expect(formatCapTime(3723.456)).toBe('1:02:03.456')
    })
})

describe('formatDelta', () => {
    it('rounds sub-minute deltas via toFixed', () => {
        expect(formatDelta(0.6)).toBe('0.600s')
    })

    it('routes minute-plus deltas through formatCapTime rounding', () => {
        expect(formatDelta(73.6)).toBe('01:13.600')
    })
})

describe('displayMapName', () => {
    it('strips the shared prefixes', () => {
        expect(displayMapName('CTF-BT-Krypton')).toBe('Krypton')
        expect(displayMapName('CTF-BT+Krypton')).toBe('Krypton')
    })

    it('returns an empty string for null and undefined', () => {
        expect(displayMapName(null)).toBe('')
        expect(displayMapName(undefined)).toBe('')
    })
})

describe('parseApiDate', () => {
    it('parses space-separated naive datetimes as UTC', () => {
        const d = parseApiDate('2026-07-27 02:25:00.123456')
        expect(d).not.toBeNull()
        expect(d!.getTime()).toBe(Date.UTC(2026, 6, 27, 2, 25, 0, 123))
    })

    it('parses offset-less ISO datetimes as UTC', () => {
        const d = parseApiDate('2026-07-27T02:25:00')
        expect(d!.getTime()).toBe(Date.UTC(2026, 6, 27, 2, 25, 0))
    })

    it('parses offsetted ISO datetimes', () => {
        const d = parseApiDate('2026-07-27T02:25:00+00:00')
        expect(d!.getTime()).toBe(Date.UTC(2026, 6, 27, 2, 25, 0))
    })

    it('parses RFC-1123 datetimes', () => {
        const d = parseApiDate('Sun, 27 Jul 2026 02:25:00 GMT')
        expect(d!.getTime()).toBe(Date.UTC(2026, 6, 27, 2, 25, 0))
    })

    it('parses a bare calendar date as UTC midnight', () => {
        expect(parseApiDate('2026-08-26')!.toISOString()).toBe('2026-08-26T00:00:00.000Z')
        expect(parseApiDate('  2026-08-26  ')!.toISOString()).toBe('2026-08-26T00:00:00.000Z')
    })

    it('returns null for garbage, empty, and non-string input', () => {
        expect(parseApiDate('not a date')).toBeNull()
        expect(parseApiDate('')).toBeNull()
        expect(parseApiDate(null)).toBeNull()
        expect(parseApiDate(42)).toBeNull()
    })
})

describe('formatTimeAgo', () => {
    const NOW = Date.UTC(2026, 7, 26, 12, 0, 0)

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('reads a zone-less server timestamp as UTC, not as local time', () => {
        expect(formatTimeAgo('2026-08-26 11:30:00')).toBe('30m ago')
        expect(formatTimeAgo('2026-08-26T11:30:00')).toBe('30m ago')
    })

    it('agrees with the offset-bearing form of the same instant', () => {
        expect(formatTimeAgo('2026-08-26T11:30:00+00:00')).toBe('30m ago')
        expect(formatTimeAgo('2026-08-26T13:30:00+02:00')).toBe('30m ago')
        expect(formatTimeAgo('2026-08-26T11:30:00Z')).toBe('30m ago')
    })

    it('reads RFC-1123 timestamps', () => {
        expect(formatTimeAgo('Wed, 26 Aug 2026 11:30:00 GMT')).toBe('30m ago')
    })

    it('does not report a stale timestamp as just now', () => {
        expect(formatTimeAgo('2026-08-26 11:59:30')).toBe('just now')
        expect(formatTimeAgo('2026-08-26 11:58:00')).toBe('2m ago')
        expect(formatTimeAgo('2026-08-26 09:00:00')).toBe('3h ago')
    })

    it('says so instead of claiming just now when a stamp is in the future', () => {
        expect(formatTimeAgo('2026-08-26T14:00:00+00:00')).toBe('in 2h')
        expect(formatTimeAgo('2026-08-26T12:00:30+00:00')).toBe('just now')
    })

    it('scales past minutes into larger units', () => {
        expect(formatTimeAgo('2026-08-23T12:00:00Z')).toBe('3d ago')
        expect(formatTimeAgo('2026-08-05T12:00:00Z')).toBe('3w ago')
        expect(formatTimeAgo('2026-05-26T12:00:00Z')).toBe('3mo ago')
        expect(formatTimeAgo('2023-08-26T12:00:00Z')).toBe('3y ago')
    })

    it('returns a dash for unparseable input', () => {
        expect(formatTimeAgo('not a date')).toBe('—')
        expect(formatTimeAgo('')).toBe('—')
    })
})

describe('formatAddedDate', () => {
    it('resolves a zone-less stamp against UTC rather than the local zone', () => {
        const expected = new Date(Date.UTC(2026, 7, 26, 22, 30))
            .toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })

        expect(formatAddedDate('2026-08-26 22:30:00')).toBe(expected)
        expect(formatAddedDate('2026-08-26T22:30:00+00:00')).toBe(expected)
    })

    it('renders a date-only value as that calendar day in every viewer zone', () => {
        const expected = new Date(Date.UTC(2026, 7, 26))
            .toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' })

        expect(formatAddedDate('2026-08-26')).toBe(expected)
        expect(formatAddedDate('2026-08-26')).not.toBe('—')
    })

    it('returns a dash for unparseable input', () => {
        expect(formatAddedDate('not a date')).toBe('—')
    })
})

describe('isNew', () => {
    const NOW = Date.UTC(2026, 7, 26, 12, 0, 0)

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('accepts both serialization styles for the same instant', () => {
        expect(isNew('2026-08-20 08:00:00')).toBe(true)
        expect(isNew('2026-08-20T08:00:00+00:00')).toBe(true)
    })

    it('accepts a bare calendar date', () => {
        expect(isNew('2026-08-20')).toBe(true)
        expect(isNew('2026-06-20')).toBe(false)
    })

    it('rejects stamps outside the window and unparseable input', () => {
        expect(isNew('2026-06-20T08:00:00Z')).toBe(false)
        expect(isNew('not a date')).toBe(false)
    })
})
