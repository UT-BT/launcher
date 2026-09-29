import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'desk-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const BOB = { id: '222222222222', display_name: 'Bob Broadcasts', twitch_url: null }

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Desk Cup 2026',
    summary: 'A cup for checking the current match controls.',
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

function assigned(id: string, a: string, b: string, scheduledAt: string, overrides: object = {}) {
    return {
        id,
        stage: { key: 'groups', name: 'Groups' },
        group: { id: 'g1', name: 'Group A' },
        round: { no: 1, label: null },
        best_of: 3,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        stream_url: null,
        public: true,
        finished: false,
        teams: { a: { id: `${id}-a`, name: a }, b: { id: `${id}-b`, name: b } },
        ...overrides,
    }
}

const FIRST = assigned('m1', 'Crimson Tide', 'Azure Wave', '2030-10-12T19:00:00+00:00', { status: 'complete', finished: true })
const SECOND = assigned('m2', 'Night Owls', 'Early Birds', '2030-10-12T20:00:00+00:00')
const THIRD = assigned('m3', 'Long Jumpers', 'Wall Runners', '2030-10-12T21:30:00+00:00', { public: false })

interface DeskState {
    currentId: string | null
    reason: string
    onScreenId: string | null
    nextId: string | null
}

interface Server {
    state: DeskState
    afterNext: DeskState
    readGate: Promise<void> | null
    reads: string[]
    writes: { method: string; path: string; body: unknown }[]
}

function deskPayload(streamerId: string, state: DeskState) {
    const matches = [FIRST, SECOND, THIRD]
    const onScreen = matches.find(match => match.id === state.onScreenId)
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: streamerId, display_name: 'Streamer', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: state.currentId },
        reason: state.reason,
        match: onScreen ? { id: onScreen.id, reason: state.reason } : null,
        assigned_matches: matches,
        next_match: matches.find(match => match.id === state.nextId) ?? null,
    }
}

