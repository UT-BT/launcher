import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi, preseedCollapsedRail, sidebarRail, sidebarToggle } from './sidebarRail'
import {
    DESKTOP_APP_DOWNLOAD_URL,
    DESKTOP_PROMO_DISMISSED_STORAGE_KEY,
    DESKTOP_SEEN_STORAGE_KEY,
    MACOS_USER_AGENT,
    STALE_DAYS,
    WINDOWS_11_USER_AGENT,
    daysAgo,
    recordTelemetryFlushes,
    routeDelayedUsersMe,
    routeDesktopAppDownload,
    routeUsersMe,
    seedDesktopPromo,
} from './desktopPromo'

const ROW_LABEL = 'Get the desktop app'
const DISMISS_LABEL = 'Dismiss the desktop app suggestion'
const MODAL_TITLE = 'Get the UTBT desktop app'
const MODAL_BULLETS = [
    'One-click join and spectate from the server browser',
    'Installs maps straight into UT',
    'Installs UT99 and the 469 patch for you',
    'Edit your UT99 player, controls, video and audio settings',
    'Can upload your personal-best and record demos automatically',
]
const SMARTSCREEN_LINE =
    "Due to code-signing licence fees, the installer isn't signed, so Windows may warn that you are installing an unrecognised app. To install it anyway, choose More info → Run anyway."

function navRow(page: Page): Locator {
    return sidebarRail(page).getByRole('button', { name: ROW_LABEL, exact: true })
}

function dismissButton(page: Page): Locator {
    return sidebarRail(page).getByRole('button', { name: DISMISS_LABEL })
}

function loginButton(page: Page): Locator {
    return sidebarRail(page).getByRole('button', { name: 'Login with Discord' })
}

function signedInCard(page: Page): Locator {
    return sidebarRail(page).getByText('Tester', { exact: true })
}

function modal(page: Page): Locator {
    return page.locator('[data-modal-backdrop]').filter({ has: page.getByRole('heading', { name: MODAL_TITLE }) })
}

async function expectNoRowOnceLoaded(page: Page, loaded: Locator) {
    await expect(loaded).toBeAttached()
    await page.waitForLoadState('networkidle')
    await expect(navRow(page)).toHaveCount(0)
}

async function box(locator: Locator) {
    const bounds = await locator.boundingBox()
    if (!bounds) throw new Error('element has no bounding box')
    return bounds
}

async function openDrawer(page: Page) {
    const menu = page.getByRole('button', { name: 'Open navigation' })
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    return menu
}

