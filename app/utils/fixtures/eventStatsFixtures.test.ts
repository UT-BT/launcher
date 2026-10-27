import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import matchDetailLinksFile from './eventStats/match_detail_links.json'
import overviewAllFile from './eventStats/overview_all.json'
import overviewStageEmptyFile from './eventStats/overview_stage_empty.json'
import overviewUnpublishedFile from './eventStats/overview_unpublished.json'
import reviewFile from './eventStats/review.json'
import teamFile from './eventStats/team.json'
import {
    EVENT_STATS_FIXTURES,
    eventStatsErrorFixture,
    eventStatsFixture,
    eventStatsFixtureResponse,
    type EventStatsFixtureName,
    type EventStatsSuccessFixtureName,
} from './eventStatsFixtures'
import {
    EVENT_CAP_FLAG_REASONS,
    EVENT_CAP_LINK_SOURCES,
    EVENT_STATS_MATCH_STATUSES,
    EVENT_STATS_RESULTS,
    EVENT_STATS_STANDINGS,
    SIDE_COLORS,
    fetchEventCapReview,
    fetchEventStats,
    fetchEventTeamStats,
    type EventCapReview,
    type EventCapReviewDetail,
    type EventCapReviewItem,
    type EventCapReviewTeam,
    type EventCapReviewWindow,
    type EventMatch,
    type EventMatchCapLink,
    type EventRun,
    type EventRunMember,
    type EventRunServer,
    type EventStats,
    type EventStatsBestDefence,
    type EventStatsBiggestUpset,
    type EventStatsFastestTeam,
    type EventStatsFirstBan,
    type EventStatsFormEntry,
    type EventStatsFurthestStage,
    type EventStatsMap,
    type EventStatsMostBanned,
    type EventStatsMostComebacks,
    type EventStatsMostPicked,
    type EventStatsPace,
    type EventStatsPaceRank,
    type EventStatsPathEntry,
    type EventStatsPicker,
    type EventStatsRecordHeld,
    type EventStatsRecords,
    type EventStatsStage,
    type EventStatsTeam,
    type EventStatsTeamMember,
    type EventStatsTeamRecord,
    type EventStatsTeamRun,
    type EventTeamMapProfileRow,
    type EventTeamRun,
    type EventTeamStats,
    type EventTeamStatsMap,
    type EventTeamStatsMatch,
    type EventTeamStatsOpponent,
    type EventTeamStatsPickBan,
    type EventTeamStatsPickBanStep,
    type EventTeamStatsVeto,
} from '@/app/utils/api'

type Loose<T> = T extends string
    ? string
    : T extends readonly (infer U)[]
      ? Loose<U>[]
      : T extends object
        ? { [K in keyof T]: Loose<T[K]> }
        : T

interface Envelope<T> {
    success: boolean
    data: Loose<T>
}

const TYPED_FILES = {
    overviewAll: overviewAllFile satisfies Envelope<EventStats>,
    overviewStageEmpty: overviewStageEmptyFile satisfies Envelope<EventStats>,
    overviewUnpublished: overviewUnpublishedFile satisfies Envelope<EventStats>,
    team: teamFile satisfies Envelope<EventTeamStats>,
    review: reviewFile satisfies Envelope<EventCapReview>,
    matchDetailLinks: matchDetailLinksFile satisfies Envelope<{ match: EventMatch }>,
}

const FIXTURE_DIR = resolve(__dirname, 'eventStats')

const PINNED_SHA256: Record<string, string> = {
    'match_detail_links.json': 'e3c65ed374171a52ddc645c40695d7540e5e2fe4a78c9d1ceabf31549ddd47d5',
    'overview_all.json': 'f565ed6e6942501f5974aa7daf74f547e509c2c6d4ad59783f1b7e22fa7a7ee9',
    'overview_stage_empty.json': '80e7e7fc9c92f2a33aaff9693053fa92ce4530370eb100b8deb5235f97e61023',
    'overview_unpublished.json': '88d3a9c6b2e602e3126fd6a102c8c12d0dbe15157f1250ae32021594fdd78903',
    'review.json': '76967b704e83c9485e70e3f570454d398b4d9e642246ab9b8cb27b67aecc92f3',
    'team.json': '16e088c84dc8ad7b0122ae0ef74451315d41d965c32d82335102cc5bdfdc987e',
    'team_not_found.json': '0cea29759987a054bb8ba3bb30edbd0c08c3ffb603938348ee972fe00ea6299d',
}

