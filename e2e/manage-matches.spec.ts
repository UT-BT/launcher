import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const SLUG = 'matches-cup'
const VIEWER = { id: '555555555555', alias: 'Rin' }

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Matches Cup 2026',
    summary: 'A cup for checking match management.',
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
    team_count: 4,
    registered_team_count: 4,
    created_at: null,
    published_at: null,
    predictions_enabled: false,
}

const STREAMERS = [
    { id: '111111111111', display_name: 'Nova', twitch_url: 'https://twitch.tv/nova' },
    { id: '222222222222', display_name: 'Kestrel', twitch_url: null },
]

const ADMINS = [
    { id: '666666666666', display_name: 'Lumen', role: 0, event_manager: true },
    { id: '333333333333', display_name: 'Orbit', role: 3, event_manager: false },
    { id: '444444444444', display_name: 'Vega', role: 1, event_manager: false },
]

function team(id: string, name: string, seed: number) {
    return { id, name, seed, status: 'registered' }
}

const CRIMSON = team('t1', 'Crimson Tide', 1)
const AZURE = team('t2', 'Azure Wave', 2)
const JADE = team('t3', 'Jade Runners', 3)
const AMBER = team('t4', 'Amber Lift Syndicate', 4)

interface MatchSeed {
    id: string
    a: ReturnType<typeof team>
    b: ReturnType<typeof team>
    status: string
    ordinal: number
    at?: string | null
    score?: [number, number]
    streamer?: typeof STREAMERS[number] | null
    admin?: typeof ADMINS[number] | null
}

function match(seed: MatchSeed) {
    return {
        id: seed.id,
        stage_id: 'stage-groups',
        group_id: null,
        round_no: 1,
        round_label: null,
        ordinal: seed.ordinal,
        team_a: seed.a,
        team_b: seed.b,
        slot_a_label: null,
        slot_b_label: null,
        best_of: 4,
        caps_to_win: 2,
        mode: 'first_to',
        status: seed.status,
        winner_team_id: null,
        is_draw: false,
        score_a: seed.score?.[0] ?? null,
        score_b: seed.score?.[1] ?? null,
        caps_a: null,
        caps_b: null,
        deaths_a: null,
        deaths_b: null,
        scheduled_at: seed.at ?? null,
        resolved_window: { opens_at: null, closes_at: null },
        stream_url: null,
        notes: null,
        published: true,
        winner_to_match_id: null,
        winner_to_slot: null,
        loser_to_match_id: null,
        loser_to_slot: null,
        pick_ban_status: 'none',
        maps: [],
        streamer: seed.streamer ?? null,
        match_admin: seed.admin ?? null,
    }
}

const MATCHES = [
    match({ id: 'm-staffed', a: CRIMSON, b: AZURE, status: 'scheduled', ordinal: 0, at: '2026-10-02 20:00:00', streamer: STREAMERS[0], admin: ADMINS[2] }),
    match({ id: 'm-bare', a: JADE, b: AMBER, status: 'pending', ordinal: 1 }),
    match({ id: 'm-done', a: CRIMSON, b: JADE, status: 'complete', ordinal: 2, score: [3, 1] }),
]

const BRACKET = {
    published: true,
    format: { template: null, spec: { version: 1, stages: [] } },
    stages: [{
        id: 'stage-groups',
        key: 'groups',
        name: 'Group Stage',
        kind: 'groups',
        ordinal: 0,
        status: 'active',
        published: true,
        expected_match_duration_minutes: 90,
        config: null,
        groups: [],
        entrants: [],
        matches: MATCHES,
    }],
}

interface Server {
    puts: { path: string; body: unknown }[]
}

async function mockApi(page: Page): Promise<Server> {
    const server: Server = { puts: [] }

    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '555555555555',
            username: 'rin',
            avatar: '',
            accessToken: 'matches-token',
            refreshToken: 'matches-refresh',
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
        const method = request.method()
        const staffWrite = path.match(new RegExp(`^/tournaments/${SLUG}/admin/matches/([\\w-]+)/(streamer|match-admin)$`))
        const matchRead = path.match(new RegExp(`^/tournaments/${SLUG}/matches/([\\w-]+)$`))

        if (staffWrite && method === 'PUT') {
            const body = request.postDataJSON() as { user_id: string | null }
            server.puts.push({ path, body })
            const pool: Array<{ id: string }> = staffWrite[2] === 'streamer' ? STREAMERS : ADMINS
            const picked = pool.find(person => person.id === body.user_id) ?? null
            const key = staffWrite[2] === 'streamer' ? 'streamer' : 'match_admin'
            await route.fulfill({ json: { success: true, data: { [key]: picked } } })
            return
        }
        if (matchRead) {
            await route.fulfill({ json: { success: true, data: { match: MATCHES.find(entry => entry.id === matchRead[1]) } } })
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
                    data: {
                        team: null, invitations: [], lfp: null, volunteer: null, pick_ban_session: null,
                        can_manage: true, can_manage_bracket: true, is_streamer: false,
                    },
                },
            })
            return
        }
        if (path === `/tournaments/${SLUG}/admin/streamers`) {
            await route.fulfill({ json: { success: true, data: { items: STREAMERS } } })
            return
        }
        if (path === `/tournaments/${SLUG}/admin/match-admins`) {
            await route.fulfill({ json: { success: true, data: { items: ADMINS } } })
            return
        }
        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: BRACKET } })
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

    return server
}

