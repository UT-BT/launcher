import { listed, rowsOf } from './steps'
import type { MobileRouteEntry } from './types'

export const news: MobileRouteEntry = {
    view: 'news',
    tier: 'public',
    path: '/news',
    fixtures: 'news',
    decorative: [],
    ready: listed({
        heading: 'News',
        rows: data => rowsOf(data.api('/v2/news'), 'items'),
        label: row => row.title,
        empty: 'No news to show.',
    }),
    stress: { pr: 'single-row' },
}
