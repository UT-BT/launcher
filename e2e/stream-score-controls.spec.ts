import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'score-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const MATCH_ID = 'm7'
const SCHEDULED = '2030-10-12T20:00:00+00:00'
const MATCH_PATH = `/tournaments/${SLUG}/stream/matches/${MATCH_ID}`

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

type Side = 'a' | 'b'
type WinnerOverride = 'auto' | 'a' | 'b' | 'none'

interface MapState {
    a: number | null
    b: number | null
    winner: WinnerOverride
}

interface Broadcast {
    liveAt: string | null
    countdownAt: string | null
    scoreState: Record<string, MapState>
    liveCounting: boolean
}

interface Server {
    broadcast: Broadcast
    pickBanEndedAt: string | null
    liveCaps: { a: number; b: number }[]
    official: Record<number, { caps: { a: number; b: number }; winner: Side }>
    writes: { method: string; path: string; body: unknown }[]
    writeDelayMs: number
    reject: { code: string; error: string } | null
}

const LIVE_STATE: MapState = { a: null, b: null, winner: 'auto' }

function team(id: string, name: string, side: Side) {
    return { id, name, match_side: side, stage_seed: 1, pre_cup_seed: null, members: [] }
}

function addMinutes(iso: string, minutes: number): string {
    return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace('.000Z', '+00:00')
}

function isManual(state: MapState): boolean {
    return state.a !== null || state.b !== null || state.winner !== 'auto'
}

function mapScoreOf(server: Server, live: { a: number; b: number }, ordinal: number) {
    const state = server.broadcast.scoreState[String(ordinal)] ?? LIVE_STATE
    const stored = { pins: { a: state.a, b: state.b }, winner_override: state.winner }
    const official = server.official[ordinal]
    if (official) {
        return { ordinal, caps: official.caps, decided: true, winner: official.winner, source: 'official', closed_by: 'official', ...stored }
    }
    const counted = server.broadcast.liveCounting ? live : { a: 0, b: 0 }
    const caps = { a: state.a ?? counted.a, b: state.b ?? counted.b }
    const byTarget: Side | null = caps.a >= 2 && caps.a > caps.b ? 'a' : caps.b >= 2 && caps.b > caps.a ? 'b' : null
    const overridden = state.winner !== 'auto'
    const winner = overridden ? (state.winner === 'none' ? null : state.winner) : byTarget
    const closedBy = overridden ? 'override' : byTarget ? 'target' : null
    return {
        ordinal,
        caps,
        decided: overridden || byTarget !== null,
        winner,
        source: isManual(state) ? 'manual' : 'live',
        closed_by: closedBy,
        ...stored,
    }
}

function scoreOf(server: Server) {
    const maps = server.liveCaps.map((live, ordinal) => mapScoreOf(server, live, ordinal))
    const series = {
        a: maps.filter(entry => entry.winner === 'a').length,
        b: maps.filter(entry => entry.winner === 'b').length,
    }
    const current = maps.find(entry => !entry.decided)
    return {
        maps,
        current_map: current ? current.ordinal : null,
        series,
        winner: null,
        live_decided: false,
        live_counting: server.broadcast.liveCounting,
    }
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
        live_since: server.broadcast.liveAt ?? server.pickBanEndedAt,
        live_source: server.broadcast.liveAt ? 'manual' : server.pickBanEndedAt ? 'pick_ban' : null,
        status: 'live',
        stream_url: null,
        pick_ban_status: server.pickBanEndedAt ? 'complete' : 'none',
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
            score_state: server.broadcast.scoreState,
            live_counting: server.broadcast.liveCounting,
        },
    }
}

function sameState(left: MapState, right: MapState): boolean {
    return left.a === right.a && left.b === right.b && left.winner === right.winner
}

function validPin(value: unknown): boolean {
    return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 20)
}

function mapOrdinal(suffix: string): string | null {
    return suffix.match(/^\/score\/maps\/(\d+)$/)?.[1] ?? null
}

