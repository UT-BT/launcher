import { EVENT_SLUG } from './event-detail'
import { heading } from './steps'
import type { MobileRouteEntry } from './types'

export const EVENT_TEAM_ID = '01c942d8-95ac-49cd-85be-791b18e24b86'

export const eventTeam: MobileRouteEntry = {
    view: 'event-team',
    tier: 'public',
    path: `/events/${EVENT_SLUG}/teams/${EVENT_TEAM_ID}`,
    fixtures: 'event-team',
    ready: heading('Matches'),
    stress: { pr: 'long-text' },
}
