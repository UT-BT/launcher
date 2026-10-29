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

export const SIDEBAR_COLLAPSED_KEY = 'utbt:sidebarCollapsed:v1'

export async function preseedCollapsedRail(page: Page) {
    await page.addInitScript(key => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, 'true')
    }, SIDEBAR_COLLAPSED_KEY)
}

export function sidebarToggle(page: Page): Locator {
    return sidebarRail(page).getByRole('button', { name: /^(Collapse|Expand) sidebar$/ })
}

export async function railWidth(page: Page): Promise<number> {
    return sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().width)
}

export function railTiles(page: Page): Locator {
    return sidebarRail(page).getByRole('navigation').getByRole('link')
}

export async function overflowingRailText(page: Page): Promise<string[]> {
    return sidebarRail(page).getByRole('navigation').evaluate(nav =>
        Array.from(nav.querySelectorAll<HTMLElement>('a *'))
            .filter(element => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
            .filter(element => element.getBoundingClientRect().width > 1)
            .filter(element => element.scrollWidth > element.clientWidth)
            .map(element => element.textContent ?? ''),
    )
}
