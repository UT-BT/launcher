import { heading } from './steps'
import type { MobileRouteEntry } from './types'

export const newsDetail: MobileRouteEntry = {
    view: 'news-detail',
    tier: 'public',
    path: '/news/15',
    fixtures: 'news-detail',
    ready: heading('2v2 Group Stage has completed - on to the play-offs!'),
}
