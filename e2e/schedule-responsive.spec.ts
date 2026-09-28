import { expect, test, type Page } from '@playwright/test'

const SLUG = 'schedule-cup'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = Date.parse('2026-10-03T12:00:00Z')
const START_OF_TODAY = Math.floor(NOW / DAY) * DAY
const START_OF_TOMORROW = START_OF_TODAY + DAY

function bracketTime(instant: number): string {
    return new Date(instant).toISOString().slice(0, 19).replace('T', ' ')
}

const TEAMS = [
    { id: 'team-1', name: 'Respawn Repeat Regret', seed: 1, players: ['Kestrel', 'Moth'] },
    { id: 'team-2', name: 'Sandbagging Sorcerers', seed: 2, players: ['Brine', 'Quill'] },
    { id: 'team-3', name: 'Flag Runners United', seed: 3, players: ['Sparrow', 'Tundra'] },
    { id: 'team-4', name: 'Wall Jump Wizards', seed: 4, players: ['Ember', 'Zephyr'] },
    { id: 'team-5', name: 'Dodge Dynasty', seed: 5, players: ['Lynx', 'Onyx'] },
    { id: 'team-6', name: 'Cap or Nap', seed: 6, players: ['Pebble', 'Vapor'] },
    { id: 'team-7', name: 'Lift Lords', seed: 7, players: ['Cinder', 'Juniper'] },
    { id: 'team-8', name: 'Boost Brigade', seed: 8, players: ['Harbor', 'Nimbus'] },
]

function teamRef(id: string) {
    const team = TEAMS.find(candidate => candidate.id === id)
    if (!team) throw new Error(`Unknown team ${id}`)
    return { id: team.id, name: team.name, seed: team.seed, status: 'registered' }
}

const EVENT_TEAMS = TEAMS.map(team => ({
    id: team.id,
    tournament_id: 'event-1',
    name: team.name,
    captain: `${team.id}-p1`,
    status: 'registered',
    division: null,
    seed: team.seed,
    member_count: team.players.length,
    members: team.players.map((alias, index) => ({
        user: `${team.id}-p${index + 1}`,
        alias,
        flag: 'de',
        role: index === 0 ? 'captain' : 'member',
        status: 'active',
        joined_at: '2026-08-01T12:00:00',
        invited_at: null,
        timezone: 'Europe/Berlin',
        availability: 'Evenings',
    })),
    created_at: '2026-08-01T12:00:00',
}))

const LFP = [
    {
        user: 'free-agent-1',
        alias: 'Drifter',
        flag: 'nl',
        timezone: 'Europe/Amsterdam',
        availability: 'Weekends',
        note: 'Looking for a runner.',
        created_at: '2026-08-10T09:00:00',
    },
]

interface MatchSeed {
    id: string
    stage: string
    group?: string | null
    round: number
    ordinal: number
    a?: string | null
    b?: string | null
    slotA?: string | null
    slotB?: string | null
    status: 'pending' | 'scheduled' | 'live' | 'complete' | 'forfeit' | 'cancelled' | 'bye'
    at?: number | null
    score?: [number, number] | null
    winner?: string | null
    published?: boolean
    pickBan?: 'none' | 'lobby' | 'running' | 'paused' | 'complete'
    stream?: string | null
    roundLabel?: string | null
}

function match(seed: MatchSeed) {
    const [scoreA, scoreB] = seed.score ?? [null, null]
    return {
        id: seed.id,
        stage_id: seed.stage,
        group_id: seed.group ?? null,
        round_no: seed.round,
        round_label: seed.roundLabel ?? null,
        ordinal: seed.ordinal,
        team_a: seed.a ? teamRef(seed.a) : null,
        team_b: seed.b ? teamRef(seed.b) : null,
        slot_a_label: seed.slotA ?? null,
        slot_b_label: seed.slotB ?? null,
        best_of: 3,
        caps_to_win: 3,
        mode: 'first_to',
        status: seed.status,
        winner_team_id: seed.winner ?? null,
        is_draw: false,
        score_a: scoreA,
        score_b: scoreB,
        caps_a: scoreA === null ? null : scoreA * 3,
        caps_b: scoreB === null ? null : scoreB * 3,
        deaths_a: null,
        deaths_b: null,
        scheduled_at: seed.at == null ? null : bracketTime(seed.at),
        resolved_window: { opens_at: null, closes_at: null },
        stream_url: seed.stream ?? null,
        notes: null,
        published: seed.published ?? true,
        winner_to_match_id: null,
        winner_to_slot: null,
        loser_to_match_id: null,
        loser_to_slot: null,
        pick_ban_status: seed.pickBan ?? 'none',
        maps: [],
    }
}

