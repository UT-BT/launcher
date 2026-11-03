import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'
import {
    DESKTOP_APP_DOWNLOAD_URL,
    MACOS_USER_AGENT,
    WINDOWS_11_USER_AGENT,
    recordTelemetryFlushes,
    routeDesktopAppDownload,
    routeUsersMe,
    seedDesktopPromo,
    type UsersMeVariant,
} from './desktopPromo'

const SLUG = 'stream-cup'
const CAMS_EXPLANATION = 'The cam tool needs the desktop launcher.'
const GUIDE_EXPLANATION = /This step is done in the desktop launcher/
const NOT_ELIGIBLE_LINE = 'Use the desktop launcher (Windows) for this.'
const ELIGIBLE_LINE = 'Get the desktop launcher for Windows · Download'
const DOWNLOADING_HINT = 'Downloading… If Windows warns about an unrecognised app, choose More info → Run anyway.'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Stream Cup 2026',
    summary: 'A cup for checking the Stream tab notices.',
    description: null,
    rules: null,
    team_size: 2,
    bracket_type: 'groups',
    status: 'active',
    signups_open: false,
    signup_opens_at: null,
    signup_closes_at: null,
    starts_at: null,
    ends_at: null,
    max_teams: 8,
    team_count: 0,
    registered_team_count: 0,
    created_at: null,
    published_at: null,
    predictions_enabled: false,
}

