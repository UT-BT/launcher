import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { ENTRIES, ENTRY_IDS, type Entry, type EntryId } from '../app/seasonal/seasons'
import { ICE_CRYSTAL, LEAF, STAR } from '../app/seasonal/decor/shapes'
import { dataFrom } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { worldRecords } from './mobile/manifest/world-records'

const SEASONAL_LOGO = new RegExp(`logo-(${ENTRY_IDS.join('|')})`)
const NO_AMBIENT: readonly EntryId[] = []
const SEASONS = ENTRIES.filter(entry => entry.kind === 'season').map(entry => entry.id)
const SEASON_PARTICLES = 8
const LOGO_FILES = new Map((ENTRIES as readonly Entry[]).map(entry => [entry.id, entry.logo ?? entry.id]))
const HALLOWEEN_NIGHT = new Date(2026, 9, 31, 20, 0)
const CHRISTMAS_EVE = new Date(2026, 11, 24, 12, 0)
const MIDSUMMER = new Date(2026, 6, 15, 12, 0)
const DAY_MS = 24 * 60 * 60 * 1000
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

async function followCalendar(page: Page, now: Date, theme?: string) {
    await page.addInitScript(themeId => {
        localStorage.removeItem('utbt:seasonPin:v1')
        if (themeId) localStorage.setItem('utbt:theme:v1', JSON.stringify({ id: themeId }))
    }, theme)
    await page.clock.setFixedTime(now)
}

function decorRequests(page: Page): string[] {
    const requests: string[] = []
    page.on('request', request => {
        const url = request.url()
        if (url.includes('SeasonalDecor') || (request.resourceType() === 'image' && SEASONAL_LOGO.test(url))) requests.push(url)
    })
    return requests
}

async function localMidnight(page: Page, year: number, monthIndex: number, day: number): Promise<number> {
    return page.evaluate(([y, m, d]) => new Date(y, m, d).getTime(), [year, monthIndex, day])
}

async function storedTheme(page: Page): Promise<unknown> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('utbt:theme:v1') ?? 'null'))
}

async function openAppearance(page: Page) {
    await expect(page.locator('aside#app-navigation')).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
}

function themeCard(page: Page, label: string) {
    return page.getByRole('button', { name: new RegExp(`^${label}`) })
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

test.use({ timezoneId: 'Europe/London' })

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

for (const season of ENTRY_IDS) {
    test(`${season} decorates the launcher when previewed`, async ({ page, isMobile }) => {
        await page.goto(`/?season=${season}`)
        await expect(page.locator('html')).toHaveAttribute('data-season', season)
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
        await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
        const [tint] = await resolvedColors(page, [declared(SEASONS_CSS, `:root[data-theme='seasonal'][data-season='${season}']`, '--accent-500')])
        await expect.poll(() => resolvedColors(page, ['var(--accent-500)'])).toEqual([tint])
        await expect(logo(page, isMobile)).toHaveAttribute('src', new RegExp(`logo-${LOGO_FILES.get(season)}`))
        await expect(logo(page, isMobile)).toBeVisible()
        const layer = page.locator('.seasonal-layer')
        await expect(layer).toHaveAttribute('data-season-layer', season)
        await expect(layer).toHaveCSS('pointer-events', 'none')
        if (NO_AMBIENT.includes(season)) await expect(layer.locator(':scope > *')).toHaveCount(0)
        else await expect(layer.locator(':scope > *').first()).toBeAttached()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await nonCompositorProperties(page)).toEqual([])
    })
}

async function firstFrame(page: Page, path: string, local: Record<string, string> = {}) {
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, local)
    await page.route('**/renderer-web.tsx*', route => route.abort())
    await page.goto(path)
    const root = page.locator('html')
    return {
        theme: await root.getAttribute('data-theme'),
        season: await root.getAttribute('data-season'),
        dark: await root.evaluate(element => element.classList.contains('dark')),
    }
}

