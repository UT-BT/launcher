import { expect, test, type BrowserContext } from '@playwright/test'
import type { MapMetadata } from '../app/utils/api'
import { horizontalOverflow } from './layout'

const MAP = 'CTF-BT-Chain'

const METADATA: MapMetadata = {
    name: MAP,
    added: '2026-01-01T00:00:00Z',
    difficulty: 3,
    active: true,
    tags: '',
    author: 'Mapper',
    required_players: 1,
    preceded_by: null,
    superseded_by: null,
}

async function serveRoutes(context: BrowserContext) {
    await context.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        let data: unknown
        if (path === `/maps/${MAP}`) data = METADATA
        else if (path === '/v2/summary') {
            data = { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null }
        } else data = path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
    await context.route(/https:\/\/api\.utmapdownload\.com\/download.*/, route =>
        route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK-mock-zip') }),
    )
}

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
    await context.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await serveRoutes(context)
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
