import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SEASONS = ['halloween', 'christmas', 'easter'] as const
const COMPOSITOR_PROPERTIES = new Set(['offset', 'easing', 'composite', 'computedOffset', 'transform', 'opacity'])

async function mockApi(page: Page) {
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

function logo(page: Page, isMobile: boolean) {
    const logos = page.getByAltText('UTBT Logo')
    return isMobile ? logos.first() : logos.last()
}

function ornament(page: Page, isMobile: boolean) {
    return isMobile
        ? page.locator('svg[viewBox="0 0 256 256"]').first()
        : page.locator('aside svg[viewBox="0 0 256 256"]')
}

async function nonCompositorProperties(page: Page): Promise<string[]> {
    const properties = await page.evaluate(() =>
        document.getAnimations()
            .filter(animation => {
                const target = (animation.effect as KeyframeEffect | null)?.target
                return target instanceof Element && !!target.closest('.seasonal-layer, .seasonal-burst')
            })
            .flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes().flatMap(frame => Object.keys(frame)))
    )
    return [...new Set(properties)].filter(property => !COMPOSITOR_PROPERTIES.has(property))
}

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

for (const season of SEASONS) {
    test(`${season} decorates the launcher when previewed`, async ({ page, isMobile }) => {
        await page.goto(`/?season=${season}`)
        await expect(page.locator('html')).toHaveAttribute('data-season', season)
        await expect(ornament(page, isMobile)).toBeAttached()
        const layer = page.locator('.seasonal-layer')
        await expect(layer).toHaveAttribute('data-season-layer', season)
        await expect(layer).toHaveCSS('pointer-events', 'none')
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await nonCompositorProperties(page)).toEqual([])
    })
}

test('the season is painted before the app script runs', async ({ page }) => {
    await page.route('**/renderer-web.tsx*', route => route.abort())
    await page.goto('/?season=christmas')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
})

test('the season follows the calendar and the viewer toggle', async ({ page, isMobile }) => {
    await page.clock.setFixedTime(new Date(2026, 11, 24, 12, 0))
    await page.goto('/')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)

    await page.evaluate(() => localStorage.setItem('utbt:seasonalThemes:v1', '"on"'))
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
})

test('no season leaves the launcher untouched and never loads the decorations', async ({ page, isMobile }) => {
    const decorRequests: string[] = []
    page.on('request', request => { if (request.url().includes('SeasonalDecor')) decorRequests.push(request.url()) })
    await page.goto('/?season=none')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(ornament(page, isMobile)).toHaveCount(0)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    expect(decorRequests).toEqual([])
})

test('ambient particles stay on Home', async ({ page, isMobile }) => {
    await page.goto('/maps?season=halloween')
    await expect(ornament(page, isMobile)).toBeAttached()
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
})

test('stream routes never get a season', async ({ page }) => {
    await page.goto('/stream/2v2-cup-2026/1/overlay?season=christmas')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
})

test('clicking the sidebar ornament fires one burst per cooldown', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the burst lives on the desktop sidebar logo')
    await page.goto('/?season=halloween')
    const art = page.locator('aside svg[viewBox="0 0 256 256"] g[filter] path').nth(1)
    await expect(art).toBeAttached()
    await art.click({ force: true })
    await expect(page.locator('.seasonal-burst')).toHaveCount(1)
    expect(await nonCompositorProperties(page)).toEqual([])
    await art.click({ force: true })
    await expect(page.locator('.seasonal-burst')).toHaveCount(1)
    await expect(page.locator('.seasonal-burst')).toHaveCount(0, { timeout: 5000 })
})

test.describe('with reduced motion', () => {
    test('keeps the ornament but drops particles and the burst', async ({ page, isMobile }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/?season=easter')
        await expect(ornament(page, isMobile)).toBeAttached()
        await expect(page.locator('.seasonal-layer')).toHaveCount(0)
        if (!isMobile) {
            await page.locator('aside svg[viewBox="0 0 256 256"] g[filter] path').nth(2).click({ force: true })
            await expect(page.locator('.seasonal-burst')).toHaveCount(0)
        }
    })
})
