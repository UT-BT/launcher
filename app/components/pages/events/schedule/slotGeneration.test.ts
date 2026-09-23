import { describe, expect, it } from 'vitest'
import {
    DEFAULT_MATCH_DURATION_MINUTES_BY_KIND,
    MAX_PROPOSAL_SLOTS,
    MIN_LEAD_HOURS,
    SLOT_BOUNDARY_MINUTES,
    effectiveMatchDurationMinutes,
    pickerBounds,
    slotAvailability,
} from './slotGeneration'

describe('constants', () => {
    it('mirror the backend validation constants exactly', () => {
        expect(MAX_PROPOSAL_SLOTS).toBe(5)
        expect(MIN_LEAD_HOURS).toBe(2)
        expect(SLOT_BOUNDARY_MINUTES).toBe(15)
    })
})

describe('effectiveMatchDurationMinutes', () => {
    it('uses the stage override when set', () => {
        expect(effectiveMatchDurationMinutes({ kind: 'groups', expected_match_duration_minutes: 45 })).toBe(45)
    })

    it('falls back to the per-kind default when the stage has no override', () => {
        expect(effectiveMatchDurationMinutes({ kind: 'groups', expected_match_duration_minutes: null })).toBe(75)
        expect(effectiveMatchDurationMinutes({ kind: 'swiss', expected_match_duration_minutes: null })).toBe(60)
        expect(effectiveMatchDurationMinutes({ kind: 'single_elim', expected_match_duration_minutes: null })).toBe(60)
    })

    it('matches the DEFAULT_MATCH_DURATION_MINUTES_BY_KIND table for every kind', () => {
        for (const kind of Object.keys(DEFAULT_MATCH_DURATION_MINUTES_BY_KIND) as Array<keyof typeof DEFAULT_MATCH_DURATION_MINUTES_BY_KIND>) {
            expect(effectiveMatchDurationMinutes({ kind, expected_match_duration_minutes: null })).toBe(DEFAULT_MATCH_DURATION_MINUTES_BY_KIND[kind])
        }
    })
})

describe('slotAvailability', () => {
    const window = { opens_at: '2026-10-05T00:00:00Z', closes_at: '2026-10-05T18:00:00Z' }
    const now = Date.parse('2026-10-05T10:00:00Z')
    const durationMinutes = 60

    it('is available when every rule passes', () => {
        const slot = Date.parse('2026-10-05T13:00:00Z')
        expect(slotAvailability(slot, window, durationMinutes, now, [], [])).toEqual({ available: true })
    })

    it('reports off_boundary for a slot not on a 15-minute mark', () => {
        const slot = Date.parse('2026-10-05T13:05:00Z')
        expect(slotAvailability(slot, window, durationMinutes, now, [], [])).toEqual({
            available: false, reason: 'off_boundary',
        })
    })

    it('reports outside_window for a slot before opens_at', () => {
        const slot = Date.parse('2026-10-04T23:45:00Z')
        expect(slotAvailability(slot, window, durationMinutes, now, [], [])).toEqual({
            available: false, reason: 'outside_window',
        })
    })

    it('reports outside_window for a slot after closes_at', () => {
        const slot = Date.parse('2026-10-05T18:15:00Z')
        expect(slotAvailability(slot, window, durationMinutes, now, [], [])).toEqual({
            available: false, reason: 'outside_window',
        })
    })

    it('reports inside_lead_time for a slot under two hours from now', () => {
        const slot = Date.parse('2026-10-05T11:00:00Z')
        expect(slotAvailability(slot, window, durationMinutes, now, [], [])).toEqual({
            available: false, reason: 'inside_lead_time',
        })
    })

    it('reports conflicts_with_booking when the slot overlaps a booking held by either team', () => {
        const slot = Date.parse('2026-10-05T13:00:00Z')
        const bookedByTeamA = [{ starts_at: '2026-10-05T13:30:00Z', ends_at: '2026-10-05T14:30:00Z' }]
        expect(slotAvailability(slot, window, durationMinutes, now, bookedByTeamA, [])).toEqual({
            available: false, reason: 'conflicts_with_booking',
        })

        const bookedByTeamB = [{ starts_at: '2026-10-05T12:30:00Z', ends_at: '2026-10-05T13:15:00Z' }]
        expect(slotAvailability(slot, window, durationMinutes, now, [], bookedByTeamB)).toEqual({
            available: false, reason: 'conflicts_with_booking',
        })
    })

    it('is available when a booking is adjacent but does not overlap (half-open interval)', () => {
        const slot = Date.parse('2026-10-05T13:00:00Z')
        const bookedByTeamA = [{ starts_at: '2026-10-05T14:00:00Z', ends_at: '2026-10-05T15:00:00Z' }]
        expect(slotAvailability(slot, window, durationMinutes, now, bookedByTeamA, [])).toEqual({ available: true })
    })
})

describe('pickerBounds', () => {
    it('uses opens_at as the floor when it is already past the lead time', () => {
        const now = Date.parse('2026-10-01T00:00:00Z')
        const { minMs } = pickerBounds({ opens_at: '2026-10-05T12:00:00Z', closes_at: null }, 60, now)
        expect(minMs).toBe(Date.parse('2026-10-05T12:00:00Z'))
    })

    it('floors at the lead time, rounded up to the next 15-minute mark, when it is later than opens_at', () => {
        const now = Date.parse('2026-10-05T12:07:00Z')
        const { minMs } = pickerBounds({ opens_at: '2026-10-01T00:00:00Z', closes_at: null }, 60, now)
        expect(minMs).toBe(Date.parse('2026-10-05T14:15:00Z'))
    })

    it('has no max when the window has no closes_at', () => {
        const { maxMs } = pickerBounds({ opens_at: null, closes_at: null }, 60, Date.parse('2026-10-01T00:00:00Z'))
        expect(maxMs).toBeNull()
    })

    it('subtracts the match duration from closes_at, so a picked start still leaves room to finish inside the window', () => {
        const { maxMs } = pickerBounds(
            { opens_at: null, closes_at: '2026-10-05T14:00:00Z' }, 45, Date.parse('2026-10-01T00:00:00Z'),
        )
        expect(maxMs).toBe(Date.parse('2026-10-05T14:00:00Z') - 45 * 60_000)
    })
})