function bodyState(body: Record<string, unknown> | null): MapState {
    return { a: (body?.a ?? null) as number | null, b: (body?.b ?? null) as number | null, winner: (body?.winner ?? 'auto') as WinnerOverride }
}

function scoreReject(server: Server, method: string, suffix: string, body: Record<string, unknown> | null): string | null {
    const ordinal = mapOrdinal(suffix)
    if (ordinal !== null) {
        if (method === 'PUT' && (!validPin(body?.a) || !validPin(body?.b))) return 'invalid_request'
        if (server.official[Number(ordinal)]) return 'official_map'
        const next = method === 'PUT' ? bodyState(body) : LIVE_STATE
        return sameState(server.broadcast.scoreState[ordinal] ?? LIVE_STATE, next) ? 'no_effect' : null
    }
    if (suffix === '/score/maps') return Object.keys(server.broadcast.scoreState).length === 0 ? 'no_effect' : null
    if (suffix === '/score/live-counting') return body?.enabled === server.broadcast.liveCounting ? 'no_effect' : null
    return null
}

function applyWrite(server: Server, method: string, suffix: string, body: Record<string, unknown> | null) {
    const ordinal = mapOrdinal(suffix)
    if (suffix === '/live') {
        server.broadcast.liveAt = method === 'POST' ? '2030-10-12T20:03:00+00:00' : null
    } else if (suffix === '/countdown' && method === 'DELETE') {
        server.broadcast.countdownAt = null
    } else if (suffix === '/countdown') {
        server.broadcast.countdownAt = typeof body?.at === 'string'
            ? addMinutes(body.at, 0)
            : addMinutes(server.broadcast.countdownAt ?? SCHEDULED, Number(body?.add_minutes))
    } else if (ordinal !== null) {
        const next = { ...server.broadcast.scoreState }
        const state = bodyState(body)
        if (method === 'PUT' && isManual(state)) next[ordinal] = state
        else delete next[ordinal]
        server.broadcast.scoreState = next
    } else if (suffix === '/score/maps') {
        server.broadcast.scoreState = {}
    } else if (suffix === '/score/live-counting') {
        server.broadcast.liveCounting = body?.enabled === true
    }
}

async function mockApi(page: Page, pickBanEndedAt: string | null = null): Promise<Server> {
    const server: Server = {
        broadcast: { liveAt: null, countdownAt: null, scoreState: {}, liveCounting: true },
        pickBanEndedAt,
        liveCaps: [{ a: 0, b: 0 }, { a: 1, b: 0 }, { a: 0, b: 0 }],
        official: { 0: { caps: { a: 2, b: 1 }, winner: 'a' } },
        writes: [],
        writeDelayMs: 0,
        reject: null,
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
        const write = path.match(new RegExp(`^${MATCH_PATH}(/live|/countdown|/score/maps(?:/\\d+)?|/score/live-counting)$`))

        if (desk && request.method() === 'GET') {
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server) } })
            return
        }

        if (write) {
            const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null
            server.writes.push({ method: request.method(), path, body })
            if (server.writeDelayMs) await new Promise(resolve => setTimeout(resolve, server.writeDelayMs))
            const forced = server.reject
            const code = forced?.code ?? scoreReject(server, request.method(), write[1], body)
            if (code) {
                server.reject = null
                await route.fulfill({ status: 422, json: { success: false, error: forced?.error ?? `Rejected: ${code}`, code } })
                return
            }
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

const HINT = 'Map ended level? Close it here as a draw.'

function scoreSection(page: Page) {
    return page.getByRole('region', { name: 'Score', exact: true })
}

function mapRow(page: Page, map: number) {
    return scoreSection(page).getByRole('list', { name: 'Maps' }).getByRole('listitem', { name: `Map ${map}` })
}

function scoreInput(page: Page, team: string, map: number) {
    return scoreSection(page).getByRole('spinbutton', { name: `${team} score on map ${map}` })
}

function stepButton(page: Page, direction: 'Raise' | 'Lower', team: string, map: number) {
    return scoreSection(page).getByRole('button', { name: `${direction} ${team} score on map ${map}` })
}

function winnerSelect(page: Page, map: number) {
    return scoreSection(page).getByRole('combobox', { name: `Winner of map ${map}` })
}

async function openStreamTab(page: Page, panel: 'Score' | 'Match' = 'Score') {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, panel)
    if (panel === 'Score') await expect(scoreInput(page, 'Crimson Tide', 2)).toHaveValue('1')
}

