import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { openStreamPanel } from './streamPanels'

const SLUG = 'countdown-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }
const MATCH_ID = 'm7'
const SCHEDULED = '2030-10-12T20:00:00+00:00'

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Countdown Cup 2030',
    summary: 'A cup for checking the countdown controls.',
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

interface Server {
    countdownAt: string | null
    writes: { method: string; path: string; body: unknown }[]
}

function team(id: string, name: string, side: 'a' | 'b') {
    return { id, name, match_side: side, stage_seed: 1, pre_cup_seed: null, members: [] }
}

function addMinutes(iso: string, minutes: number): string {
    return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace('.000Z', '+00:00')
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
        countdown_at: server.countdownAt ?? SCHEDULED,
        live_at: null,
        status: 'live',
        stream_url: null,
        pick_ban_status: 'none',
        sides: { a: 'a', b: 'b' },
        teams: { a: team('ta', 'Crimson Tide', 'a'), b: team('tb', 'Azure Wave', 'b') },
        lineup: { a1: null, a2: null, b1: null, b2: null },
        maps: [{ ordinal: 0, map: 'BT-Alpha', kind: 'normal', picked_by: 'a' }],
        score: { maps: [], current_map: 0, series: { a: 0, b: 0 }, winner: null, live_decided: false },
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
        assigned_matches: [],
        next_match: null,
    }
}

function broadcastPayload(server: Server) {
    return {
        broadcast: {
            match_id: MATCH_ID,
            live_at: null,
            countdown_override_at: server.countdownAt,
            countdown_at: server.countdownAt ?? SCHEDULED,
            score_overrides: {},
        },
    }
}

function applyWrite(server: Server, method: string, body: Record<string, unknown> | null) {
    if (method === 'DELETE') {
        server.countdownAt = null
    } else if (typeof body?.at === 'string') {
        server.countdownAt = addMinutes(body.at, 0)
    } else {
        server.countdownAt = addMinutes(server.countdownAt ?? SCHEDULED, Number(body?.add_minutes))
    }
}