const MAP_NAMES = [
    'CTF-BT-II-(K)LegendsV4',
    'CTF-BT-II-AztecCE',
    'CTF-BT-II-CoZyliciouS',
    'CTF-BT-II-DoubleVision-CE',
    'CTF-BT-II-Extant',
    'CTF-BT-II-FaithCB',
    'CTF-BT-II-FleurdelysV2',
    'CTF-BT-II-FuriumMineCE2',
    'CTF-BT-II-Pacey-CE',
    'CTF-BT-II-SkaarjInvasion-vF2',
]

const RUN_KEYS = {
    team_run_id: true,
    team_cap_id: true,
    team_time_seconds: true,
    completed_at: true,
    server: true,
    members: true,
    has_ghost: true,
    has_demo: true,
} satisfies Record<keyof EventRun, true>

const SERVER_KEYS = { id: true, name: true, region: true } satisfies Record<keyof EventRunServer, true>

const RUN_MEMBER_KEYS = { user: true, alias: true, cap_id: true, cap_time_seconds: true } satisfies Record<keyof EventRunMember, true>

const STATS_KEYS = { published: true, stage: true, stages: true, teams: true, maps: true, records: true } satisfies Record<
    keyof EventStats,
    true
>

const STAGE_KEYS = { key: true, name: true, kind: true, status: true } satisfies Record<keyof EventStatsStage, true>

const TEAM_KEYS = {
    id: true,
    name: true,
    status: true,
    seed: true,
    members: true,
    standing: true,
    furthest_stage: true,
    path: true,
    record: true,
    form: true,
    pace: true,
    comebacks: true,
    records_held: true,
} satisfies Record<keyof EventStatsTeam, true>

const TEAM_MEMBER_KEYS = { user: true, alias: true, flag: true } satisfies Record<keyof EventStatsTeamMember, true>

const FURTHEST_KEYS = { key: true, name: true, order: true } satisfies Record<keyof EventStatsFurthestStage, true>

const PATH_KEYS = { stage_key: true, stage_name: true, group: true, finish: true, advanced_to: true } satisfies Record<
    keyof EventStatsPathEntry,
    true
>

const TEAM_RECORD_KEYS = { matches: true, maps: true, caps: true } satisfies Record<keyof EventStatsTeamRecord, true>

const FORM_KEYS = { result: true, match_id: true, opponent_id: true } satisfies Record<keyof EventStatsFormEntry, true>

const PACE_KEYS = { value: true, runs: true } satisfies Record<keyof EventStatsPace, true>

const RECORD_HELD_KEYS = { map: true, display_name: true, run: true } satisfies Record<keyof EventStatsRecordHeld, true>

const MAP_KEYS = {
    map: true,
    display_name: true,
    played: true,
    picks: true,
    bans: true,
    first_bans: true,
    deciders: true,
    picker_wins: true,
    picker_games: true,
    picker_win_rate: true,
    fastest_run: true,
} satisfies Record<keyof EventStatsMap, true>

const TEAM_RUN_KEYS = { ...RUN_KEYS, team_id: true } satisfies Record<keyof EventStatsTeamRun, true>

const RECORDS_KEYS = {
    most_picked: true,
    most_banned: true,
    first_ban: true,
    picker: true,
    fastest_team: true,
    best_defence: true,
    biggest_upset: true,
    most_comebacks: true,
} satisfies Record<keyof EventStatsRecords, true>

