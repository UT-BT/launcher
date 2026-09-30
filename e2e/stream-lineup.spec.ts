import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'lineup-cup'
const VIEWER = { id: '555555555555555555', alias: 'Rin' }
const MATCH_ID = '6f7c1a52-0000-4000-8000-000000000001'

const A_CAPTAIN = { id: '100000000000000001', display_name: 'Ace Captain' }
const A_MATE = { id: '100000000000000002', display_name: 'Ada Mate' }
const A_BENCH = { id: '100000000000000003', display_name: 'Abe Bench' }
const B_CAPTAIN = { id: '200000000000000001', display_name: 'Bo Captain' }
const B_MATE = { id: '200000000000000002', display_name: 'Bea Mate' }

const ROSTERS = { a: [A_CAPTAIN, A_MATE, A_BENCH], b: [B_CAPTAIN, B_MATE] }
const PEOPLE = [...ROSTERS.a, ...ROSTERS.b]

type Slot = 'a1' | 'a2' | 'b1' | 'b2'
type Slots = Record<Slot, string | null>

const EMPTY: Slots = { a1: null, a2: null, b1: null, b2: null }

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Lineup Cup 2026',
    summary: 'A cup for checking the lineup controls.',
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

function sideFill(stored: [string | null, string | null], roster: { id: string }[]): [string | null, string | null] {
    const ids = roster.map(member => member.id)
    const kept = stored.map(id => (id && ids.includes(id) ? id : null))
    const defaults = ids.filter(id => !kept.includes(id))
    return [kept[0] ?? defaults.shift() ?? null, kept[1] ?? defaults.shift() ?? null]
}

function effective(stored: Slots): Slots {
    const [a1, a2] = sideFill([stored.a1, stored.a2], ROSTERS.a)
    const [b1, b2] = sideFill([stored.b1, stored.b2], ROSTERS.b)
    return { a1, a2, b1, b2 }
}

function person(id: string | null) {
    const found = PEOPLE.find(entry => entry.id === id)
    return found ? { ...found, avatar: `https://gateway.utbt.net/users/${found.id}/avatar` } : null
}

function team(id: string, name: string, side: 'a' | 'b') {
    return {
        id,
        name,
        match_side: side,
        stage_seed: side === 'a' ? 1 : 2,
        pre_cup_seed: null,
        members: ROSTERS[side].map((member, index) => ({ ...person(member.id), title: null, captain: index === 0 })),
    }
}

function deskPayload(streamerId: string, stored: Slots) {
    const lineup = effective(stored)
    const assigned = {
        id: MATCH_ID,
        stage: { key: 'groups', name: 'Groups' },
        group: { id: 'g1', name: 'Group A' },
        round: { no: 1, label: null },
        best_of: 3,
        scheduled_at: '2030-10-12T19:00:00+00:00',
        status: 'scheduled',
        stream_url: null,
        public: true,
        finished: false,
        teams: { a: { id: 't-a', name: 'Crimson Tide' }, b: { id: 't-b', name: 'Azure Wave' } },
    }
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: EVENT.name, slug: SLUG },
        streamer: { id: streamerId, display_name: 'Streamer', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: 'next',
        match: {
            id: MATCH_ID,
            reason: 'next',
            stage: { key: 'groups', name: 'Groups' },
            group: { id: 'g1', name: 'Group A' },
            round: { no: 1, label: null },
            best_of: 3,
            mode: 'first_to',
            caps_to_win: 2,
            scheduled_at: '2030-10-12T19:00:00+00:00',
            countdown_at: '2030-10-12T19:00:00+00:00',
            live_at: null,
            status: 'scheduled',
            stream_url: null,
            pick_ban_status: 'none',
            sides: { a: 'a', b: 'b' },
            teams: { a: team('t-a', 'Crimson Tide', 'a'), b: team('t-b', 'Azure Wave', 'b') },
            lineup: { a1: person(lineup.a1), a2: person(lineup.a2), b1: person(lineup.b1), b2: person(lineup.b2) },
            maps: [],
            score: { maps: [], current_map: null, series: { a: 0, b: 0 }, winner: null, live_decided: false },
            casters: [],
        },
        assigned_matches: [assigned],
        next_match: null,
    }
}

function gameServer(id: string, hostname: string, players: string[], certified = true) {
    return {
        id,
        ip: `10.0.0.${id}`,
        hostname,
        hostport: 7777,
        map_name: 'CTF-BT-Example',
        player_count: players.length,
        max_players: 12,
        spectators: 0,
        certified_records: certified,
        players: players.map(playerId => ({ id: playerId, name: 'Someone', ping: 40, time: 1, team: 0, deaths: 0, is_spectator: false })),
    }
}

interface MockServer {
    stored: Slots
    gameServers: ReturnType<typeof gameServer>[]
    writes: Record<string, unknown>[]
}

