import { describe, expect, it } from 'vitest'
import type { EventStatus } from './api'
import { isSignupOnlyTab, signupsClosed } from './signupWindow'

const NOW = Date.parse('2026-10-01T12:00:00Z')

function event(status: EventStatus, signups_open = false, signup_closes_at: string | null = null) {
    return { status, signups_open, signup_closes_at }
}

describe('signupsClosed', () => {
    it('is false while signups are open', () => {
        expect(signupsClosed(event('signups_open', true), NOW)).toBe(false)
        expect(signupsClosed(event('announced', true, '2026-10-02 12:00:00'), NOW)).toBe(false)
    })

    it('is false before signups have opened', () => {
        expect(signupsClosed(event('draft'), NOW)).toBe(false)
        expect(signupsClosed(event('announced'), NOW)).toBe(false)
        expect(signupsClosed(event('announced', false, '2026-10-05 12:00:00'), NOW)).toBe(false)
    })

    it('is true once signups have closed or the event has moved on', () => {
        for (const status of ['signups_closed', 'active', 'completed', 'archived'] as const) {
            expect(signupsClosed(event(status), NOW), status).toBe(true)
        }
    })

    it('is true for an announced event whose signup window has passed', () => {
        expect(signupsClosed(event('announced', false, '2026-10-01 11:59:00'), NOW)).toBe(true)
        expect(signupsClosed(event('announced', false, '2026-10-01T12:00:00+00:00'), NOW)).toBe(true)
    })
})

describe('isSignupOnlyTab', () => {
    it('names the Looking for Partner and Signup tabs only', () => {
        expect(isSignupOnlyTab('players')).toBe(true)
        expect(isSignupOnlyTab('signup')).toBe(true)
        expect(isSignupOnlyTab('teams')).toBe(false)
        expect(isSignupOnlyTab('manage')).toBe(false)
    })
})