const RECORD_SHAPES: { [K in keyof EventStatsRecords]: Record<string, true> } = {
    most_picked: { map: true, display_name: true, picks: true, played: true } satisfies Record<keyof EventStatsMostPicked, true>,
    most_banned: { map: true, display_name: true, bans: true, first_bans: true } satisfies Record<keyof EventStatsMostBanned, true>,
    first_ban: { map: true, display_name: true, first_bans: true, played: true } satisfies Record<keyof EventStatsFirstBan, true>,
    picker: { wins: true, games: true, rate: true } satisfies Record<keyof EventStatsPicker, true>,
    fastest_team: { team_id: true, value: true, runs: true } satisfies Record<keyof EventStatsFastestTeam, true>,
    best_defence: { team_id: true, caps_against: true, maps: true } satisfies Record<keyof EventStatsBestDefence, true>,
    biggest_upset: {
        match_id: true,
        winner_id: true,
        loser_id: true,
        winner_seed: true,
        loser_seed: true,
        seed_gap: true,
        score: true,
        stage_name: true,
    } satisfies Record<keyof EventStatsBiggestUpset, true>,
    most_comebacks: { team_id: true, count: true } satisfies Record<keyof EventStatsMostComebacks, true>,
}

const TEAM_STATS_KEYS = { team: true, pace_rank: true, matches: true, map_profile: true, runs: true } satisfies Record<
    keyof EventTeamStats,
    true
>

const PACE_RANK_KEYS = { rank: true, of: true } satisfies Record<keyof EventStatsPaceRank, true>

const MATCH_KEYS = {
    id: true,
    stage_key: true,
    stage_name: true,
    group: true,
    round_label: true,
    status: true,
    scheduled_at: true,
    opponent: true,
    own_side: true,
    score: true,
    result: true,
    pick_ban: true,
    maps: true,
} satisfies Record<keyof EventTeamStatsMatch, true>

const OPPONENT_KEYS = { id: true, name: true, seed: true, members: true } satisfies Record<keyof EventTeamStatsOpponent, true>

const PICK_BAN_KEYS = { steps: true, veto: true, side_chooser_team_id: true } satisfies Record<keyof EventTeamStatsPickBan, true>

const STEP_KEYS = {
    index: true,
    action: true,
    segment: true,
    team_id: true,
    map: true,
    display_name: true,
    acted_by: true,
} satisfies Record<keyof EventTeamStatsPickBanStep, true>

const VETO_KEYS = { outcome: true, vetoed_by_team_id: true } satisfies Record<keyof EventTeamStatsVeto, true>

const TEAM_MAP_KEYS = {
    ordinal: true,
    map: true,
    display_name: true,
    kind: true,
    picked_by: true,
    played: true,
    caps_for: true,
    caps_against: true,
    result: true,
    runs_for: true,
    runs_against: true,
    unrecorded_for: true,
    unrecorded_against: true,
} satisfies Record<keyof EventTeamStatsMap, true>

const PROFILE_KEYS = {
    map: true,
    display_name: true,
    picked: true,
    banned_by: true,
    banned_against: true,
    played: true,
    w: true,
    d: true,
    l: true,
    caps_for: true,
    caps_against: true,
    best_run: true,
} satisfies Record<keyof EventTeamMapProfileRow, true>

const TEAM_RUN_ROW_KEYS = {
    ...RUN_KEYS,
    map: true,
    display_name: true,
    match_id: true,
    stage_key: true,
    stage_name: true,
    opponent_id: true,
} satisfies Record<keyof EventTeamRun, true>

const REVIEW_ITEM_KEYS = {
    match_id: true,
    stage_key: true,
    round_label: true,
    team_a: true,
    team_b: true,
    ordinal: true,
    map: true,
    display_name: true,
    expected: true,
    linked: true,
    reason: true,
    detail: true,
    window: true,
} satisfies Record<keyof EventCapReviewItem, true>

const REVIEW_TEAM_KEYS = { id: true, name: true } satisfies Record<keyof EventCapReviewTeam, true>

