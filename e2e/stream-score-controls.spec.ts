import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'score-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const MATCH_ID = 'm7'
const SCHEDULED = '2030-10-12T20:00:00+00:00'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Score Cup 2030',
    summary: 'A cup for checking the score controls.',
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

interface Broadcast {
    liveAt: string | null
    countdownAt: string | null
    overrides: Record<string, { a: number; b: number }>
}

interface Server {
    broadcast: Broadcast
    liveCaps: { a: number; b: number }[]
    writes: { method: string; path: string; body: unknown }[]
    writeDelayMs: number
}

function team(id: string, name: string, side: 'a' | 'b') {
    return { id, name, match_side: side, stage_seed: 1, pre_cup_seed: null, members: [] }
}

function addMinutes(iso: string, minutes: number): string {
    return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace('.000Z', '+00:00')
}

function scoreOf(server: Server) {
    const maps = server.liveCaps.map((live, ordinal) => {
        const delta = server.broadcast.overrides[String(ordinal)] ?? { a: 0, b: 0 }
        const caps = { a: Math.max(0, live.a + delta.a), b: Math.max(0, live.b + delta.b) }
        const winner = caps.a >= 2 && caps.a > caps.b ? 'a' : caps.b >= 2 && caps.b > caps.a ? 'b' : null
        const changed = caps.a !== live.a || caps.b !== live.b
        return { ordinal, caps, decided: winner !== null, winner, source: changed ? 'override' : 'live' }
    })
    const series = {
        a: maps.filter(entry => entry.winner === 'a').length,
        b: maps.filter(entry => entry.winner === 'b').length,
    }
    const current = maps.find(entry => !entry.decided)
    return { maps, current_map: current ? current.ordinal : null, series, winner: null, live_decided: false }
}

function matchBlock(server: Server) {
    return {
        id: MATCH_ID,
        reason: 'current',
        stage: { key: 'groups', name: 'Groups' },
        group: { id: 'g1', name: 'Group A' },
        round: { no: 1, label: null },
        best_of: 3,
        mode: 'first_to',
        caps_to_win: 2,
        scheduled_at: SCHEDULED,
        countdown_at: server.broadcast.countdownAt ?? SCHEDULED,
        live_at: server.broadcast.liveAt,
        status: 'live',
        stream_url: null,
        pick_ban_status: 'none',
        sides: { a: 'a', b: 'b' },
        teams: { a: team('ta', 'Crimson Tide', 'a'), b: team('tb', 'Azure Wave', 'b') },
        lineup: { a1: null, a2: null, b1: null, b2: null },
        maps: [
            { ordinal: 0, map: 'BT-Alpha', kind: 'normal', picked_by: 'a' },
            { ordinal: 1, map: 'BT-Bravo', kind: 'normal', picked_by: 'b' },
            { ordinal: 2, map: 'BT-Charlie', kind: 'decider', picked_by: null },
        ],
        score: scoreOf(server),
        casters: [],
    }
}

function deskPayload(streamerId: string, server: Server) {
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: streamerId, display_name: 'Streamer', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: MATCH_ID },
        reason: 'current',
        match: matchBlock(server),
        assigned_matches: [{
            id: MATCH_ID,
            stage: { key: 'groups', name: 'Groups' },
            group: { id: 'g1', name: 'Group A' },
            round: { no: 1, label: null },
            best_of: 3,
            scheduled_at: SCHEDULED,
            status: 'live',
            stream_url: null,
            public: true,
            finished: false,
            teams: { a: { id: 'ta', name: 'Crimson Tide' }, b: { id: 'tb', name: 'Azure Wave' } },
        }],
        next_match: null,
    }
}

function broadcastPayload(server: Server) {
    return {
        broadcast: {
            match_id: MATCH_ID,
            live_at: server.broadcast.liveAt,
            countdown_override_at: server.broadcast.countdownAt,
            countdown_at: server.broadcast.countdownAt ?? SCHEDULED,
            score_overrides: server.broadcast.overrides,
        },
    }
}

