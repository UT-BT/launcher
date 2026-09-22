import { describe, expect, it } from 'vitest'
import {
    DEFAULT_MATCH_DURATION_MINUTES_BY_KIND,
    MAX_PROPOSAL_SLOTS,
    MIN_LEAD_HOURS,
    SLOT_BOUNDARY_MINUTES,
    annotatedCandidateSlots,
    effectiveMatchDurationMinutes,
    generateCandidateSlots,
    resolveGenerationWindow,
    slotAvailability,
} from './slotGeneration'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

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

describe('resolveGenerationWindow', () => {
    it('starts at opens_at when it is already on a boundary and after now', () => {
        const now = Date.parse('2026-10-01T00:00:00Z')
        const opensAt = Date.parse('2026-10-05T12:00:00Z')
        const { start } = resolveGenerationWindow({ opens_at: '2026-10-05T12:00:00Z', closes_at: null }, 60, now)
        expect(start).toBe(opensAt)
    })

    it('starts at now rounded up to the next 15-minute boundary when the window is already open', () => {
        const now = Date.parse('2026-10-05T12:07:00Z')
        const { start } = resolveGenerationWindow({ opens_at: '2026-10-01T00:00:00Z', closes_at: null }, 60, now)
        expect(start).toBe(Date.parse('2026-10-05T12:15:00Z'))
    })

    it('leaves now untouched when it already lands on a boundary', () => {
        const now = Date.parse('2026-10-05T12:15:00Z')
        const { start } = resolveGenerationWindow({ opens_at: null, closes_at: null }, 60, now)
        expect(start).toBe(now)
    })

    it('ends at closes_at minus the match duration, so every candidate still fits inside the window', () => {
        const now = Date.parse('2026-10-01T00:00:00Z')
        const { end } = resolveGenerationWindow(
            { opens_at: '2026-10-05T12:00:00Z', closes_at: '2026-10-05T14:00:00Z' }, 45, now,
        )
        expect(end).toBe(Date.parse('2026-10-05T14:00:00Z') - 45 * 60_000)
    })

    it('caps an unbounded window (no closes_at) at a sane forward horizon', () => {
        const now = Date.parse('2026-10-05T12:00:00Z')
        const { start, end } = resolveGenerationWindow({ opens_at: null, closes_at: null }, 60, now)
        expect(end - start).toBe(14 * DAY)
    })
})

describe('generateCandidateSlots', () => {
    it('generates every 15-minute-aligned instant across a short window', () => {
        const now = Date.parse('2026-10-01T00:00:00Z')
        const slots = generateCandidateSlots(
            { opens_at: '2026-10-05T12:00:00Z', closes_at: '2026-10-05T13:00:00Z' }, 0, now,
        )
        expect(slots).toEqual([
            Date.parse('2026-10-05T12:00:00Z'),
            Date.parse('2026-10-05T12:15:00Z'),
            Date.parse('2026-10-05T12:30:00Z'),
            Date.parse('2026-10-05T12:45:00Z'),
            Date.parse('2026-10-05T13:00:00Z'),
        ])
    })

    it('produces no candidates once the window is too short to fit the match', () => {
        const now = Date.parse('2026-10-01T00:00:00Z')
        const slots = generateCandidateSlots(
            { opens_at: '2026-10-05T12:00:00Z', closes_at: '2026-10-05T12:30:00Z' }, 60, now,
        )
        expect(slots).toEqual([])
    })

    it('holds every consecutive pair exactly 15 minutes apart across a US spring-forward DST transition', () => {
        const now = Date.parse('2026-01-01T00:00:00Z')
        const window = { opens_at: '2026-03-08T06:00:00Z', closes_at: '2026-03-08T08:00:00Z' }
        const slots = generateCandidateSlots(window, 15, now)

        expect(slots.length).toBeGreaterThan(4)

        for (let i = 1; i < slots.length; i += 1) {
            expect(slots[i] - slots[i - 1]).toBe(15 * 60_000)
        }

        expect(slots[0]).toBe(Date.parse('2026-03-08T06:00:00Z'))
        expect(slots[slots.length - 1]).toBe(Date.parse('2026-03-08T07:45:00Z'))
    })

    it('holds every consecutive pair exactly 15 minutes apart across a US fall-back DST transition', () => {
        const now = Date.parse('2026-01-01T00:00:00Z')
        const window = { opens_at: '2026-11-01T05:00:00Z', closes_at: '2026-11-01T07:00:00Z' }
        const slots = generateCandidateSlots(window, 15, now)

        for (let i = 1; i < slots.length; i += 1) {
            expect(slots[i] - slots[i - 1]).toBe(15 * 60_000)
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

describe('annotatedCandidateSlots', () => {
    it('pairs every generated slot with its availability', () => {
        const now = Date.parse('2026-10-05T10:00:00Z')
        const window = { opens_at: '2026-10-05T10:00:00Z', closes_at: '2026-10-05T14:00:00Z' }
        const annotated = annotatedCandidateSlots(window, 60, now, [], [])

        expect(annotated.length).toBeGreaterThan(0)
        expect(annotated.some(slot => !slot.availability.available && slot.availability.reason === 'inside_lead_time')).toBe(true)
        expect(annotated.some(slot => slot.availability.available)).toBe(true)
    })
})
