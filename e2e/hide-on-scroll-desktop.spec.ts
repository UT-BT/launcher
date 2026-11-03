import { expect, test, type Page } from '@playwright/test'
import { dataFrom } from './mobile/fixtures/data'
import { FIXTURE_SETS } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { mapsDetail } from './mobile/manifest/maps-detail'
import { settleLayout } from './mobile/settle'

const DESKTOP_WIDTHS = [1280, 1920]
const NARROW_WINDOW = { width: 900, height: 700 }

async function openLongPage(page: Page) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveFixtureSet(page, mapsDetail.fixtures)
    await page.goto(mapsDetail.path)
    await mapsDetail.ready(page, dataFrom(FIXTURE_SETS[mapsDetail.fixtures]))
    await page.getByRole('main').evaluate(main => {
        const filler = document.createElement('div')
        filler.style.height = '200vh'
        main.firstElementChild?.append(filler)
    })
}

async function wheelDown(page: Page) {
    const main = page.getByRole('main')
    const box = (await main.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => main.evaluate(node => node.scrollTop), { message: 'the wheel scrolled the page' }).toBeGreaterThan(100)
    await settleLayout(page)
}

for (const width of DESKTOP_WIDTHS) {
    test.describe(`desktop hide-on-scroll at ${width}px`, () => {
        test.use({ viewport: { width, height: 1080 } })

        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile, 'desktop layout only')
        })

        test('scrolling the page hides nothing', async ({ page }) => {
            await openLongPage(page)
            const sidebar = page.locator('aside#app-navigation')
            const before = await sidebar.boundingBox()
            await wheelDown(page)
            expect(await sidebar.boundingBox()).toEqual(before)
            expect(before).toMatchObject({ x: 0, y: 0, width: 256, height: 1080 })
            await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeHidden()
            await expect(page.getByRole('navigation', { name: 'Tab bar' })).toHaveCount(0)
        })
    })
}

test.describe('a narrow window on a pointer device', () => {
    test.use({ viewport: NARROW_WINDOW })

    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'pointer devices only')
    })

    test('keeps the top bar in place while the page scrolls', async ({ page }) => {
        await openLongPage(page)
        const menu = page.getByRole('button', { name: 'Open navigation', exact: true })
        await expect(menu).toBeInViewport({ ratio: 1 })
        await wheelDown(page)
        await expect(menu).toBeInViewport({ ratio: 1 })
    })
})
