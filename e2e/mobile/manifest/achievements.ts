import { listed, rowsOf } from './steps'
import type { MobileRouteEntry } from './types'

export const achievements: MobileRouteEntry = {
    view: 'achievements',
    tier: 'public',
    path: '/achievements',
    fixtures: 'achievements',
    ready: listed({
        heading: 'Achievements',
        rows: data => rowsOf(data.api('/v2/achievements/definitions'), 'achievements'),
        label: row => row.name,
        empty: /^No achievements/,
    }),
}
