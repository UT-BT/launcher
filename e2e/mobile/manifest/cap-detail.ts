import type { Page } from '@playwright/test'
import type { CapDetail, LeaderboardEntry } from '../../../app/utils/api'
import { dataFrom } from '../fixtures/data'
import { fixtureSetNamed } from '../fixtures/index'
import { opens, settledStage, shows, tap } from './steps'
import type { MobileRouteEntry } from './types'

export const CAP_ID = '258021df-51b1-4ed3-99cc-62d4e75892a7'
const FIXTURES = 'cap-detail'

export function capDetailRivals(): LeaderboardEntry[] {
    const set = fixtureSetNamed(FIXTURES)
    if (!set) throw new Error(`no mobile fixture set named "${FIXTURES}"`)
    const data = dataFrom(set)
    const { cap } = data.api(`/caps/${CAP_ID}/detail`) as CapDetail
    const leaderboard = data.api(`/caps/leaderboard/map/${cap.map}`, 'verified=true') as LeaderboardEntry[]
    return leaderboard.filter(entry => entry.id !== CAP_ID).toSorted((a, b) => a.cap_time_seconds - b.cap_time_seconds)
}

const inMain = (page: Page) => page.getByRole('main')

export const capDetail: MobileRouteEntry = {
    view: 'cap-detail',
    tier: 'public',
    path: `/caps/${CAP_ID}`,
    fixtures: FIXTURES,
    decorative: [],
    ready: shows(page => page.getByRole('button', { name: 'Watch Replay' })),
    modals: [
        {
            id: 'watch-replay',
            label: 'Replay video',
            open: opens(page => page.getByRole('button', { name: 'Watch Replay' }), /^Replay/),
        },
    ],
    subViews: [
        {
            id: 'compare-run',
            label: 'Compare, on the compare page',
            open: tap(page => inMain(page).getByRole('link', { name: 'Compare', exact: true })),
            ready: settledStage,
        },
        {
            id: 'compare-runs',
            label: 'Watch Side by Side, on the compare page',
            open: tap(page => inMain(page).getByRole('link', { name: 'Watch Side by Side' })),
            ready: settledStage,
        },
    ],
}
