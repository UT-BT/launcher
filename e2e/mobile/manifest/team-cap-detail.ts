import { opens, opensWhenShown, shows } from './steps'
import type { MobileRouteEntry } from './types'

export const TEAM_CAP_ID = '2ac2a87f-1030-45ed-b281-bdcbf926717d'

export const teamCapDetail: MobileRouteEntry = {
    view: 'team-cap-detail',
    tier: 'public',
    path: `/team-caps/${TEAM_CAP_ID}`,
    fixtures: 'team-cap-detail',
    decorative: [],
    ready: shows(page => page.getByRole('button', { name: 'Watch Team Replay' })),
    modals: [
        {
            id: 'watch-team-replay',
            label: 'Team replay video',
            open: opens(page => page.getByRole('button', { name: 'Watch Team Replay' }), /^Replay Comparison/),
        },
        {
            id: 'watch-member-replay',
            label: 'Member replay video',
            open: opensWhenShown(page => page.getByRole('button', { name: 'Watch', exact: true }), /^Replay/),
        },
    ],
}
