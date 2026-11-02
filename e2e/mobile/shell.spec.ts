import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { dataFrom } from './fixtures/data'
import { FIXTURE_SETS } from './fixtures'
import { serveFixtureSet } from './fixtures/router'
import { maps } from './manifest/maps'

const STATUS_STRIP_RGB = [0x07, 0x0b, 0x12]

interface SafeArea {
    top?: number
    right?: number
    bottom?: number
    left?: number
}

async function openMaps(page: Page, storage: Record<string, string> = {}) {
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, {
        'utbt:analyticsConsent:v1': 'denied',
        'utbt:mapsPageTutorial:v1': JSON.stringify({ seen: true, version: 1 }),
        ...storage,
    })
    await serveFixtureSet(page, 'maps')
    await page.goto('/maps')
    await maps.ready(page, dataFrom(FIXTURE_SETS.maps))
}

async function simulateSafeArea(page: Page, area: SafeArea) {
    await page.evaluate(({ top = 0, right = 0, bottom = 0, left = 0 }) => {
        const root = document.documentElement.style
        root.setProperty('--safe-area-top', `${top}px`)
        root.setProperty('--safe-area-right', `${right}px`)
        root.setProperty('--safe-area-bottom', `${bottom}px`)
        root.setProperty('--safe-area-left', `${left}px`)
    }, area)
}

function hamburger(page: Page): Locator {
    return page.getByRole('button', { name: 'Open navigation', exact: true })
}

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (!box) throw new Error('element has no bounding box')
    return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height, width: box.width, height: box.height }
}

async function topBarBox(page: Page) {
    return hamburger(page).evaluate(button => {
        let bar: Element = button
        while (bar.parentElement && getComputedStyle(bar).position !== 'fixed') bar = bar.parentElement
        const rect = bar.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom, height: rect.height, backdropFilter: getComputedStyle(bar).backdropFilter }
    })
}

async function openDrawer(page: Page) {
    await hamburger(page).click()
    const drawer = page.getByRole('complementary', { name: 'Primary navigation' })
    await expect(drawer).toBeInViewport({ ratio: 1 })
    await expect.poll(async () => (await boxOf(drawer)).left).toBe(0)
    return drawer
}

async function pixelsOf(page: Page, clip: { x: number; y: number; width: number; height: number }) {
    const shot = await page.screenshot({ clip, scale: 'css', animations: 'disabled' })
    const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const pixels: number[][] = []
    for (let offset = 0; offset < info.width * info.height * 3; offset += 3) pixels.push([data[offset], data[offset + 1], data[offset + 2]])
    return pixels
}

test.describe('web entry', () => {
    test('serves a standalone web app manifest', async ({ page }) => {
        const response = await page.request.get('/site.webmanifest')
        expect(response.ok()).toBe(true)
        const manifest = await response.json()
        expect(manifest).toMatchObject({
            id: '/',
            name: 'UTBT.net',
            short_name: 'UTBT',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            orientation: 'any',
            background_color: '#070b12',
            theme_color: '#070b12',
        })
        expect(manifest.icons).toEqual(expect.arrayContaining([
            expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
            expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
            expect.objectContaining({ src: '/icon-512-maskable.png', purpose: 'maskable' }),
        ]))
        for (const icon of manifest.icons as { src: string }[]) {
            const image = await page.request.get(icon.src)
            expect(image.ok(), icon.src).toBe(true)
            expect(image.headers()['content-type'], icon.src).toContain('image/png')
        }
    })

    test('declares a Home Screen app in the entry document', async ({ page }) => {
        await openMaps(page)
        const meta = (name: string) => page.locator(`head meta[name="${name}"]`)
        await expect(meta('apple-mobile-web-app-capable')).toHaveAttribute('content', 'yes')
        await expect(meta('mobile-web-app-capable')).toHaveAttribute('content', 'yes')
        await expect(meta('apple-mobile-web-app-status-bar-style')).toHaveAttribute('content', 'black-translucent')
        await expect(meta('apple-mobile-web-app-title')).toHaveAttribute('content', 'UTBT')
        await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest')
        await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
        const viewport = await meta('viewport').getAttribute('content')
        expect(viewport).toContain('viewport-fit=cover')
        expect(viewport).not.toMatch(/maximum-scale|user-scalable/)
    })
})

test.describe('status bar strip', () => {
    for (const theme of ['light', 'classic']) {
        test(`stays #070b12 behind the status bar in the ${theme} theme`, async ({ page }) => {
            await openMaps(page, { 'utbt:theme:v1': JSON.stringify({ id: theme }) })
            await simulateSafeArea(page, { top: 47 })
            await expect.poll(async () => (await topBarBox(page)).top).toBe(0)
            await expect.poll(async () => (await boxOf(hamburger(page))).top).toBeGreaterThanOrEqual(47)
            const width = page.viewportSize()!.width
            const strip = await pixelsOf(page, { x: 0, y: 0, width, height: 47 })
            for (const pixel of strip) expect(pixel).toEqual(STATUS_STRIP_RGB)
        })
    }

    test('sits above a light top bar in the Light theme', async ({ page }) => {
        await openMaps(page, { 'utbt:theme:v1': JSON.stringify({ id: 'light' }) })
        await simulateSafeArea(page, { top: 47 })
        const [below] = await pixelsOf(page, { x: page.viewportSize()!.width - 4, y: 50, width: 1, height: 1 })
        expect(Math.min(...below)).toBeGreaterThan(180)
    })
})

