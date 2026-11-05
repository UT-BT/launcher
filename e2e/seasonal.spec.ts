import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { SEASON_IDS } from '../app/seasonal/seasons'

const SEASONAL_LOGO = new RegExp(`logo-(${SEASON_IDS.join('|')})`)
const COMPOSITOR_PROPERTIES = new Set(['offset', 'easing', 'composite', 'computedOffset', 'transform', 'opacity'])
const THEMES_CSS = readFileSync(resolve(__dirname, '../app/styles/themes.css'), 'utf8')
const SEASONS_CSS = readFileSync(resolve(__dirname, '../app/styles/seasons.css'), 'utf8')

function declared(css: string, selector: string, name: string): string {
    const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match => match[1].trim() === selector)!
    return block[2].match(new RegExp(String.raw`(?:^|[\s;])${name}\s*:\s*([^;]+);`))![1].trim()
}

async function resolvedColors(page: Page, colors: string[]): Promise<string[]> {
    return page.evaluate(values => values.map(value => {
        const probe = document.createElement('div')
        probe.style.color = value
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
    }), colors)
}

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

function sidebarLogo(page: Page) {
    return page.locator('aside img[alt="UTBT Logo"]')
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

for (const season of SEASON_IDS) {
    test(`${season} decorates the launcher when previewed`, async ({ page, isMobile }) => {
        await page.goto(`/?season=${season}`)
        await expect(page.locator('html')).toHaveAttribute('data-season', season)
        await expect(logo(page, isMobile)).toHaveAttribute('src', new RegExp(`logo-${season}`))
        await expect(logo(page, isMobile)).toBeVisible()
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
    await expect(logo(page, isMobile)).not.toHaveAttribute('src', SEASONAL_LOGO)

    await page.evaluate(() => localStorage.setItem('utbt:seasonalThemes:v1', '"on"'))
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
})

test('no season leaves the launcher untouched and never loads the decorations', async ({ page, isMobile }) => {
    const decorRequests: string[] = []
    page.on('request', request => {
        const url = request.url()
        if (url.includes('SeasonalDecor') || (request.resourceType() === 'image' && SEASONAL_LOGO.test(url))) decorRequests.push(url)
    })
    await page.goto('/?season=none')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(logo(page, isMobile)).not.toHaveAttribute('src', SEASONAL_LOGO)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    expect(decorRequests).toEqual([])
})

test('ambient particles stay on Home while the seasonal logo stays everywhere', async ({ page, isMobile }) => {
    await page.goto('/maps?season=halloween')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-halloween/)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
})

test('Classic keeps its own accent and background during a holiday preview', async ({ page, isMobile }) => {
    await page.goto('/?season=halloween')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-season', 'halloween')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    const classic = await resolvedColors(page, ['--accent-500', '--background'].map(name => declared(THEMES_CSS, ':root', name)))
    await expect.poll(() => resolvedColors(page, ['var(--accent-500)', 'var(--background)'])).toEqual(classic)
})

test('the saved Seasonal theme takes the holiday tint', async ({ page, isMobile }) => {
    await page.addInitScript(() => localStorage.setItem('utbt:theme:v1', JSON.stringify({ id: 'seasonal' })))
    await page.goto('/?season=halloween')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'halloween')
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    const [halloween] = await resolvedColors(page, [declared(SEASONS_CSS, ":root[data-theme='seasonal'][data-season='halloween']", '--accent-500')])
    await expect.poll(() => resolvedColors(page, ['var(--accent-500)'])).toEqual([halloween])
})

test('stream routes never get a season', async ({ page }) => {
    await page.goto('/stream/2v2-cup-2026/1/overlay?season=christmas')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
})

test('clicking the sidebar logo fires one burst per cooldown', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the burst lives on the desktop sidebar logo')
    await page.goto('/?season=halloween')
    await expect(sidebarLogo(page)).toHaveAttribute('src', /logo-halloween/)
    await sidebarLogo(page).click()
    await expect(page.locator('.seasonal-burst')).toHaveCount(1)
    expect(await nonCompositorProperties(page)).toEqual([])
    await sidebarLogo(page).click()
    await expect(page.locator('.seasonal-burst')).toHaveCount(1)
    await expect(page.locator('.seasonal-burst')).toHaveCount(0, { timeout: 5000 })
})

test.describe('with reduced motion', () => {
    test('keeps the seasonal logo but drops particles and the burst', async ({ page, isMobile }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/?season=easter')
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-easter/)
        await expect(page.locator('.seasonal-layer')).toHaveCount(0)
        if (!isMobile) {
            await sidebarLogo(page).click()
            await page.waitForTimeout(300)
            await expect(page.locator('.seasonal-burst')).toHaveCount(0)
        }
    })
})
