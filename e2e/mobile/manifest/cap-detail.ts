import type { Page } from '@playwright/test'
import type { CapDetail, LeaderboardEntry } from '../../../app/utils/api'
import { dataFrom } from '../fixtures/data'
import { fixtureSetNamed } from '../fixtures/index'
import { modalHeading, opens, shows } from './steps'
import type { MobileRouteEntry, PageStep } from './types'

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

const firstRival = (page: Page) => page.locator('[data-modal-backdrop] [role="button"][aria-disabled="false"]').first()

const openPicker: PageStep = async page => {
    await page.getByRole('button', { name: 'Compare Run' }).click()
    await modalHeading(page, /^Compare run/).waitFor()
    await firstRival(page).waitFor()
}

export const capDetail: MobileRouteEntry = {
    view: 'cap-detail',
    tier: 'public',
    path: `/caps/${CAP_ID}`,
    fixtures: FIXTURES,
    decorative: [],
    ready: shows(page => page.getByRole('button', { name: 'Watch Replay' })),
    modals: [
        {
            id: 'compare-run',
            label: 'Compare run picker',
            open: openPicker,
        },
        {
            id: 'compare-runs',
            label: 'Compare runs video',
            open: async page => {
                await openPicker(page)
                await firstRival(page).click()
                await modalHeading(page, /^Replay Comparison/).waitFor()
            },
        },
        {
            id: 'watch-replay',
            label: 'Replay video',
            open: opens(page => page.getByRole('button', { name: 'Watch Replay' }), /^Replay/),
        },
    ],
}
