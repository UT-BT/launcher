import { expect, test, type Page } from '@playwright/test'

const AUTH_KEY = 'utbt:webAuth:v1'
const EXPIRED = 'Your session expired. Please log in again.'
const UNCONFIRMED = "We couldn't confirm your login right now, so you're browsing logged out. Reload the page to try again."

async function storeLogin(page: Page, accessToken: string) {
    await page.addInitScript(([key, token]) => {
        if (sessionStorage.getItem('e2e:seeded')) return
        sessionStorage.setItem('e2e:seeded', '1')
        localStorage.setItem(key, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: token,
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    }, [AUTH_KEY, accessToken] as const)
}

async function mockApi(page: Page, refresh: { status: number; body: unknown }, validToken = 'fresh-token') {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const authorized = request.headers()['authorization'] === `Bearer ${validToken}`
        if (path === '/auth/discord/refresh') {
            await route.fulfill({ status: refresh.status, json: refresh.body })
            return
        }
        if (path === '/users/me') {
            await route.fulfill(authorized
                ? { json: { success: true, data: { id: '100', alias: 'Tester', utbt_role: 0 } } }
                : { status: 401, json: { success: false, reason: 'Invalid authentication for this endpoint.' } })
            return
        }
        if (path === '/launcher/activity/latest') {
            await route.fulfill(authorized ? { status: 404, json: { success: false } } : { status: 401, json: { success: false } })
            return
        }
        const data = path === '/v2/summary'
            ? { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null }
            : path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
}

async function storedAccessToken(page: Page): Promise<string | null> {
    return page.evaluate(key => {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as { accessToken: string }).accessToken : null
    }, AUTH_KEY)
}

test('a refused login drops the dead session and keeps browsing logged out', async ({ page }) => {
    await storeLogin(page, 'dead-token')
    await mockApi(page, { status: 400, body: { success: false, error: 'invalid_grant' } })
    await page.goto('/')
    await expect(page.getByText(EXPIRED)).toBeAttached()
    await expect(page.getByText('Failed to load user data', { exact: false })).toHaveCount(0)
    expect(await storedAccessToken(page)).toBeNull()
})

test('a login that cannot be checked right now keeps the session for the next visit', async ({ page }) => {
    await storeLogin(page, 'dead-token')
    await mockApi(page, { status: 500, body: { success: false } })
    await page.goto('/')
    await expect(page.getByText(UNCONFIRMED)).toBeAttached()
    await expect(page.getByText('Failed to load user data', { exact: false })).toHaveCount(0)
    expect(await storedAccessToken(page)).toBe('dead-token')
})

test('a stale token is refreshed and the viewer stays logged in', async ({ page }) => {
    await storeLogin(page, 'stale-token')
    await mockApi(page, {
        status: 200,
        body: { success: true, data: { access_token: 'fresh-token', token_type: 'Bearer', expires_in: 604800, refresh_token: 'next-refresh', scope: 'identify' } },
    })
    await page.goto('/')
    await expect.poll(() => storedAccessToken(page)).toBe('fresh-token')
    await expect(page.getByText('Login with Discord')).toHaveCount(0)
    await expect(page.getByText(EXPIRED)).toHaveCount(0)
    await expect(page.getByText('Failed to load user data', { exact: false })).toHaveCount(0)
})