const DETAIL_KEYS = { side: true, found: true, expected: true } satisfies Record<keyof EventCapReviewDetail, true>

const WINDOW_KEYS = { from: true, to: true } satisfies Record<keyof EventCapReviewWindow, true>

const LINK_KEYS = {
    cap_id: true,
    side: true,
    user: true,
    alias: true,
    map: true,
    cap_time_seconds: true,
    added: true,
    source: true,
    team_run_id: true,
    team_cap_id: true,
    team_time_seconds: true,
    has_ghost: true,
    has_demo: true,
} satisfies Record<keyof EventMatchCapLink, true>

const OVERVIEW_NAMES = ['overviewAll', 'overviewStageEmpty', 'overviewUnpublished'] as const

const ALL_NAMES = Object.keys(EVENT_STATS_FIXTURES) as EventStatsFixtureName[]
const SUCCESS_NAMES = ALL_NAMES.filter((name) => name !== 'teamNotFound') as EventStatsSuccessFixtureName[]

function fileText(name: EventStatsFixtureName): string {
    return readFileSync(resolve(FIXTURE_DIR, EVENT_STATS_FIXTURES[name].file), 'utf8')
}

function keysOf(value: object): string[] {
    return Object.keys(value).sort()
}

function expectKeys(value: object, keys: object) {
    expect(keysOf(value)).toEqual(keysOf(keys))
}

function expectRun(run: EventRun, keys: object = RUN_KEYS) {
    expectKeys(run, keys)
    if (run.server !== null) expectKeys(run.server, SERVER_KEYS)
    for (const member of run.members) expectKeys(member, RUN_MEMBER_KEYS)
    expect(run.members.map((member) => member.cap_time_seconds)).toContain(run.team_time_seconds)
}

function expectMapRef(value: { map: string; display_name: string }) {
    expect(MAP_NAMES).toContain(value.map)
    expect(`CTF-BT-${value.display_name}`).toBe(value.map)
}

function expectTeam(team: EventStatsTeam) {
    expectKeys(team, TEAM_KEYS)
    expect(EVENT_STATS_STANDINGS).toContain(team.standing)
    for (const member of team.members) expectKeys(member, TEAM_MEMBER_KEYS)
    expectKeys(team.furthest_stage, FURTHEST_KEYS)
    for (const entry of team.path) expectKeys(entry, PATH_KEYS)
    expectKeys(team.record, TEAM_RECORD_KEYS)
    for (const entry of team.form) {
        expectKeys(entry, FORM_KEYS)
        expect(EVENT_STATS_RESULTS).toContain(entry.result)
    }
    if (team.pace !== null) expectKeys(team.pace, PACE_KEYS)
    expect(team.records_held.count).toBe(team.records_held.maps.length)
    for (const held of team.records_held.maps) {
        expectKeys(held, RECORD_HELD_KEYS)
        expectMapRef(held)
        expectRun(held.run)
    }
}

function expectOverview(stats: EventStats) {
    expectKeys(stats, STATS_KEYS)
    expectKeys(stats.records, RECORDS_KEYS)
    for (const stage of stats.stages) expectKeys(stage, STAGE_KEYS)
    for (const team of stats.teams) expectTeam(team)
    for (const row of stats.maps) {
        expectKeys(row, MAP_KEYS)
        expectMapRef(row)
        if (row.fastest_run !== null) expectRun(row.fastest_run, TEAM_RUN_KEYS)
    }
    for (const key of Object.keys(RECORDS_KEYS) as (keyof EventStatsRecords)[]) {
        const entry = stats.records[key]
        if (entry !== null) expectKeys(entry, RECORD_SHAPES[key])
    }
}

