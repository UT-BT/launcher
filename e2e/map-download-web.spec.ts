import { expect, test } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { MAP, serveMapDownloadRoutes } from './mapDownload'

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    await context.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveMapDownloadRoutes(context)
    await page.goto(`/maps/${MAP}`)
})

test.describe('at 360 px', () => {
    test.use({ viewport: { width: 360, height: 800 } })

    test('a web map download says it was downloaded as a zip', async ({ page }) => {
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Download Map' }).click(),
        ])
        expect(download.suggestedFilename()).toBe(`${MAP}.zip`)

        await expect(page.getByRole('heading', { name: 'Map Downloaded' })).toBeVisible()
        await expect(page.getByText(`Downloaded as ${MAP}.zip`)).toBeVisible()
        await expect(page.getByText(/installed/i)).toHaveCount(0)
        await expect(page.getByText(/extracted/i)).toHaveCount(0)
        await expect(page.getByText(/installed to/i)).toHaveCount(0)

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
})