function market(id: string, matchId: string) {
    return {
        id,
        match_id: matchId,
        stage_id: 'stage-groups',
        status: 'open',
        outcome: null,
        draws_allowed: true,
        price_a: 0.58,
        price_b: 0.42,
        price_draw: null,
        opening_price_a: 0.55,
        opening_price_b: 0.45,
        opening_price_draw: null,
        pool_stake: 4200,
        position_count: 3,
        liquidity_b: 9110,
        manual_override: null,
        closes_at: new Date(NOW + 2 * HOUR).toISOString(),
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        outcome_reason: null,
        result_key: 'open',
        your_position: null,
        team_a: teamRef('team-2'),
        team_b: teamRef('team-4'),
    }
}

const PREDICTIONS = {
    enabled: true,
    bracket_published: true,
    config: {
        enabled: true,
        initial_grant: 10000,
        min_stake: 10,
        max_stake_pct: 25,
        liquidity_b: 9110,
        close_buffer_seconds: 0,
        settlement_hold_minutes: 30,
        roster_bets_allowed: true,
        void_on_result_while_open: true,
        staff_only: false,
        updated_at: null,
    },
    stages: [{ id: 'stage-groups', stage_key: 'groups', name: 'Group Stage', kind: 'groups', ordinal: 0 }],
    markets: [market('market-today-a', 'today-a')],
    wallet: null,
}

function standing(teamId: string, rank: number, wins: number, losses: number) {
    return {
        team_id: teamId,
        team: teamRef(teamId),
        rank,
        seed: teamRef(teamId).seed,
        played: wins + losses,
        wins,
        draws: 0,
        losses,
        points: wins * 3,
        maps_won: wins * 2,
        maps_lost: losses * 2,
        map_diff: (wins - losses) * 2,
        caps_for: wins * 6,
        caps_against: losses * 6,
        caps_diff: (wins - losses) * 6,
        deaths: null,
    }
}

function entrant(teamId: string, groupId: string | null, wins: number, losses: number) {
    return {
        team_id: teamId,
        team: teamRef(teamId),
        group_id: groupId,
        seed: teamRef(teamId).seed,
        pot: null,
        source_rank: null,
        wins,
        losses,
        status: 'active',
        final_rank: null,
        rank_override: null,
        qualified_round: null,
    }
}

