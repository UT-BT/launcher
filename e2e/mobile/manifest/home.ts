import { consentPolicy } from './overlays'
import { listed, recordShown, rowsOf, watchesReplay } from './steps'
import type { MobileRouteEntry } from './types'

const ready = listed({
    heading: 'Latest World Records',
    rows: data => rowsOf(data.api('/v2/summary'), 'recentWorldRecords'),
    label: recordShown,
    empty: /^No (world )?records/i,
})

export const home: MobileRouteEntry = {
    view: 'home',
    tier: 'public',
    path: '/',
    fixtures: 'home',
    ready,
    stress: { pr: 'long-text' },
    modals: [
        {
            id: 'watch-replay',
            label: 'Replay video',
            open: watchesReplay(page => page.locator('section').filter({
                has: page.getByRole('heading', { name: 'Latest World Records' }),
            })),
        },
        consentPolicy(ready),
    ],
}
