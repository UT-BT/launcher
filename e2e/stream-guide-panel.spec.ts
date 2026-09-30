import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'stream-cup'
const STREAMER_ID = '555555555555'

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

async function openGuide(page: Page) {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.stack))
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'guide-token',
            refreshToken: 'guide-refresh',
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
    await page.getByRole('navigation', { name: 'Stream panels' }).getByRole('button', { name: 'Guide' }).click()
    await expect(page.getByRole('region', { name: 'Guide' })).toBeVisible()
}

test('every guide step is present, numbered and collapsible', async ({ page }) => {
    await openGuide(page)
    const panel = page.getByRole('region', { name: 'Guide' })

    const titles = ['Requirements', 'Get the kit', 'Import the scene collection and the profile', 'Pick an encoder', 'Add your stream key in OBS',
        'Add the Stream tab as an OBS dock', 'Launch the cams', 'Repair or add a single source by hand', 'Running a match',
        'Audio levels', 'When the out-of-date banner shows', 'Troubleshooting']
    for (const title of titles) await expect(panel.getByRole('button', { name: new RegExp(title) })).toBeVisible()

    const requirements = panel.getByRole('button', { name: /Requirements/ })
    await expect(requirements).toHaveAttribute('aria-expanded', 'true')
    await expect(panel.getByText(/Windows 10 version 2004/)).toBeVisible()
    await requirements.click()
    await expect(requirements).toHaveAttribute('aria-expanded', 'false')
    await expect(panel.getByText(/Windows 10 version 2004/)).toHaveCount(0)

    await panel.getByRole('button', { name: 'Expand all' }).click()
    await expect(panel.getByText(/Ignore streaming service setting recommendations/)).toBeVisible()
    await expect(panel.getByText(/The stinger shows black instead of transparent/)).toBeVisible()
    await panel.getByRole('button', { name: 'Collapse all' }).click()
    await expect(panel.locator('[aria-expanded="true"]')).toHaveCount(0)
})

test('the website marks the cam steps desktop only and links to the launcher', async ({ page }) => {
    await openGuide(page)
    const panel = page.getByRole('region', { name: 'Guide' })

    await expect(panel.getByText('Desktop only')).toHaveCount(1)
    await expect(panel.getByRole('link', { name: 'Get the desktop launcher' })).toHaveAttribute('href', 'https://github.com/UT-BT/launcher/releases/latest')

    await panel.getByRole('button', { name: /Launch the cams/ }).click()
    await expect(panel.getByText(/This step is done in the desktop launcher/)).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Get the desktop launcher' })).toHaveCount(2)
})

test('a step can be linked to from its link button', async ({ page }) => {
    await openGuide(page)
    const panel = page.getByRole('region', { name: 'Guide' })

    await panel.getByRole('button', { name: 'Link to step 6' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#guide-dock')
    await expect(panel.getByRole('button', { name: /Add the Stream tab as an OBS dock/ })).toHaveAttribute('aria-expanded', 'true')
})

test('the Guide panel fits 390 px and 1920 px with every step open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await openGuide(page)
    await page.getByRole('button', { name: 'Expand all' }).click()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.getByRole('region', { name: 'Guide' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