test('the score panel lists each map in pick order with its picker, source, scores and winner', async ({ page }) => {
    await mockApi(page)
    await openStreamTab(page)

    const first = mapRow(page, 1)
    await expect(first).toContainText('BT-Alpha')
    await expect(first).toContainText('Picked by Crimson Tide')
    await expect(first).toContainText('Crimson Tide won')
    await expect(first.getByText('Official', { exact: true })).toBeVisible()

    const second = mapRow(page, 2)
    await expect(second).toContainText('BT-Bravo')
    await expect(second).toContainText('Picked by Azure Wave')
    await expect(second.getByText('Current', { exact: true })).toBeVisible()
    await expect(second.getByText('Live', { exact: true })).toBeVisible()
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('0')
    await expect(stepButton(page, 'Lower', 'Azure Wave', 2)).toBeDisabled()
    await expect(winnerSelect(page, 2).locator('option')).toHaveText(['Auto', 'Crimson Tide', 'Azure Wave', 'Draw'])

    await expect(mapRow(page, 3)).toContainText('Decider')
    await expect(scoreSection(page).getByText(HINT)).toHaveCount(1)
    await expect(second.getByText(HINT)).toBeVisible()
    await expect(scoreSection(page).getByTestId('series-score')).toHaveText('Series: Crimson Tide 1 – 0 Azure Wave')
    await expect(scoreSection(page).getByRole('switch', { name: 'Live counting' })).toHaveAttribute('aria-checked', 'true')
    await expect(scoreSection(page).getByTestId('match-live-status')).toHaveText(/Not live yet/)
})

test('an official map is read-only', async ({ page }) => {
    await mockApi(page)
    await openStreamTab(page)

    const first = mapRow(page, 1)
    await expect(scoreInput(page, 'Crimson Tide', 1)).toHaveValue('2')
    await expect(scoreInput(page, 'Crimson Tide', 1)).toBeDisabled()
    await expect(scoreInput(page, 'Azure Wave', 1)).toBeDisabled()
    await expect(stepButton(page, 'Raise', 'Azure Wave', 1)).toBeDisabled()
    await expect(stepButton(page, 'Lower', 'Crimson Tide', 1)).toBeDisabled()
    await expect(winnerSelect(page, 1)).toBeDisabled()
    await expect(first.getByRole('button', { name: 'Reset map 1 to live' })).toHaveCount(0)
    await expect(first).toContainText('Official result. It can’t be edited here.')
})

test('typing and stepping a score pin that side and show the new values within about 2 s', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    server.writeDelayMs = 300

    await scoreInput(page, 'Azure Wave', 2).fill('1')
    await scoreInput(page, 'Azure Wave', 2).press('Enter')
    await expect(mapRow(page, 2).getByText('Manual', { exact: true })).toBeVisible({ timeout: 2_000 })
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('1')
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `${MATCH_PATH}/score/maps/1`, body: { a: null, b: 1, winner: 'auto' } })

    await stepButton(page, 'Raise', 'Crimson Tide', 2).click()
    await expect(scoreInput(page, 'Crimson Tide', 2)).toHaveValue('2', { timeout: 2_000 })
    await expect(mapRow(page, 2)).toContainText('Crimson Tide won')
    await expect(scoreSection(page).getByTestId('series-score')).toHaveText('Series: Crimson Tide 2 – 0 Azure Wave')
    expect(server.writes[1].body).toEqual({ a: 2, b: 1, winner: 'auto' })

    await stepButton(page, 'Lower', 'Azure Wave', 2).click()
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('0', { timeout: 2_000 })
    expect(server.writes[2].body).toEqual({ a: 2, b: 0, winner: 'auto' })
})

