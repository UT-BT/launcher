import { expect, test, type Page } from '@playwright/test'
import { dataFrom, replyFor } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { CAP_ID, capDetail } from './mobile/manifest/cap-detail'
import { MAP_NAME, mapsDetail } from './mobile/manifest/maps-detail'
import type { MobileRouteEntry } from './mobile/manifest/types'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const TOLERANCE_PX = 4

async function open(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, mapsDetail.fixtures)
    const primary = fixtureSetNamed(mapsDetail.fixtures)!
    const cap = fixtureSetNamed(capDetail.fixtures)!
    await page.route(API_HOSTS, async route => {
        const url = new URL(route.request().url())
        const reply = replyFor(primary, url) ? null : replyFor(cap, url)
        if (!reply) return route.fallback()
        await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => undefined)
    })
    await page.goto(mapsDetail.path)
    await shown(page, mapsDetail)
}

async function shown(page: Page, entry: MobileRouteEntry) {
    await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    await stillMain(page)
}

const mainTop = (page: Page) => page.getByRole('main').evaluate(main => main.scrollTop)

async function stillMain(page: Page) {
    await page.waitForFunction(() => {
        const main = document.querySelector('main')!
        const state = window as unknown as { __mainStill?: { signature: string; frames: number } }
        const signature = `${main.scrollTop},${main.scrollHeight}`
        if (state.__mainStill?.signature === signature) state.__mainStill.frames += 1
        else state.__mainStill = { signature, frames: 0 }
        return state.__mainStill.frames >= 3
    }, undefined, { polling: 'raf' })
}

async function wheelDown(page: Page, deltaY: number): Promise<number> {
    const box = (await page.getByRole('main').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, deltaY)
    await expect.poll(() => mainTop(page), { message: 'the wheel scrolls the shell scroller' }).toBeGreaterThan(0)
    await stillMain(page)
    return mainTop(page)
}

async function expectBackAt(page: Page, left: number, what: string) {
    const top = await mainTop(page)
    expect(Math.abs(top - left), `${what}: main is at ${Math.round(top)}px, it was left at ${Math.round(left)}px`).toBeLessThanOrEqual(TOLERANCE_PX)
}

test.describe('shell scroll restore on desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'desktop layout only')
    })

    test('a page opened from a link starts at the top, and Back and Forward return each page to where it was left', async ({ page }) => {
        await open(page)
        const mapLeft = await wheelDown(page, 2000)
        const capLink = page.locator(`main a[href="/caps/${CAP_ID}"]`).first()
        await expect(capLink).toBeInViewport()

        await capLink.click()
        await page.waitForURL(`**/caps/${CAP_ID}`)
        await shown(page, capDetail)
        expect(await mainTop(page), 'the cap page starts at the top').toBe(0)
        const capLeft = await wheelDown(page, 500)

        await page.goBack()
        await page.waitForURL(`**/maps/${MAP_NAME}`)
        await shown(page, mapsDetail)
        await expectBackAt(page, mapLeft, 'Back to the map page')

        await page.goForward()
        await page.waitForURL(`**/caps/${CAP_ID}`)
        await shown(page, capDetail)
        await expectBackAt(page, capLeft, 'Forward to the cap page')
    })
})
