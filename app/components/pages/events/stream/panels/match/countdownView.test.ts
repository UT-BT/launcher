import { describe, expect, it } from 'vitest'
import type { StreamMatch } from '../../streamDesk'
import { buildCountdownView, buildLocalTimeView } from './countdownView'

const NOW = Date.parse('2026-09-26T20:10:00Z')

function match(scheduledAt: string | null, countdownAt: string | null): StreamMatch {
    return { id: 'm1', scheduled_at: scheduledAt, countdown_at: countdownAt } as StreamMatch
}

describe('buildCountdownView', () => {
    it('has nothing to show without a match', () => {
        expect(buildCountdownView(null, NOW, 'UTC')).toBeNull()
    })

    it('counts down to the scheduled time when nothing moved it', () => {
        const view = buildCountdownView(match('2026-09-26T20:30:00+00:00', '2026-09-26T20:30:00+00:00'), NOW, 'UTC')
        expect(view).toEqual({
            scheduledText: '20:30 UTC · in 20m',
            targetText: '20:30 UTC · in 20m',
            moved: false,
            inputValue: '2026-09-26T20:30',
        })
    })

    it('shows a moved countdown next to the scheduled time', () => {
        const view = buildCountdownView(match('2026-09-26T20:00:00+00:00', '2026-09-26T20:45:00+00:00'), NOW, 'UTC')
        expect(view?.moved).toBe(true)
        expect(view?.scheduledText).toBe('20:00 UTC · 10m ago')
        expect(view?.targetText).toBe('20:45 UTC · in 35m')
        expect(view?.inputValue).toBe('2026-09-26T20:45')
    })

    it('treats a countdown on an unscheduled match as moved', () => {
        const view = buildCountdownView(match(null, '2026-09-26T20:45:00+00:00'), NOW, 'UTC')
        expect(view?.moved).toBe(true)
        expect(view?.scheduledText).toBe('Not scheduled')
    })

    it('says when there is no countdown at all', () => {
        const view = buildCountdownView(match(null, null), NOW, 'UTC')
        expect(view?.targetText).toBe('No countdown yet')
        expect(view?.moved).toBe(false)
        expect(view?.inputValue).toBe('')
    })
})

describe('the countdown input in the browser zone', () => {
    it('shows the current target as local wall time', () => {
        const view = buildCountdownView(match('2026-09-26T20:00:00+00:00', '2026-09-26T20:45:00+00:00'), NOW, 'Europe/Budapest')
        expect(view?.inputValue).toBe('2026-09-26T22:45')
        expect(view?.targetText).toBe('20:45 UTC · in 35m')
    })

    it('falls back to the scheduled time when nothing moved the countdown', () => {
        const view = buildCountdownView(match('2026-09-26T20:00:00+00:00', null), NOW, 'America/New_York')
        expect(view?.inputValue).toBe('2026-09-26T16:00')
    })
})

describe('buildLocalTimeView', () => {
    it('shows the UTC equivalent of the typed time', () => {
        expect(buildLocalTimeView('2026-09-26T22:30', 'Europe/Budapest')).toEqual({
            iso: '2026-09-26T20:30:00Z',
            utcText: '= 20:30 UTC',
            notice: null,
            error: null,
        })
    })

    it('names the UTC day when it differs from the typed day', () => {
        expect(buildLocalTimeView('2026-07-04T20:00', 'America/New_York')?.utcText).toBe('= 00:00 UTC · 5 Jul')
        expect(buildLocalTimeView('2026-09-27T00:30', 'Europe/Budapest')?.utcText).toBe('= 22:30 UTC · 26 Sep')
    })

    it('says which instant it takes when the clocks repeat', () => {
        const view = buildLocalTimeView('2026-10-25T02:30', 'Europe/Budapest')
        expect(view?.iso).toBe('2026-10-25T00:30:00Z')
        expect(view?.notice).toBe('The clocks repeat 02:30 that night. This is the first one, before they go back.')
        expect(view?.error).toBeNull()
    })

    it('refuses a time the clocks skip', () => {
        const view = buildLocalTimeView('2026-03-29T02:30', 'Europe/Budapest')
        expect(view?.iso).toBeNull()
        expect(view?.utcText).toBeNull()
        expect(view?.error).toBe('02:30 does not exist in Europe/Budapest that day, because the clocks go forward. Pick a time before or after.')
    })

    it('asks for a date and time when the input is empty or unfinished', () => {
        expect(buildLocalTimeView('', 'UTC')).toBeNull()
        expect(buildLocalTimeView('2026-02-30T10:00', 'UTC')?.error).toBe('Pick a date and time.')
    })
})