function applyWrite(server: Server, method: string, suffix: string, body: Record<string, unknown> | null) {
    if (suffix === '/live') {
        server.broadcast.liveAt = method === 'POST' ? '2030-10-12T20:03:00+00:00' : null
    } else if (suffix === '/countdown' && method === 'DELETE') {
        server.broadcast.countdownAt = null
    } else if (suffix === '/countdown') {
        server.broadcast.countdownAt = typeof body?.at === 'string'
            ? addMinutes(body.at, 0)
            : addMinutes(server.broadcast.countdownAt ?? SCHEDULED, Number(body?.add_minutes))
    } else if (suffix === '/score/overrides' && method === 'DELETE') {
        server.broadcast.overrides = {}
    } else if (suffix === '/score/overrides') {
        const key = String(body?.ordinal)
        const side = body?.side as 'a' | 'b'
        const entry = { ...(server.broadcast.overrides[key] ?? { a: 0, b: 0 }) }
        entry[side] += Number(body?.delta)
        server.broadcast.overrides = { ...server.broadcast.overrides, [key]: entry }
    }
}

async function mockApi(page: Page): Promise<Server> {
    const server: Server = {
        broadcast: { liveAt: null, countdownAt: null, overrides: {} },
        liveCaps: [{ a: 1, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }],
        writes: [],
        writeDelayMs: 0,
    }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'score-token',
            refreshToken: 'score-refresh',
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
        const desk = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/desk$`))
        const write = path.match(new RegExp(`^/tournaments/${SLUG}/stream/matches/${MATCH_ID}(/live|/countdown|/score/overrides)$`))

        if (desk && request.method() === 'GET') {
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server) } })
            return
        }

        if (write) {
            const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null
            server.writes.push({ method: request.method(), path, body })
            if (server.writeDelayMs) await new Promise(resolve => setTimeout(resolve, server.writeDelayMs))
            applyWrite(server, request.method(), write[1], body)
            await route.fulfill({ json: { success: true, data: broadcastPayload(server) } })
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
                    data: { team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null, is_streamer: true },
                },
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
                    data: { global: { newMaps: 0, newRecords: 0 }, achievements: [], recentWorldRecords: [], newMaps: [], latestPatch: null },
                },
            })
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })

    return server
}

function scoreSection(page: Page) {
    return page.getByRole('region', { name: 'Score', exact: true })
}

function countdownSection(page: Page) {
    return page.getByRole('region', { name: 'Countdown' })
}

function mapCard(page: Page, label: string) {
    return scoreSection(page).getByRole('list', { name: 'Maps' }).getByRole('listitem', { name: label })
}

function caps(page: Page, team: string, map: number) {
    return scoreSection(page).getByRole('status', { name: `${team} caps on map ${map}` })
}

async function openStreamTab(page: Page, panel: 'Score' | 'Match' = 'Score') {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, panel)
    if (panel === 'Score') await expect(caps(page, 'Crimson Tide', 1)).toHaveText('1')
}

test('the score section lists each map with both teams, their caps and the source', async ({ page }) => {
    await mockApi(page)
    await openStreamTab(page)

    const first = mapCard(page, 'Map 1')
    await expect(first.getByText('BT-Alpha')).toBeVisible()
    await expect(first.getByText('Current')).toBeVisible()
    await expect(first.getByText('Live', { exact: true })).toBeVisible()
    await expect(caps(page, 'Azure Wave', 1)).toHaveText('0')
    await expect(scoreSection(page).getByRole('button', { name: 'Remove a cap from Azure Wave on map 1' })).toBeDisabled()
    await expect(scoreSection(page).getByText('Crimson Tide 0 – 0 Azure Wave')).toBeVisible()
    await expect(scoreSection(page).getByTestId('match-live-status')).toHaveText(/Not marked live/)
})

test('the ± buttons write a correction and show the new value within about 2 s', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    server.writeDelayMs = 300

    await scoreSection(page).getByRole('button', { name: 'Add a cap to Azure Wave on map 1' }).click()
    await expect(caps(page, 'Azure Wave', 1)).toHaveText('1', { timeout: 2_000 })
    await expect(mapCard(page, 'Map 1').getByText('Override')).toBeVisible()
    expect(server.writes[0]).toEqual({
        method: 'POST',
        path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/score/overrides`,
        body: { ordinal: 0, side: 'b', delta: 1 },
    })

    await scoreSection(page).getByRole('button', { name: 'Remove a cap from Crimson Tide on map 1' }).click()
    await expect(caps(page, 'Crimson Tide', 1)).toHaveText('0', { timeout: 2_000 })
    expect(server.writes[1].body).toEqual({ ordinal: 0, side: 'a', delta: -1 })

    await scoreSection(page).getByRole('button', { name: 'Clear overrides' }).click()
    await expect(caps(page, 'Crimson Tide', 1)).toHaveText('1', { timeout: 2_000 })
    await expect(caps(page, 'Azure Wave', 1)).toHaveText('0')
    await expect(mapCard(page, 'Map 1').getByText('Live', { exact: true })).toBeVisible()
    expect(server.writes[2]).toMatchObject({ method: 'DELETE', path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/score/overrides` })
})

test('the step buttons stay disabled while a correction is being written', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    server.writeDelayMs = 800
    const add = scoreSection(page).getByRole('button', { name: 'Add a cap to Azure Wave on map 1' })

    await add.click()
    await expect(add).toBeDisabled()
    await expect(caps(page, 'Azure Wave', 1)).toHaveText('1', { timeout: 2_000 })
    await expect(add).toBeEnabled()
    expect(server.writes).toHaveLength(1)
})

test('Match live records the time and can be cleared', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    const score = scoreSection(page)

    await score.getByRole('button', { name: 'Match live' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/^Live since .*20:03 UTC/, { timeout: 2_000 })
    expect(server.writes[0]).toEqual({ method: 'POST', path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/live`, body: null })

    await score.getByRole('button', { name: 'Clear live time' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/Not marked live/, { timeout: 2_000 })
    expect(server.writes[1]).toMatchObject({ method: 'DELETE' })
})