const GROUP_STAGE = {
    id: 'stage-groups',
    key: 'groups',
    name: 'Group Stage',
    kind: 'groups',
    ordinal: 0,
    status: 'active',
    published: true,
    expected_match_duration_minutes: null,
    config: {
        group_count: 2,
        group_size: 4,
        seeding: 'snake',
        double_round_robin: false,
        points: [
            { maps_won: 2, maps_lost: 0, points: 3 },
            { maps_won: 2, maps_lost: 1, points: 3 },
            { maps_won: 1, maps_lost: 2, points: 1 },
            { maps_won: 0, maps_lost: 2, points: 0 },
        ],
        tiebreakers: ['points', 'map_diff', 'head_to_head'],
    },
    groups: [
        {
            id: 'group-a',
            name: 'Group A',
            ordinal: 0,
            standings: [
                standing('team-1', 1, 1, 0),
                standing('team-3', 2, 1, 0),
                standing('team-2', 3, 0, 1),
                standing('team-4', 4, 0, 1),
            ],
        },
        {
            id: 'group-b',
            name: 'Group B',
            ordinal: 1,
            standings: [
                standing('team-5', 1, 1, 0),
                standing('team-7', 2, 1, 0),
                standing('team-6', 3, 0, 1),
                standing('team-8', 4, 0, 1),
            ],
        },
    ],
    entrants: [
        entrant('team-1', 'group-a', 1, 0),
        entrant('team-2', 'group-a', 0, 1),
        entrant('team-3', 'group-a', 1, 0),
        entrant('team-4', 'group-a', 0, 1),
        entrant('team-5', 'group-b', 1, 0),
        entrant('team-6', 'group-b', 0, 1),
        entrant('team-7', 'group-b', 1, 0),
        entrant('team-8', 'group-b', 0, 1),
    ],
    matches: [
        match({
            id: 'played-a-1', stage: 'stage-groups', group: 'group-a', round: 1, ordinal: 0, a: 'team-1', b: 'team-2',
            status: 'complete', at: START_OF_TODAY - 2 * DAY + 18 * HOUR, score: [2, 1], winner: 'team-1', pickBan: 'complete',
        }),
        match({
            id: 'played-a-2', stage: 'stage-groups', group: 'group-a', round: 1, ordinal: 1, a: 'team-3', b: 'team-4',
            status: 'complete', at: START_OF_TODAY - 2 * DAY + 20 * HOUR, score: [2, 0], winner: 'team-3',
        }),
        match({
            id: 'played-b-1', stage: 'stage-groups', group: 'group-b', round: 1, ordinal: 0, a: 'team-5', b: 'team-6',
            status: 'forfeit', at: START_OF_TODAY - 2 * DAY + 19 * HOUR, winner: 'team-5',
        }),
        match({
            id: 'played-b-2', stage: 'stage-groups', group: 'group-b', round: 1, ordinal: 1, a: 'team-7', b: 'team-8',
            status: 'complete', at: START_OF_TODAY - DAY + 19 * HOUR, score: [2, 1], winner: 'team-7',
            stream: 'https://www.twitch.tv/utbt_cup',
        }),
        match({
            id: 'live-a', stage: 'stage-groups', group: 'group-a', round: 2, ordinal: 0, a: 'team-1', b: 'team-3',
            status: 'live', at: NOW - 25 * MINUTE, score: [1, 0], pickBan: 'complete', stream: 'https://www.twitch.tv/utbt_cup',
        }),
        match({
            id: 'today-a', stage: 'stage-groups', group: 'group-a', round: 2, ordinal: 1, a: 'team-2', b: 'team-4',
            status: 'scheduled', at: NOW + 2 * HOUR, pickBan: 'lobby', stream: 'https://www.youtube.com/@utbt',
        }),
        match({
            id: 'today-b', stage: 'stage-groups', group: 'group-b', round: 2, ordinal: 0, a: 'team-5', b: 'team-7',
            status: 'scheduled', at: NOW + 4 * HOUR,
        }),
        match({
            id: 'unscheduled-b-1', stage: 'stage-groups', group: 'group-b', round: 2, ordinal: 1, a: 'team-6', b: 'team-8',
            status: 'pending', at: null,
        }),
        match({
            id: 'tomorrow-a', stage: 'stage-groups', group: 'group-a', round: 3, ordinal: 0, a: 'team-1', b: 'team-4',
            status: 'scheduled', at: START_OF_TOMORROW + 18 * HOUR,
        }),
        match({
            id: 'hidden-match-a', stage: 'stage-groups', group: 'group-a', round: 3, ordinal: 1, a: 'team-2', b: 'team-3',
            status: 'scheduled', at: START_OF_TOMORROW + 20 * HOUR, published: false,
        }),
        match({
            id: 'unscheduled-b-2', stage: 'stage-groups', group: 'group-b', round: 3, ordinal: 0, a: 'team-5', b: 'team-8',
            status: 'pending', at: null,
        }),
        match({
            id: 'cancelled-b', stage: 'stage-groups', group: 'group-b', round: 3, ordinal: 1, a: 'team-6', b: 'team-7',
            status: 'cancelled', at: START_OF_TOMORROW + 19 * HOUR,
        }),
    ],
}