test('typing the live count pins that side, and leaving an input untouched sends nothing', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    const crimson = scoreInput(page, 'Crimson Tide', 2)

    await crimson.focus()
    await crimson.press('Enter')
    expect(server.writes).toHaveLength(0)

    await crimson.fill('1')
    await crimson.press('Enter')
    await expect(mapRow(page, 2).getByText('Manual', { exact: true })).toBeVisible({ timeout: 2_000 })
    await expect(crimson).toHaveValue('1')
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `${MATCH_PATH}/score/maps/1`, body: { a: 1, b: null, winner: 'auto' } })
})

test('a typed score outside 0 to 20 is refused before it is sent', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)

    await scoreInput(page, 'Azure Wave', 2).fill('25')
    await scoreInput(page, 'Azure Wave', 2).press('Enter')

    await expect(scoreSection(page).getByRole('alert')).toHaveText('Type a whole number from 0 to 20.')
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('0')
    expect(server.writes).toHaveLength(0)
})

test('setting Draw closes the current map and moves the current map on', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)

    await winnerSelect(page, 2).selectOption({ label: 'Draw' })

    await expect(mapRow(page, 3).getByText('Current', { exact: true })).toBeVisible({ timeout: 2_000 })
    await expect(mapRow(page, 3).getByText(HINT)).toBeVisible()
    await expect(mapRow(page, 2).getByText(HINT)).toHaveCount(0)
    await expect(mapRow(page, 2)).toContainText('Draw')
    await expect(winnerSelect(page, 2)).toHaveValue('none')
    await expect(scoreSection(page).getByTestId('series-score')).toHaveText('Series: Crimson Tide 1 – 0 Azure Wave')
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `${MATCH_PATH}/score/maps/1`, body: { a: null, b: null, winner: 'none' } })
})

test('switching live counting off leaves only official results and typed scores', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    const toggle = scoreSection(page).getByRole('switch', { name: 'Live counting' })

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 2_000 })
    await expect(scoreInput(page, 'Crimson Tide', 2)).toHaveValue('0')
    await expect(scoreInput(page, 'Crimson Tide', 1)).toHaveValue('2')
    await expect(scoreSection(page).getByTestId('live-counting-status')).toHaveText(/only official results and the scores you set count/)
    expect(server.writes[0]).toEqual({ method: 'PUT', path: `${MATCH_PATH}/score/live-counting`, body: { enabled: false } })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 2_000 })
    await expect(scoreInput(page, 'Crimson Tide', 2)).toHaveValue('1')
    expect(server.writes[1].body).toEqual({ enabled: true })
})

test('Reset puts one map back to live and Reset all puts every map back', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    const resetAll = scoreSection(page).getByRole('button', { name: 'Reset all' })
    await expect(resetAll).toBeDisabled()
    await expect(mapRow(page, 2).getByRole('button', { name: 'Reset map 2 to live' })).toBeDisabled()

    await stepButton(page, 'Raise', 'Azure Wave', 2).click()
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('1', { timeout: 2_000 })
    await stepButton(page, 'Raise', 'Azure Wave', 3).click()
    await expect(scoreInput(page, 'Azure Wave', 3)).toHaveValue('1', { timeout: 2_000 })

    await mapRow(page, 2).getByRole('button', { name: 'Reset map 2 to live' }).click()
    await expect(mapRow(page, 2).getByText('Live', { exact: true })).toBeVisible({ timeout: 2_000 })
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('0')
    await expect(scoreInput(page, 'Azure Wave', 3)).toHaveValue('1')
    expect(server.writes[2]).toEqual({ method: 'DELETE', path: `${MATCH_PATH}/score/maps/1`, body: null })

    await resetAll.click()
    await expect(mapRow(page, 3).getByText('Live', { exact: true })).toBeVisible({ timeout: 2_000 })
    await expect(scoreInput(page, 'Azure Wave', 3)).toHaveValue('0')
    await expect(resetAll).toBeDisabled()
    expect(server.writes[3]).toEqual({ method: 'DELETE', path: `${MATCH_PATH}/score/maps`, body: null })
})