function expectMatch(match: EventTeamStatsMatch) {
    expectKeys(match, MATCH_KEYS)
    expect(EVENT_STATS_MATCH_STATUSES).toContain(match.status)
    if (match.own_side !== null) expect(SIDE_COLORS).toContain(match.own_side)
    if (match.result !== null) expect(EVENT_STATS_RESULTS).toContain(match.result)
    if (match.opponent !== null) {
        expectKeys(match.opponent, OPPONENT_KEYS)
        for (const member of match.opponent.members) expectKeys(member, TEAM_MEMBER_KEYS)
    }
    if (match.pick_ban !== null) {
        expectKeys(match.pick_ban, PICK_BAN_KEYS)
        if (match.pick_ban.veto !== null) expectKeys(match.pick_ban.veto, VETO_KEYS)
        for (const step of match.pick_ban.steps) {
            expectKeys(step, STEP_KEYS)
            expectMapRef(step)
        }
    }
    for (const row of match.maps) {
        expectKeys(row, TEAM_MAP_KEYS)
        expectMapRef(row)
        if (row.result !== null) expect(EVENT_STATS_RESULTS).toContain(row.result)
        for (const run of [...row.runs_for, ...row.runs_against]) expectRun(run)
    }
}

function lastUrl(fetchMock: ReturnType<typeof vi.fn>) {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
    return { url, headers: init.headers as { [key: string]: string } }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('event stats fixtures', () => {
    it('lists every fixture file once, and every file is pinned', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort()

        expect(ALL_NAMES.map((name) => EVENT_STATS_FIXTURES[name].file).sort()).toEqual(onDisk)
        expect(Object.keys(PINNED_SHA256).sort()).toEqual(onDisk)
    })

    it.each(ALL_NAMES)('pins %s byte for byte', (name) => {
        const bytes = readFileSync(resolve(FIXTURE_DIR, EVENT_STATS_FIXTURES[name].file))

        expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_SHA256[EVENT_STATS_FIXTURES[name].file])
    })

    it.each(SUCCESS_NAMES)('%s sits inside the success envelope and type-checks', (name) => {
        const body = JSON.parse(fileText(name))

        expect(keysOf(body)).toEqual(['data', 'success'])
        expect(body.success).toBe(true)
        expect(EVENT_STATS_FIXTURES[name].status).toBe(200)
        expect(TYPED_FILES[name]).toEqual(body)
    })

    it('answers an unknown team with the not-found error body', () => {
        const body = eventStatsErrorFixture('teamNotFound')

        expect(keysOf(body)).toEqual(['error', 'success'])
        expect(body.success).toBe(false)
        expect(typeof body.error).toBe('string')
        expect(EVENT_STATS_FIXTURES.teamNotFound.status).toBe(404)
    })

    it.each(OVERVIEW_NAMES)('%s parses into the overview types', (name) => {
        expectOverview(eventStatsFixture(name))
    })

    it('shows a draw, a team without pace, a team ahead of the generated stages and every headline', () => {
        const stats = eventStatsFixture('overviewAll')
        const stageKeys = stats.stages.map((stage) => stage.key)
        const ahead = stats.teams.filter((team) => !stageKeys.includes(team.furthest_stage.key))

        expect(stats.teams.length).toBeGreaterThanOrEqual(4)
        expect(stats.teams.some((team) => team.record.matches.d > 0 && team.form.some((entry) => entry.result === 'D'))).toBe(true)
        expect(stats.teams.some((team) => team.pace === null)).toBe(true)
        expect(ahead.length).toBeGreaterThan(0)
        expect(ahead.every((team) => team.standing === 'alive')).toBe(true)
        expect(Object.values(stats.records).every((entry) => entry !== null)).toBe(true)
    })

    it('resolves every team the overview mentions', () => {
        const stats = eventStatsFixture('overviewAll')
        const ids = new Set(stats.teams.map((team) => team.id))
        const { records } = stats

        expect(stats.teams.every((team) => team.form.every((entry) => ids.has(entry.opponent_id)))).toBe(true)
        expect(stats.maps.every((row) => row.fastest_run === null || ids.has(row.fastest_run.team_id))).toBe(true)
        expect(
            [
                records.fastest_team?.team_id,
                records.best_defence?.team_id,
                records.biggest_upset?.winner_id,
                records.biggest_upset?.loser_id,
                records.most_comebacks?.team_id,
            ].every((id) => id !== undefined && ids.has(id)),
        ).toBe(true)
    })

    it('gives a stage with no played matches zero records and no headlines', () => {
        const stats = eventStatsFixture('overviewStageEmpty')

        expect(stats.stage).not.toBeNull()
        expect(stats.teams.length).toBeGreaterThan(0)
        expect(stats.maps).toEqual([])
        for (const team of stats.teams) {
            expect(team.record).toEqual({ matches: { w: 0, d: 0, l: 0 }, maps: { w: 0, d: 0, l: 0 }, caps: { for: 0, against: 0 } })
            expect([team.form, team.pace, team.comebacks, team.records_held]).toEqual([[], null, 0, { count: 0, maps: [] }])
        }
        expect(Object.values(stats.records).every((entry) => entry === null)).toBe(true)
    })

    it('sends nothing but the flag for an unpublished bracket', () => {
        const stats = eventStatsFixture('overviewUnpublished')

        expect([stats.published, stats.stage, stats.stages, stats.teams, stats.maps]).toEqual([false, null, [], [], []])
        expect(Object.values(stats.records).every((entry) => entry === null)).toBe(true)
    })

    it('parses the team page into its types, with the overview entry as its header', () => {
        const page = eventStatsFixture('team')

        expectKeys(page, TEAM_STATS_KEYS)
        expectTeam(page.team)
        expect(eventStatsFixture('overviewAll').teams).toContainEqual(page.team)
        expect(page.pace_rank).not.toBeNull()
        if (page.pace_rank) expectKeys(page.pace_rank, PACE_RANK_KEYS)
        for (const match of page.matches) expectMatch(match)
        for (const row of page.map_profile) {
            expectKeys(row, PROFILE_KEYS)
            expectMapRef(row)
            if (row.best_run !== null) expectRun(row.best_run)
        }
        for (const run of page.runs) {
            expectRun(run, TEAM_RUN_ROW_KEYS)
            expectMapRef(run)
        }
    })

    it('covers a full pick/ban, unrecorded caps, an unplayed map, a drawn map, and live and scheduled matches', () => {
        const page = eventStatsFixture('team')
        const complete = page.matches.filter((match) => match.status === 'complete')
        const maps: EventTeamStatsMap[] = complete.flatMap((match) => match.maps)

        expect(complete.every((match) => (match.pick_ban?.steps.length ?? 0) > 0)).toBe(true)
        expect(complete.some((match) => match.maps.filter((row) => row.played).length >= 2)).toBe(true)
        expect(maps.some((row) => row.unrecorded_against > 0)).toBe(true)
        expect(maps.some((row) => !row.played && row.result === null)).toBe(true)
        expect(maps.some((row) => row.result === 'D')).toBe(true)
        expect(page.map_profile.some((row) => row.best_run === null)).toBe(true)
        for (const status of ['live', 'scheduled'] as const) {
            const match = page.matches.find((entry) => entry.status === status)
            expect([match?.score, match?.result, match?.pick_ban, match?.maps]).toEqual([null, null, null, []])
        }
    })

    it('lists one caps-need-linking row per reason, with detail and window only where they apply', () => {
        const { items } = eventStatsFixture('review')

        expect(items.map((item) => item.reason).sort()).toEqual([...EVENT_CAP_FLAG_REASONS].sort())
        for (const item of items) {
            expectKeys(item, REVIEW_ITEM_KEYS)
            expectKeys(item.team_a, REVIEW_TEAM_KEYS)
            expectKeys(item.team_b, REVIEW_TEAM_KEYS)
            expectMapRef(item)
            expect(item.detail !== null).toBe(item.reason === 'too_few_runs')
            expect(item.window === null).toBe(item.reason === 'no_window')
            if (item.detail) expectKeys(item.detail, DETAIL_KEYS)
            if (item.window) expectKeys(item.window, WINDOW_KEYS)
        }
    })

    it('gives every match cap link the run fields, with one map holding two linked team runs', () => {
        const { match } = eventStatsFixture('matchDetailLinks')
        const maps = match.maps ?? []
        const links = maps.flatMap((row) => row.caps ?? [])
        const twoRuns = maps.filter((row) => row.caps?.length === 4 && new Set(row.caps.map((link) => link.team_run_id)).size === 2)

        expect(links.length).toBeGreaterThan(0)
        for (const link of links) {
            expectKeys(link, LINK_KEYS)
            expect(EVENT_CAP_LINK_SOURCES).toContain(link.source)
        }
        expect(twoRuns).toHaveLength(1)
        expect(new Set(links.map((link) => link.source))).toEqual(new Set(EVENT_CAP_LINK_SOURCES))
    })

    it('still reads a cap link that has none of the run fields', () => {
        const link: EventMatchCapLink = {
            cap_id: 'c1',
            side: 'a',
            user: '1',
            alias: null,
            map: null,
            cap_time_seconds: null,
            added: null,
        }

        expect(link.source).toBeUndefined()
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        const page = eventStatsFixture('team')
        page.team.name = 'Changed'

        expect(eventStatsFixture('team').team.name).not.toBe('Changed')
    })

    it.each(ALL_NAMES)('builds a %s mock response with its status and body', async (name) => {
        const response = eventStatsFixtureResponse(name)

        expect(response.status).toBe(EVENT_STATS_FIXTURES[name].status)
        expect(response.headers.get('Content-Type')).toBe('application/json')
        expect(await response.json()).toEqual(JSON.parse(fileText(name)))
    })
})