const PLAYOFF_STAGE = {
    id: 'stage-playoffs',
    key: 'playoffs',
    name: 'Playoffs',
    kind: 'single_elim',
    ordinal: 1,
    status: 'pending',
    published: true,
    expected_match_duration_minutes: 90,
    config: null,
    groups: [],
    entrants: [],
    matches: [
        match({
            id: 'later-semi-1', stage: 'stage-playoffs', round: 1, ordinal: 0, slotA: 'Group A #1', slotB: 'Group B #2',
            status: 'scheduled', at: START_OF_TOMORROW + 3 * DAY + 19 * HOUR, roundLabel: 'Semi-final',
        }),
        match({
            id: 'later-semi-2', stage: 'stage-playoffs', round: 1, ordinal: 1, slotA: 'Group B #1', slotB: 'Group A #2',
            status: 'scheduled', at: START_OF_TOMORROW + 3 * DAY + 21 * HOUR, roundLabel: 'Semi-final',
        }),
        match({
            id: 'final', stage: 'stage-playoffs', round: 2, ordinal: 0, slotA: 'Winner Semi-final 1', slotB: 'Winner Semi-final 2',
            status: 'pending', at: null, roundLabel: 'Final',
        }),
    ],
}

const HIDDEN_STAGE = {
    id: 'stage-showmatch',
    key: 'showmatch',
    name: 'All-Star Showmatch',
    kind: 'single_elim',
    ordinal: 2,
    status: 'pending',
    published: false,
    expected_match_duration_minutes: null,
    config: null,
    groups: [],
    entrants: [
        entrant('team-1', null, 0, 0),
        entrant('team-5', null, 0, 0),
    ],
    matches: [
        match({
            id: 'hidden-stage-match', stage: 'stage-showmatch', round: 1, ordinal: 0, a: 'team-1', b: 'team-5',
            status: 'scheduled', at: START_OF_TOMORROW + 21 * HOUR,
        }),
    ],
}

const BRACKET = {
    published: true,
    format: { template: null, spec: null },
    stages: [GROUP_STAGE, PLAYOFF_STAGE, HIDDEN_STAGE],
}

const UNPUBLISHED_BRACKET = {
    published: false,
    format: { template: null, spec: null },
    stages: [],
}

const EVENT = {
    id: 'event-1',
    slug: SLUG,
    name: 'Schedule Cup 2026',
    summary: 'A cup for checking the public schedule.',
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
    team_count: TEAMS.length,
    registered_team_count: TEAMS.length,
    created_at: null,
    published_at: null,
    predictions_enabled: true,
}

const PERSONAL_PATHS = ['/me/schedule', `/tournaments/${SLUG}/me`, `/tournaments/${SLUG}/me/matches`]

test.use({ timezoneId: 'UTC' })

let bracketResponse: typeof BRACKET | typeof UNPUBLISHED_BRACKET = BRACKET
let personalRequests: string[] = []

test.beforeEach(async ({ page }) => {
    bracketResponse = BRACKET
    personalRequests = []
    await page.clock.setFixedTime(NOW)
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))

    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())

        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }

        const path = url.pathname.replace(/\/$/, '')

        if (PERSONAL_PATHS.includes(path)) {
            personalRequests.push(path)
            await route.fulfill({ status: 401, json: { success: false, error: 'Unauthorized' } })
            return
        }

        if (path === `/tournaments/${SLUG}`) {
            await route.fulfill({ json: { success: true, data: { tournament: EVENT } } })
            return
        }

        if (path === `/tournaments/${SLUG}/bracket`) {
            await route.fulfill({ json: { success: true, data: bracketResponse } })
            return
        }

        if (path === `/tournaments/${SLUG}/predictions`) {
            await route.fulfill({ json: { success: true, data: PREDICTIONS } })
            return
        }

        if (path === `/tournaments/${SLUG}/teams`) {
            await route.fulfill({ json: { success: true, data: { items: EVENT_TEAMS } } })
            return
        }

        if (path === `/tournaments/${SLUG}/lfp`) {
            await route.fulfill({ json: { success: true, data: { items: LFP } } })
            return
        }

        if (path === `/tournaments/${SLUG}/pick-ban/config`) {
            await route.fulfill({ json: { success: true, data: { stages: [] } } })
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
})

