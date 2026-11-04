import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi, sidebarRail } from './sidebarRail'
import {
    DESKTOP_APP_DOWNLOAD_URL,
    DESKTOP_PROMO_DISMISSED_STORAGE_KEY,
    MACOS_USER_AGENT,
    WINDOWS_11_USER_AGENT,
    recordTelemetryFlushes,
    routeDelayedUsersMe,
    routeDesktopAppDownload,
    routeUsersMe,
    seedDesktopPromo,
} from './desktopPromo'

const STRIP_LINE = 'Join servers in one click with the desktop app · Download'
const DOWNLOADING_HINT = 'Downloading… If Windows warns about an unrecognised app, choose More info → Run anyway.'
const DISMISS_LABEL = 'Dismiss the desktop app suggestion'
const NAV_ROW_LABEL = 'Get the desktop app'

const GATEWAY_SERVERS = [
    { id: 'bt-1', ip: '192.0.2.10', hostport: 7777, hostname: 'UTBT Test Server One', map_name: 'CTF-BT-Test', max_players: 12, players: [] },
    { id: 'bt-2', ip: '192.0.2.11', hostport: 7777, hostname: 'UTBT Test Server Two', map_name: 'CTF-BT-Other', max_players: 12, players: [] },
]

async function mockServers(page: Page) {
    await mockApi(page)
    await page.route(/https:\/\/gateway\.utbt\.net\/server-info\/?(\?.*)?$/, (route) => route.fulfill({ json: GATEWAY_SERVERS }))
}

async function skipServersTutorial(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:serversPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
}

function strip(page: Page): Locator {
    return page.locator('[data-desktop-app-notice]')
}

function stripDownload(page: Page): Locator {
    return strip(page).getByRole('link', { name: 'Download', exact: true })
}

function stripDismiss(page: Page): Locator {
    return strip(page).getByRole('button', { name: DISMISS_LABEL })
}

function navRow(page: Page): Locator {
    return sidebarRail(page).getByRole('button', { name: NAV_ROW_LABEL, exact: true })
}

function serverRows(page: Page): Locator {
    return page.getByText(/^UTBT Test Server (One|Two)$/)
}

async function box(locator: Locator) {
    const bounds = await locator.boundingBox()
    if (!bounds) throw new Error('element has no bounding box')
    return bounds
}

async function openServers(page: Page) {
    await page.goto('/servers')
    await expect(page.getByRole('heading', { name: 'Servers', level: 1 })).toBeVisible()
    await expect(serverRows(page).first()).toBeVisible()
}

async function expectNoStripOnceLoaded(page: Page) {
    await page.waitForLoadState('networkidle')
    await expect(strip(page)).toHaveCount(0)
}

function storedDismissal(page: Page) {
    return page.evaluate((key) => localStorage.getItem(key), DESKTOP_PROMO_DISMISSED_STORAGE_KEY)
}

async function recordStripAppearances(page: Page) {
    await page.addInitScript(() => {
        const marker = window as unknown as { desktopAppNoticeSeen?: boolean }
        marker.desktopAppNoticeSeen = false
        const check = () => {
            if (document.querySelector('[data-desktop-app-notice]')) marker.desktopAppNoticeSeen = true
        }
        new MutationObserver(check).observe(document, { childList: true, subtree: true })
    })
    return () => page.evaluate(() => (window as unknown as { desktopAppNoticeSeen?: boolean }).desktopAppNoticeSeen)
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error('BROWSER PAGE ERROR:', error.message))
    await mockServers(page)
    await skipServersTutorial(page)
})

