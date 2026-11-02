import { listed, rowsOf, seen } from './steps'
import type { MobileRouteEntry } from './types'

const PAGE = 'active=true&limit=10&offset=0&order=desc&sort=added'

function mapsReady(query: string) {
    return listed({
        heading: 'Maps',
        rows: data => rowsOf(data.api('/maps', query)),
        label: row => String(row.name ?? '').replace(/^CTF-BT-/, ''),
        empty: 'No maps match your filters.',
    })
}

export const maps: MobileRouteEntry = {
    view: 'maps',
    tier: 'public',
    path: '/maps',
    fixtures: 'maps',
    storage: seen('utbt:mapsPageTutorial:v1'),
    ready: mapsReady(PAGE),
    stress: { pr: 'most-columns' },
    subViews: [
        { id: 'new', label: 'New maps only', path: '/maps?new=1', ready: mapsReady(`${PAGE}&added_since=recent`) },
    ],
}
