import { EVENT_SLUG } from './event-detail'
import { shows } from './steps'
import type { MobileRouteEntry } from './types'

export const MATCH_ID = '673d41c0-0ad0-4fdb-8f41-eeb1cb108934'

export const matchPickban: MobileRouteEntry = {
    view: 'match-pickban',
    tier: 'public',
    path: `/events/${EVENT_SLUG}/matches/${MATCH_ID}`,
    fixtures: 'match-pickban',
    decorative: [],
    ready: shows(page => page.getByRole('region', { name: 'Picks & Bans Stage' })
        .or(page.getByRole('heading', { name: 'Picks & Bans page not available' }))
        .first()),
}