describe('event stats fetchers', () => {
    it('reads the overview for every stage, or for one', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(eventStatsFixtureResponse('overviewAll')))
        vi.stubGlobal('fetch', fetchMock)

        expect(await fetchEventStats('', 'cup 2026')).toEqual(eventStatsFixture('overviewAll'))
        expect(lastUrl(fetchMock).url).toMatch(/\/tournaments\/cup%202026\/stats$/)
        await fetchEventStats('', 'cup 2026', 'playoffs')
        expect(lastUrl(fetchMock).url).toMatch(/\/tournaments\/cup%202026\/stats\?stage=playoffs$/)
        await fetchEventStats('', 'cup 2026', null)
        expect(lastUrl(fetchMock).url).toMatch(/\/stats$/)
    })

    it('reads a team page with an optional stage, and fails on an unknown team', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(eventStatsFixtureResponse('team')))
        vi.stubGlobal('fetch', fetchMock)

        expect(await fetchEventTeamStats('', 'cup', 'team/1')).toEqual(eventStatsFixture('team'))
        expect(lastUrl(fetchMock).url).toMatch(/\/tournaments\/cup\/teams\/team%2F1\/stats$/)
        await fetchEventTeamStats('', 'cup', 'team/1', 'groups')
        expect(lastUrl(fetchMock).url).toMatch(/\/teams\/team%2F1\/stats\?stage=groups$/)

        fetchMock.mockImplementation(() => Promise.resolve(eventStatsFixtureResponse('teamNotFound')))
        await expect(fetchEventTeamStats('', 'cup', 'nobody')).rejects.toMatchObject({
            name: 'ApiError',
            status: 404,
            serverMessage: eventStatsErrorFixture('teamNotFound').error,
        })
    })

    it('reads the caps-need-linking rows with the manager token', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(eventStatsFixtureResponse('review')))
        vi.stubGlobal('fetch', fetchMock)

        expect(await fetchEventCapReview('token', 'cup')).toEqual(eventStatsFixture('review').items)
        expect(lastUrl(fetchMock).url).toMatch(/\/tournaments\/cup\/admin\/caps\/review$/)
        expect(lastUrl(fetchMock).headers.Authorization).toBe('Bearer token')
        await fetchEventCapReview('token', 'cup', 'groups')
        expect(lastUrl(fetchMock).url).toMatch(/\/admin\/caps\/review\?stage=groups$/)
    })
})
