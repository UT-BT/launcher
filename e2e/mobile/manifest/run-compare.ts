import { EIGHT_RUN_IDS, START_MAP, TEAM_RUN_IDS } from '../fixtures/synthetic/run-compare'
import { CAP_ID } from './cap-detail'
import { heading, opens, settledStage, shows, steps, tap } from './steps'
import type { MobileModal, MobileRouteEntry } from './types'

const RIVAL_ID = '418b0aec-34c5-40e7-acf4-f2bc33373063'

const openRuns = tap(page => page.getByRole('button', { name: /^Runs · \d+$/ }))

const runsDrawer: MobileModal = {
    id: 'runs',
    label: 'Runs drawer sheet',
    open: openRuns,
    root: '.run-compare-drawer-layer',
}

const runMenu: MobileModal = {
    id: 'run-menu',
    label: 'Run menu of the first roster row',
    open: steps(
        openRuns,
        tap(page => page.getByRole('list', { name: 'Roster' }).getByRole('button', { name: /^More for / }).first()),
        shows(page => page.getByRole('menu')),
    ),
    root: '[role="menu"]',
    skip: [
        { rule: 'modal-fits', reason: 'a dropdown menu has no close control: an outside tap or Escape closes it, and Radix keeps it inside the viewport' },
        { rule: 'rotation-recovers', reason: 'it measures and taps the close control after the rotation, and a dropdown menu has none' },
    ],
}

const compareHelp = (trigger: string): MobileModal => ({
    id: 'help',
    label: `How Compare Works, from ${trigger}`,
    open: opens(page => page.getByRole('button', { name: trigger }), 'How Compare Works'),
})

export const runCompare: MobileRouteEntry = {
    view: 'run-compare',
    tier: 'public',
    path: `/compare?runs=${CAP_ID},${RIVAL_ID}`,
    fixtures: 'run-compare',
    decorative: [],
    ready: settledStage,
    modals: [runsDrawer],
    stress: { pr: 'long-text' },
    subViews: [
        {
            id: 'pov',
            label: 'POV switcher, eight runs',
            path: `/compare?runs=${EIGHT_RUN_IDS.join(',')}`,
            ready: settledStage,
            modals: [runsDrawer, runMenu],
            stress: { pr: 'long-text' },
        },
        {
            id: 'teams',
            label: 'Two team runs, POVs grouped by team',
            path: `/compare?runs=${TEAM_RUN_IDS.join(',')}`,
            ready: settledStage,
            modals: [runsDrawer],
            stress: { pr: 'long-text' },
        },
        {
            id: 'start',
            label: 'Start: pick a map',
            path: '/compare',
            ready: steps(heading('Pick a Map'), shows(page => page.getByRole('list', { name: 'Latest World Records' }))),
            modals: [compareHelp('How it works')],
            stress: { pr: 'long-text' },
        },
        {
            id: 'start-map',
            label: 'Start: pick runs on a map',
            path: `/compare?map=${START_MAP}`,
            ready: steps(heading('Pick Runs'), shows(page => page.getByRole('list', { name: 'Leaderboard' }))),
            modals: [compareHelp('About these runs')],
            stress: { pr: 'long-text' },
        },
    ],
}
