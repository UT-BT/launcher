import { expect, type Locator, type Page } from '@playwright/test'
import { runCompareErrors } from '../app/utils/fixtures/runCompareFixtures'
import { reopenOnDroppedModule } from './mobile/dev-server'
import { serveFixtureSet } from './mobile/fixtures/router'
import { CAP_ID, capDetail } from './mobile/manifest/cap-detail'
import { settleLayout } from './mobile/settle'

export async function failComparison(page: Page) {
    const failure = runCompareErrors().find(entry => entry.body.code === 'no_ghost')!
    await page.route(/https:\/\/api\.utbt\.net\/ghosts\/compare(\?|$)/, route => route.fulfill({ status: failure.status, json: failure.body }))
}

export function checkpointCard(page: Page): Locator {
    return page
        .getByText('Checkpoint Deltas', { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
}

export async function openCapPage(page: Page, fixtures: string, override?: (page: Page) => Promise<void>): Promise<Locator> {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, fixtures)
    await override?.(page)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(`/caps/${CAP_ID}`)
        await capDetail.ready(page)
    })
    const card = checkpointCard(page)
    await card.getByRole('table').or(card.getByText('No checkpoint splits available for this run.')).first().waitFor()
    await settleLayout(page)
    await card.scrollIntoViewIfNeeded()
    return card
}

export async function showSpeedTable(card: Locator, press: (button: Locator) => Promise<void>) {
    const speed = card.getByRole('button', { name: 'Speed', exact: true })
    await press(speed)
    await expect(speed).toHaveAttribute('aria-pressed', 'true')
    await expect(card.getByRole('columnheader', { name: 'Δ Line' })).toBeVisible()
}

export const ZONES_FALLBACK = 'The replay comparison is unavailable, so this uses zone checkpoints.'