async function recordRowAppearances(page: Page, label: string) {
    await page.addInitScript((text) => {
        const marker = window as unknown as { desktopPromoRowSeen?: boolean }
        marker.desktopPromoRowSeen = false
        const check = () => {
            const rail = document.querySelector('aside#app-navigation')
            if (Array.from(rail?.querySelectorAll('button') ?? []).some((button) => button.textContent === text)) {
                marker.desktopPromoRowSeen = true
            }
        }
        new MutationObserver(check).observe(document, { childList: true, subtree: true })
    }, label)
    return () => page.evaluate(() => (window as unknown as { desktopPromoRowSeen?: boolean }).desktopPromoRowSeen)
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

    test.describe('signed out', () => {
        test('with nothing stored the gold button shows in the sidebar footer, above Login with Discord', async ({ page }) => {
            await seedDesktopPromo(page)
            await page.goto('/')
            const row = navRow(page)
            await expect(row).toBeVisible()
            await expect(row).toHaveText(ROW_LABEL)
            const label = row.getByText(ROW_LABEL, { exact: true })
            expect(await label.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)

            const navigation = await box(sidebarRail(page).getByRole('navigation'))
            const rowBox = await box(row)
            const login = await box(loginButton(page))
            expect(rowBox.y).toBeGreaterThanOrEqual(navigation.y + navigation.height)
            expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(login.y)
        })

        test('the collapsed rail shows the row as an icon tile with its label in a right-side tooltip', async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 900 })
            await preseedCollapsedRail(page)
            await seedDesktopPromo(page)
            await page.goto('/')
            await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')

            const row = navRow(page)
            await expect(row).toBeVisible()
            const railRight = await sidebarRail(page).evaluate((rail) => rail.getBoundingClientRect().right)
            const tile = await box(row)
            expect(tile.x + tile.width).toBeLessThanOrEqual(railRight)
            expect(tile.height).toBeGreaterThanOrEqual(44)

            await row.hover()
            const tooltip = page.locator('body > div:not(#app)').filter({ hasText: ROW_LABEL })
            await expect(tooltip).toHaveCount(1)
            await expect(tooltip).toBeVisible()
            const tip = await box(tooltip)
            expect(tip.x).toBeGreaterThanOrEqual(railRight)
            expect(Math.abs(tip.y + tip.height / 2 - (tile.y + tile.height / 2))).toBeLessThanOrEqual(2)
        })

        test('at a narrow viewport the row sits in the drawer and closes it to open the modal', async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 })
            await seedDesktopPromo(page)
            await page.goto('/')
            const menu = await openDrawer(page)

            const row = navRow(page)
            await expect(row).toBeVisible()
            await row.click()
            await expect(menu).toHaveAttribute('aria-expanded', 'false')
            await expect(sidebarRail(page)).toHaveAttribute('inert', '')
            await expect(modal(page)).toBeVisible()
        })

        test('the modal lists what the desktop app adds and links the stable download', async ({ page }) => {
            const downloads = await routeDesktopAppDownload(page)
            await seedDesktopPromo(page)
            await page.goto('/')
            await navRow(page).click()

            const dialog = modal(page)
            await expect(dialog.getByRole('heading', { name: MODAL_TITLE })).toBeVisible()
            await expect(dialog.getByRole('listitem')).toHaveText(MODAL_BULLETS)
            await expect(dialog.getByText(SMARTSCREEN_LINE, { exact: true })).toBeVisible()

            const link = dialog.getByRole('link', { name: 'Download for Windows' })
            await expect(link).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
            const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
            expect(download.suggestedFilename()).toBe('utbt-launcher-setup.exe')
            expect(downloads).toEqual([DESKTOP_APP_DOWNLOAD_URL])
            await expect(dialog).toBeVisible()

            await dialog.getByRole('button', { name: 'Close modal' }).click()
            await expect(modal(page)).toHaveCount(0)
            await expect(navRow(page)).toBeVisible()
        })

        test('the × appears on hover or keyboard focus and stays out of sight otherwise', async ({ page }) => {
            await seedDesktopPromo(page)
            await page.goto('/')
            const dismiss = dismissButton(page)
            await expect(navRow(page)).toBeVisible()
            await expect(dismiss).toHaveCSS('opacity', '0')

            await navRow(page).hover()
            await expect(dismiss).toHaveCSS('opacity', '1')

            await page.mouse.move(900, 450)
            await expect(dismiss).toHaveCSS('opacity', '0')

            await navRow(page).focus()
            await expect(dismiss).toHaveCSS('opacity', '1')
            await page.keyboard.press('Tab')
            await expect(dismiss).toBeFocused()
        })

        test('× hides the row for good: it stays hidden after a reload', async ({ page }) => {
            await seedDesktopPromo(page)
            await page.goto('/')
            await navRow(page).hover()
            await dismissButton(page).click()
            await expect(navRow(page)).toHaveCount(0)
            expect(await page.evaluate((key) => localStorage.getItem(key), DESKTOP_PROMO_DISMISSED_STORAGE_KEY)).toBeTruthy()

            await page.reload()
            await expectNoRowOnceLoaded(page, loginButton(page))
        })

        test('a fresh dismissal keeps the row hidden', async ({ page }) => {
            await seedDesktopPromo(page, { dismissed: 'fresh' })
            await page.goto('/')
            await expectNoRowOnceLoaded(page, loginButton(page))
        })

        test('a stale (91-day) dismissal brings the row back', async ({ page }) => {
            await seedDesktopPromo(page, { dismissed: 'stale' })
            await page.goto('/')
            await expect(navRow(page)).toBeVisible()
        })

        test('a fresh stored desktop-seen time keeps the row hidden, a stored null or a stale one shows it', async ({ page }) => {
            await seedDesktopPromo(page, { desktopSeen: 'fresh' })
            await page.goto('/')
            await expectNoRowOnceLoaded(page, loginButton(page))

            for (const desktopSeen of ['null', 'stale'] as const) {
                const stored = desktopSeen === 'null' ? 'null' : JSON.stringify(daysAgo(STALE_DAYS))
                await page.evaluate(([key, value]) => localStorage.setItem(key, value), [DESKTOP_SEEN_STORAGE_KEY, stored] as const)
                await page.reload()
                await expect(navRow(page), `stored desktop-seen ${desktopSeen}`).toBeVisible()
            }
        })

        test('at 360 px the open drawer and the modal fit without horizontal scroll', async ({ page }) => {
            await page.setViewportSize({ width: 360, height: 800 })
            await seedDesktopPromo(page)
            await page.goto('/')
            await openDrawer(page)
            await expect(navRow(page)).toBeVisible()
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

            await navRow(page).click()
            await expect(modal(page).getByRole('link', { name: 'Download for Windows' })).toBeVisible()
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
            const link = await box(modal(page).getByRole('link', { name: 'Download for Windows' }))
            expect(link.height).toBeGreaterThanOrEqual(40)
        })

        test('with analytics consent the download click and the dismissal reach the flushed session', async ({ page }) => {
            const telemetry = recordTelemetryFlushes(page)
            await routeDesktopAppDownload(page)
            await seedDesktopPromo(page, { consent: 'granted' })
            await page.goto('/')

            await navRow(page).click()
            const link = modal(page).getByRole('link', { name: 'Download for Windows' })
            await Promise.all([page.waitForEvent('download'), link.click()])
            await modal(page).getByRole('button', { name: 'Close modal' }).click()

            await navRow(page).hover()
            await dismissButton(page).click()
            await expect(navRow(page)).toHaveCount(0)

            await expect
                .poll(() => telemetry.flushedOutcomes())
                .toMatchObject({ 'desktop_promo_click:nav': 1, 'desktop_promo_dismiss:nav': 1 })
        })
    })

    test.describe('on a touch screen', () => {
        test.use({ hasTouch: true })

        test('the × shows without hovering', async ({ page }) => {
            await seedDesktopPromo(page)
            await page.goto('/')
            await expect(navRow(page)).toBeVisible()
            await expect(dismissButton(page)).toHaveCSS('opacity', '1')
            await dismissButton(page).tap()
            await expect(navRow(page)).toHaveCount(0)
        })
    })

    test.describe('signed in', () => {
        test('a null last_desktop_seen_at shows the row', async ({ page }) => {
            await seedDesktopPromo(page, { signedIn: true })
            await routeUsersMe(page, 'null')
            await page.goto('/')
            await expect(signedInCard(page)).toBeVisible()
            await expect(navRow(page)).toBeVisible()
            await expect
                .poll(() => page.evaluate((key) => localStorage.getItem(key), DESKTOP_SEEN_STORAGE_KEY))
                .toBe('null')
        })

        test('a recent last_desktop_seen_at hides the row and keeps the next signed-out visit quiet', async ({ page }) => {
            await seedDesktopPromo(page, { signedIn: true })
            const served = await routeUsersMe(page, 'recent')
            await page.goto('/')
            await expectNoRowOnceLoaded(page, signedInCard(page))
            await expect
                .poll(() => page.evaluate((key) => localStorage.getItem(key), DESKTOP_SEEN_STORAGE_KEY))
                .toBe(JSON.stringify(served.last_desktop_seen_at))

            await page.evaluate(() => localStorage.removeItem('utbt:webAuth:v1'))
            await page.reload()
            await expectNoRowOnceLoaded(page, loginButton(page))
        })

        test('a stale last_desktop_seen_at shows the row', async ({ page }) => {
            await seedDesktopPromo(page, { signedIn: true, desktopSeen: 'fresh' })
            await routeUsersMe(page, 'stale')
            await page.goto('/')
            await expect(signedInCard(page)).toBeVisible()
            await expect(navRow(page)).toBeVisible()
        })

        test('a response without the field shows nothing', async ({ page }) => {
            await seedDesktopPromo(page, { signedIn: true })
            await routeUsersMe(page, 'absent')
            await page.goto('/')
            await expectNoRowOnceLoaded(page, signedInCard(page))
        })

        test('while /users/me is pending the row never appears, and a recent answer keeps it away', async ({ page }) => {
            const rowSeen = await recordRowAppearances(page, ROW_LABEL)
            await seedDesktopPromo(page, { signedIn: true })
            const pending = await routeDelayedUsersMe(page, 'recent')
            await page.goto('/')
            await pending.requested
            await page.waitForTimeout(500)
            expect(await rowSeen()).toBe(false)
            await expect(sidebarRail(page)).toHaveCount(0)

            pending.release()
            await expectNoRowOnceLoaded(page, signedInCard(page))
            expect(await rowSeen()).toBe(false)
        })

        test('with a delayed null answer the row appears only after the response', async ({ page }) => {
            const rowSeen = await recordRowAppearances(page, ROW_LABEL)
            await seedDesktopPromo(page, { signedIn: true })
            const pending = await routeDelayedUsersMe(page, 'null')
            await page.goto('/')
            await pending.requested
            await page.waitForTimeout(500)
            expect(await rowSeen()).toBe(false)

            pending.release()
            await expect(navRow(page)).toBeVisible()
            expect(await rowSeen()).toBe(true)
        })
    })
})

test.describe('on macOS', () => {
    test.use({ userAgent: MACOS_USER_AGENT })

    test('a signed-out visitor with nothing stored sees no row', async ({ page }) => {
        await seedDesktopPromo(page)
        await page.goto('/')
        await expectNoRowOnceLoaded(page, loginButton(page))
    })

    test('a signed-in player who never used the desktop app sees no row', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'null')
        await page.goto('/')
        await expectNoRowOnceLoaded(page, signedInCard(page))
    })
})

test('an Android phone sees no row in the drawer', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-chromium is the Android project')
    await seedDesktopPromo(page)
    await page.goto('/')
    await openDrawer(page)
    await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toBeVisible()
    await expect(loginButton(page)).toBeVisible()
    await expect(navRow(page)).toHaveCount(0)
})
