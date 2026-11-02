import { listed, rowsOf } from './steps'
import type { MobileRouteEntry } from './types'

export const teams: MobileRouteEntry = {
    view: 'teams',
    tier: 'public',
    path: '/teams',
    fixtures: 'teams',
    ready: listed({
        heading: 'Teams',
        rows: data => rowsOf(data.api('/teams', 'limit=0&order=desc&sort=world_records'), 'teams'),
        label: row => row.name,
        empty: /^No teams/,
    }),
    stress: { pr: 'most-columns' },
}
