import { describe, expect, it } from 'vitest'
import { formatCapTime, formatDelta, displayMapName, parseApiDate } from './format'

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

    it('returns null for garbage, empty, and non-string input', () => {
        expect(parseApiDate('not a date')).toBeNull()
        expect(parseApiDate('')).toBeNull()
        expect(parseApiDate(null)).toBeNull()
        expect(parseApiDate(42)).toBeNull()
    })
})
