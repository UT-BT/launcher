import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'roster-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const ROSTER_EMPTY = 'No streamers on the roster yet. Staff add them in Admin → Streamers.'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Roster Cup 2026',
    summary: 'A cup for checking who can stream.',
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

const QUEUED_MATCH = {
    match_id: 'm1',
    stage_key: 'groups',
    stage_name: 'Groups',
    round_no: 1,
    round_label: null,
    scheduled_at: null,
    teams: { team_a: { id: 'ta', name: 'Crimson Tide' }, team_b: { id: 'tb', name: 'Azure Wave' } },
    session_status: 'none',
    ready_count: 0,
    online_count: 0,
    startable: false,
    blocking_reason: null,
    streamer: null,
}

interface Status {
    is_streamer: boolean
    can_manage_bracket: boolean
    can_manage?: boolean
}

function emptyDesk(streamerId: string) {
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: streamerId, display_name: VIEWER.alias, channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: 'none',
        match: null,
        assigned_matches: [],
        next_match: null,
    }
}

async function mockApi(page: Page, status: Status) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'roster-token',
            refreshToken: 'roster-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const desk = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/desk$`))
        const kitInfo = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/kit/info$`))

        if (desk) {
            await route.fulfill({ json: { success: true, data: emptyDesk(desk[1]) } })
            return
        }
        if (kitInfo) {
            await route.fulfill({ json: { success: true, data: { current_version: 2, downloaded_version: 2, default_folder: 'C:\\UTBT-StreamKit' } } })
            return
        }
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
            await route.fulfill({
                json: {
                    success: true,
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, can_manage: false, ...status },
                },
            })
            return
        }
        if (path === `/tournaments/${SLUG}/admin/streamers`) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }
        if (path === `/tournaments/${SLUG}/admin/pick-ban/queue`) {
            await route.fulfill({ json: { success: true, data: { matches: [QUEUED_MATCH] } } })
            return
        }
        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: { published: false, format: { template: null, spec: null }, stages: [] } } })
            return
        }
        if (path === `/tournaments/${SLUG}/pick-ban/config` || path === `/tournaments/${SLUG}/admin/pick-ban/config`) {
            await route.fulfill({ json: { success: true, data: { stages: [] } } })
            return
        }
        if (path.startsWith(`/tournaments/${SLUG}/`)) {
            await route.fulfill({ json: { success: true, data: { items: [] } } })
            return
        }
        if (path === '/v2/summary') {
            await route.fulfill({
                json: {
                    success: true,
                    data: { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null },
                },
            })
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })
}

test('a manager with an empty roster is sent to Admin → Streamers from the Stream tab', async ({ page }) => {
    await mockApi(page, { is_streamer: false, can_manage_bracket: true })
    await page.goto(`/events/${SLUG}?tab=stream`)

    await expect(page.getByText('Operating as')).toBeVisible()
    await expect(page.getByText(ROSTER_EMPTY)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Stream panels' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Choose a streamer' }).click()
    await expect(page.getByRole('menu').getByText(ROSTER_EMPTY)).toBeVisible()
    await expect(page.getByRole('menuitemradio')).toHaveCount(0)
    await expect(page.getByText(/volunteer/i)).toHaveCount(0)
})

test('the match-queue streamer picker points at the roster when it is empty', async ({ page }) => {
    await mockApi(page, { is_streamer: false, can_manage_bracket: true })
    await page.goto(`/events/${SLUG}?tab=manage`)

    await page.getByRole('button', { name: 'Picks & Bans', exact: true }).click()
    await page.getByRole('button', { name: 'Streamer: none' }).first().click()

    const menu = page.getByRole('menu')
    await expect(menu.getByText(ROSTER_EMPTY)).toBeVisible()
    await expect(menu.getByRole('menuitemradio')).toHaveText(['No streamer'])
    await expect(menu.getByText(/volunteer/i)).toHaveCount(0)
})

test('a roster streamer with no assignments here sees they are set up but not scheduled yet', async ({ page }) => {
    await mockApi(page, { is_streamer: true, can_manage_bracket: false })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    const current = page.getByRole('region', { name: 'Current match' })
    const empty = current.getByRole('status')
    await expect(empty.getByText("You're set up, just not scheduled yet")).toBeVisible()
    await expect(empty.getByText(/No matches in this event are assigned to you yet\./)).toBeVisible()
    await expect(empty.getByText('Meanwhile, download the OBS kit on the Setup tab and read the Guide.')).toBeVisible()
    await expect(current.getByRole('button', { name: 'Next match' })).toHaveCount(0)
    await expect(current.getByRole('list', { name: 'Assigned matches' })).toHaveCount(0)
    await expect(current.getByText('On your scenes now')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})

for (const width of [390, 1920]) {
    test(`the not-scheduled state fits at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await mockApi(page, { is_streamer: true, can_manage_bracket: false })
        await page.goto(`/events/${SLUG}?tab=stream`)
        await openStreamPanel(page, 'Match')

        await expect(page.getByRole('region', { name: 'Current match' }).getByRole('status')).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })
}
