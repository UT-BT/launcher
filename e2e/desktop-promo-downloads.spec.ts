import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import type { LeaderboardEntry, MedalHuntOpportunity } from '../app/utils/api'
import { horizontalOverflow } from './layout'
import { MAP, serveMapDownloadRoutes } from './mapDownload'
import {
    DESKTOP_APP_DOWNLOAD_URL,
    MACOS_USER_AGENT,
    WINDOWS_11_USER_AGENT,
    recordTelemetryFlushes,
    routeDesktopAppDownload,
    routeUsersMe,
    seedDesktopPromo,
} from './desktopPromo'

const MAP_LINE = 'The desktop app installs maps straight into UT · Download'
const DEMO_LINE = 'The desktop app uploads your demos automatically · Download'
const DOWNLOADING_HINT = 'Downloading… If Windows warns about an unrecognised app, choose More info → Run anyway.'

const CAP = runCompareFixture('capDetailCandidates')
const CAP_ID = CAP.cap.id

async function serveCapDemo(context: BrowserContext) {
    await context.route(/https:\/\/api\.utbt\.net\/(caps\/[^/]+\/detail|demos\/[^/?]+)\/?(\?.*)?$/, async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path.startsWith('/demos/')) {
            await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from('UT-mock-demo') })
            return
        }
        await route.fulfill({ json: { success: true, data: path.includes(CAP_ID) ? CAP : null } })
    })
}

async function serveMedalHunt(context: BrowserContext) {
    const opportunity: MedalHuntOpportunity = {
        mapName: CAP.cap.map,
        difficulty: 3,
        currentTime: CAP.cap.cap_time_seconds + 5,
        targetTime: CAP.cap.cap_time_seconds,
        targetMedal: 'Gold Medal',
        improvement: 5,
        improvementPct: 6,
        worldRecordAdded: null,
    }
    const entry: LeaderboardEntry = {
        map: CAP.cap.map,
        user: String(CAP.cap.user),
        cap_time_seconds: CAP.cap.cap_time_seconds,
        added: '2026-07-12T04:20:49Z',
        alias: CAP.cap.alias ?? 'player',
        cap_type: CAP.cap.cap_type,
        verified: true,
        id: CAP_ID,
    }
    await context.route(/https:\/\/api\.utbt\.net\/(v2\/summary\/medal_hunt|caps\/leaderboard\/map\/[^/?]+)\/?(\?.*)?$/, async (route) => {
        const path = new URL(route.request().url()).pathname
        const data = path.includes('medal_hunt') ? { opportunities: [opportunity] } : [entry]
        await route.fulfill({ json: { success: true, data } })
    })
}

function notice(page: Page): Locator {
    return page.locator('[data-desktop-app-notice]')
}

function noticeDownload(page: Page): Locator {
    return notice(page).getByRole('link', { name: 'Download', exact: true })
}

function noticeDismiss(page: Page): Locator {
    return notice(page).getByRole('button', { name: 'Dismiss the desktop app suggestion' })
}

async function expectNoNoticeOnceLoaded(page: Page) {
    await page.waitForLoadState('networkidle')
    await expect(notice(page)).toHaveCount(0)
}

function closeButton(page: Page): Locator {
    return page.getByRole('button', { name: 'Close', exact: true })
}

async function downloadMap(page: Page) {
    await page.goto(`/maps/${MAP}`)
    await page.waitForLoadState('networkidle')
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download Map' }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`${MAP}.zip`)
    await expect(page.getByRole('heading', { name: 'Map Downloaded' })).toBeVisible()
    await expect(page.getByText(`Downloaded as ${MAP}.zip`)).toBeVisible()
}

async function downloadDemo(page: Page) {
    await page.goto(`/caps/${CAP_ID}`)
    await page.waitForLoadState('networkidle')
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Demo', exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.dem$/)
    await expect(page.getByRole('heading', { name: 'Demo Downloaded' })).toBeVisible()
}

async function expectNoLineOnEitherDialog(page: Page) {
    await downloadMap(page)
    await expectNoNoticeOnceLoaded(page)
    await closeButton(page).click()

    await downloadDemo(page)
    await expectNoNoticeOnceLoaded(page)
}

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', (error) => console.error('BROWSER PAGE ERROR:', error.message))
    await serveMapDownloadRoutes(context)
    await serveCapDemo(context)
})

