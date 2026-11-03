import { expect, test } from '@playwright/test'
import { dataFrom } from './mobile/fixtures/data'
import { FIXTURE_SETS } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { maps } from './mobile/manifest/maps'

const DESKTOP_WIDTHS = [1280, 1920]

for (const width of DESKTOP_WIDTHS) {
    test.describe(`desktop tab bar at ${width}px`, () => {
        test.use({ viewport: { width, height: 1080 } })

        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile, 'desktop layout only')
        })

        test('shows no tab bar and leaves the content padding as it was', async ({ page }) => {
            await page.addInitScript(() => {
                localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
                localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
            })
            await serveFixtureSet(page, 'maps')
            await page.goto('/maps')
            await maps.ready(page, dataFrom(FIXTURE_SETS.maps))
            await expect(page.getByRole('navigation', { name: 'Tab bar' })).toHaveCount(0)
            expect(await page.getByRole('main').evaluate(node => getComputedStyle(node).paddingBottom)).toBe('0px')
            const sidebar = page.locator('aside#app-navigation')
            expect(await sidebar.boundingBox()).toMatchObject({ x: 0, y: 0, width: 256, height: 1080 })
            expect(await sidebar.evaluate(node => getComputedStyle(node).touchAction)).toBe('auto')
        })
    })
}
