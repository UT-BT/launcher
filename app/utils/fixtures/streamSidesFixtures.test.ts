import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    STREAM_SIDES_FIXTURES,
    streamSidesErrorFixture,
    streamSidesFixture,
    streamSidesFixtureResponse,
    type ContractPickBanState,
    type StreamSidesErrorFixtureName,
    type StreamSidesFixtureName,
    type StreamSidesSuccessFixtureName,
} from './streamSidesFixtures'
import {
    MATCH_SIDE_SOURCES,
    MATCH_SIDES_ERROR_CODES,
    PICK_BAN_CHOOSER_REASONS,
    PICK_BAN_ERROR_CODES,
    PICK_BAN_SIDE_ERROR_CODES,
    SIDE_COLORS,
    STREAM_SIDE_BLOCKED_REASONS,
    type MatchSides,
    type MatchSideStatus,
    type PickBanBlockingReason,
    type PickBanContractPhase,
    type PickBanSideBlock,
    type StreamSideControls,
} from '@/app/utils/api'
import type { PredictorFocusMarket, PredictorStandingsRow } from '@/app/components/stream/scenes/standings/predictorStandingsRead'

const FIXTURE_DIR = resolve(__dirname, 'streamSides')

const PINNED_SHA256: Record<string, string> = {
    'admin_match.json': 'a4afa7df91487482a6e7696392180379e68c280892188fc1619bc0878f687c3b',
    'betting_closed.json': '8702f7d907f52df25f9d1292381afbcb638fdce2db50749941ee1765b4019c34',
    'desk.json': 'b958b9777a9229f8ba6b152c2f66ac45df3af8974be90f849400d611cf5f42ce',
    'error_invalid_side.json': '7d9e332766469db64255ffaa0e6c2421a800a5e0631af9b56d7fc8dfb3049a4b',
    'error_pick_ban_in_progress.json': 'b2f6151c29fa07a420aaaa801753036e476af045249eb34a7e986ecd74eb8356',
    'error_side_not_open.json': 'eaa63b08b48f4928874b456790699d56a9975c526e5a07d2d5d23373f10a611d',
    'leaderboard.json': '05bd495d5dccb81a191902735b1e790cb19fafc005837abe760be23667d189b9',
    'me_matches.json': '6a4dab64118f6dc6ee5363686884a5688ab7a2989f9f923838515789bd2a23c8',
    'pick_ban_admin_set.json': 'ed7bd010fbd832e9a51e165ef417bd17ac840da48f8fec0fb0678775b5a88c52',
    'pick_ban_lobby.json': '177eb1692c5112a79642ff08fae1b667b89d710ae3a500722a50913a8146639f',
    'pick_ban_lobby_undetermined.json': '542b9f7216e78d14ad5ceaea303a38c29fc1125c874a6441c06abe8ec5000f80',
    'pick_ban_side_choice.json': '7f1607f539949e3e404a5cfa1ec30b51ec753a1167a5998daf6fcf436dce5d86',
    'pick_ban_side_spotlight.json': '36657dd4794c1e522b1976ad19b273db0243239ee8cf297cb3d46ceeb2f2131e',
    'predictor_standings.json': 'a8a26a0b20fc6e3b831deaf0345aac2d0391657dfd107620167959a343d70ba3',
    'predictor_standings_matchless.json': 'b70fe79c86d5f2e6df96ad53d9f30661ae782c471714fad6a99e362dc8e5c1bb',
    'stream_sides_put.json': '9cfd031c985dfcc00c5aaaee138470ed980c45f82f4335eac740975245f3bdfe',
    'stream_state.json': 'ec8da99b9d8288ad9c0ff6c2b1260839566fbbcdba6c4275b80633ae6679c0ef',
}

const PHASES = {
    lobby: true,
    intro: true,
    veto_choice: true,
    veto_spotlight: true,
    side_choice: true,
    side_spotlight: true,
    awaiting: true,
    spotlight: true,
    paused: true,
    complete: true,
    cancelled: true,
    voided: true,
} satisfies Record<PickBanContractPhase, true>

const SIDE_BLOCK_KEYS = {
    red: true,
    source: true,
    confirmed: true,
    set_at: true,
    changed_mid_veto: true,
    chooser: true,
    chooser_reason: true,
    chooser_basis: true,
    cards: true,
} satisfies Record<keyof PickBanSideBlock, true>

const SIDE_STATUS_KEYS = { confirmed: true, source: true } satisfies Record<keyof MatchSideStatus, true>

const SIDE_CONTROLS_KEYS = { can_swap: true, blocked_reason: true } satisfies Record<keyof StreamSideControls, true>

const MATCH_SIDES_KEYS = {
    red_team_id: true,
    blue_team_id: true,
    a_match_side: true,
    confirmed: true,
    source: true,
} satisfies Record<keyof MatchSides, true>

const STANDINGS_ROW_KEYS = {
    rank: true,
    user_id: true,
    display_name: true,
    avatar: true,
    title: true,
    net_worth: true,
    profit: true,
    bets_placed: true,
    positions_won: true,
    positions_lost: true,
    positions_refunded: true,
    pending: true,
    pending_count: true,
    movement: true,
    new: true,
} satisfies Record<keyof PredictorStandingsRow, true>

