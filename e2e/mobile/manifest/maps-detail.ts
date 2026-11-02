import { opens, opensWhenShown, shows, steps, tap, watchRun, wrHistory } from './steps'
import type { MobileRouteEntry, PageStep } from './types'

export const MAP_NAME = 'CTF-BT-HumanResources'
export const TEAM_MAP_NAME = 'CTF-BT-II-SkaarjInvasion-vF2'

const leaderboardShown: PageStep = shows(page => page
    .locator('a[href^="/caps/"], a[href^="/team-caps/"]')
    .or(page.getByText(/^No (caps|team runs) yet\.$/))
    .first())

export const mapsDetail: MobileRouteEntry = {
    view: 'maps-detail',
    tier: 'public',
    path: `/maps/${MAP_NAME}`,
    fixtures: 'maps-detail',
    ready: leaderboardShown,
    stress: { pr: 'long-text' },
    modals: [
        {
            id: 'playtime',
            label: 'Playtime breakdown',
            open: opens(page => page.getByRole('button', { name: /Total Playtime/ }), /^Playtime/),
        },
        {
            id: 'cap-distribution',
            label: 'Cap time distribution',
            open: opens(page => page.getByRole('button', { name: /Median (Certified|Team) Time/ }), /Distribution/),
        },
        wrHistory,
        watchRun,
        {
            id: 'sign-in-to-review',
            label: 'Sign in to review',
            open: opens(page => page.getByRole('button', { name: 'Add a Review' }), 'Sign in to review maps'),
        },
        {
            id: 'screenshot-viewer',
            label: 'Screenshot viewer',
            open: steps(
                tap(page => page.getByRole('button', { name: 'View screenshot' })),
                shows(page => page.getByRole('img', { name: /Pinch or double-tap to zoom/ })),
            ),
        },
    ],
    subViews: [
        { id: 'certified', label: 'Certified leaderboard', open: tap(page => page.getByRole('button', { name: 'Certified', exact: true })), ready: leaderboardShown },
        { id: 'all', label: 'All caps leaderboard', open: tap(page => page.getByRole('button', { name: 'All', exact: true })), ready: leaderboardShown },
        {
            id: 'team-map',
            label: 'Team map',
            path: `/maps/${TEAM_MAP_NAME}`,
            ready: leaderboardShown,
            stress: { pr: 'most-columns' },
            modals: [
                {
                    id: 'team-cap-distribution',
                    label: 'Team time distribution',
                    open: opensWhenShown(page => page.getByRole('button', { name: /Median Team Time/ }), /Distribution/),
                },
            ],
        },
    ],
}
