import { listed, recordShown, rowsOf, shows, steps, tap, watchRun, wrHistory } from './steps'
import type { MobileRouteEntry } from './types'

export const worldRecords: MobileRouteEntry = {
    view: 'world-records',
    tier: 'public',
    path: '/world-records',
    fixtures: 'world-records',
    decorative: [],
    ready: listed({
        heading: 'World Records',
        rows: data => rowsOf(data.api('/v2/world_records', 'limit=10&offset=0&sort=desc&sort_by=added')),
        label: recordShown,
        empty: 'No world records found.',
    }),
    stress: { pr: 'most-columns' },
    modals: [wrHistory, watchRun],
    subViews: [
        {
            id: 'rushers',
            label: 'Top Rushers',
            open: tap(page => page.getByRole('button', { name: 'Top Rushers' })),
            ready: steps(
                shows(page => page.getByRole('columnheader', { name: 'Rusher' })
                    .or(page.getByRole('list', { name: 'Top rushers' }))
                    .or(page.getByText('No rushers found.'))
                    .first()),
                listed({
                    rows: data => rowsOf(data.api('/v2/world_records/rushers', 'limit=10&offset=0'), 'items'),
                    label: row => row.alias,
                    empty: 'No rushers found.',
                }),
            ),
            stress: { pr: 'long-text' },
        },
    ],
}