const FOCUS_MARKET_KEYS = {
    market_id: true,
    status: true,
    outcome: true,
    movement: true,
} satisfies Record<keyof PredictorFocusMarket, true>

const UNDETERMINED: PickBanBlockingReason = 'side_chooser_undetermined'

const PICK_BAN_NAMES = [
    'pickBanLobby',
    'pickBanLobbyUndetermined',
    'pickBanSideChoice',
    'pickBanSideSpotlight',
    'pickBanAdminSet',
] as const

const ERROR_CODES: Record<StreamSidesErrorFixtureName, string> = {
    errorPickBanInProgress: 'pick_ban_in_progress',
    errorInvalidSide: 'invalid_side',
    errorSideNotOpen: 'side_not_open',
}

const ALL_NAMES = Object.keys(STREAM_SIDES_FIXTURES) as StreamSidesFixtureName[]
const ERROR_NAMES = Object.keys(ERROR_CODES) as StreamSidesErrorFixtureName[]
const SUCCESS_NAMES = ALL_NAMES.filter((name) => !(name in ERROR_CODES)) as StreamSidesSuccessFixtureName[]

function fileText(name: StreamSidesFixtureName): string {
    return readFileSync(resolve(FIXTURE_DIR, STREAM_SIDES_FIXTURES[name].file), 'utf8')
}

function keysOf(value: object): string[] {
    return Object.keys(value).sort()
}

function expectSideBlock(side: PickBanSideBlock) {
    expect(keysOf(side)).toEqual(Object.keys(SIDE_BLOCK_KEYS).sort())
    if (side.source !== null) expect(MATCH_SIDE_SOURCES).toContain(side.source)
    if (side.chooser_reason !== null) expect(PICK_BAN_CHOOSER_REASONS).toContain(side.chooser_reason)
    expect(side.cards.map((card) => [card.color, card.letter])).toEqual([
        ['red', 'A'],
        ['blue', 'B'],
    ])
    for (const card of side.cards) expect(SIDE_COLORS).toContain(card.color)
}

