import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom, replyFor } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { CAP_ID, capDetail } from './manifest/cap-detail'
import { maps } from './manifest/maps'
import type { MobileRouteEntry } from './manifest/types'
import { worldRecords } from './manifest/world-records'
import { settleLayout } from './settle'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/

async function serveFixtureSets(page: Page, [first, ...others]: MobileRouteEntry[]) {
    await serveFixtureSet(page, first.fixtures)
    const primary = fixtureSetNamed(first.fixtures)!
    const sets = others.map(entry => fixtureSetNamed(entry.fixtures)!)
    await page.route(API_HOSTS, async route => {
        const url = new URL(route.request().url())
        const reply = replyFor(primary, url) ? null : sets.map(set => replyFor(set, url)).find(Boolean)
        if (!reply) return route.fallback()
        await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => undefined)
    })
}

async function shown(page: Page, entry: MobileRouteEntry) {
    await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    await settleLayout(page)
}

async function open(page: Page, entries: MobileRouteEntry[]) {
    const [first] = entries
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
    await serveFixtureSets(page, entries)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(first.path)
        await first.ready(page, dataFrom(fixtureSetNamed(first.fixtures)!))
    })
    await settleLayout(page)
}

function drawer(page: Page): Locator {
    return page.getByRole('complementary', { name: 'Primary navigation', includeHidden: true })
}

function historyLength(page: Page): Promise<number> {
    return page.evaluate(() => window.history.length)
}

async function historyAtPageEntry(page: Page) {
    await page.waitForFunction(() => !(window.history.state && typeof window.history.state === 'object' && 'overlay' in window.history.state))
}

async function openDrawer(page: Page) {
    const entries = await historyLength(page)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })
    await expect.poll(() => historyLength(page), 'opening the drawer adds one history entry').toBe(entries + 1)
}

async function expectDrawerClosed(page: Page) {
    await expect.poll(() => drawer(page).evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute('aria-expanded', 'false')
}

test('a drawer link takes the drawer entry, Back closes an open drawer, and the next Back goes to the previous page', async ({ page }) => {
    await open(page, [worldRecords, maps])
    const entries = await historyLength(page)
    await openDrawer(page)
    await drawer(page).getByRole('link', { name: 'Maps', exact: true }).tap()
    await page.waitForURL('**/maps')
    await shown(page, maps)
    expect(await historyLength(page), 'the new page replaces the drawer entry').toBe(entries + 1)

    await openDrawer(page)
    await page.goBack()
    await expectDrawerClosed(page)
    await expect(page).toHaveURL(/\/maps$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/world-records$/)
    await shown(page, worldRecords)
})

test('closing the drawer from its backdrop leaves no entry behind, so Back goes to the previous page', async ({ page }) => {
    await open(page, [worldRecords, maps])
    await openDrawer(page)
    await drawer(page).getByRole('link', { name: 'Maps', exact: true }).tap()
    await page.waitForURL('**/maps')
    await shown(page, maps)

    await openDrawer(page)
    const backdrop = page.getByRole('button', { name: 'Close navigation' })
    const box = (await backdrop.boundingBox())!
    await page.touchscreen.tap(box.x + box.width - 8, box.y + box.height / 2)
    await expectDrawerClosed(page)
    await historyAtPageEntry(page)

    await page.goBack()
    await expect(page).toHaveURL(/\/world-records$/)
    await shown(page, worldRecords)
})

test('Back closes an open sheet and keeps the page; the next Back goes to the previous page', async ({ page }) => {
    await open(page, [maps, capDetail])
    await page.evaluate(capId => window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } })), CAP_ID)
    await page.waitForURL(`**${capDetail.path}`)
    await shown(page, capDetail)

    const sheet = page.locator('[data-modal-backdrop]').filter({ has: page.getByRole('heading', { name: /^Replay —/ }) })
    const entries = await historyLength(page)
    await page.getByRole('button', { name: 'Watch Replay' }).tap()
    await expect(sheet).toBeVisible()
    await expect.poll(() => historyLength(page), 'opening the sheet adds one history entry').toBe(entries + 1)

    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`${capDetail.path}$`))
    await expect(page.getByRole('button', { name: 'Watch Replay' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/maps$/)
    await shown(page, maps)
})