async function mockStreamTab(page: Page, usersMe: UsersMeVariant) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') return route.fulfill({ json: [] })
        const path = url.pathname.replace(/\/$/, '')
        if (path === '/user_state') return route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
        if (path === `/tournaments/${SLUG}`) return route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
        if (path === `/tournaments/${SLUG}/me`) {
            return route.fulfill({ json: { success: true, data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, is_streamer: true } } })
        }
        if (path === `/tournaments/${SLUG}/bracket`) {
            return route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
        }
        if (path === `/tournaments/${SLUG}/pick-ban/config`) return route.fulfill({ json: { success: true, data: { stages: [] } } })
        if (path.endsWith('/teams') || path.endsWith('/lfp') || path.endsWith('/matches')) {
            return route.fulfill({ json: { success: true, data: { items: [] } } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
    await routeUsersMe(page, usersMe)
}

async function openPanel(page: Page, name: 'Cams' | 'Guide') {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, name)
    const panel = page.getByRole('region', { name })
    await expect(panel).toBeVisible()
    return panel
}

function notices(scope: Locator): Locator {
    return scope.locator('[data-desktop-app-notice]')
}

function downloadLinks(scope: Locator): Locator {
    return scope.getByRole('link', { name: 'Download', exact: true })
}

async function openLaunchTheCams(guide: Locator) {
    await guide.getByRole('button', { name: /Launch the cams/ }).click()
    await expect(guide.getByText(GUIDE_EXPLANATION)).toBeVisible()
}

async function expectFallbackOnly(page: Page) {
    const cams = await openPanel(page, 'Cams')
    await page.waitForLoadState('networkidle')
    await expect(cams.getByText(CAMS_EXPLANATION)).toBeVisible()
    await expect(cams.getByText(NOT_ELIGIBLE_LINE)).toHaveCount(1)
    await expect(notices(cams)).toHaveCount(0)
    await expect(downloadLinks(cams)).toHaveCount(0)

    await openStreamPanel(page, 'Guide')
    const guide = page.getByRole('region', { name: 'Guide' })
    await openLaunchTheCams(guide)
    await expect(guide.getByText(NOT_ELIGIBLE_LINE)).toHaveCount(2)
    await expect(notices(guide)).toHaveCount(0)
    await expect(downloadLinks(guide)).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

test.describe('an eligible Windows 11 streamer', () => {
    test.use({ userAgent: WINDOWS_11_USER_AGENT })

    test.beforeEach(async ({ page, isMobile }) => {
        test.skip(isMobile, 'mobile-chromium keeps its Android user agent; the Android test covers it')
        await mockStreamTab(page, 'null')
    })

    test('sees the cam tool explanation and Download in the Cams panel', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        const cams = await openPanel(page, 'Cams')

        await expect(cams.getByText(CAMS_EXPLANATION)).toBeVisible()
        await expect(notices(cams)).toHaveCount(1)
        await expect(notices(cams)).toHaveText(ELIGIBLE_LINE)
        await expect(downloadLinks(cams)).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(cams.getByText(NOT_ELIGIBLE_LINE)).toHaveCount(0)
    })

    test('sees Download in the requirements and in the desktop-only guide step', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        const guide = await openPanel(page, 'Guide')

        await expect(notices(guide)).toHaveCount(1)
        await openLaunchTheCams(guide)
        await expect(notices(guide)).toHaveCount(2)
        await expect(notices(guide)).toHaveText([ELIGIBLE_LINE, ELIGIBLE_LINE])
        await expect(downloadLinks(guide)).toHaveCount(2)
        for (const link of await downloadLinks(guide).all()) await expect(link).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(guide.getByText(NOT_ELIGIBLE_LINE)).toHaveCount(0)
    })

    test('Download switches the Cams notice to the SmartScreen hint and records the click', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        const downloads = await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { signedIn: true, consent: 'granted' })
        const cams = await openPanel(page, 'Cams')

        const [download] = await Promise.all([page.waitForEvent('download'), downloadLinks(cams).click()])
        expect(download.suggestedFilename()).toBe('utbt-launcher-setup.exe')
        expect(downloads).toEqual([DESKTOP_APP_DOWNLOAD_URL])

        await expect(notices(cams)).toHaveText(DOWNLOADING_HINT)
        await expect(downloadLinks(cams)).toHaveCount(0)
        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_click:stream': 1 })
        await expect(notices(cams)).toHaveText(DOWNLOADING_HINT)
    })

    test('Download in a guide step switches only that notice to the SmartScreen hint', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { signedIn: true, consent: 'granted' })
        const guide = await openPanel(page, 'Guide')
        await openLaunchTheCams(guide)

        const step = guide.locator('#guide-cams')
        await Promise.all([page.waitForEvent('download'), downloadLinks(step).click()])

        await expect(notices(step)).toHaveText(DOWNLOADING_HINT)
        await expect(notices(guide)).toHaveText([ELIGIBLE_LINE, DOWNLOADING_HINT])
        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_click:stream': 1 })
    })

    test('the notices fit a 360 px phone', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 })
        await seedDesktopPromo(page, { signedIn: true })
        const cams = await openPanel(page, 'Cams')
        await expect(downloadLinks(cams)).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        await openStreamPanel(page, 'Guide')
        const guide = page.getByRole('region', { name: 'Guide' })
        await openLaunchTheCams(guide)
        await expect(downloadLinks(guide)).toHaveCount(2)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
})

test.describe('a Windows 11 streamer who used the desktop app recently', () => {
    test.use({ userAgent: WINDOWS_11_USER_AGENT })

    test('sees the explanation and the fallback line, with no Download', async ({ page, isMobile }) => {
        test.skip(isMobile, 'mobile-chromium keeps its Android user agent; the Android test covers it')
        await mockStreamTab(page, 'recent')
        await seedDesktopPromo(page, { signedIn: true })
        await expectFallbackOnly(page)
    })
})

test.describe('a macOS streamer', () => {
    test.use({ userAgent: MACOS_USER_AGENT })

    test('sees the explanation and the fallback line, with no Download', async ({ page }) => {
        await mockStreamTab(page, 'null')
        await seedDesktopPromo(page, { signedIn: true })
        await expectFallbackOnly(page)
    })

    test('the fallback fits a 360 px phone', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 })
        await mockStreamTab(page, 'null')
        await seedDesktopPromo(page, { signedIn: true })
        const cams = await openPanel(page, 'Cams')
        await expect(cams.getByText(NOT_ELIGIBLE_LINE)).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
})

test('an Android streamer sees the explanation and the fallback line, with no Download', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-chromium is the Android project')
    await mockStreamTab(page, 'null')
    await seedDesktopPromo(page, { signedIn: true })
    await expectFallbackOnly(page)
})