test.describe('the first frame, painted before the app script runs', () => {
    const SAVED_SEASONAL = { 'utbt:theme:v1': JSON.stringify({ id: 'seasonal' }) }
    const CHRISTMAS_CACHE = { 'utbt:season:v2': JSON.stringify({ id: 'christmas', until: HALLOWEEN_NIGHT.getTime() + 7 * 24 * 60 * 60 * 1000 }) }

    test('a preview on the saved Seasonal theme', async ({ page }) => {
        expect(await firstFrame(page, '/?season=christmas', SAVED_SEASONAL))
            .toEqual({ theme: 'seasonal', season: 'christmas', dark: true })
    })

    test('a preview on Classic shows the Seasonal theme', async ({ page }) => {
        expect(await firstFrame(page, '/?season=christmas'))
            .toEqual({ theme: 'seasonal', season: 'christmas', dark: true })
    })

    test('the saved Seasonal theme follows the unexpired cache', async ({ page }) => {
        await followCalendar(page, HALLOWEEN_NIGHT, 'seasonal')
        expect(await firstFrame(page, '/', CHRISTMAS_CACHE))
            .toEqual({ theme: 'seasonal', season: 'christmas', dark: true })
    })

    test('Red ignores the cache', async ({ page }) => {
        await followCalendar(page, HALLOWEEN_NIGHT, 'red')
        expect(await firstFrame(page, '/', CHRISTMAS_CACHE))
            .toEqual({ theme: 'red', season: null, dark: true })
    })

    test('the saved Seasonal theme paints the season from the month and the timezone on a cold cache', async ({ page }) => {
        await followCalendar(page, MIDSUMMER, 'seasonal')
        expect(await firstFrame(page, '/'))
            .toEqual({ theme: 'seasonal', season: 'summer', dark: true })
    })

    test('an expired cache falls back to the month, and the hemisphere preview flips the season', async ({ page }) => {
        await followCalendar(page, MIDSUMMER, 'seasonal')
        const expired = { 'utbt:season:v2': JSON.stringify({ id: 'christmas', until: MIDSUMMER.getTime() - DAY_MS }) }
        expect(await firstFrame(page, '/?hemisphere=south', expired))
            .toEqual({ theme: 'seasonal', season: 'winter', dark: true })
    })

    test('a stored hemisphere beats the timezone on a cold cache', async ({ page }) => {
        await followCalendar(page, MIDSUMMER, 'seasonal')
        expect(await firstFrame(page, '/', { 'utbt:hemisphere:v1': JSON.stringify('south') }))
            .toEqual({ theme: 'seasonal', season: 'winter', dark: true })
    })
})

test('the calendar gives Classic the Christmas logo and the Seasonal theme the Christmas look', async ({ page, isMobile }) => {
    await followCalendar(page, CHRISTMAS_EVE)
    await page.goto('/')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    const christmasEnds = await localMidnight(page, 2026, 11, 31)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('utbt:season:v2') ?? 'null')))
        .toEqual({ id: 'christmas', until: christmasEnds })

    await page.evaluate(() => {
        localStorage.setItem('utbt:theme:v1', JSON.stringify({ id: 'seasonal' }))
        localStorage.setItem('utbt:seasonalThemes:v1', '"off"')
    })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
})

test('the saved Seasonal theme follows the season where the player is', async ({ page, isMobile }) => {
    await followCalendar(page, MIDSUMMER, 'seasonal')
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'summer')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-summer/)
    const summerEnds = await localMidnight(page, 2026, 8, 1)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('utbt:season:v2') ?? 'null')))
        .toEqual({ id: 'summer', until: summerEnds })

    await page.goto('/?hemisphere=south')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'winter')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-winter/)
})

test('a plain season on Red changes nothing and never loads the decorations', async ({ page, isMobile }) => {
    const requests = decorRequests(page)
    await followCalendar(page, MIDSUMMER, 'red')
    await page.goto('/')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'red')
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(logo(page, isMobile)).not.toHaveAttribute('src', SEASONAL_LOGO)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    expect(requests).toEqual([])
})

test('the spinner shows each season\'s glyph, with winter\'s ice crystal held still', async ({ page }) => {
    await page.route(/https:\/\/api\.utbt\.net\/.*/, () => {})
    const glyphs: Array<[EntryId, string, RegExp | null]> = [
        ['spring', 'lucide-flower', /(^|\s)animate-spin(\s|$)/],
        ['summer', 'lucide-sun', /(^|\s)animate-spin(\s|$)/],
        ['autumn', 'lucide-leaf', /(^|\s)seasonal-wobble(\s|$)/],
        ['winter', 'lucide-snowflake', null],
    ]
    for (const [season, icon, motion] of glyphs) {
        await page.goto(`/compare?season=${season}`)
        const spinner = page.locator('.compare-start-empty').filter({ hasText: 'Loading records' }).locator('svg')
        await expect(spinner).toHaveClass(new RegExp(`(^|\\s)${icon}(\\s|$)`))
        if (motion) await expect(spinner).toHaveClass(motion)
        else await expect(spinner).toHaveCSS('animation-name', 'none')
    }
})

