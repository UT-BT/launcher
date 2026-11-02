import type { Page } from '@playwright/test'
import { modalHeading, opens, shows } from './steps'
import type { MobileRouteEntry, PageStep } from './types'

export const CAP_ID = '258021df-51b1-4ed3-99cc-62d4e75892a7'

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
    fixtures: 'cap-detail',
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