test.describe('on Windows 11', () => {
    test.use({ userAgent: WINDOWS_11_USER_AGENT })

    test.beforeEach(async ({ isMobile }) => {
        test.skip(isMobile, 'mobile-chromium keeps its Android user agent; the Android test covers it')
    })

    test('one strip sits above the server table, never per row', async ({ page }) => {
        await seedDesktopPromo(page)
        await openServers(page)

        await expect(strip(page)).toHaveCount(1)
        await expect(strip(page)).toHaveText(STRIP_LINE)
        await expect(stripDownload(page)).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(serverRows(page)).toHaveCount(2)

        const stripBox = await box(strip(page))
        const table = await box(page.getByRole('table'))
        expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(table.y)
        expect(stripBox.width).toBeGreaterThanOrEqual(table.width - 1)
    })

    test('Download switches the line to the SmartScreen hint and records the click', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        const downloads = await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { consent: 'granted' })
        await openServers(page)

        const [download] = await Promise.all([page.waitForEvent('download'), stripDownload(page).click()])
        expect(download.suggestedFilename()).toBe('utbt-launcher-setup.exe')
        expect(downloads).toEqual([DESKTOP_APP_DOWNLOAD_URL])

        await expect(strip(page)).toHaveText(DOWNLOADING_HINT)
        await expect(stripDownload(page)).toHaveCount(0)
        await expect(stripDismiss(page)).toBeVisible()

        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_click:servers': 1 })
        await expect(strip(page)).toHaveText(DOWNLOADING_HINT)
    })

    test('the strip × hides the strip and the nav row, for good, and records the dismissal', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        await seedDesktopPromo(page, { consent: 'granted' })
        await openServers(page)
        await expect(navRow(page)).toBeVisible()

        await stripDismiss(page).click()
        await expect(strip(page)).toHaveCount(0)
        await expect(navRow(page)).toHaveCount(0)
        expect(await storedDismissal(page)).toBeTruthy()
        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_dismiss:servers': 1 })

        await page.reload()
        await expect(serverRows(page).first()).toBeVisible()
        await expectNoStripOnceLoaded(page)
        await expect(navRow(page)).toHaveCount(0)
    })

    test('dismissing the nav row hides the strip too', async ({ page }) => {
        await seedDesktopPromo(page)
        await openServers(page)
        await expect(strip(page)).toBeVisible()

        await navRow(page).hover()
        await sidebarRail(page).getByRole('button', { name: DISMISS_LABEL }).click()
        await expect(navRow(page)).toHaveCount(0)
        await expect(strip(page)).toHaveCount(0)

        await page.reload()
        await expect(serverRows(page).first()).toBeVisible()
        await expectNoStripOnceLoaded(page)
    })

    test('a fresh dismissal keeps the strip away', async ({ page }) => {
        await seedDesktopPromo(page, { dismissed: 'fresh' })
        await openServers(page)
        await expectNoStripOnceLoaded(page)
    })

    test('a stale (91-day) dismissal brings the strip back', async ({ page }) => {
        await seedDesktopPromo(page, { dismissed: 'stale' })
        await openServers(page)
        await expect(strip(page)).toHaveText(STRIP_LINE)
    })

    test('while a delayed profile is pending no strip flashes for a recent desktop user', async ({ page }) => {
        const stripSeen = await recordStripAppearances(page)
        await seedDesktopPromo(page, { signedIn: true })
        const pending = await routeDelayedUsersMe(page, 'recent')
        await page.goto('/servers')
        await pending.requested
        await page.waitForTimeout(500)
        expect(await stripSeen()).toBe(false)

        pending.release()
        await expect(sidebarRail(page).getByText('Tester', { exact: true })).toBeVisible()
        await expect(serverRows(page).first()).toBeVisible()
        await expectNoStripOnceLoaded(page)
        expect(await stripSeen()).toBe(false)
    })

    test('a signed-in player who used the desktop app recently sees no strip', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'recent')
        await openServers(page)
        await expect(sidebarRail(page).getByText('Tester', { exact: true })).toBeVisible()
        await expectNoStripOnceLoaded(page)
    })

    test('a signed-in player who never used the desktop app sees the strip', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'null')
        await openServers(page)
        await expect(strip(page)).toHaveText(STRIP_LINE)
    })

    test('at 360 px the strip wraps without horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 })
        await seedDesktopPromo(page)
        await openServers(page)
        await expect(strip(page)).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await strip(page).evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
    })

    test('at 390 px Download and × are tappable', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await seedDesktopPromo(page)
        await openServers(page)
        for (const control of [stripDownload(page), stripDismiss(page)]) {
            const bounds = await box(control)
            expect(bounds.height).toBeGreaterThanOrEqual(40)
            expect(bounds.width).toBeGreaterThanOrEqual(40)
        }
    })

    test.describe('on a touch screen', () => {
        test.use({ hasTouch: true })

        test('the × shows without hovering and dismisses by tap', async ({ page }) => {
            await seedDesktopPromo(page)
            await openServers(page)
            await expect(stripDismiss(page)).toBeVisible()
            await expect(stripDismiss(page)).toHaveCSS('opacity', '1')
            await stripDismiss(page).tap()
            await expect(strip(page)).toHaveCount(0)
        })
    })
})

test.describe('on macOS', () => {
    test.use({ userAgent: MACOS_USER_AGENT })

    test('a signed-out visitor with nothing stored sees no strip', async ({ page }) => {
        await seedDesktopPromo(page)
        await openServers(page)
        await expectNoStripOnceLoaded(page)
    })
})

test('an Android phone sees no strip', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-chromium is the Android project')
    await seedDesktopPromo(page)
    await openServers(page)
    await expectNoStripOnceLoaded(page)
})
