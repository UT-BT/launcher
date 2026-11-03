import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom, replyFor } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { scrollPositionProblems, scrollerTop, swipeOneViewport } from './interactions'
import { CAP_ID, capDetail } from './manifest/cap-detail'
import { maps } from './manifest/maps'
import { MAP_NAME, mapsDetail } from './manifest/maps-detail'
import type { MobileRouteEntry } from './manifest/types'
import { worldRecords } from './manifest/world-records'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const TOLERANCE_PX = 4
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
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
    await serveFixtureSets(page, entries)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entries[0].path)
        await entries[0].ready(page, dataFrom(fixtureSetNamed(entries[0].fixtures)!))
    })
    await settleLayout(page)
    await installProbe(page)
}

async function mainTop(page: Page): Promise<number> {
    return (await scrollerTop(page, 'main'))!
}

async function scrolledDown(page: Page): Promise<number> {
    const [moved] = await swipeOneViewport(page)
    expect(moved?.scroller, 'a swipe scrolls the shell scroller').toBe('the shell scroller (main)')
    return mainTop(page)
}

async function expectAtTop(page: Page, what: string) {
    expect(await scrollPositionProblems(page), `${what} starts at the top`).toEqual([])
}

async function expectBackAt(page: Page, left: number, what: string) {
    const top = await mainTop(page)
    expect(Math.abs(top - left), `${what}: main is at ${Math.round(top)}px, it was left at ${Math.round(left)}px`).toBeLessThanOrEqual(TOLERANCE_PX)
}

async function tapInMain(page: Page, href: string): Promise<number> {
    const link = page.locator(`main a[href="${href}"]`).first()
    await link.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await settleLayout(page)
    const left = await mainTop(page)
    await link.tap()
    return left
}

async function drawerTo(page: Page, label: string) {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
    await page.locator('aside#app-navigation').getByRole('link', { name: label, exact: true }).tap()
}

test('pages opened from detail pages start at the top, and Back and Forward return each one to where it was left', async ({ page }) => {
    test.slow()
    await open(page, [mapsDetail, capDetail])
    await scrolledDown(page)

    const mapLeft = await tapInMain(page, `/caps/${CAP_ID}`)
    expect(mapLeft, 'the map page was scrolled before leaving it').toBeGreaterThan(0)
    await page.waitForURL(`**/caps/${CAP_ID}`)
    await shown(page, capDetail)
    await expectAtTop(page, 'the cap page opened from the map page')
    const capLeft = await scrolledDown(page)

    await page.goBack()
    await page.waitForURL(`**/maps/${MAP_NAME}`)
    await shown(page, mapsDetail)
    await expectBackAt(page, mapLeft, 'Back to the map page')

    await page.goForward()
    await page.waitForURL(`**/caps/${CAP_ID}`)
    await shown(page, capDetail)
    await expectBackAt(page, capLeft, 'Forward to the cap page')

    const capLeftAgain = await tapInMain(page, `/maps/${MAP_NAME}`)
    await page.waitForURL(`**/maps/${MAP_NAME}`)
    await shown(page, mapsDetail)
    await expectAtTop(page, 'a new visit to the map page')
    await scrolledDown(page)

    await page.goBack()
    await page.waitForURL(`**/caps/${CAP_ID}`)
    await shown(page, capDetail)
    await expectBackAt(page, capLeftAgain, 'Back to the cap page')
})

test('a list page opened from the drawer starts at the top, and Back and Forward return each list to where it was left', async ({ page }) => {
    test.slow()
    await open(page, [worldRecords, maps])
    const recordsLeft = await scrolledDown(page)

    await drawerTo(page, 'Maps')
    await page.waitForURL('**/maps')
    await shown(page, maps)
    await expectAtTop(page, 'the Maps page opened from the drawer')
    const mapsLeft = await scrolledDown(page)

    await page.goBack()
    await page.waitForURL('**/world-records')
    await shown(page, worldRecords)
    await expectBackAt(page, recordsLeft, 'Back to World Records')

    await page.goForward()
    await page.waitForURL('**/maps')
    await shown(page, maps)
    await expectBackAt(page, mapsLeft, 'Forward to Maps')
})
