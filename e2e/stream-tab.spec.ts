import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'stream-cup'

const VIEWER = { id: '555555555555', alias: 'Rin' }

const STREAMERS = [
    { id: '111111111111', display_name: 'Alice Streams', twitch_url: 'https://twitch.tv/alice' },
    { id: '222222222222', display_name: 'Bob Broadcasts', twitch_url: null },
]

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Stream Cup 2026',
    summary: 'A cup for checking the Stream tab.',
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

interface Status {
    is_streamer?: boolean
    can_manage_bracket?: boolean
    can_manage?: boolean
}

const STREAMER: Status = { is_streamer: true }
const MANAGER: Status = { can_manage_bracket: true }
const STREAMING_MANAGER: Status = { can_manage_bracket: true, is_streamer: true }
const CUP_ADMIN: Status = { can_manage: true }
const PLAYER: Status = {}

let streamerReads = 0

async function mockApi(page: Page, status: Status | null) {
    streamerReads = 0
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.stack))

    await page.addInitScript(({ signedIn }) => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        if (!signedIn) return
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'stream-tab-token',
            refreshToken: 'stream-tab-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    }, { signedIn: status !== null })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const path = url.pathname.replace(/\/$/, '')

        if (path === '/users/me') {
            await route.fulfill({ json: { success: true, data: VIEWER } })
            return
        }

        if (path === '/user_state') {
            await route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
            return
        }

        if (path === '/launcher/activity/latest') {
            await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
            return
        }

        if (path === `/tournaments/${SLUG}`) {
            await route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
            return
        }

        if (path === `/tournaments/${SLUG}/me`) {
            if (!status) {
                await route.fulfill({ status: 401, json: { success: false, error: 'Unauthorized' } })
                return
            }
            await route.fulfill({
                json: {
                    success: true,
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, ...status },
                },
            })
            return
        }

        if (path === `/tournaments/${SLUG}/admin/streamers`) {
            streamerReads += 1
            await route.fulfill({ json: { success: true, data: { items: STREAMERS } } })
            return
        }

        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
            return
        }

        if (path === `/tournaments/${SLUG}/pick-ban/config`) {
            await route.fulfill({ json: { success: true, data: { stages: [] } } })
            return
        }

        if (path === `/tournaments/${SLUG}/teams` || path === `/tournaments/${SLUG}/lfp` || path === `/tournaments/${SLUG}/me/matches`) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }

        if (path === '/v2/summary') {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        global: { newMaps: 0, newRecords: 0 },
                        achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null,
                    },
                },
            })
            return
        }

        await route.fulfill({ json: { success: true, data: [] } })
    })
}

function streamTabButton(page: Page) {
    return page.getByRole('button', { name: 'Stream', exact: true })
}

function matchSections(page: Page) {
    return ['Current match', 'Lineup', 'Score', 'Countdown'].map(name => page.getByRole('region', { name }))
}

test('a streaming volunteer lands on the Stream tab from its link and streams as themself', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(streamTabButton(page)).toBeVisible()
    await expect(page.getByText('Streaming as')).toBeVisible()
    await expect(page.getByRole('main').getByText('Rin')).toBeVisible()
    await expect(page.getByRole('button', { name: /Operating as|Choose a streamer/ })).toHaveCount(0)

    const panels = page.getByRole('navigation', { name: 'Stream panels' })
    await expect(panels.getByRole('button')).toHaveText(['Match', 'Show', 'Channel', 'Scenes', 'Kit', 'Guide', 'Cams'])
    await expect(panels.getByRole('button', { name: 'Match' })).toHaveAttribute('aria-pressed', 'true')
    for (const section of matchSections(page)) await expect(section).toBeVisible()

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    expect(streamerReads).toBe(0)
})

test('every Stream panel opens without horizontal overflow', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    const panels = page.getByRole('navigation', { name: 'Stream panels' })
    for (const name of ['Show', 'Channel', 'Scenes', 'Kit']) {
        await panels.getByRole('button', { name }).click()
        await expect(panels.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    }
})

test('the website Cams panel sends a streamer to the desktop launcher', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await page.getByRole('navigation', { name: 'Stream panels' }).getByRole('button', { name: 'Cams' }).click()

    const cams = page.getByRole('region', { name: 'Cams' })
    await expect(cams.getByText('The cam tool needs the desktop launcher.')).toBeVisible()
    await expect(cams.getByRole('link', { name: 'Get the desktop launcher' }))
        .toHaveAttribute('href', 'https://github.com/UT-BT/launcher/releases/latest')
    await expect(cams.getByText('Coming soon.')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('a bracket manager picks which streamer to operate as', async ({ page }) => {
    await mockApi(page, MANAGER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(page.getByText('Operating as')).toBeVisible()
    await expect(page.getByText('Choose a streamer to open their controls.')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Stream panels' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Choose a streamer' }).click()
    const options = page.getByRole('menuitemradio')
    await expect(options).toHaveText(['Alice Streams', 'Bob Broadcasts'])
    await options.filter({ hasText: 'Bob Broadcasts' }).click()

    await expect(page.getByRole('button', { name: 'Operating as Bob Broadcasts' })).toBeVisible()
    for (const section of matchSections(page)) await expect(section).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

test('a manager who also streams starts out operating as themself', async ({ page }) => {
    await mockApi(page, STREAMING_MANAGER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(page.getByRole('button', { name: 'Operating as Rin' })).toBeVisible()
    for (const section of matchSections(page)) await expect(section).toBeVisible()

    await page.getByRole('button', { name: 'Operating as Rin' }).click()
    await expect(page.getByRole('menuitemradio')).toHaveText([/^Rin/, 'Alice Streams', 'Bob Broadcasts'])
})

test('a Cup Admin sees the Stream tab', async ({ page }) => {
    await mockApi(page, CUP_ADMIN)
    await page.goto(`/events/${SLUG}`)

    await streamTabButton(page).click()
    await expect(page.getByText('Operating as')).toBeVisible()
})

test('a regular player never sees the Stream tab, even from its link', async ({ page }) => {
    await mockApi(page, PLAYER)
    const statusRead = page.waitForResponse(response => new URL(response.url()).pathname === `/tournaments/${SLUG}/me`)
    await page.goto(`/events/${SLUG}?tab=stream`)
    await statusRead

    await expect(page.getByText('More details coming soon.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teams', exact: true })).toBeVisible()
    await expect(streamTabButton(page)).toHaveCount(0)
    await expect(page.getByText(/Streaming as|Operating as/)).toHaveCount(0)
})

test('a signed-out visitor never sees the Stream tab, even from its link', async ({ page }) => {
    await mockApi(page, null)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(page.getByText('More details coming soon.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teams', exact: true })).toBeVisible()
    await expect(streamTabButton(page)).toHaveCount(0)
})

test('the Stream tab fits a 360 px phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await mockApi(page, STREAMING_MANAGER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    for (const section of matchSections(page)) await expect(section).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    await page.getByRole('navigation', { name: 'Stream panels' }).getByRole('button', { name: 'Cams' }).click()
    await expect(page.getByRole('link', { name: 'Get the desktop launcher' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
