import { CAP_ID, FIRST_RIVAL_ALIAS } from '../fixtures/cap-detail'
import type { MobileRouteEntry } from './types'

export const capDetail: MobileRouteEntry = {
    view: 'cap-detail',
    tier: 'public',
    path: `/caps/${CAP_ID}`,
    fixtures: 'cap-detail',
    ready: async page => {
        await page.getByText('Checkpoint Deltas', { exact: true }).waitFor()
    },
    modals: [
        {
            id: 'compare-run',
            label: 'Compare run picker',
            open: async page => {
                await page.getByRole('button', { name: 'Compare Run' }).click()
                await page.getByRole('heading', { name: /^Compare run/ }).waitFor()
                await page.locator('[role="button"][aria-disabled="false"]', { hasText: FIRST_RIVAL_ALIAS }).waitFor()
            },
        },
    ],
}
