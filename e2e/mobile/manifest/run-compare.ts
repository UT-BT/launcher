import { EIGHT_RUN_IDS, TEAM_RUN_IDS } from '../fixtures/synthetic/run-compare'
import { CAP_ID } from './cap-detail'
import { tap } from './steps'
import type { MobileModal, MobileRouteEntry, PageStep } from './types'

const RIVAL_ID = '418b0aec-34c5-40e7-acf4-f2bc33373063'

const SETTLE_CHECKS = 2
const SETTLE_GAP_MS = 750

function stageSettled(): boolean {
    const videos = [...document.querySelectorAll<HTMLVideoElement>('.run-compare-stage video[src]')]
    const pending = document.querySelector('.run-compare-tile-wait') !== null
    return !pending && videos.every(video => video.error !== null || video.readyState >= HTMLMediaElement.HAVE_METADATA)
}

const settledStage: PageStep = async page => {
    await page.getByRole('region', { name: 'Playback' }).waitFor()
    for (let check = 0; check < SETTLE_CHECKS; check += 1) {
        await page.waitForTimeout(check === 0 ? 0 : SETTLE_GAP_MS)
        await page.waitForFunction(stageSettled)
    }
}

const runsDrawer: MobileModal = {
    id: 'runs',
    label: 'Runs drawer sheet',
    open: tap(page => page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Runs', exact: true })),
    root: '.run-compare-drawer-layer',
}

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
            modals: [runsDrawer],
            stress: { pr: 'long-text' },
            skip: [{ rule: 'table-shows-every-column', reason: 'with eight runs the sector matrix shows the run columns that fit and a run picker for the others' }],
        },
        {
            id: 'teams',
            label: 'Two team runs, POVs grouped by team',
            path: `/compare?runs=${TEAM_RUN_IDS.join(',')}`,
            ready: settledStage,
            modals: [runsDrawer],
            stress: { pr: 'long-text' },
        },
    ],
}