test.describe('on Windows 11', () => {
    test.use({ userAgent: WINDOWS_11_USER_AGENT })

    test.beforeEach(async ({ isMobile }) => {
        test.skip(isMobile, 'mobile-chromium keeps its Android user agent; the Android test covers it')
    })

    test('the map result keeps the zip copy and adds the map promo line', async ({ page }) => {
        await seedDesktopPromo(page)
        await downloadMap(page)

        await expect(notice(page)).toHaveCount(1)
        await expect(notice(page)).toHaveText(MAP_LINE)
        await expect(noticeDownload(page)).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(noticeDismiss(page)).toHaveCount(0)
        await expect(page.getByText(/installed/i)).toHaveCount(0)
        await expect(page.getByText(/extracted/i)).toHaveCount(0)
    })

    test('the map line Download shows the SmartScreen hint until the dialog closes and records map-modal', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        const downloads = await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { consent: 'granted' })
        await downloadMap(page)

        const [installer] = await Promise.all([page.waitForEvent('download'), noticeDownload(page).click()])
        expect(installer.suggestedFilename()).toBe('utbt-launcher-setup.exe')
        expect(downloads).toEqual([DESKTOP_APP_DOWNLOAD_URL])

        await expect(notice(page)).toHaveText(DOWNLOADING_HINT)
        await expect(noticeDownload(page)).toHaveCount(0)
        await expect(page.getByText(`Downloaded as ${MAP}.zip`)).toBeVisible()

        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_click:map-modal': 1 })

        await closeButton(page).click()
        await expect(page.getByRole('heading', { name: 'Map Downloaded' })).toHaveCount(0)
        await expectNoNoticeOnceLoaded(page)

        await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Map' }).click()])
        await expect(notice(page)).toHaveText(MAP_LINE)
    })

    test('the demo result adds the demo promo line, and its Download records demo-modal', async ({ page }) => {
        const telemetry = recordTelemetryFlushes(page)
        await routeDesktopAppDownload(page)
        await seedDesktopPromo(page, { consent: 'granted' })
        await downloadDemo(page)

        await expect(notice(page)).toHaveCount(1)
        await expect(notice(page)).toHaveText(DEMO_LINE)
        await expect(noticeDownload(page)).toHaveAttribute('href', DESKTOP_APP_DOWNLOAD_URL)
        await expect(noticeDismiss(page)).toHaveCount(0)

        await Promise.all([page.waitForEvent('download'), noticeDownload(page).click()])
        await expect(notice(page)).toHaveText(DOWNLOADING_HINT)

        await expect
            .poll(() => telemetry.flushedOutcomes())
            .toMatchObject({ 'desktop_promo_click:demo-modal': 1 })
        expect(await telemetry.flushedOutcomes()).not.toHaveProperty('desktop_promo_click:map-modal')

        await closeButton(page).click()
        await expect(page.getByRole('heading', { name: 'Demo Downloaded' })).toHaveCount(0)
        await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Demo', exact: true }).click()])
        await expect(notice(page)).toHaveText(DEMO_LINE)
    })

    test('a demo downloaded from the Home replay picker gets the demo promo line', async ({ page, context }) => {
        await serveMedalHunt(context)
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'null')
        await page.goto('/')

        await page.getByRole('button', { name: 'Demos' }).first().click()
        await expect(page.getByRole('heading', { name: /^Replays/ })).toBeVisible()
        await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Download demo' }).first().click(),
        ])

        await expect(page.getByRole('heading', { name: 'Demo Downloaded' })).toBeVisible()
        await expect(notice(page)).toHaveText(DEMO_LINE)
    })

    test('a recent desktop user gets the result copy without a promo line', async ({ page }) => {
        await seedDesktopPromo(page, { signedIn: true })
        await routeUsersMe(page, 'recent')

        await expectNoLineOnEitherDialog(page)
    })

    test.describe('at 360 px', () => {
        test.use({ viewport: { width: 360, height: 800 } })

        test('neither result dialog overflows with its promo line', async ({ page }) => {
            await seedDesktopPromo(page)

            await downloadMap(page)
            await expect(notice(page)).toHaveText(MAP_LINE)
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
            await closeButton(page).click()

            await downloadDemo(page)
            await expect(notice(page)).toHaveText(DEMO_LINE)
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        })
    })
})

test.describe('on macOS', () => {
    test.use({ userAgent: MACOS_USER_AGENT })

    test('neither result dialog shows a promo line', async ({ page }) => {
        await seedDesktopPromo(page)

        await expectNoLineOnEitherDialog(page)
    })
})

test.describe('on Android', () => {
    test.beforeEach(async ({ isMobile }) => {
        test.skip(!isMobile, 'only mobile-chromium carries the Android user agent')
    })

    test('neither result dialog shows a promo line', async ({ page }) => {
        await seedDesktopPromo(page)

        await expectNoLineOnEitherDialog(page)
    })
})
