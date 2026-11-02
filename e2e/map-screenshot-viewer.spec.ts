import { expect, test, type Page } from '@playwright/test'
import type { MapMetadata } from '../app/utils/api'

const MAP_NAME = 'CTF-BT-Viewer'
const STAFF = { id: '555555555555', alias: 'Rin', utbt_role: 1 }
const VIEWER_CHUNK = /\/MapScreenshotViewer(\.tsx|-[\w-]+\.js)(\?|$)/

const MAP: MapMetadata = {
    name: MAP_NAME,
    added: '2026-01-01T00:00:00Z',
    difficulty: 3,
    active: true,
    tags: '',
    author: 'Mapper',
    required_players: 1,
    has_screenshot: true,
    screenshot_updated: '2026-06-01T00:00:00Z',
}

async function openMap(page: Page, { signedIn = false } = {}) {
    await page.addInitScript(signIn => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        if (!signIn) return
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'viewer-token',
            refreshToken: 'viewer-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    }, signedIn)
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net' || url.pathname.startsWith('/screenshots/')) {
            await route.fulfill(url.hostname === 'gateway.utbt.net' ? { json: [] } : { status: 404 })
            return
        }
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        let data: unknown
        if (path === `/maps/${MAP_NAME}`) data = MAP
        else if (path === '/users/me') data = STAFF
        else data = path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
    await page.goto(`/maps/${MAP_NAME}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Viewer' })).toBeVisible()
}

function viewerFetches(page: Page): string[] {
    const fetched: string[] = []
    page.on('request', request => {
        if (VIEWER_CHUNK.test(request.url())) fetched.push(request.url())
    })
    return fetched
}

test('on desktop the hero screenshot opens nothing and loads no viewer code', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop only')
    const fetched = viewerFetches(page)
    await openMap(page)
    const hero = page.getByRole('img', { name: MAP_NAME, exact: true })
    await hero.click()

    await expect(page.getByRole('button', { name: 'View screenshot' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Close modal' })).toHaveCount(0)
    expect(fetched).toEqual([])
})

test('the Change screenshot button still opens the screenshot editor', async ({ page }) => {
    await openMap(page, { signedIn: true })
    await page.getByRole('button', { name: 'Change' }).click()

    await expect(page.getByText('Screenshots are shown as squares across the app.')).toBeVisible()
    await expect(page.getByRole('img', { name: /Pinch or double-tap to zoom/ })).toHaveCount(0)
})

test('on a touch device tapping the hero screenshot opens the viewer, which fetches its code on the first tap', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only')
    const fetched = viewerFetches(page)
    await openMap(page)
    expect(fetched).toEqual([])

    await page.getByRole('button', { name: 'View screenshot' }).tap()
    await expect(page.getByRole('img', { name: /Pinch or double-tap to zoom/ })).toBeVisible()
    expect(fetched.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Close modal' }).tap()
    await expect(page.getByRole('img', { name: /Pinch or double-tap to zoom/ })).toHaveCount(0)
})