async function mockApi(page: Page, status: { is_streamer?: boolean; can_manage_bracket?: boolean }): Promise<Server> {
    const server: Server = {
        state: { currentId: 'm1', reason: 'holding-finished', onScreenId: 'm1', nextId: 'm2' },
        afterNext: { currentId: 'm2', reason: 'current', onScreenId: 'm2', nextId: null },
        readGate: null,
        reads: [],
        writes: [],
    }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'desk-token',
            refreshToken: 'desk-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const path = url.pathname.replace(/\/$/, '')
        const desk = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/desk(/current|/next)?$`))

        if (desk && request.method() === 'GET' && !desk[2]) {
            server.reads.push(desk[1])
            await server.readGate
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server.state) } })
            return
        }

        if (desk && desk[2] === '/current' && request.method() === 'PUT') {
            const body = request.postDataJSON() as { match_id: string | null }
            server.writes.push({ method: 'PUT', path, body })
            server.state = body.match_id
                ? { currentId: body.match_id, reason: 'current', onScreenId: body.match_id, nextId: 'm2' }
                : { currentId: null, reason: 'next', onScreenId: 'm2', nextId: null }
            await route.fulfill({ json: { success: true, data: { desk: { current_match_id: body.match_id } } } })
            return
        }

        if (desk && desk[2] === '/next' && request.method() === 'POST') {
            server.writes.push({ method: 'POST', path, body: null })
            server.state = server.afterNext
            await route.fulfill({ json: { success: true, data: { desk: { current_match_id: server.afterNext.currentId } } } })
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
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, ...status },
                },
            })
            return
        }
        if (path === `/tournaments/${SLUG}/admin/streamers`) {
            await route.fulfill({ json: { success: true, data: { items: [BOB] } } })
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
                    data: { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null },
                },
            })
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })

    return server
}

function section(page: Page) {
    return page.getByRole('region', { name: 'Current match' })
}

function assignedRow(page: Page, title: string) {
    return section(page).getByRole('list', { name: 'Assigned matches' }).getByRole('listitem').filter({ hasText: title })
}

test('a streamer sees their assigned matches, what is on screen and why', async ({ page }) => {
    await mockApi(page, { is_streamer: true })
    await page.goto(`/events/${SLUG}?tab=stream`)

    const current = section(page)
    await expect(current.getByText('On your scenes now')).toBeVisible()
    await expect(current.getByTestId('current-match-reason')).toHaveText('Finished. Your scenes hold it until you move on.')
    await expect(current.getByRole('listitem')).toHaveCount(3)

    const first = assignedRow(page, 'Crimson Tide vs Azure Wave')
    await expect(first.getByText('Final')).toBeVisible()
    await expect(first.getByText('On screen')).toBeVisible()
    await expect(first.getByText(/19:00 UTC · in /)).toBeVisible()
    await expect(first.getByRole('button', { name: 'Crimson Tide vs Azure Wave is the current match' })).toBeDisabled()

    const third = assignedRow(page, 'Long Jumpers vs Wall Runners')
    await expect(third.getByText('Not public yet')).toBeVisible()
    await expect(third.getByText('Scheduled')).toBeVisible()

    await expect(current.getByText(/Night Owls vs Early Birds · .*20:00 UTC · in /)).toBeVisible()
})

test('Set current and Next match write, then show the change straight away', async ({ page }) => {
    const server = await mockApi(page, { is_streamer: true })
    await page.goto(`/events/${SLUG}?tab=stream`)
    const current = section(page)
    await expect(current.getByTestId('current-match-reason')).toHaveText(/until you move on/)

    await assignedRow(page, 'Long Jumpers vs Wall Runners').getByRole('button', { name: 'Set Long Jumpers vs Wall Runners as the current match' }).click()
    await expect(current.getByTestId('current-match-reason')).toHaveText('Chosen here as the current match.', { timeout: 1_000 })
    await expect(assignedRow(page, 'Long Jumpers vs Wall Runners').getByText('On screen')).toBeVisible()
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `/tournaments/${SLUG}/stream/${VIEWER.id}/desk/current`, body: { match_id: 'm3' } })

    await current.getByRole('button', { name: 'Next match' }).click()
    await expect(assignedRow(page, 'Night Owls vs Early Birds').getByText('On screen')).toBeVisible({ timeout: 1_000 })
    await expect(current.getByRole('button', { name: 'Next match' })).toBeDisabled()
    await expect(current.getByText('No later match to move to.')).toBeVisible()
    expect(server.writes[1]).toEqual({ method: 'POST', path: `/tournaments/${SLUG}/stream/${VIEWER.id}/desk/next`, body: null })

    await current.getByRole('button', { name: 'Choose automatically' }).click()
    await expect(current.getByTestId('current-match-reason')).toHaveText('Your next assigned match by scheduled time.', { timeout: 1_000 })
    expect(server.writes[2]).toMatchObject({ method: 'PUT', body: { match_id: null } })
})

test('Next match stays disabled until the read after the write lands, so a quick second click cannot skip a match', async ({ page }) => {
    const server = await mockApi(page, { is_streamer: true })
    server.afterNext = { currentId: 'm2', reason: 'current', onScreenId: 'm2', nextId: 'm3' }
    await page.goto(`/events/${SLUG}?tab=stream`)
    const current = section(page)
    const next = current.getByRole('button', { name: 'Next match' })
    await expect(current.getByTestId('current-match-reason')).toHaveText(/until you move on/)

    let releaseReads: () => void = () => undefined
    server.readGate = new Promise<void>(resolve => { releaseReads = resolve })
    const readsBefore = server.reads.length

    await next.click()
    await expect.poll(() => server.writes.length).toBe(1)
    await expect.poll(() => server.reads.length).toBeGreaterThan(readsBefore)
    await expect(next).toBeDisabled()

    server.readGate = null
    releaseReads()
    await expect(assignedRow(page, 'Night Owls vs Early Birds').getByText('On screen')).toBeVisible({ timeout: 1_000 })
    await expect(next).toBeEnabled()
    expect(server.writes).toHaveLength(1)
})

test('a change made from another browser shows within about 2 s', async ({ page }) => {
    const server = await mockApi(page, { is_streamer: true })
    await page.goto(`/events/${SLUG}?tab=stream`)
    const current = section(page)
    await expect(current.getByTestId('current-match-reason')).toHaveText(/until you move on/)

    server.state = { currentId: null, reason: 'live', onScreenId: 'm2', nextId: null }

    await expect(current.getByTestId('current-match-reason')).toHaveText('Live now, so your scenes follow it.', { timeout: 2_600 })
    await expect(assignedRow(page, 'Night Owls vs Early Birds').getByText('On screen')).toBeVisible()
})

test('a manager operating as a streamer reads and writes that streamer\'s desk', async ({ page }) => {
    const server = await mockApi(page, { can_manage_bracket: true })
    await page.goto(`/events/${SLUG}?tab=stream`)

    await page.getByRole('button', { name: 'Choose a streamer' }).click()
    await page.getByRole('menuitemradio').filter({ hasText: 'Bob Broadcasts' }).click()

    await expect(section(page).getByRole('listitem')).toHaveCount(3)
    expect(new Set(server.reads)).toEqual(new Set([BOB.id]))

    await section(page).getByRole('button', { name: 'Next match' }).click()
    await expect.poll(() => server.writes.length).toBe(1)
    expect(server.writes[0].path).toBe(`/tournaments/${SLUG}/stream/${BOB.id}/desk/next`)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the current match controls fit ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page, { is_streamer: true })
        await page.goto(`/events/${SLUG}?tab=stream`)

        await expect(section(page).getByRole('listitem')).toHaveCount(3)
        await expect(section(page).getByRole('button', { name: 'Next match' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        const box = await section(page).getByRole('button', { name: 'Set Night Owls vs Early Birds as the current match' }).boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(32)
    })
}
