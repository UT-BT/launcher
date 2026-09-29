import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'stream-cup'
const STREAMER_ID = '555555555555'

const SCENES = [
    ['starting-soon', 'Starting Soon'],
    ['preview', 'Match Preview'],
    ['pick-ban', 'Pick & Ban'],
    ['betting', 'Betting'],
    ['overlay', 'Match Overlay'],
    ['intermission', 'Intermission'],
    ['post-match', 'Post-match'],
    ['standings', 'Standings'],
    ['brb', 'BRB'],
    ['ending', 'Ending'],
    ['caster', 'Caster Cam'],
] as const

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Stream Cup 2026',
    summary: 'A cup for checking the Scenes panel.',
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

async function openScenes(page: Page) {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.stack))
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'scenes-token',
            refreshToken: 'scenes-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') return route.fulfill({ json: [] })
        const path = url.pathname.replace(/\/$/, '')
        if (path === '/users/me') return route.fulfill({ json: { success: true, data: { id: STREAMER_ID, alias: 'Rin' } } })
        if (path === '/user_state') return route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
        if (path === '/launcher/activity/latest') return route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
        if (path === `/tournaments/${SLUG}`) return route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
        if (path === `/tournaments/${SLUG}/me`) {
            return route.fulfill({ json: { success: true, data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, is_streamer: true } } })
        }
        if (path === `/tournaments/${SLUG}/bracket`) {
            return route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
        }
        if (path === `/tournaments/${SLUG}/pick-ban/config`) return route.fulfill({ json: { success: true, data: { stages: [] } } })
        if (path === '/v2/summary') {
            return route.fulfill({
                json: { success: true, data: { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null } },
            })
        }
        if (path.endsWith('/teams') || path.endsWith('/lfp') || path.endsWith('/matches')) {
            return route.fulfill({ json: { success: true, data: { items: [] } } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })

    await page.goto(`/events/${SLUG}?tab=stream`)
    await page.getByRole('navigation', { name: 'Stream panels' }).getByRole('button', { name: 'Scenes' }).click()
    await expect(page.getByRole('region', { name: 'Scenes' })).toBeVisible()
}

test('every scene shows its URL with the streamer id and a copy button', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openScenes(page)

    const panel = page.getByRole('region', { name: 'Scenes' })
    await expect(panel.getByText(/Visual changes reach OBS automatically/)).toBeVisible()

    for (const [id, label] of SCENES) {
        const input = panel.getByRole('textbox', { name: `${label} URL` })
        await expect(input).toHaveValue(new RegExp(`/stream/${SLUG}/${STREAMER_ID}/${id}$`))
        await expect(panel.getByRole('button', { name: `Copy ${label} URL` })).toBeVisible()
    }
    await expect(panel.getByRole('textbox')).toHaveCount(11)

    const brb = panel.getByRole('button', { name: 'Copy BRB URL' })
    await brb.click()
    await expect(brb).toHaveText('Copied')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(new RegExp(`/stream/${SLUG}/${STREAMER_ID}/brb$`))
    await expect(brb).toHaveText('Copy')
})

test('previews are preview=1 scene pages that load only while on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openScenes(page)

    const frames = page.locator('iframe')
    await expect(frames.first()).toBeVisible()
    const loaded = await frames.count()
    expect(loaded).toBeGreaterThan(0)
    expect(loaded).toBeLessThan(11)
    await expect(frames.first()).toHaveAttribute('src', `/stream/${SLUG}/${STREAMER_ID}/starting-soon?preview=1`)

    await page.getByTestId('scene-preview-caster').scrollIntoViewIfNeeded()
    await expect(page.locator('iframe[src*="/caster?preview=1"]')).toHaveCount(1)
    await expect(page.locator('iframe[src*="/starting-soon?preview=1"]')).toHaveCount(0)

    for (const src of await frames.evaluateAll(nodes => nodes.map(node => node.getAttribute('src')))) {
        expect(src).toContain('preview=1')
    }
})

test('the overlay preview sits over a checkerboard and the others do not', async ({ page }) => {
    await openScenes(page)
    const backgroundOf = (id: string) => page.getByTestId(`scene-preview-${id}`).evaluate(node => getComputedStyle(node).backgroundImage)

    expect(await backgroundOf('overlay')).toContain('conic-gradient')
    expect(await backgroundOf('brb')).toBe('none')
})

test('the Scenes panel fits 390 px and 1920 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await openScenes(page)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    const box = await page.getByTestId('scene-preview-starting-soon').boundingBox()
    expect(box!.width).toBeLessThanOrEqual(390)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.getByRole('region', { name: 'Scenes' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
