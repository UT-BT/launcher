import { listed, rowsOf, seen } from './steps'
import type { MobileRouteEntry } from './types'

export const players: MobileRouteEntry = {
    view: 'players',
    tier: 'public',
    path: '/players',
    fixtures: 'players',
    storage: seen('utbt:playersPageTutorial:v1'),
    ready: listed({
        heading: 'Players',
        rows: data => rowsOf(data.api('/v2/players', 'limit=10&offset=0&order=asc&sort=rank')),
        label: row => row.alias,
        empty: 'No players found.',
    }),
    stress: { pr: 'long-text' },
}