test('the countdown moves by +N minutes on the current target, to a picked time, and back', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page, 'Match')
    const countdown = countdownSection(page)
    const target = countdown.getByTestId('countdown-target')
    await expect(target).toHaveText(/20:00 UTC/)

    await countdown.getByRole('button', { name: 'Move the countdown 10 minutes later' }).click()
    await expect(target).toHaveText(/20:10 UTC/, { timeout: 2_000 })
    await expect(countdown.getByText('Moved')).toBeVisible()
    await countdown.getByRole('button', { name: 'Move the countdown 5 minutes later' }).click()
    await expect(target).toHaveText(/20:15 UTC/, { timeout: 2_000 })
    expect(server.writes.map(entry => entry.body)).toEqual([{ add_minutes: 10 }, { add_minutes: 5 }])

    await countdown.getByLabel('New time (UTC)').fill('2030-10-12T21:30')
    await countdown.getByRole('button', { name: 'Set countdown' }).click()
    await expect(target).toHaveText(/21:30 UTC/, { timeout: 2_000 })
    expect(server.writes[2].body).toEqual({ at: '2030-10-12T21:30:00Z' })

    await countdown.getByRole('button', { name: 'Use scheduled time' }).click()
    await expect(target).toHaveText(/20:00 UTC/, { timeout: 2_000 })
    await expect(countdown.getByText('Moved')).toHaveCount(0)
    expect(server.writes[3]).toMatchObject({ method: 'DELETE', path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/countdown` })
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the score and countdown controls fit ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page)
        await openStreamTab(page)

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        for (const name of ['Add a cap to Azure Wave on map 1', 'Remove a cap from Crimson Tide on map 1']) {
            const box = await scoreSection(page).getByRole('button', { name }).boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(32)
            expect(box?.width ?? 0).toBeGreaterThanOrEqual(32)
        }

        await openStreamPanel(page, 'Match')
        await expect(countdownSection(page).getByRole('button', { name: 'Set countdown' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        const plus = await countdownSection(page).getByRole('button', { name: 'Move the countdown 5 minutes later' }).boundingBox()
        expect(plus?.height ?? 0).toBeGreaterThanOrEqual(32)
    })
}
