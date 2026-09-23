import { describe, expect, it } from 'vitest'
import {
    formatSlotTime, fromZonedInput, parseApiInstant, startOfNextZonedDay, toZonedInput, zonedDayKey, zonedParts, zonedToInstant,
} from './timezone'

describe('parseApiInstant', () => {
    it('parses an offset-carrying timestamp', () => {
        expect(parseApiInstant('2026-09-25T18:00:00+00:00')).toBe(Date.parse('2026-09-25T18:00:00+00:00'))
    })

    it('parses a space-separated, zone-less timestamp as UTC', () => {
        expect(parseApiInstant('2026-09-25 18:00:00')).toBe(Date.parse('2026-09-25T18:00:00Z'))
    })

    it('returns null for missing or unparseable input', () => {
        expect(parseApiInstant(null)).toBeNull()
        expect(parseApiInstant(undefined)).toBeNull()
        expect(parseApiInstant('not a date')).toBeNull()
    })
})

describe('formatSlotTime', () => {
    it('renders in the given IANA zone, never a typed abbreviation', () => {
        const rendered = formatSlotTime('2026-09-25T18:00:00+00:00', 'America/New_York')
        expect(rendered).not.toMatch(/UTC|GMT/)
        expect(rendered.length).toBeGreaterThan(0)
    })

    it('falls back gracefully on an unparseable timestamp', () => {
        expect(formatSlotTime('not a date', 'UTC')).toBe('Unknown time')
    })
})

describe('zonedParts', () => {
    it('reads the wall clock in the given zone', () => {
        expect(zonedParts(Date.parse('2026-09-25T18:30:00Z'), 'America/New_York')).toEqual({
            year: 2026, month: 9, day: 25, hour: 14, minute: 30,
        })
    })

    it('reports midnight as hour 0', () => {
        expect(zonedParts(Date.parse('2026-09-25T00:00:00Z'), 'UTC').hour).toBe(0)
    })
})

describe('zonedToInstant', () => {
    it('round-trips a wall clock time through the zone', () => {
        const parts = { year: 2026, month: 10, day: 5, hour: 20, minute: 15 }
        expect(zonedToInstant(parts, 'Europe/Berlin')).toBe(Date.parse('2026-10-05T18:15:00Z'))
        expect(zonedToInstant(parts, 'Asia/Kathmandu')).toBe(Date.parse('2026-10-05T14:30:00Z'))
    })

    it('uses the right offset on either side of a DST change', () => {
        expect(zonedToInstant({ year: 2026, month: 10, day: 24, hour: 12, minute: 0 }, 'Europe/Berlin'))
            .toBe(Date.parse('2026-10-24T10:00:00Z'))
        expect(zonedToInstant({ year: 2026, month: 10, day: 26, hour: 12, minute: 0 }, 'Europe/Berlin'))
            .toBe(Date.parse('2026-10-26T11:00:00Z'))
    })
})

describe('startOfNextZonedDay', () => {
    it('lands on the next local midnight', () => {
        expect(startOfNextZonedDay(Date.parse('2026-10-05T21:00:00Z'), 'America/New_York'))
            .toBe(Date.parse('2026-10-06T04:00:00Z'))
    })

    it('spans a 25-hour DST-ending day', () => {
        expect(startOfNextZonedDay(Date.parse('2026-10-24T22:00:00Z'), 'Europe/Berlin'))
            .toBe(Date.parse('2026-10-25T23:00:00Z'))
    })
})

describe('zonedDayKey', () => {
    it('buckets an instant by its local calendar day', () => {
        expect(zonedDayKey(Date.parse('2026-10-05T23:30:00Z'), 'UTC')).toBe('2026-10-05')
        expect(zonedDayKey(Date.parse('2026-10-05T23:30:00Z'), 'Europe/Berlin')).toBe('2026-10-06')
    })
})

describe('toZonedInput / fromZonedInput', () => {
    it('renders an API instant as a wall clock input in the zone', () => {
        expect(toZonedInput('2026-10-05T18:15:00Z', 'Europe/Berlin')).toBe('2026-10-05T20:15')
        expect(toZonedInput(null, 'Europe/Berlin')).toBe('')
    })

    it('parses a wall clock input in the zone back to an ISO instant', () => {
        expect(fromZonedInput('2026-10-05T20:15', 'Europe/Berlin')).toBe('2026-10-05T18:15:00.000Z')
    })

    it('rejects empty or malformed input', () => {
        expect(fromZonedInput('', 'UTC')).toBeNull()
        expect(fromZonedInput('2026-10-05', 'UTC')).toBeNull()
    })
})
