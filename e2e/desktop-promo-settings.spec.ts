import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi } from './sidebarRail'
import {
    DESKTOP_APP_DOWNLOAD_URL,
    MACOS_USER_AGENT,
    WINDOWS_11_USER_AGENT,
    recordTelemetryFlushes,
    routeDesktopAppDownload,
    routeUsersMe,
    seedDesktopPromo,
} from './desktopPromo'

const ENTRY_LABEL = 'Unreal Tournament settings'
const EXPLANATION = /Installation, player, controls, video, audio and gameplay settings live in the desktop app/
const DOWNLOADING_HINT = 'Downloading… If Windows warns about an unrecognised app, choose More info → Run anyway.'

function railEntries(page: Page): Locator {
    return page.getByRole('complementary', { name: 'Settings sections' }).getByRole('button')
}

function entry(page: Page): Locator {
    return railEntries(page).filter({ hasText: ENTRY_LABEL })
}

function notice(page: Page): Locator {
    return page.locator('[data-desktop-app-notice]')
}

async function openSettings(page: Page) {
    await expect(page.locator('aside#app-navigation')).toBeAttached()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))
    await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toBeVisible()
}

async function expectNoEntryOnceLoaded(page: Page) {
    await page.waitForLoadState('networkidle')
    await expect(railEntries(page).filter({ hasText: 'Privacy' })).toBeVisible()
    await expect(entry(page)).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error('BROWSER PAGE ERROR:', error.message))
    await mockApi(page)
})

test.describe('on Windows 11', () => {
    test.use({ userAgent: WINDOWS_11_USER_AGENT })

    test.beforeEach(async ({ isMobile }) => {
        test.skip(isMobile, 'mobile-chromium keeps its Android user agent; the Android test covers it')
    })

    test('the entry follows Appearance and Privacy and opens the explanation with Download', async ({ page }) => {
        await seedDesktopPromo(page)
        await page.goto('/')
        await openSettings(page)

        await expect(railEntries(page)).toHaveText(['Appearance', 'Privacy', ENTRY_LABEL])
        await entry(page).click()

        await expect(page.getByRole('heading', { name: ENTRY_LABEL })).toBeVisible()
        await expect(page.getByText(EXPLANATION)).toBeVisible()
        await expect(notice(page)).toHaveCount(1)
        await expect(notice(page).getByRole('link', { name: 'Download', exact: true })).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(notice(page).getByRole('button')).toHaveCount(0)
    })

    test('Download switches to the SmartScreen hint until the panel unmounts, and records the click', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        const downloads = await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { consent: 'granted' })
        await page.goto('/')
        await openSettings(page)
        await entry(page).click()

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            notice(page).getByRole('link', { name: 'Download', exact: true }).click(),
        ])
        expect(download.suggestedFilename()).toBe('utbt-launcher-setup.exe')
        expect(downloads).toEqual([DESKTOP_APP_DOWNLOAD_URL])

        await expect(notice(page)).toHaveText(DOWNLOADING_HINT)
        await expect(notice(page).getByRole('link')).toHaveCount(0)
        await expect.poll(() => telemetry.flushedOutcomes()).toMatchObject({ 'desktop_promo_click:settings': 1 })

        await railEntries(page).filter({ hasText: 'Privacy' }).click()
        await entry(page).click()
        await expect(notice(page).getByRole('link', { name: 'Download', exact: true })).toBeVisible()
    })

    test('a signed-in player who never used the desktop app sees the entry', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'null')
        await page.goto('/')
        await openSettings(page)
        await expect(entry(page)).toBeVisible()
    })

    test('a signed-in player who used the desktop app recently sees no entry', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'recent')
        await page.goto('/')
        await expect(page.getByText('Tester', { exact: true }).first()).toBeVisible()
        await openSettings(page)
        await expectNoEntryOnceLoaded(page)
    })

    test('a recent desktop visit stored on this browser hides the entry', async ({ page }) => {
        await seedDesktopPromo(page, { desktopSeen: 'fresh' })
        await page.goto('/')
        await openSettings(page)
        await expectNoEntryOnceLoaded(page)
    })

    test('at 360 px the list drills into the panel without horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 })
        await seedDesktopPromo(page)
        await page.goto('/')
        await openSettings(page)

        await entry(page).click()
        await expect(page.getByText(EXPLANATION)).toBeVisible()
        await expect(notice(page)).toBeVisible()
        await expect(page.getByRole('complementary', { name: 'Settings sections' })).toBeHidden()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        expect(await notice(page).evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)

        await page.getByRole('button', { name: 'Back to settings sections' }).click()
        await expect(entry(page)).toBeVisible()
    })
})

test.describe('on macOS', () => {
    test.use({ userAgent: MACOS_USER_AGENT })

    test('Settings lists only Appearance and Privacy', async ({ page }) => {
        await seedDesktopPromo(page)
        await page.goto('/')
        await openSettings(page)
        await expectNoEntryOnceLoaded(page)
        await expect(railEntries(page)).toHaveText(['Appearance', 'Privacy'])
    })
})

test('an Android phone sees only Appearance and Privacy', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-chromium is the Android project')
    await seedDesktopPromo(page)
    await page.goto('/')
    await openSettings(page)
    await expectNoEntryOnceLoaded(page)
    await expect(railEntries(page)).toHaveText(['Appearance', 'Privacy'])
})