test('a rejected write shows a readable message and keeps the shown score', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    server.reject = { code: 'no_effect', error: 'no_effect' }

    await scoreInput(page, 'Azure Wave', 2).fill('3')
    await scoreInput(page, 'Azure Wave', 2).press('Enter')

    await expect(scoreSection(page).getByRole('alert')).toHaveText('Nothing changed: the map already shows that.', { timeout: 2_000 })
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('0')

    server.reject = { code: 'official_map', error: 'official_map' }
    await stepButton(page, 'Raise', 'Crimson Tide', 2).click()
    await expect(scoreSection(page).getByRole('alert')).toHaveText('That map has an official result, so it can’t be edited.', { timeout: 2_000 })
})

test('the step buttons stay disabled while a score is being written', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    server.writeDelayMs = 800
    const raise = stepButton(page, 'Raise', 'Azure Wave', 2)

    await raise.click()
    await expect(raise).toBeDisabled()
    await expect(scoreInput(page, 'Azure Wave', 2)).toHaveValue('1', { timeout: 2_000 })
    await expect(raise).toBeEnabled()
    expect(server.writes).toHaveLength(1)
})

test('Match live records the time and can be cleared', async ({ page }) => {
    const server = await mockApi(page)
    await openStreamTab(page)
    const score = scoreSection(page)

    await score.getByRole('button', { name: 'Match live' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/^Live since .*20:03 UTC/, { timeout: 2_000 })
    expect(server.writes[0]).toEqual({ method: 'POST', path: `${MATCH_PATH}/live`, body: null })

    await score.getByRole('button', { name: 'Clear live time' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/Not live yet/, { timeout: 2_000 })
    expect(server.writes[1]).toMatchObject({ method: 'DELETE' })
})

test('a finished pick and ban marks the match live without pressing Match live', async ({ page }) => {
    const server = await mockApi(page, '2030-10-12T19:55:00+00:00')
    await openStreamTab(page)
    const score = scoreSection(page)

    await expect(score.getByTestId('match-live-status')).toHaveText(/^Live since .*19:55 UTC.*, when pick & ban ended\.$/)
    await expect(score.getByRole('button', { name: 'Mark live again now' })).toBeVisible()
    await expect(score.getByRole('button', { name: 'Clear live time' })).toHaveCount(0)

    await score.getByRole('button', { name: 'Mark live again now' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/^Live since .*20:03 UTC/, { timeout: 2_000 })
    await score.getByRole('button', { name: 'Clear live time' }).click()
    await expect(score.getByTestId('match-live-status')).toHaveText(/19:55 UTC.*, when pick & ban ended\.$/, { timeout: 2_000 })
    expect(server.writes.map(write => write.method)).toEqual(['POST', 'DELETE'])
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the score editor fits ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page)
        await openStreamTab(page)

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        for (const button of [stepButton(page, 'Raise', 'Azure Wave', 2), stepButton(page, 'Lower', 'Crimson Tide', 2)]) {
            const box = await button.boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(32)
            expect(box?.width ?? 0).toBeGreaterThanOrEqual(32)
        }
        const input = await scoreInput(page, 'Crimson Tide', 2).boundingBox()
        expect(input?.height ?? 0).toBeGreaterThanOrEqual(32)
        const row = await mapRow(page, 2).boundingBox()
        const select = await winnerSelect(page, 2).boundingBox()
        expect((select?.x ?? 0) + (select?.width ?? 0)).toBeLessThanOrEqual((row?.x ?? 0) + (row?.width ?? 0))
    })
}
