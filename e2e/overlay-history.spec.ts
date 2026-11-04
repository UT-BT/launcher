import { expect, test, type Locator, type Page } from '@playwright/test'
import { serveFixtureSet } from './mobile/fixtures/router'
import { capDetail, capDetailRivals } from './mobile/manifest/cap-detail'
import { settleLayout } from './mobile/settle'

const RIVAL = capDetailRivals()[0]
const CAP_PATH = capDetail.path
const PREVIOUS_PATH = `/caps/${RIVAL.id}`

async function openCapFromAnotherCap(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, capDetail.fixtures)
    await page.goto(PREVIOUS_PATH)
    await capDetail.ready(page)
    await page.evaluate(capId => window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } })), capDetail.path.split('/').at(-1))
    await expect(page).toHaveURL(CAP_PATH)
    await capDetail.ready(page)
    await settleLayout(page)
}

function replayModal(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: /^Replay —/ }) })
}

function supportModal(page: Page): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: 'Support UTBT', exact: true }) })
}

function historyLength(page: Page): Promise<number> {
    return page.evaluate(() => window.history.length)
}

async function openOverlay(page: Page, open: () => Promise<void>, dialog: Locator) {
    const entries = await historyLength(page)
    await open()
    await expect(dialog).toBeVisible()
    await expect.poll(() => historyLength(page), 'opening an overlay adds one history entry').toBe(entries + 1)
}

async function openReplay(page: Page) {
    await openOverlay(page, () => page.getByRole('button', { name: 'Watch Replay' }).click(), replayModal(page))
}

async function historyAtPageEntry(page: Page) {
    await page.waitForFunction(() => !(window.history.state && typeof window.history.state === 'object' && 'overlay' in window.history.state))
}

test('Back closes an open modal and keeps the page and its URL; Back again leaves the page', async ({ page }) => {
    await openCapFromAnotherCap(page)
    await openReplay(page)

    await page.goBack()
    await expect(replayModal(page)).toHaveCount(0)
    await expect(page).toHaveURL(CAP_PATH)
    await expect(page.getByRole('button', { name: 'Watch Replay' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(PREVIOUS_PATH)
    await capDetail.ready(page)
})

test('stacked modals close one per Back, the top-most first', async ({ page }) => {
    await openCapFromAnotherCap(page)
    await openReplay(page)
    await openOverlay(page, () => page.evaluate(() => { window.dispatchEvent(new CustomEvent('open-patreon')) }), supportModal(page))

    await page.goBack()
    await expect(supportModal(page)).toHaveCount(0)
    await expect(replayModal(page)).toBeVisible()
    await expect(page).toHaveURL(CAP_PATH)

    await page.goBack()
    await expect(replayModal(page)).toHaveCount(0)
    await expect(page).toHaveURL(CAP_PATH)

    await page.goBack()
    await expect(page).toHaveURL(PREVIOUS_PATH)
})

test('closing a modal with its close button leaves no entry behind: Back goes to the previous page, Forward never reopens it', async ({ page }) => {
    await openCapFromAnotherCap(page)
    await openReplay(page)

    await replayModal(page).getByRole('button', { name: 'Close modal' }).click()
    await expect(replayModal(page)).toHaveCount(0)
    await historyAtPageEntry(page)
    await expect(page).toHaveURL(CAP_PATH)

    await page.goBack()
    await expect(page).toHaveURL(PREVIOUS_PATH)
    await capDetail.ready(page)

    await page.goForward()
    await expect(page).toHaveURL(CAP_PATH)
    await capDetail.ready(page)

    await page.goForward()
    await historyAtPageEntry(page)
    await expect(page).toHaveURL(CAP_PATH)
    await expect(replayModal(page)).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL(PREVIOUS_PATH)
})

test('a link inside a modal replaces its entry, so Back returns to the page under it', async ({ page }) => {
    await openCapFromAnotherCap(page)
    await openReplay(page)
    const entries = await historyLength(page)

    await page.evaluate(capId => window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } })), RIVAL.id)
    await expect(page).toHaveURL(PREVIOUS_PATH)
    await expect(replayModal(page)).toHaveCount(0)
    await capDetail.ready(page)
    expect(await historyLength(page), 'the new page takes the modal entry').toBe(entries)

    await page.goBack()
    await expect(page).toHaveURL(CAP_PATH)
    await capDetail.ready(page)
})