test('a holiday on Red shows only its logo and never loads the decorations', async ({ page, isMobile }) => {
    const requests = decorRequests(page)
    await followCalendar(page, HALLOWEEN_NIGHT, 'red')
    await page.goto('/')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-halloween/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'red')
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    if (!isMobile) {
        await sidebarLogo(page).click()
        await page.waitForTimeout(300)
        await expect(page.locator('.seasonal-burst')).toHaveCount(0)
    }
    expect(requests.filter(url => url.includes('SeasonalDecor'))).toEqual([])
})

test('no season leaves the launcher untouched during a holiday and never loads the decorations', async ({ page, isMobile }) => {
    const requests = decorRequests(page)
    await followCalendar(page, HALLOWEEN_NIGHT)
    await page.goto('/?season=none')
    await expect(logo(page, isMobile)).toBeVisible()
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expect(logo(page, isMobile)).not.toHaveAttribute('src', SEASONAL_LOGO)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    expect(requests).toEqual([])
})

test('an entry preview shows the Seasonal theme for the session and keeps the saved theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('utbt:theme:v1', JSON.stringify({ id: 'red' })))
    await page.goto('/?season=christmas')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
    expect(await storedTheme(page)).toEqual({ id: 'red' })

    await openAppearance(page)
    await expect(themeCard(page, 'UTBT Red')).toHaveAttribute('aria-pressed', 'true')
    await expect(themeCard(page, 'Seasonal')).toHaveAttribute('aria-pressed', 'false')
    await themeCard(page, 'UTBT Blue').click()
    await expect(themeCard(page, 'UTBT Blue')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => storedTheme(page)).toEqual({ id: 'classic' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
})

test('Settings has no seasonal themes toggle, and the dev preview lists every entry', async ({ page }) => {
    await page.goto('/')
    await openAppearance(page)
    await expect(page.getByRole('switch', { name: 'Seasonal themes' })).toHaveCount(0)
    const preview = page.locator('select').filter({ has: page.locator('option[value="none"]') })
    await expect(preview.locator('option')).toHaveText(['Automatic (by date)', 'No season', ...ENTRIES.map(entry => entry.label)])
    await preview.selectOption('easter')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
    await expect(page.locator('html')).toHaveAttribute('data-season', 'easter')
    await preview.selectOption('')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
})

test('the ambient layer runs behind every page of the app shell', async ({ page, isMobile }) => {
    await page.goto('/?season=winter')
    await expect(page.locator('.seasonal-layer')).toHaveAttribute('data-season-layer', 'winter')

    await serveFixtureSet(page, worldRecords.fixtures)
    await page.goto(`${worldRecords.path}?season=winter`)
    await worldRecords.ready(page, dataFrom(fixtureSetNamed(worldRecords.fixtures)!))
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-winter/)
    const layer = page.locator('.seasonal-layer')
    await expect(layer).toHaveAttribute('data-season-layer', 'winter')
    await expect(layer).toHaveCSS('pointer-events', 'none')
    const stacking = await page.evaluate(() => {
        const main = document.querySelector('main')!
        const ambient = document.querySelector('.seasonal-layer')!
        return {
            inScroller: main.contains(ambient),
            under: Number(getComputedStyle(ambient).zIndex) < Number(getComputedStyle(main).zIndex),
            before: !!(ambient.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
        }
    })
    expect(stacking).toEqual({ inScroller: false, under: true, before: true })

    await page.goto('/maps?season=halloween')
    await expect(page.locator('.seasonal-layer')).toHaveAttribute('data-season-layer', 'halloween')
})

test('stream routes never mount the ambient layer', async ({ page }) => {
    await page.goto('/stream/2v2-cup-2026/1/overlay?season=winter')
    await page.waitForLoadState('load')
    await page.waitForTimeout(500)
    await expect(page.locator('.seasonal-layer')).toHaveCount(0)
})

async function particleCounts(page: Page): Promise<{ total: number; visible: number }> {
    return page.locator('.seasonal-layer').evaluate(layer => {
        const particles = [...layer.children].filter(child => child.tagName === 'SPAN')
        return { total: particles.length, visible: particles.filter(child => getComputedStyle(child).display !== 'none').length }
    })
}

for (const season of SEASONS) {
    test(`${season} stays within the season particle budget, with half hidden below 768 px`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.goto(`/?season=${season}`)
        await expect(page.locator('.seasonal-layer')).toHaveAttribute('data-season-layer', season)
        const desktop = await particleCounts(page)
        expect(desktop.total).toBeLessThanOrEqual(SEASON_PARTICLES)
        expect(desktop.visible).toBe(desktop.total)

        await page.setViewportSize({ width: 390, height: 844 })
        const phone = await particleCounts(page)
        expect(phone.visible).toBeLessThanOrEqual(SEASON_PARTICLES / 2)
        expect(phone.visible).toBeLessThanOrEqual(Math.ceil(desktop.total / 2))
        expect(await nonCompositorProperties(page)).toEqual([])
    })
}

