import { listed, rowsOf, seen } from './steps'
import { pageTutorial } from './overlays'
import type { MobileRouteEntry } from './types'

export const servers: MobileRouteEntry = {
    view: 'servers',
    tier: 'public',
    path: '/servers',
    fixtures: 'servers',
    decorative: ['column 1'],
    storage: seen('utbt:serversPageTutorial:v1'),
    ready: listed({
        heading: 'Servers',
        rows: data => rowsOf(data.gateway('/server-info')),
        label: (_row, page) => page.getByRole('button', { name: /^Favorite / }).first(),
        empty: 'No servers match your filters.',
    }),
    modals: [pageTutorial('Servers')],
    stress: { pr: 'long-text' },
}
