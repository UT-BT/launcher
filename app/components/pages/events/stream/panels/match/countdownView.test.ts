import { describe, expect, it } from 'vitest'
import type { StreamMatch } from '../../streamDesk'
import { buildCountdownView, isoFromUtcInput, utcInputValue } from './countdownView'

const NOW = Date.parse('2026-09-26T20:10:00Z')

function match(scheduledAt: string | null, countdownAt: string | null): StreamMatch {
    return { id: 'm1', scheduled_at: scheduledAt, countdown_at: countdownAt } as StreamMatch
}

describe('buildCountdownView', () => {
    it('has nothing to show without a match', () => {
        expect(buildCountdownView(null, NOW)).toBeNull()
    })

    it('counts down to the scheduled time when nothing moved it', () => {
        const view = buildCountdownView(match('2026-09-26T20:30:00+00:00', '2026-09-26T20:30:00+00:00'), NOW)
        expect(view).toEqual({
            scheduledText: '20:30 UTC · in 20m',
            targetText: '20:30 UTC · in 20m',
            moved: false,
            inputValue: '2026-09-26T20:30',
        })
    })

    it('shows a moved countdown next to the scheduled time', () => {
        const view = buildCountdownView(match('2026-09-26T20:00:00+00:00', '2026-09-26T20:45:00+00:00'), NOW)
        expect(view?.moved).toBe(true)
        expect(view?.scheduledText).toBe('20:00 UTC · 10m ago')
        expect(view?.targetText).toBe('20:45 UTC · in 35m')
        expect(view?.inputValue).toBe('2026-09-26T20:45')
    })

    it('treats a countdown on an unscheduled match as moved', () => {
        const view = buildCountdownView(match(null, '2026-09-26T20:45:00+00:00'), NOW)
        expect(view?.moved).toBe(true)
        expect(view?.scheduledText).toBe('Not scheduled')
    })

    it('says when there is no countdown at all', () => {
        const view = buildCountdownView(match(null, null), NOW)
        expect(view?.targetText).toBe('No countdown yet')
        expect(view?.moved).toBe(false)
        expect(view?.inputValue).toBe('')
    })
})

describe('UTC time input', () => {
    it('writes an instant as a UTC datetime-local value', () => {
        expect(utcInputValue('2026-09-26T22:05:00+02:00')).toBe('2026-09-26T20:05')
        expect(utcInputValue(null)).toBe('')
    })

    it('reads a datetime-local value as UTC', () => {
        expect(isoFromUtcInput('2026-09-26T21:15')).toBe('2026-09-26T21:15:00Z')
        expect(isoFromUtcInput(' 2026-12-31T23:59 ')).toBe('2026-12-31T23:59:00Z')
    })

    it('rejects an empty or impossible time', () => {
        expect(isoFromUtcInput('')).toBeNull()
        expect(isoFromUtcInput('2026-02-30T10:00')).toBeNull()
        expect(isoFromUtcInput('2026-09-26T24:00')).toBeNull()
        expect(isoFromUtcInput('tomorrow')).toBeNull()
    })
})