async function mockApi(page: Page, init: Partial<MockServer> = {}): Promise<MockServer> {
    const server: MockServer = { stored: { ...EMPTY }, gameServers: [], writes: [], ...init }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'lineup-token',
            refreshToken: 'lineup-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (path === '/server-info') {
                await route.fulfill({ json: server.gameServers })
                return
            }
            if (path.endsWith('/avatar')) {
                await route.fulfill({ status: 404, body: '' })
                return
            }
            await route.fulfill({ json: [] })
            return
        }

        const desk = path.match(new RegExp(`^/tournaments/${SLUG}/stream/(\\d+)/desk$`))
        if (desk && request.method() === 'GET') {
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server.stored) } })
            return
        }

        if (path === `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/lineup`) {
            if (request.method() === 'PUT') {
                const body = request.postDataJSON() as Slots & { only_if_empty?: boolean }
                server.writes.push(body)
                if (body.only_if_empty && Object.values(server.stored).some(Boolean)) {
                    await route.fulfill({ status: 409, json: { success: false, error: 'The lineup is already set.', code: 'lineup_set' } })
                    return
                }
                server.stored = { a1: body.a1, a2: body.a2, b1: body.b1, b2: body.b2 }
            }
            await route.fulfill({
                json: { success: true, data: { match_id: MATCH_ID, lineup: server.stored, effective: effective(server.stored) } },
            })
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

function section(page: Page) {
    return page.getByRole('region', { name: 'Lineup', exact: true })
}

function teamCard(page: Page, name: string) {
    return section(page).getByRole('region', { name: `${name} lineup` })
}

async function seatName(page: Page, teamName: string, seat: 'left' | 'right') {
    return teamCard(page, teamName).getByTestId(`seat-${seat}`)
}

test('shows the default lineup, the bigger roster to choose from and nothing to choose for a two-player roster', async ({ page }) => {
    await mockApi(page)
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    const tide = teamCard(page, 'Crimson Tide')
    await expect(await seatName(page, 'Crimson Tide', 'left')).toContainText(A_CAPTAIN.display_name)
    await expect(await seatName(page, 'Crimson Tide', 'right')).toContainText(A_MATE.display_name)
    await expect(tide.getByRole('list', { name: 'Crimson Tide roster' }).getByRole('listitem')).toHaveCount(3)
    await expect(tide.getByRole('button', { name: `Put ${A_CAPTAIN.display_name} on the left` })).toHaveAttribute('aria-pressed', 'true')

    const wave = teamCard(page, 'Azure Wave')
    await expect(await seatName(page, 'Azure Wave', 'left')).toContainText(B_CAPTAIN.display_name)
    await expect(await seatName(page, 'Azure Wave', 'right')).toContainText(B_MATE.display_name)
    await expect(wave.getByText('Two-player roster: both play, so there is nothing to choose.')).toBeVisible()
    await expect(wave.getByRole('list')).toHaveCount(0)
    await expect(section(page).getByTestId('lineup-detection')).toContainText('Crimson Tide: nobody found in game.')
})

test('an empty lineup takes the players found in game when exactly two per side are there', async ({ page }) => {
    const server = await mockApi(page, {
        gameServers: [
            gameServer('1', '[UTBT.NET] - BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_BENCH.id, '12345']),
            gameServer('2', '[UTBT.NET] - BunnyTrack America Server #2', [B_CAPTAIN.id, B_MATE.id]),
        ],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    await expect.poll(() => server.writes.length).toBe(1)
    expect(server.writes[0]).toEqual({ a1: A_CAPTAIN.id, a2: A_BENCH.id, b1: B_CAPTAIN.id, b2: B_MATE.id, only_if_empty: true })
    await expect(await seatName(page, 'Crimson Tide', 'right')).toContainText(A_BENCH.display_name)
    await expect(section(page).getByText('Applied the players found in game.')).toBeVisible()
    await expect(await seatName(page, 'Crimson Tide', 'right')).toContainText('In game on Europe #1')
    await expect(await seatName(page, 'Azure Wave', 'left')).toContainText('In game on America #2')
    await page.waitForTimeout(500)
    expect(server.writes).toHaveLength(1)
})

test('a lineup already set is never auto-applied, and the suggestion applies on request', async ({ page }) => {
    const server = await mockApi(page, {
        stored: { ...EMPTY, b1: B_MATE.id, b2: B_CAPTAIN.id },
        gameServers: [gameServer('1', 'BunnyTrack Europe Server #1', [A_MATE.id, A_BENCH.id, B_CAPTAIN.id, B_MATE.id])],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    const suggestion = section(page).getByRole('list', { name: 'Suggested lineup' })
    await expect(suggestion.getByRole('listitem')).toHaveCount(1)
    await expect(suggestion).toContainText(A_BENCH.display_name)
    await page.waitForTimeout(500)
    expect(server.writes).toHaveLength(0)

    await section(page).getByRole('button', { name: 'Apply suggestion' }).click()
    await expect.poll(() => server.writes.length).toBe(1)
    expect(server.writes[0]).toEqual({ a1: A_BENCH.id, a2: A_MATE.id, b1: B_MATE.id, b2: B_CAPTAIN.id })
    await expect(await seatName(page, 'Crimson Tide', 'left')).toContainText(A_BENCH.display_name)
    await expect(section(page).getByRole('button', { name: 'Apply suggestion' })).toHaveCount(0)
})

test('warns under the team that plays on an uncertified server, and only there', async ({ page }) => {
    await mockApi(page, {
        gameServers: [
            gameServer('1', 'BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_MATE.id], false),
            gameServer('2', 'BunnyTrack America Server #2', [B_CAPTAIN.id, B_MATE.id], true),
        ],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    const warning = section(page).getByTestId('lineup-a-uncertified')
    await expect(warning).toHaveText("Uncertified server: caps here won't count for the live score or records.")
    await expect(section(page).getByTestId('lineup-b-uncertified')).toHaveCount(0)
})

test('shows no uncertified warning when the team plays on a certified server', async ({ page }) => {
    await mockApi(page, {
        gameServers: [gameServer('1', 'BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_MATE.id, B_CAPTAIN.id, B_MATE.id])],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    await expect(section(page).getByTestId('lineup-detection')).toContainText('Crimson Tide: 2 found in game on Europe #1.')
    await expect(section(page).getByText('Uncertified server', { exact: false })).toHaveCount(0)
})

test('three members found on a side gives no suggestion for that side and no auto-apply', async ({ page }) => {
    const server = await mockApi(page, {
        gameServers: [gameServer('1', 'BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_MATE.id, A_BENCH.id, B_CAPTAIN.id, B_MATE.id])],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    await expect(section(page).getByTestId('lineup-detection')).toContainText('Crimson Tide: 3 found in game, so choose the two players by hand.')
    await page.waitForTimeout(500)
    expect(server.writes).toHaveLength(0)
})

test('swap works for each team and a roster pick pins both slots', async ({ page }) => {
    const server = await mockApi(page)
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    await teamCard(page, 'Crimson Tide').getByRole('button', { name: 'Swap Crimson Tide left and right' }).click()
    await expect(await seatName(page, 'Crimson Tide', 'left')).toContainText(A_MATE.display_name)
    expect(server.writes[0]).toEqual({ a1: A_MATE.id, a2: A_CAPTAIN.id, b1: null, b2: null })

    await teamCard(page, 'Azure Wave').getByRole('button', { name: 'Swap Azure Wave left and right' }).click()
    await expect(await seatName(page, 'Azure Wave', 'left')).toContainText(B_MATE.display_name)
    expect(server.writes[1]).toEqual({ a1: A_MATE.id, a2: A_CAPTAIN.id, b1: B_MATE.id, b2: B_CAPTAIN.id })

    await teamCard(page, 'Crimson Tide').getByRole('button', { name: `Put ${A_BENCH.display_name} on the right` }).click()
    await expect(await seatName(page, 'Crimson Tide', 'right')).toContainText(A_BENCH.display_name)
    expect(server.writes[2]).toEqual({ a1: A_MATE.id, a2: A_BENCH.id, b1: B_MATE.id, b2: B_CAPTAIN.id })

    await section(page).getByRole('button', { name: 'Use the default lineup' }).click()
    await expect(await seatName(page, 'Crimson Tide', 'left')).toContainText(A_CAPTAIN.display_name)
    expect(server.writes[3]).toEqual(EMPTY)
})

test('going back to the default lineup is not overridden by the players found in game', async ({ page }) => {
    const server = await mockApi(page, {
        stored: { ...EMPTY, a1: A_MATE.id },
        gameServers: [gameServer('1', 'BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_BENCH.id, B_CAPTAIN.id, B_MATE.id])],
    })
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')

    await expect(section(page).getByRole('button', { name: 'Apply suggestion' })).toBeVisible()
    await section(page).getByRole('button', { name: 'Use the default lineup' }).click()
    await expect.poll(() => server.writes.length).toBe(1)
    expect(server.writes[0]).toEqual(EMPTY)
    await expect(await seatName(page, 'Crimson Tide', 'right')).toContainText(A_MATE.display_name)
    await page.waitForTimeout(500)
    expect(server.writes).toHaveLength(1)
    await expect(section(page).getByRole('button', { name: 'Apply suggestion' })).toBeVisible()
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the lineup controls fit ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await mockApi(page, {
            stored: { ...EMPTY, a1: A_MATE.id },
            gameServers: [gameServer('1', 'BunnyTrack Europe Server #1', [A_CAPTAIN.id, A_BENCH.id, B_CAPTAIN.id], false)],
        })
        await page.goto(`/events/${SLUG}?tab=stream`)
        await openStreamPanel(page, 'Match')

        await expect(section(page).getByRole('button', { name: 'Apply suggestion' })).toBeVisible()
        await expect(section(page).getByTestId('lineup-a-uncertified')).toBeVisible()
        await expect(section(page).getByTestId('lineup-b-uncertified')).toBeVisible()
        await expect(teamCard(page, 'Crimson Tide').getByRole('listitem')).toHaveCount(3)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

        for (const name of [`Put ${A_BENCH.display_name} on the right`, 'Swap Azure Wave left and right']) {
            const box = await section(page).getByRole('button', { name }).boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(32)
            expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
        }
    })
}