test.describe('top bar', () => {
    test('is shorter in landscape and keeps a 44px hamburger', async ({ page }) => {
        await openMaps(page)
        const portrait = page.viewportSize()!
        const tall = await topBarBox(page)
        expect(await boxOf(hamburger(page))).toMatchObject({ width: 44, height: 44 })
        await page.setViewportSize({ width: portrait.height, height: portrait.width })
        await expect.poll(async () => (await topBarBox(page)).height).toBeLessThan(tall.height)
        expect(await boxOf(hamburger(page))).toMatchObject({ width: 44, height: 44 })
        const short = await topBarBox(page)
        const content = await boxOf(page.getByRole('main'))
        expect(content.top).toBe(0)
        expect(await page.getByRole('main').evaluate(main => parseFloat(getComputedStyle(main).paddingTop))).toBe(short.bottom)
    })

    test('uses a solid tint instead of a blur on touch', async ({ page }) => {
        await openMaps(page)
        expect((await topBarBox(page)).backdropFilter).toBe('none')
        await openDrawer(page)
        const backdrop = page.getByRole('button', { name: 'Close navigation' })
        expect(await backdrop.evaluate(node => getComputedStyle(node).backdropFilter)).toBe('none')
    })
})

test.describe('safe areas', () => {
    test('keep the shell clear of the notch and home indicator in portrait', async ({ page }) => {
        await openMaps(page)
        const { height } = page.viewportSize()!
        await simulateSafeArea(page, { top: 47, bottom: 34 })
        await expect.poll(async () => (await boxOf(hamburger(page))).top).toBeGreaterThanOrEqual(47)
        const bar = await topBarBox(page)
        const search = await boxOf(page.getByPlaceholder('Search for a map name or tag...'))
        expect(search.top).toBeGreaterThanOrEqual(bar.bottom)
        expect(await page.getByRole('main').evaluate(main => parseFloat(getComputedStyle(main).paddingBottom))).toBe(34)

        const drawer = await openDrawer(page)
        const firstLink = await boxOf(drawer.getByRole('link').first())
        expect(firstLink.top).toBeGreaterThanOrEqual(47)
        const login = await boxOf(drawer.getByRole('button', { name: 'Login with Discord' }))
        expect(login.bottom).toBeLessThanOrEqual(height - 34)
    })

    test('inset the hamburger, content and drawer from the notch side in landscape', async ({ page }) => {
        const portrait = page.viewportSize()!
        await page.setViewportSize({ width: portrait.height, height: portrait.width })
        await openMaps(page)
        const { width, height } = page.viewportSize()!
        await simulateSafeArea(page, { left: 47, right: 47, bottom: 21 })
        await expect.poll(async () => (await boxOf(hamburger(page))).left).toBeGreaterThanOrEqual(47)
        const search = await boxOf(page.getByPlaceholder('Search for a map name or tag...'))
        expect(search.left).toBeGreaterThanOrEqual(47)
        expect(search.right).toBeLessThanOrEqual(width - 47)

        const drawer = await openDrawer(page)
        const firstLink = await boxOf(drawer.getByRole('link').first())
        expect(firstLink.left).toBeGreaterThanOrEqual(47)
        expect(firstLink.width).toBeGreaterThanOrEqual(200)
        await drawer.getByRole('button', { name: 'Login with Discord' }).scrollIntoViewIfNeeded()
        const login = await boxOf(drawer.getByRole('button', { name: 'Login with Discord' }))
        expect(login.left).toBeGreaterThanOrEqual(47)
        expect(login.bottom).toBeLessThanOrEqual(height - 21)
    })
})

test.describe('Reload app', () => {
    test('reloads the page onto the route reached inside the app', async ({ page }) => {
        await openMaps(page, { 'utbt:serversPageTutorial:v1': JSON.stringify({ seen: true, version: 1 }) })
        await (await openDrawer(page)).getByRole('link', { name: 'Servers', exact: true }).click()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/servers')
        await page.evaluate(() => { (window as unknown as { beforeReload: boolean }).beforeReload = true })
        const drawer = await openDrawer(page)
        const reloaded = page.waitForEvent('load')
        await drawer.getByRole('button', { name: 'Reload app' }).click()
        await reloaded
        await expect(hamburger(page)).toBeVisible()
        expect(new URL(page.url()).pathname).toBe('/servers')
        expect(await page.evaluate(() => (window as unknown as { beforeReload?: boolean }).beforeReload)).toBeUndefined()
    })
})

test.describe('form controls on a touch tablet', () => {
    test.use({ viewport: { width: 1180, height: 820 } })

    test('render at 16px or more above lg', async ({ page }) => {
        await openMaps(page)
        const sizes = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('input:not([type="checkbox"], [type="radio"]), select, textarea'))
            .filter(control => control.getClientRects().length > 0)
            .map(control => parseFloat(getComputedStyle(control).fontSize)))
        expect(sizes.length).toBeGreaterThan(0)
        for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16)
    })
})
