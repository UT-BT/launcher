import type { Locator, Page } from '@playwright/test'

export async function mockApi(page: Page) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const data = path === '/v2/summary'
            ? { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null }
            : path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
}

export function sidebarRail(page: Page): Locator {
    return page.locator('aside#app-navigation')
}

export async function contentAreaCentreX(page: Page): Promise<number> {
    return sidebarRail(page).evaluate(rail => {
        const railRight = Math.max(0, rail.getBoundingClientRect().right)
        return (railRight + document.documentElement.clientWidth) / 2
    })
}

export async function centreX(locator: Locator): Promise<number> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('element has no bounding box')
    return box.x + box.width / 2
}
