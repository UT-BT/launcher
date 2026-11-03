import type { Page } from '@playwright/test'
import { listed, opens, rowsOf, seen, withCardsOpen } from './steps'
import { pageTutorial } from './overlays'
import type { MobileModal, MobileRouteEntry } from './types'

export const MAPS_PAGE = 'active=true&limit=10&offset=0&order=desc&sort=added'

export function mapsReady(query: string) {
    return listed({
        heading: 'Maps',
        rows: data => rowsOf(data.api('/maps', query)),
        label: row => String(row.name ?? '').replace(/^CTF-BT-/, ''),
        empty: 'No maps match your filters.',
    })
}

function inMaps(page: Page) {
    return page.getByRole('list', { name: 'Maps' }).or(page.getByRole('table'))
}

const demos: MobileModal = {
    id: 'demos',
    label: 'Demos',
    open: withCardsOpen(opens(page => inMaps(page).getByRole('button', { name: 'Demos', exact: true }), /^Replays —/)),
}

const reviews: MobileModal = {
    id: 'reviews',
    label: 'Map reviews',
    open: withCardsOpen(opens(page => inMaps(page).getByRole('button', { name: /^(\d+|No reviews, add one\?)$/ }), /^Reviews for /)),
}

export const maps: MobileRouteEntry = {
    view: 'maps',
    tier: 'public',
    path: '/maps',
    fixtures: 'maps',
    decorative: ['column 1'],
    storage: seen('utbt:mapsPageTutorial:v1'),
    ready: mapsReady(MAPS_PAGE),
    modals: [pageTutorial('Maps'), demos, reviews],
    stress: { pr: 'most-columns' },
    subViews: [
        { id: 'new', label: 'New maps only', path: '/maps?new=1', ready: mapsReady(`${MAPS_PAGE}&added_since=recent`) },
    ],
}
