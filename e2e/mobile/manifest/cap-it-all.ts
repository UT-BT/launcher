import { listed, rowsOf } from './steps'
import type { MobileRouteEntry } from './types'

export const capItAll: MobileRouteEntry = {
    view: 'cap-it-all',
    tier: 'public',
    path: '/cap-it-all',
    fixtures: 'cap-it-all',
    decorative: [],
    ready: listed({
        heading: 'Cap It All',
        rows: data => rowsOf(data.api('/v2/leaderboards/cap_it_all', 'limit=10&offset=0')),
        label: row => row.alias,
        empty: 'No players on this leaderboard yet.',
    }),
    stress: { pr: 'long-text' },
}
