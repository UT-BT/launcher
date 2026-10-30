import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './sidebarRail'

const AUTH_KEY = 'utbt:webAuth:v1'
const NEWS_SEEN = '2026-10-01T00:00:00.000Z'

interface PendingReviewRow {
    id: number
    mapName: string
    timeAgo: string
}

interface HomeApi {
    pendingReviews: PendingReviewRow[]
    playersCount: number
    mapsCount: number
    pendingReviewRequests: number
    submittedReviews: string[]
    hold: Promise<void> | null
}

function pendingRow(id: number, mapName: string): PendingReviewRow {
    return { id, mapName, timeAgo: '2 days ago' }
}

function newsRow(id: number, title: string, publishedAt: string) {
    return {
        id,
        category: 'update',
        title,
        excerpt: `${title} excerpt`,
        body: `${title} body`,
        pinned: false,
        published_at: publishedAt,
    }
}

async function openSignedInHome(
    page: Page,
    pendingReviews = [pendingRow(1, 'CTF-BT-Alpha'), pendingRow(2, 'CTF-BT-Beta')],
): Promise<HomeApi> {
    const api: HomeApi = {
        pendingReviews,
        playersCount: 1200,
        mapsCount: 340,
        pendingReviewRequests: 0,
        submittedReviews: [],
        hold: null,
    }

    await page.addInitScript(key => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem(key, JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    }, AUTH_KEY)
    await mockApi(page)
    await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const path = new URL(request.url()).pathname.replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } }).catch(() => undefined)

        if (path === '/users/me') return ok({ id: '100', alias: 'Tester', utbt_role: 0 })
        if (path === '/launcher/activity/latest') return route.fulfill({ status: 404, json: { success: false } })
        if (path === '/v2/summary/badges') {
            return ok({
                sections: { maps: { count: 0 }, world_records: { count: 0 }, events: { count: 0 }, news: { count: 1 } },
                seen: { maps: null, world_records: null, events: null, news: NEWS_SEEN },
                as_of: '2026-10-29T12:00:00Z',
            })
        }
        if (path === '/v2/news') {
            return ok({
                items: [
                    newsRow(2, 'Fresh article', '2026-10-20T12:00:00.000Z'),
                    newsRow(1, 'Old article', '2026-09-01T12:00:00.000Z'),
                ],
            })
        }
        if (path === '/v2/news/categories') return ok({ items: [] })
        if (path === '/v2/summary/map_reviews' && request.method() === 'POST') {
            api.submittedReviews.push((request.postDataJSON() as { map_name: string }).map_name)
            return ok({})
        }
        if (path === '/v2/summary/pending_reviews') {
            api.pendingReviewRequests += 1
            if (api.hold) await api.hold
            const query = new URL(request.url()).searchParams
            const offset = Number(query.get('offset') ?? 0)
            const limit = Number(query.get('limit') ?? api.pendingReviews.length)
            return ok({ total: api.pendingReviews.length, items: api.pendingReviews.slice(offset, offset + limit) })
        }
        if (path === '/v2/players/count') {
            if (api.hold) await api.hold
            return ok({ count: api.playersCount })
        }
        if (path === '/maps/count') {
            if (api.hold) await api.hold
            return ok({ count: api.mapsCount })
        }
        return route.fallback()
    })

    await page.goto('/')
    return api
}

function reviewsSection(page: Page) {
    return page.locator('section', { has: page.getByRole('heading', { name: 'Maps to Review' }) })
}

test.describe('Home freshness', () => {
    test('marks news newer than the seen marker as New', async ({ page }) => {
        await openSignedInHome(page)

        const fresh = page.getByRole('button', { name: /Fresh article/ })
        const old = page.getByRole('button', { name: /Old article/ })
        await expect(fresh).toBeVisible()
        await expect(fresh.getByText('New', { exact: true })).toBeVisible()
        await expect(old).toBeVisible()
        await expect(old.getByText('New', { exact: true })).toHaveCount(0)
    })

    test('drops a reviewed map from Maps to Review without a refresh', async ({ page }) => {
        const api = await openSignedInHome(page)
        const reviews = reviewsSection(page)
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toBeVisible()
        await expect(reviews.getByRole('button', { name: 'Review Beta' })).toBeVisible()

        await reviews.getByRole('button', { name: 'Review Alpha' }).click()
        api.pendingReviews = [pendingRow(2, 'CTF-BT-Beta')]
        await page.getByRole('button', { name: 'Submit Review' }).click()

        await expect(page.getByText('Review Published')).toBeVisible()
        expect(api.submittedReviews).toEqual(['CTF-BT-Alpha'])
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toHaveCount(0)
        await expect(reviews.getByRole('button', { name: 'Review Beta' })).toBeVisible()
    })

    test('steps back to the last page when a review empties the current one', async ({ page }) => {
        const rows = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((name, i) => pendingRow(i + 1, `CTF-BT-${name}`))
        const api = await openSignedInHome(page, rows)
        const reviews = reviewsSection(page)
        await expect(reviews.getByText('Page 1 of 2')).toBeVisible()
        await reviews.locator('button:has(.lucide-chevron-right)').click()
        await expect(reviews.getByText('Page 2 of 2')).toBeVisible()

        await reviews.getByRole('button', { name: 'Review Zeta' }).click()
        api.pendingReviews = rows.slice(0, 5)
        await page.getByRole('button', { name: 'Submit Review' }).click()

        await expect(page.getByText('Review Published')).toBeVisible()
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toBeVisible()
        await expect(reviews.getByRole('button', { name: 'Review Zeta' })).toHaveCount(0)
        await expect(reviews.getByText(/All caught up/)).toHaveCount(0)
    })

    test('shows cached reviews and counts on a revisit, then refreshes them silently', async ({ page }) => {
        const others = ['Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((name, i) => pendingRow(i + 2, `CTF-BT-${name}`))
        const api = await openSignedInHome(page, [pendingRow(1, 'CTF-BT-Alpha'), ...others])
        const reviews = reviewsSection(page)
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toBeVisible()
        await expect(reviews.getByText('Page 1 of 2')).toBeVisible()
        await expect(page.getByRole('link', { name: '1,200', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: '340', exact: true })).toBeVisible()

        let release = () => {}
        api.hold = new Promise<void>(resolve => { release = resolve })
        api.pendingReviews = others
        api.playersCount = 1201
        api.mapsCount = 341
        const requestsBeforeRevisit = api.pendingReviewRequests

        await page.getByRole('link', { name: '340', exact: true }).click()
        await expect(page).toHaveURL(/\/maps/)
        await page.goBack()
        await expect(page).not.toHaveURL(/\/maps/)

        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toBeVisible()
        await expect(page.getByRole('link', { name: '1,200', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: '340', exact: true })).toBeVisible()
        await expect.poll(() => api.pendingReviewRequests).toBeGreaterThan(requestsBeforeRevisit)
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toBeVisible()
        await expect(reviews.getByText('Page 1 of 2')).toBeVisible()
        await expect(reviews.locator('.animate-pulse')).toHaveCount(0)

        release()
        await expect(reviews.getByRole('button', { name: 'Review Alpha' })).toHaveCount(0)
        await expect(reviews.getByRole('button', { name: 'Review Zeta' })).toBeVisible()
        await expect(page.getByRole('link', { name: '1,201', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: '341', exact: true })).toBeVisible()
    })
})