describe('stream sides fixtures', () => {
    it('lists every fixture file once, and every file is pinned', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort()

        expect(ALL_NAMES.map((name) => STREAM_SIDES_FIXTURES[name].file).sort()).toEqual(onDisk)
        expect(Object.keys(PINNED_SHA256).sort()).toEqual(onDisk)
    })

    it.each(ALL_NAMES)('pins %s byte for byte', (name) => {
        const bytes = readFileSync(resolve(FIXTURE_DIR, STREAM_SIDES_FIXTURES[name].file))

        expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_SHA256[STREAM_SIDES_FIXTURES[name].file])
    })

    it.each(SUCCESS_NAMES)('%s sits inside the success envelope', (name) => {
        const body = JSON.parse(fileText(name))

        expect(keysOf(body)).toEqual(['data', 'success'])
        expect(body.success).toBe(true)
        expect(STREAM_SIDES_FIXTURES[name].status).toBe(200)
    })

    it.each(ERROR_NAMES)('%s is an error body with its code', (name) => {
        const body = streamSidesErrorFixture(name)

        expect(keysOf(body)).toEqual(['code', 'error', 'success'])
        expect(body.success).toBe(false)
        expect(body.code).toBe(ERROR_CODES[name])
        expect([...MATCH_SIDES_ERROR_CODES, ...PICK_BAN_ERROR_CODES, ...PICK_BAN_SIDE_ERROR_CODES]).toContain(body.code)
        expect(STREAM_SIDES_FIXTURES[name].status).toBeGreaterThanOrEqual(400)
    })

    it.each(PICK_BAN_NAMES)('%s carries the side block and can_choose_side, without the choose-A fields', (name) => {
        const state: ContractPickBanState = streamSidesFixture(name)

        expectSideBlock(state.side)
        expect(Object.keys(PHASES)).toContain(state.phase)
        expect(typeof state.capabilities.can_choose_side).toBe('boolean')
        expect(state.capabilities).not.toHaveProperty('can_choose_a')
        expect(state).not.toHaveProperty('chooser_side')
        expect(state).not.toHaveProperty('a_confirmed')
    })

    it.each(PICK_BAN_NAMES)('%s carries the veto keys for a stage without a veto', (name) => {
        const state = streamSidesFixture(name)

        expect(state.veto).toBeNull()
        expect(state.capabilities.can_veto).toBe(false)
        expect(state.pool.every((card) => card.pending_choice === false)).toBe(true)
        expect(state.pacing.veto_spotlight).toBe(7)
        expect(state.sequence).not.toHaveProperty('ban_down_order')
        expect(state.side.chooser_basis).toEqual(state.side.chooser === null ? null : { chooser: 9, other: 3 })
    })

    it('walks a lobby, an undetermined chooser, step 0 and an admin-set side', () => {
        const lobby = streamSidesFixture('pickBanLobby')
        const undetermined = streamSidesFixture('pickBanLobbyUndetermined')
        const choice = streamSidesFixture('pickBanSideChoice')
        const spotlight = streamSidesFixture('pickBanSideSpotlight')
        const adminSet = streamSidesFixture('pickBanAdminSet')

        expect([lobby.side.red, lobby.side.chooser, lobby.side.chooser_reason]).toEqual([null, 'team_b', 'lower_pre_cup_seed'])
        expect(lobby.blocking_reasons).not.toContain(UNDETERMINED)
        expect(undetermined.side.chooser).toBeNull()
        expect(undetermined.blocking_reasons).toEqual([UNDETERMINED])
        expect([choice.phase, choice.capabilities.can_choose_side]).toEqual(['side_choice', true])
        expect([spotlight.phase, spotlight.side.source, spotlight.side.confirmed]).toEqual(['side_spotlight', 'step0', true])
        expect([adminSet.phase, adminSet.side.source, adminSet.side.red]).toEqual(['awaiting', 'admin', 'team_b'])
    })

    it('sends side_status on the hot state and the desk, and side_controls on the desk', () => {
        const state = streamSidesFixture('streamState').match
        const desk = streamSidesFixture('desk').match

        expect(keysOf(state?.side_status ?? {})).toEqual(Object.keys(SIDE_STATUS_KEYS).sort())
        expect(state?.side_status).toEqual({ confirmed: false, source: null })
        expect(state).not.toHaveProperty('side_controls')
        expect(keysOf(desk?.side_status ?? {})).toEqual(Object.keys(SIDE_STATUS_KEYS).sort())
        expect(keysOf(desk?.side_controls ?? {})).toEqual(Object.keys(SIDE_CONTROLS_KEYS).sort())
        expect(STREAM_SIDE_BLOCKED_REASONS).toContain(desk?.side_controls.blocked_reason)
    })

    it('answers the Cams switch with the match sides', () => {
        const sides = streamSidesFixture('streamSidesPut')

        expect(keysOf(sides)).toEqual(Object.keys(MATCH_SIDES_KEYS).sort())
        expect(sides.red_team_id).not.toBe(sides.blue_team_id)
    })

    it('gives My Matches a side colour and match payloads their Red side', () => {
        const { items } = streamSidesFixture('meMatches')
        const { match } = streamSidesFixture('adminMatch')

        expect(items.filter((entry) => entry.roles.includes('player')).map((entry) => entry.side_color)).toEqual([
            'red',
            'blue',
            null,
        ])
        expect(items.every((entry) => 'red_team_id' in entry.match && 'red_side_source' in entry.match)).toBe(true)
        expect([match.team_a?.id, match.team_b?.id]).toContain(match.red_team_id)
        expect(match.red_side_source).toBe('admin')
    })

    it('shows projected standings with movement, pending rows and a newcomer', () => {
        const standings = streamSidesFixture('predictorStandings')
        const matchless = streamSidesFixture('predictorStandingsMatchless')

        for (const row of [...standings.items, ...matchless.items]) {
            expect(keysOf(row)).toEqual(Object.keys(STANDINGS_ROW_KEYS).sort())
        }
        expect(keysOf(standings.focus_market ?? {})).toEqual(Object.keys(FOCUS_MARKET_KEYS).sort())
        expect(standings.any_pending).toBe(true)
        expect(standings.items.some((row) => row.new && row.movement === null)).toBe(true)
        expect(standings.items.some((row) => (row.movement ?? 0) > 0)).toBe(true)
        expect(standings.items.some((row) => (row.movement ?? 0) < 0)).toBe(true)
        expect(matchless.focus_market).toBeNull()
        expect(matchless.items.every((row) => row.movement === null && !row.new)).toBe(true)
    })

    it('projects the leaderboard and marks pending rows', () => {
        const board = streamSidesFixture('leaderboard')

        expect(board.projected).toBe(true)
        expect(new Set(board.items.map((row) => row.pending))).toEqual(new Set([true, false]))
        expect(board.items.every((row) => row.pending === row.pending_count > 0)).toBe(true)
    })

    it('lists bettors by potential payout with no leaderboard and one side without odds', () => {
        const betting = streamSidesFixture('bettingClosed')
        const sides = betting.sides

        expect(betting).not.toHaveProperty('leaderboard')
        expect(sides).not.toBeNull()
        if (!sides) return
        for (const side of [sides.a, sides.b, sides.draw]) {
            const payouts = (side?.backers ?? []).map((backer) => backer.payout)
            expect(payouts).toEqual([...payouts].sort((left, right) => right - left))
        }
        expect([sides.a.odds, sides.b.odds, sides.draw?.odds].filter((odds) => odds === null)).toHaveLength(1)
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        streamSidesFixture('pickBanLobby').side.chooser = 'team_a'

        expect(streamSidesFixture('pickBanLobby').side.chooser).toBe('team_b')
    })

    it.each(ALL_NAMES)('builds a %s mock response with its status and body', async (name) => {
        const response = streamSidesFixtureResponse(name)

        expect(response.status).toBe(STREAM_SIDES_FIXTURES[name].status)
        expect(response.headers.get('Content-Type')).toBe('application/json')
        expect(await response.json()).toEqual(JSON.parse(fileText(name)))
    })
})
