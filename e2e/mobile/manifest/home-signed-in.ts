import type { Page } from '@playwright/test'
import { VIEWER } from '../fixtures/synthetic/people'
import { signedInStorage } from '../fixtures/synthetic/session'
import { heading, modalHeading, opens, shows, steps } from './steps'
import type { MobileRouteEntry } from './types'

async function opensSettings(page: Page) {
    const card = page.locator('[aria-haspopup="menu"]').filter({ hasText: VIEWER.alias }).filter({ visible: true }).first()
    const onScreen = await card.evaluate(element => {
        const box = element.getBoundingClientRect()
        return box.right > 0 && box.left < window.innerWidth
    })
    if (!onScreen) await page.getByRole('button', { name: 'Open navigation' }).click()
    await card.click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await modalHeading(page, 'Settings').waitFor()
}

export const homeSignedIn: MobileRouteEntry = {
    view: 'home',
    id: 'home:signed-in',
    tier: 'role-gated',
    path: '/',
    fixtures: 'home-signed-in',
    storage: signedInStorage(),
    ready: steps(heading('Your Latest Caps'), shows(page => page.getByRole('button', { name: 'See More' }))),
    modals: [
        {
            id: 'history',
            label: 'Recent caps history',
            open: opens(page => page.getByRole('button', { name: 'See More' }), 'Recent Caps History'),
        },
        {
            id: 'settings',
            label: 'Settings',
            open: opensSettings,
        },
    ],
}
