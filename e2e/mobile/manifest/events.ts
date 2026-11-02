import { listed, rowsOf } from './steps'
import type { MobileRouteEntry } from './types'

export const events: MobileRouteEntry = {
    view: 'events',
    tier: 'public',
    path: '/events',
    fixtures: 'events',
    ready: listed({
        heading: 'Events',
        rows: data => rowsOf(data.api('/tournaments'), 'items'),
        label: row => row.name,
        empty: 'No events yet. Check back soon!',
    }),
    stress: { pr: 'empty' },
}
