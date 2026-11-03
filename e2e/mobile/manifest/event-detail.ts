import { heading, opens } from './steps'
import type { MobileRouteEntry, MobileSubView } from './types'

export const EVENT_SLUG = '2v2-cup-2026'
const EVENT_NAME = 'UTBT 2v2 World Cup 2026'

function tab(id: string, label: string): MobileSubView {
    return { id, label, path: `/events/${EVENT_SLUG}?tab=${id}`, ready: heading(EVENT_NAME) }
}

export const eventDetail: MobileRouteEntry = {
    view: 'event-detail',
    tier: 'public',
    path: `/events/${EVENT_SLUG}`,
    fixtures: 'event-detail',
    decorative: [],
    ready: heading(EVENT_NAME),
    subViews: [
        { ...tab('teams', 'Stats'), stress: { pr: 'long-text' } },
        tab('bracket', 'Bracket'),
        tab('maps', 'Maps'),
        tab('schedule', 'Schedule'),
        {
            ...tab('predictions', 'Predictions'),
            modals: [
                {
                    id: 'backers',
                    label: 'Backers',
                    open: opens(page => page.getByTitle('See who has predicted on this match'), / vs /),
                },
            ],
        },
        tab('achievements', 'Achievements'),
    ],
}