async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
}

test('a signed-out visitor lands on All Matches from a schedule link', async ({ page }) => {
    await page.goto(`/events/${SLUG}?tab=schedule`)

    await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toBeVisible()
    const allMatches = page.getByRole('region', { name: 'All Matches' })
    await expect(allMatches).toBeVisible()
    await expect(page.getByText('Times in UTC')).toBeVisible()

    await expect(page.getByRole('group', { name: 'Schedule view' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /My Matches/ })).toHaveCount(0)

    const liveNow = allMatches.getByRole('region', { name: 'Live Now' })
    await expect(liveNow).toBeVisible()
    await expect(liveNow).toContainText('Respawn Repeat Regret')
    await expect(liveNow).toContainText('Flag Runners United')

    const liveRow = liveNow.locator('> div')
    await expect(liveRow).toContainText('Live Now')
    await expect(liveRow.getByRole('link', { name: 'View Picks & Bans' })).toBeVisible()
    await expect(liveRow.getByRole('button', { name: 'Watch Stream' })).toBeVisible()

    const rowTimes = allMatches.locator('text=/^\\d{2}:\\d{2}$/')
    await expect(rowTimes).toHaveText(['11:35', '14:00', '16:00', '18:00', '19:00', '21:00'])

    const todaySection = allMatches.getByRole('region', { name: 'Today' })
    await expect(todaySection).toContainText('Sandbagging Sorcerers')
    await expect(todaySection).toContainText('Dodge Dynasty')
    const todayRows = todaySection.locator('> div')
    await expect(todayRows.nth(0)).toContainText('Starts in 2h 0m')
    await expect(todayRows.nth(0)).not.toContainText('Scheduled')
    await expect(todayRows.nth(0).getByRole('link', { name: 'Watch Picks & Bans' })).toBeVisible()
    await expect(todayRows.nth(1)).toContainText('Scheduled')
    await expect(allMatches.getByText(/58 ·/)).toHaveCount(0)

    const tomorrowSection = allMatches.getByRole('region', { name: 'Tomorrow' })
    await expect(tomorrowSection).toContainText('Wall Jump Wizards')

    await expect(allMatches.getByText('2 matches still need a time.')).toBeVisible()

    const playedSection = allMatches.getByRole('region', { name: 'Played matches' })
    const playedToggle = playedSection.getByRole('button', { name: /Show played matches/ })
    const playedRows = playedSection.locator('> div')
    await expect(playedToggle).toHaveText('Show played matches (4)')
    await expect(playedRows).toHaveCount(0)

    await playedToggle.click()
    await expect(playedRows).toHaveCount(4)
    await expect(playedRows.nth(0)).toContainText('Boost Brigade')
    await expect(playedRows.nth(1)).toContainText('Flag Runners United')
    await expect(playedRows.nth(2)).toContainText('Dodge Dynasty')
    await expect(playedRows.nth(2)).toContainText('Forfeit')
    await expect(playedRows.nth(3)).toContainText('Respawn Repeat Regret')

    await expect(allMatches.getByText('vs', { exact: true })).toHaveCount(10)

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    expect(personalRequests).toEqual([])
})

test('without a published stage a signed-out visitor falls back to Info', async ({ page }) => {
    bracketResponse = UNPUBLISHED_BRACKET
    const bracketRead = page.waitForResponse(response => new URL(response.url()).pathname.startsWith(`/tournaments/${SLUG}/bracket`))

    await page.goto(`/events/${SLUG}?tab=schedule`)
    await bracketRead

    await expect(page.getByText('More details coming soon.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teams', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'All Matches' })).toHaveCount(0)
    expect(personalRequests).toEqual([])
})
