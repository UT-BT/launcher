import { describe, expect, it } from 'vitest'
import { formatSlotTime, parseApiInstant } from './timezone'

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
