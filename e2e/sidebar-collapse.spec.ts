import { expect, test, type Page } from '@playwright/test'
import { centreX, contentAreaCentreX, mockApi, sidebarRail } from './sidebarRail'

async function openSidebarOffsetDialog(page: Page) {
    await expect(sidebarRail(page)).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-patreon')))
    const panel = page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: 'Support UTBT' }) })
    await expect(panel).toBeVisible()
    return panel
}

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

for (const width of [1024, 1920]) {
    test(`a sidebar-offset dialog is centred beside the expanded sidebar at ${width}px`, async ({ page, isMobile }) => {
        test.skip(isMobile, 'the sidebar only takes space at desktop widths')
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        await expect(sidebarRail(page).getByRole('link', { name: 'Maps' })).toBeVisible()
        const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
        expect(railRight).toBeGreaterThan(200)

        const panel = await openSidebarOffsetDialog(page)
        const contentCentre = await contentAreaCentreX(page)
        await expect.poll(async () => Math.abs(await centreX(panel) - contentCentre)).toBeLessThanOrEqual(1)
    })
}

test('a sidebar-offset dialog is centred over the full viewport at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const panel = await openSidebarOffsetDialog(page)
    const viewportCentre = await page.evaluate(() => document.documentElement.clientWidth / 2)
    await expect.poll(async () => Math.abs(await centreX(panel) - viewportCentre)).toBeLessThanOrEqual(1)
})
