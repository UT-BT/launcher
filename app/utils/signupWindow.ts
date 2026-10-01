import { parseApiInstant } from './timezone'
import type { EventStatus, EventSummary } from './api'

const SIGNUPS_OVER_STATUSES: readonly EventStatus[] = ['signups_closed', 'active', 'completed', 'archived']

export const SIGNUP_ONLY_TABS = ['players', 'signup'] as const

export function signupsClosed(event: Pick<EventSummary, 'status' | 'signups_open' | 'signup_closes_at'>, now: number): boolean {
    if (event.signups_open) return false
    if (SIGNUPS_OVER_STATUSES.includes(event.status)) return true

    const closesAt = parseApiInstant(event.signup_closes_at)
    return event.status === 'announced' && closesAt !== null && closesAt <= now
}

export function isSignupOnlyTab(tab: string): boolean {
    return (SIGNUP_ONLY_TABS as readonly string[]).includes(tab)
}
