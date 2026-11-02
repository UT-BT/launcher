import { listed, rowsOf, seen } from './steps'
import type { MobileRouteEntry } from './types'

export const servers: MobileRouteEntry = {
    view: 'servers',
    tier: 'public',
    path: '/servers',
    fixtures: 'servers',
    storage: seen('utbt:serversPageTutorial:v1'),
    ready: listed({
        heading: 'Servers',
        rows: data => rowsOf(data.gateway('/server-info')),
        label: (_row, page) => page.getByRole('button', { name: /^Favorite / }).first(),
        empty: 'No servers match your filters.',
    }),
    stress: { pr: 'long-text' },
}