test('Classic keeps its own accent and background during a holiday', async ({ page, isMobile }) => {
    await followCalendar(page, HALLOWEEN_NIGHT)
    await page.goto('/')
    await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-halloween/)
    await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
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
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'seasonal')
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

const SEASON_BURSTS: Array<[EntryId, string]> = [
    ['spring', 'span.seasonal-burst-petal'],
    ['summer', 'span.seasonal-burst-spark'],
    ['autumn', `span > svg > path[d="${LEAF}"]`],
    ['winter', `span > svg > path[d="${ICE_CRYSTAL}"]`],
]

for (const [season, shape] of SEASON_BURSTS) {
    test(`clicking the sidebar logo on ${season} fires its own burst once per cooldown`, async ({ page, isMobile }) => {
        test.skip(isMobile, 'the burst lives on the desktop sidebar logo')
        await page.goto(`/?season=${season}`)
        await expect(sidebarLogo(page)).toHaveAttribute('src', new RegExp(`logo-${season}`))
        await sidebarLogo(page).click()
        const burst = page.locator('.seasonal-burst')
        await expect(burst).toHaveCount(1)
        const particles = burst.locator(':scope > span')
        await expect(particles.first()).toBeAttached()
        expect(await burst.locator(`:scope > ${shape}`).count()).toBe(await particles.count())
        expect(await nonCompositorProperties(page)).toEqual([])
        await sidebarLogo(page).click()
        await expect(burst).toHaveCount(1)
        await expect(burst).toHaveCount(0, { timeout: 5000 })
    })
}

for (const season of ['autumn', 'halloween'] as const) {
    test(`with the effects switch off ${season} keeps its look but has no layer and no burst`, async ({ page, isMobile }) => {
        await page.addInitScript(() => localStorage.setItem('utbt:seasonalEffects:v1', 'false'))
        await page.goto(`/?season=${season}`)
        await expect(page.locator('html')).toHaveAttribute('data-season', season)
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
        const [tint] = await resolvedColors(page, [declared(SEASONS_CSS, `:root[data-theme='seasonal'][data-season='${season}']`, '--accent-500')])
        await expect.poll(() => resolvedColors(page, ['var(--accent-500)'])).toEqual([tint])
        await expect(logo(page, isMobile)).toHaveAttribute('src', new RegExp(`logo-${season}`))
        await expect(logo(page, isMobile)).toBeVisible()
        if (!isMobile) {
            await sidebarLogo(page).click()
            await page.waitForTimeout(300)
            await expect(page.locator('.seasonal-burst')).toHaveCount(0)
        }
        await page.waitForLoadState('load')
        await page.waitForTimeout(500)
        await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    })
}

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

    test('a season shows no layer and no burst', async ({ page, isMobile }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/?season=summer')
        await expect(page.locator('html')).toHaveAttribute('data-season', 'summer')
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-summer/)
        if (!isMobile) {
            await sidebarLogo(page).click()
            await page.waitForTimeout(300)
            await expect(page.locator('.seasonal-burst')).toHaveCount(0)
        }
        await expect(page.locator('.seasonal-layer')).toHaveCount(0)
    })
})

