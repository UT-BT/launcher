import { opensWhenShown, settledStage, shows, tap } from './steps'
import type { MobileRouteEntry } from './types'

export const TEAM_CAP_ID = '2ac2a87f-1030-45ed-b281-bdcbf926717d'

export const teamCapDetail: MobileRouteEntry = {
    view: 'team-cap-detail',
    tier: 'public',
    path: `/team-caps/${TEAM_CAP_ID}`,
    fixtures: 'team-cap-detail',
    decorative: [],
    ready: shows(page => page.getByRole('main').getByRole('link', { name: 'Watch Team Run' })),
    modals: [
        {
            id: 'watch-member-replay',
            label: 'Member replay video',
            open: opensWhenShown(page => page.getByRole('button', { name: 'Watch', exact: true }), /^Replay/),
        },
    ],
    subViews: [
        {
            id: 'watch-team-replay',
            label: 'Watch Team Run, on the compare page',
            open: tap(page => page.getByRole('main').getByRole('link', { name: 'Watch Team Run' })),
            ready: settledStage,
        },
    ],
}