async function openMatches(page: Page) {
    await page.goto(`/events/${SLUG}?tab=manage`)
    await page.getByRole('button', { name: 'Matches', exact: true }).click()
    const section = page.getByRole('region', { name: 'Matches' })
    await expect(section.getByRole('heading', { name: 'Matches' })).toBeVisible()
    return section
}

test('the Matches tab lists the open matches with their match admin and streamer', async ({ page }) => {
    await mockApi(page)
    const section = await openMatches(page)

    await expect(section.getByText('Crimson Tide vs Azure Wave').first()).toBeVisible()
    await expect(section.getByText('Jade Runners vs Amber Lift Syndicate').first()).toBeVisible()
    await expect(section.getByText('Crimson Tide vs Jade Runners')).toHaveCount(0)
    await expect(section.getByRole('button', { name: 'Match admin: Vega' }).first()).toBeVisible()
    await expect(section.getByRole('button', { name: 'Streamer: Nova' }).first()).toBeVisible()
    await expect(section.getByRole('button', { name: /Without match admin\s*1/ })).toBeVisible()
})

test('a manager assigns a match admin from the staff list, which shows each role', async ({ page }) => {
    const server = await mockApi(page)
    const section = await openMatches(page)

    await section.getByRole('button', { name: 'Match admin: none' }).first().click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitemradio')).toHaveText([
        'No match admin', /Lumen\s*Event Manager/, /Orbit\s*Cup Admin/, /Vega\s*Moderator/,
    ])
    await menu.getByRole('menuitemradio', { name: /Orbit/ }).click()

    await expect(section.getByRole('button', { name: 'Match admin: Orbit' }).first()).toBeVisible()
    expect(server.puts).toEqual([{ path: `/tournaments/${SLUG}/admin/matches/m-bare/match-admin`, body: { user_id: ADMINS[1].id } }])
    await expect(section.getByRole('button', { name: /Without match admin\s*0/ })).toBeVisible()
})

test('a manager assigns a streamer from the same table', async ({ page }) => {
    const server = await mockApi(page)
    const section = await openMatches(page)

    await section.getByRole('button', { name: 'Streamer: none' }).first().click()
    await page.getByRole('menu').getByRole('menuitemradio', { name: 'Kestrel' }).click()

    await expect(section.getByRole('button', { name: 'Streamer: Kestrel' }).first()).toBeVisible()
    expect(server.puts).toEqual([{ path: `/tournaments/${SLUG}/admin/matches/m-bare/streamer`, body: { user_id: STREAMERS[1].id } }])
})

test('the staffing pills and filters narrow the list, and finished matches show their score', async ({ page }) => {
    await mockApi(page)
    const section = await openMatches(page)

    await section.getByRole('button', { name: /Without match admin/ }).click()
    await expect(section.getByText('Crimson Tide vs Azure Wave')).toHaveCount(0)
    await expect(section.getByText('Jade Runners vs Amber Lift Syndicate').first()).toBeVisible()

    await section.getByRole('button', { name: 'Staffing' }).click()
    await page.getByRole('menuitem', { name: 'Any staffing' }).click()
    await section.getByRole('button', { name: 'Status' }).click()
    await page.getByRole('menuitem', { name: 'Finished matches' }).click()
    await expect(section.getByText('Crimson Tide vs Jade Runners').first()).toBeVisible()
    await expect(section.getByText('3–1').first()).toBeVisible()

    await section.getByRole('button', { name: 'Status' }).click()
    await page.getByRole('menuitem', { name: 'All matches' }).click()
    await section.getByLabel('Search matches').fill('amber')
    await expect(section.getByText('Jade Runners vs Amber Lift Syndicate').first()).toBeVisible()
    await expect(section.getByText('Crimson Tide vs Jade Runners')).toHaveCount(0)
})

test('Edit opens the match editor for scores, times and links', async ({ page }) => {
    await mockApi(page)
    const section = await openMatches(page)

    await section.getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.getByRole('heading', { name: 'Crimson Tide vs Azure Wave' })).toBeVisible()
})

for (const width of [360, 390]) {
    test(`the Matches tab fits a ${width} px phone with its pickers tappable`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await mockApi(page)
        const section = await openMatches(page)

        await expect(section.getByRole('button', { name: 'Match admin: Vega' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
        const picker = await section.getByRole('button', { name: 'Match admin: none' }).boundingBox()
        expect(picker?.height ?? 0).toBeGreaterThanOrEqual(32)
    })
}