async function mockApi(page: Page): Promise<Server> {
    const server: Server = { countdownAt: null, writes: [] }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'countdown-token',
            refreshToken: 'countdown-refresh',
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

        if (desk && request.method() === 'GET') {
            await route.fulfill({ json: { success: true, data: deskPayload(desk[1], server) } })
            return
        }

        if (path === `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/countdown`) {
            const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null
            server.writes.push({ method: request.method(), path, body })
            applyWrite(server, request.method(), body)
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

function countdownSection(page: Page) {
    return page.getByRole('region', { name: 'Countdown' })
}

async function openCountdown(page: Page) {
    await page.goto(`/events/${SLUG}?tab=stream`)
    await openStreamPanel(page, 'Match')
    await expect(countdownSection(page).getByTestId('countdown-target')).toHaveText(/20:00 UTC/)
}

test.describe('in Budapest', () => {
    test.use({ timezoneId: 'Europe/Budapest' })

    test('the input is in the browser time zone, named, and starts at the target', async ({ page }) => {
        await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)

        await expect(countdown.getByLabel('New time in Europe/Budapest (CEST)')).toHaveValue('2030-10-12T22:00')
        await expect(countdown.getByTestId('countdown-utc')).toHaveText('= 20:00 UTC')
    })

    test('a local time sends the UTC instant and the UTC line updates as it is typed', async ({ page }) => {
        const server = await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)
        const input = countdown.getByLabel('New time in Europe/Budapest (CEST)')
        const utc = countdown.getByTestId('countdown-utc')

        await input.fill('2030-10-12T21:30')
        await expect(utc).toHaveText('= 19:30 UTC')
        await input.fill('2030-10-13T00:15')
        await expect(utc).toHaveText('= 22:15 UTC · 12 Oct')

        await input.fill('2030-10-12T21:30')
        await countdown.getByRole('button', { name: 'Set countdown' }).click()
        await expect(countdown.getByTestId('countdown-target')).toHaveText(/19:30 UTC/, { timeout: 2_000 })
        await expect(input).toHaveValue('2030-10-12T21:30')
        expect(server.writes).toEqual([{
            method: 'PUT',
            path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/countdown`,
            body: { at: '2030-10-12T19:30:00Z' },
        }])
    })

    test('the label follows the daylight-saving change', async ({ page }) => {
        await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)

        await countdown.getByLabel('New time in Europe/Budapest (CEST)').fill('2030-12-01T21:00')
        await expect(countdown.getByLabel('New time in Europe/Budapest (CET)')).toBeVisible()
        await expect(countdown.getByTestId('countdown-utc')).toHaveText('= 20:00 UTC')
    })

    test('a time the clocks skip is refused and cannot be set', async ({ page }) => {
        const server = await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)

        await countdown.getByLabel('New time in Europe/Budapest (CEST)').fill('2030-03-31T02:30')
        await expect(countdown.getByRole('alert')).toHaveText('02:30 does not exist in Europe/Budapest that day, because the clocks go forward. Pick a time before or after.')
        await expect(countdown.getByTestId('countdown-utc')).toHaveCount(0)
        await expect(countdown.getByRole('button', { name: 'Set countdown' })).toBeDisabled()
        expect(server.writes).toHaveLength(0)
    })

    test('a repeated hour takes the first instant and says so', async ({ page }) => {
        const server = await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)

        await countdown.getByLabel('New time in Europe/Budapest (CEST)').fill('2030-10-27T02:30')
        await expect(countdown.getByTestId('countdown-utc')).toHaveText('= 00:30 UTC')
        await expect(countdown.getByText('The clocks repeat 02:30 that night. This is the first one, before they go back.')).toBeVisible()
        await countdown.getByRole('button', { name: 'Set countdown' }).click()
        await expect(countdown.getByTestId('countdown-target')).toHaveText(/00:30 UTC/, { timeout: 2_000 })
        expect(server.writes[0].body).toEqual({ at: '2030-10-27T00:30:00Z' })
    })

    test('the +N buttons move the current target and the clear restores the schedule', async ({ page }) => {
        const server = await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)
        const target = countdown.getByTestId('countdown-target')

        await countdown.getByRole('button', { name: 'Move the countdown 10 minutes later' }).click()
        await expect(target).toHaveText(/20:10 UTC/, { timeout: 2_000 })
        await expect(countdown.getByText('Moved')).toBeVisible()
        await countdown.getByRole('button', { name: 'Move the countdown 5 minutes later' }).click()
        await expect(target).toHaveText(/20:15 UTC/, { timeout: 2_000 })
        await expect(countdown.getByLabel('New time in Europe/Budapest (CEST)')).toHaveValue('2030-10-12T22:15')
        expect(server.writes.map(entry => entry.body)).toEqual([{ add_minutes: 10 }, { add_minutes: 5 }])

        await countdown.getByRole('button', { name: 'Use scheduled time' }).click()
        await expect(target).toHaveText(/20:00 UTC/, { timeout: 2_000 })
        await expect(countdown.getByText('Moved')).toHaveCount(0)
        expect(server.writes[2]).toMatchObject({ method: 'DELETE', path: `/tournaments/${SLUG}/stream/matches/${MATCH_ID}/countdown` })
    })

    for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
        test(`the countdown controls fit ${viewport.width} px`, async ({ page }) => {
            await page.setViewportSize(viewport)
            await mockApi(page)
            await openCountdown(page)
            const countdown = countdownSection(page)
            const input = countdown.getByLabel('New time in Europe/Budapest (CEST)')

            await input.fill('2030-03-31T02:30')
            await expect(countdown.getByRole('alert')).toBeVisible()
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
            await input.fill('2030-10-27T02:30')
            await expect(countdown.getByText(/The clocks repeat/)).toBeVisible()
            expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
            await expect(countdown.getByRole('button', { name: 'Set countdown' })).toBeVisible()
            const plus = await countdown.getByRole('button', { name: 'Move the countdown 5 minutes later' }).boundingBox()
            expect(plus?.height ?? 0).toBeGreaterThanOrEqual(32)
        })
    }
})

test.describe('in New York', () => {
    test.use({ timezoneId: 'America/New_York' })

    test('a local evening time lands on the next UTC day', async ({ page }) => {
        const server = await mockApi(page)
        await openCountdown(page)
        const countdown = countdownSection(page)
        const input = countdown.getByLabel('New time in America/New_York (EDT)')

        await expect(input).toHaveValue('2030-10-12T16:00')
        await input.fill('2030-10-12T21:00')
        await expect(countdown.getByTestId('countdown-utc')).toHaveText('= 01:00 UTC · 13 Oct')
        await countdown.getByRole('button', { name: 'Set countdown' }).click()
        await expect(countdown.getByTestId('countdown-target')).toHaveText(/01:00 UTC/, { timeout: 2_000 })
        expect(server.writes[0].body).toEqual({ at: '2030-10-13T01:00:00Z' })
    })
})
