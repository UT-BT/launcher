import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel, streamPanelNav } from './streamPanels'

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

const PANEL_LABELS = ['Match', 'Cams', 'Score', 'Studio', 'Setup', 'Guide']

const KIT_VERSIONS: Record<string, number | null> = { [VIEWER.id]: 2, [STREAMERS[0].id]: 2, [STREAMERS[1].id]: null }

interface KitOptions {
    kits?: Record<string, number | null>
    kitDelayMs?: number
}

let streamerReads = 0

async function mockApi(page: Page, status: Status | null, options: KitOptions = {}) {
    streamerReads = 0
    const kits = { ...KIT_VERSIONS, ...options.kits }
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

        const kitStreamer = Object.keys(kits).find(id => path === `/tournaments/${SLUG}/stream/${id}/kit/info`)
        if (kitStreamer) {
            if (options.kitDelayMs) await new Promise(resolve => setTimeout(resolve, options.kitDelayMs))
            await route.fulfill({
                json: { success: true, data: { current_version: 2, downloaded_version: kits[kitStreamer], default_folder: 'C:\\UTBT-StreamKit' } },
            })
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
    return ['Current match', 'Lineup', 'Streaming on', 'Countdown'].map(name => page.getByRole('region', { name }))
}

function setupSections(page: Page) {
    return ['Own Twitch channel', 'Kit', 'Scenes'].map(name => page.getByRole('region', { name, exact: true }))
}

async function expectPanel(page: Page, name: string) {
    await expect(streamPanelNav(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
}

test('a streaming volunteer lands on the Stream tab from its link and streams as themself', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(streamTabButton(page)).toBeVisible()
    await expect(page.getByText('Streaming as')).toBeVisible()
    await expect(page.getByRole('main').getByText('Rin')).toBeVisible()
    await expect(page.getByRole('button', { name: /Operating as|Choose a streamer/ })).toHaveCount(0)

    await expect(streamPanelNav(page).getByRole('button')).toHaveText(PANEL_LABELS)
    await expectPanel(page, 'Match')
    for (const section of matchSections(page)) await expect(section).toBeVisible()

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    expect(streamerReads).toBe(0)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the panels read Match, Cams, Score, Studio, then Setup and Guide after a divider at ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page, STREAMER)
        await page.goto(`/events/${SLUG}?tab=stream`)

        const nav = streamPanelNav(page)
        await expect(nav.getByRole('button')).toHaveText(PANEL_LABELS)
        const divider = nav.getByRole('separator')
        await expect(divider).toHaveCount(1)
        await expect(divider).toBeVisible()

        const boxes = await Promise.all(PANEL_LABELS.map(name => nav.getByRole('button', { name, exact: true }).boundingBox()))
        const dividerBox = await divider.boundingBox()
        for (const [index, box] of boxes.entries()) {
            expect(box).not.toBeNull()
            if (index > 0) expect(box!.x).toBeGreaterThan(boxes[index - 1]!.x)
        }
        expect(dividerBox!.x).toBeGreaterThanOrEqual(boxes[3]!.x + boxes[3]!.width)
        expect(dividerBox!.x + dividerBox!.width).toBeLessThanOrEqual(boxes[4]!.x)
        expect(boxes[5]!.x + boxes[5]!.width).toBeLessThanOrEqual(viewport.width)
        expect(await nav.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
}

test('every Stream panel opens without horizontal overflow and holds its sections', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    const sections: Record<string, string[]> = {
        Match: ['Current match', 'Lineup', 'Streaming on', 'Countdown'],
        Cams: ['Cams'],
        Score: ['Score'],
        Studio: ['Casters', 'BRB message', 'Webcam frame'],
        Setup: ['Own Twitch channel', 'Kit', 'Scenes'],
        Guide: ['Guide'],
    }
    for (const name of PANEL_LABELS) {
        await openStreamPanel(page, name)
        for (const region of sections[name]) await expect(page.getByRole('region', { name: region, exact: true })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    }
})

test('a streamer who has never downloaded a kit lands on Setup', async ({ page }) => {
    await mockApi(page, STREAMER, { kits: { [VIEWER.id]: null } })
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expectPanel(page, 'Setup')
    for (const section of setupSections(page)) await expect(section).toBeVisible()
    await expect(page.getByRole('region', { name: 'Current match' })).toHaveCount(0)
})

test('while the kit state loads no panel opens, so the tab never jumps', async ({ page }) => {
    await mockApi(page, STREAMER, { kits: { [VIEWER.id]: null }, kitDelayMs: 1_500 })
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(streamPanelNav(page).getByRole('button')).toHaveText(PANEL_LABELS)
    await expect(page.getByText('Loading your stream desk…')).toBeVisible()
    await expect(streamPanelNav(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Current match' })).toHaveCount(0)

    await expectPanel(page, 'Setup')
    await expect(page.getByRole('region', { name: 'Kit', exact: true })).toBeVisible()
})

test('the chosen panel and a linked guide step are kept when the streamer comes back to the Stream tab', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)
    await expectPanel(page, 'Match')

    await openStreamPanel(page, 'Guide')
    const guide = page.getByRole('region', { name: 'Guide' })
    await guide.getByRole('button', { name: 'Link to step 6' }).click()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#guide-dock')

    await page.getByRole('button', { name: 'Info', exact: true }).click()
    await expect(streamPanelNav(page)).toHaveCount(0)
    await streamTabButton(page).click()

    await expectPanel(page, 'Guide')
    await expect(guide.getByRole('button', { name: /Add the Stream tab as an OBS dock/ })).toHaveAttribute('aria-expanded', 'true')
})

test('the website Cams panel sends a streamer to the desktop launcher', async ({ page }) => {
    await mockApi(page, STREAMER)
    await page.goto(`/events/${SLUG}?tab=stream`)

    await openStreamPanel(page, 'Cams')

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
    await expectPanel(page, 'Setup')
    for (const section of setupSections(page)) await expect(section).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: 'Operating as Bob Broadcasts' }).click()
    await page.getByRole('menuitemradio').filter({ hasText: 'Alice Streams' }).click()
    await expect(page.getByRole('button', { name: 'Operating as Alice Streams' })).toBeVisible()
    await expectPanel(page, 'Match')
    for (const section of matchSections(page)) await expect(section).toBeVisible()
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

    await openStreamPanel(page, 'Cams')
    await expect(page.getByRole('link', { name: 'Get the desktop launcher' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