test.describe('Summer Christmas', () => {
    const EARLY_DECEMBER = new Date(2026, 11, 5, 12, 0)
    const DEC_20 = new Date(2026, 11, 20, 12, 0)

    test('the southern Seasonal theme goes from summer to Summer Christmas, with the Christmas logo, sun rays and no snow', async ({ page, isMobile }) => {
        await followCalendar(page, EARLY_DECEMBER, 'seasonal')
        await page.goto('/?hemisphere=south')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
        await expect(page.locator('html')).toHaveAttribute('data-season', 'summer')
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-summer/)

        await page.clock.setFixedTime(DEC_20)
        await page.reload()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'seasonal')
        await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas-summer')
        await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
        const layer = page.locator('.seasonal-layer')
        await expect(layer).toHaveAttribute('data-season-layer', 'christmas-summer')
        await expect(layer.locator('.seasonal-rays')).toHaveCount(1)
        await expect(layer.locator('.seasonal-twinkle').first()).toBeAttached()
        await expect(page.locator('.seasonal-flake')).toHaveCount(0)
    })

    test.describe('in a southern zone', () => {
        test.use({ timezoneId: 'Australia/Sydney' })

        test('the calendar caches Summer Christmas until the midnight it ends', async ({ page, isMobile }) => {
            await followCalendar(page, DEC_20, 'seasonal')
            await page.goto('/')
            await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas-summer')
            await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
            const christmasEnds = await localMidnight(page, 2026, 11, 31)
            await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('utbt:season:v2') ?? 'null')))
                .toEqual({ id: 'christmas-summer', until: christmasEnds })
        })
    })

    test('the north keeps Christmas on the same day', async ({ page, isMobile }) => {
        await followCalendar(page, DEC_20, 'seasonal')
        await page.goto('/?hemisphere=north')
        await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas')
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
    })

    test('Red in the south shows only the Christmas logo and never loads the decorations', async ({ page, isMobile }) => {
        const requests = decorRequests(page)
        await followCalendar(page, DEC_20, 'red')
        await page.goto('/?hemisphere=south')
        await expect(logo(page, isMobile)).toHaveAttribute('src', /logo-christmas/)
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'red')
        await expect(page.locator('html')).not.toHaveAttribute('data-season', /.+/)
        await expect(page.locator('.seasonal-layer')).toHaveCount(0)
        expect(requests.filter(url => url.includes('SeasonalDecor'))).toEqual([])
    })

    test('keeps the sun rays and at most 8 gold twinkles, with half hidden below 768 px', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.goto('/?season=christmas-summer')
        const layer = page.locator('.seasonal-layer')
        await expect(layer).toHaveAttribute('data-season-layer', 'christmas-summer')
        await expect(layer.locator(':scope > .seasonal-rays')).toHaveCount(1)
        await expect(layer.locator('.seasonal-flake')).toHaveCount(0)
        const desktop = await particleCounts(page)
        expect(desktop.total).toBeGreaterThan(0)
        expect(desktop.total).toBeLessThanOrEqual(SEASON_PARTICLES)
        expect(desktop.visible).toBe(desktop.total)
        expect(await layer.locator(':scope > span.seasonal-twinkle').count()).toBe(desktop.total)

        await page.setViewportSize({ width: 390, height: 844 })
        const phone = await particleCounts(page)
        expect(phone.visible).toBeLessThanOrEqual(SEASON_PARTICLES / 2)
        expect(await nonCompositorProperties(page)).toEqual([])
    })

    test('the spinner shows a slowly spinning star', async ({ page }) => {
        await page.route(/https:\/\/api\.utbt\.net\/.*/, () => {})
        await page.goto('/compare?season=christmas-summer')
        const spinner = page.locator('.compare-start-empty').filter({ hasText: 'Loading records' }).locator('svg')
        await expect(spinner).toHaveClass(/(^|\s)lucide-star(\s|$)/)
        await expect(spinner).not.toHaveCSS('animation-name', 'none')
        const seconds = await spinner.evaluate(element => parseFloat(getComputedStyle(element).animationDuration))
        expect(seconds).toBeGreaterThan(1)
    })

    test('clicking the sidebar logo fires gold stars and red baubles once per cooldown', async ({ page, isMobile }) => {
        test.skip(isMobile, 'the burst lives on the desktop sidebar logo')
        await page.goto('/?season=christmas-summer')
        await expect(sidebarLogo(page)).toHaveAttribute('src', /logo-christmas/)
        await sidebarLogo(page).click()
        const burst = page.locator('.seasonal-burst')
        await expect(burst).toHaveCount(1)
        const particles = await burst.locator(':scope > span').count()
        const stars = await burst.locator(`:scope > span > svg > path[d="${STAR}"]`).count()
        const baubles = await burst.locator(':scope > span.seasonal-burst-bauble').count()
        expect(stars).toBeGreaterThan(0)
        expect(baubles).toBeGreaterThan(0)
        expect(stars + baubles).toBe(particles)
        expect(await nonCompositorProperties(page)).toEqual([])
        await sidebarLogo(page).click()
        await expect(burst).toHaveCount(1)
        await expect(burst).toHaveCount(0, { timeout: 5000 })
    })
})
