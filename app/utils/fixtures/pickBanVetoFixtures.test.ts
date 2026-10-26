import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    PICK_BAN_VETO_FIXTURES,
    pickBanVetoErrorFixture,
    pickBanVetoFixture,
    pickBanVetoFixtureResponse,
    type ContractVetoExclusion,
    type ContractVetoPickBanState,
    type ContractVetoPoolCard,
    type ContractVetoSideBlock,
    type PickBanVetoErrorFixtureName,
    type PickBanVetoFixtureName,
    type PickBanVetoSuccessFixtureName,
} from './pickBanVetoFixtures'
import {
    MATCH_EDITOR_SIDE_ERROR_CODES,
    PICK_BAN_CONTRACT_CHOOSER_REASONS,
    PICK_BAN_EXCLUSION_MODES,
    PICK_BAN_SIDE_PHASES,
    PICK_BAN_VETO_CHOICES,
    PICK_BAN_VETO_ERROR_CODES,
    PICK_BAN_VETO_OUTCOMES,
    PICK_BAN_VETO_PHASES,
    type PickBanActor,
    type PickBanBlock,
    type PickBanCapabilities,
    type PickBanChooserBasis,
    type PickBanContractPacing,
    type PickBanExclusionRule,
    type PickBanPlayoffRecord,
    type PickBanSequence,
    type PickBanStageConfig,
    type PickBanVeto,
    type PickBanVetoPoolSizes,
} from '@/app/utils/api'

const FIXTURE_DIR = resolve(__dirname, 'pickBanVeto')

const PINNED_SHA256: Record<string, string> = {
    'error_already_chosen.json': 'd191687213ffeea611be6a61c558b7fee05d38c401a9a7131a48ccf24da26a71',
    'error_side_locked.json': 'd075b6b00913308e7bfe8d333902d3ca0d8b6d9d923c05b5a02f3c509fe962e4',
    'error_veto_choice_active.json': 'b78f51ed35afeb7b0c33cad40c39debd65b2d798afb25677ae2e5057654f1ca2',
    'error_veto_not_open.json': '21bdcbad4eea132a2cd141c2e144231b9211453b1a54e16c3494a1d6791ee7e1',
    'pick_ban_config.json': '43f123ffa62072a399c62ee24fe23663599770f15b80049a3948f00305691cac',
    'pick_ban_direct_qualifier.json': '2c33f76c88763c365690c9fbf3e32774b2cf8473558763a91e95a9e6f6b175ef',
    'pick_ban_lobby_veto.json': 'c1d39cde58e6fa1cc48ddd342b21b653d110ad5ab0cda5fbd49dacb3da056c51',
    'pick_ban_no_veto.json': '9326d470bd9839efd9d38c4026cb698c583a3213d3a9428075f59fab240d1252',
    'pick_ban_side_choice_after_veto.json': '03c6b6db716d50b49ad04998c0620fcb807128249f369c26dd42d63db3e3531f',
    'pick_ban_veto_choice.json': '1a904a8cc104c9c4e7dde8b2eefc1541f3b5298778ed4ebab7f55c590c1e598c',
    'pick_ban_veto_spotlight_played.json': 'e3ca314aea8aaf710c0efe73b2cf7bd8e06cc0cccb0a5b10cf247ffffca45541',
    'pick_ban_veto_spotlight_vetoed.json': 'd4001a1a45c4082b2e7039efeac4411185611d9baee43e196b65a365a2f81678',
}

const HARD_MAPS = ['Diplopia-V4', 'FuriumMineCE2', 'InventionCE2', 'Synchronize-vF2']

const BAN_DOWN_ORDER: PickBanActor[] = ['A', 'B', 'B', 'A']

const STATE_KEYS = {
    id: true,
    status: true,
    phase: true,
    phase_ends_at: true,
    intro_ends_at: true,
    spotlight_ends_at: true,
    version: true,
    server_now: true,
    match: true,
    sequence: true,
    plan: true,
    current_plan_index: true,
    dropped_bans: true,
    skipped_bans: true,
    pool: true,
    teams: true,
    a_side: true,
    side: true,
    veto: true,
    ready: true,
    selection_preview: true,
    pacing: true,
    paused: true,
    paused_at: true,
    paused_seconds: true,
    opened_at: true,
    started_at: true,
    completed_at: true,
    ended_at: true,
    edited: true,
    final_maps: true,
    end_reason: true,
    warnings: true,
    results_present: true,
    blocking_reasons: true,
    blocking_reason: true,
    viewer: true,
    capabilities: true,
} satisfies Record<keyof ContractVetoPickBanState, true>

const VETO_KEYS = {
    active: true,
    tag: true,
    min_pre_cup_seed: true,
    maps: true,
    eligible: true,
    choices: true,
    outcome: true,
    vetoed_by: true,
    pool_sizes: true,
    resolved_at: true,
    reveal_at: true,
} satisfies Record<keyof PickBanVeto, true>

const POOL_SIZE_KEYS = { vetoed: true, played: true } satisfies Record<keyof PickBanVetoPoolSizes, true>

const POOL_CARD_KEYS = {
    map: true,
    tags: true,
    screenshot_version: true,
    excluded: true,
    exclusion: true,
    pending_choice: true,
} satisfies Record<keyof ContractVetoPoolCard, true>

const EXCLUSION_KEYS = {
    tag: true,
    min_pre_cup_seed: true,
    mode: true,
    triggered_by: true,
    vetoed_by: true,
} satisfies Record<keyof ContractVetoExclusion, true>

const CAPABILITY_KEYS = {
    can_manage: true,
    acting_side: true,
    can_ready: true,
    can_choose_side: true,
    can_lock_now: true,
    can_veto: true,
} satisfies Record<keyof PickBanCapabilities, true>

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
} satisfies Record<keyof ContractVetoSideBlock, true>

const BASIS_KEYS = { chooser: true, other: true } satisfies Record<keyof PickBanChooserBasis, true>

const RECORD_KEYS = { wins: true, losses: true } satisfies Record<keyof PickBanPlayoffRecord, true>

const STAGE_KEYS = {
    key: true,
    name: true,
    best_of: true,
    pick_ban: true,
    counts: true,
    sequence_mismatch: true,
    pool: true,
    pool_status: true,
} satisfies Record<keyof PickBanStageConfig, true>

const BLOCK_KEYS = { preset_id: true, sequence: true, exclusions: true, pacing: true } satisfies Record<keyof PickBanBlock, true>

const SEQUENCE_KEYS = { steps: true, ban_down: true, ban_down_order: true } satisfies Record<keyof PickBanSequence, true>

const PACING_KEYS = {
    intro: true,
    spotlight: true,
    ban_down_spotlight: true,
    decider_spotlight: true,
    side_spotlight: true,
    veto_spotlight: true,
} satisfies Record<keyof PickBanContractPacing, true>

const RULE_KEYS = { tag: true, min_pre_cup_seed: true, mode: true } satisfies Record<keyof PickBanExclusionRule, true>

const STATE_NAMES = [
    'pickBanLobbyVeto',
    'pickBanVetoChoice',
    'pickBanVetoSpotlightVetoed',
    'pickBanVetoSpotlightPlayed',
    'pickBanSideChoiceAfterVeto',
    'pickBanNoVeto',
    'pickBanDirectQualifier',
] as const

const ERROR_CODES: Record<PickBanVetoErrorFixtureName, string> = {
    errorVetoNotOpen: 'veto_not_open',
    errorAlreadyChosen: 'already_chosen',
    errorVetoChoiceActive: 'veto_choice_active',
    errorSideLocked: 'side_locked',
}

const ALL_NAMES = Object.keys(PICK_BAN_VETO_FIXTURES) as PickBanVetoFixtureName[]
const ERROR_NAMES = Object.keys(ERROR_CODES) as PickBanVetoErrorFixtureName[]
const SUCCESS_NAMES = ALL_NAMES.filter((name) => !(name in ERROR_CODES)) as PickBanVetoSuccessFixtureName[]

function fileText(name: PickBanVetoFixtureName): string {
    return readFileSync(resolve(FIXTURE_DIR, PICK_BAN_VETO_FIXTURES[name].file), 'utf8')
}

function keysOf(value: object): string[] {
    return Object.keys(value).sort()
}

function sortedKeys(keys: object): string[] {
    return Object.keys(keys).sort()
}

function expectBasis(basis: PickBanChooserBasis) {
    expect(keysOf(basis)).toEqual(sortedKeys(BASIS_KEYS))
    for (const value of [basis.chooser, basis.other]) {
        if (typeof value === 'number') continue
        expect(keysOf(value)).toEqual(sortedKeys(RECORD_KEYS))
    }
}

function expectPoolCard(card: ContractVetoPoolCard) {
    expect(keysOf(card)).toEqual(sortedKeys(POOL_CARD_KEYS))
    expect(typeof card.pending_choice).toBe('boolean')
    if (card.exclusion === null) return
    expect(keysOf(card.exclusion)).toEqual(sortedKeys(EXCLUSION_KEYS))
    expect(PICK_BAN_EXCLUSION_MODES).toContain(card.exclusion.mode)
}

function expectVeto(veto: PickBanVeto) {
    expect(keysOf(veto)).toEqual(sortedKeys(VETO_KEYS))
    expect(keysOf(veto.pool_sizes)).toEqual(sortedKeys(POOL_SIZE_KEYS))
    expect(veto.maps).toEqual(HARD_MAPS)
    expect(Object.keys(veto.choices).sort()).toEqual([...veto.eligible].sort())
    for (const choice of Object.values(veto.choices)) {
        if (choice !== null) expect(PICK_BAN_VETO_CHOICES).toContain(choice)
    }
    if (veto.outcome !== null) expect(PICK_BAN_VETO_OUTCOMES).toContain(veto.outcome)
}

function expectState(state: ContractVetoPickBanState) {
    expect(keysOf(state)).toEqual(sortedKeys(STATE_KEYS))
    expect(keysOf(state.capabilities)).toEqual(sortedKeys(CAPABILITY_KEYS))
    expect(keysOf(state.side)).toEqual(sortedKeys(SIDE_BLOCK_KEYS))
    expect([...PICK_BAN_VETO_PHASES, ...PICK_BAN_SIDE_PHASES, 'lobby', 'intro', 'awaiting', 'spotlight']).toContain(state.phase)
    if (state.side.chooser_reason !== null) expect(PICK_BAN_CONTRACT_CHOOSER_REASONS).toContain(state.side.chooser_reason)
    if (state.side.chooser_basis !== null) expectBasis(state.side.chooser_basis)
    for (const card of state.pool) expectPoolCard(card)
    if (state.veto !== null) expectVeto(state.veto)
    expect(state.sequence?.ban_down_order).toEqual(BAN_DOWN_ORDER)
    expect(keysOf(state.pacing)).toEqual(sortedKeys(PACING_KEYS))
    expect(state.pacing.veto_spotlight).toBe(7)
}

function hardCards(state: ContractVetoPickBanState): ContractVetoPoolCard[] {
    return state.pool.filter((card) => card.tags.includes('Hard'))
}

function banDownActors(state: ContractVetoPickBanState): (PickBanActor | null)[] {
    return state.plan.filter((step) => step.segment === 'ban_down').map((step) => step.actor)
}

describe('pick/ban veto fixtures', () => {
    it('lists every fixture file once, and every file is pinned', () => {
        const onDisk = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort()

        expect(ALL_NAMES.map((name) => PICK_BAN_VETO_FIXTURES[name].file).sort()).toEqual(onDisk)
        expect(Object.keys(PINNED_SHA256).sort()).toEqual(onDisk)
    })

    it.each(ALL_NAMES)('pins %s byte for byte', (name) => {
        const bytes = readFileSync(resolve(FIXTURE_DIR, PICK_BAN_VETO_FIXTURES[name].file))

        expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_SHA256[PICK_BAN_VETO_FIXTURES[name].file])
    })

    it.each(SUCCESS_NAMES)('%s sits inside the success envelope', (name) => {
        const body = JSON.parse(fileText(name))

        expect(keysOf(body)).toEqual(['data', 'success'])
        expect(body.success).toBe(true)
        expect(PICK_BAN_VETO_FIXTURES[name].status).toBe(200)
    })

    it.each(ERROR_NAMES)('%s is an error body with its code', (name) => {
        const body = pickBanVetoErrorFixture(name)

        expect(keysOf(body)).toEqual(['code', 'error', 'success'])
        expect(body.success).toBe(false)
        expect(body.code).toBe(ERROR_CODES[name])
        expect([...PICK_BAN_VETO_ERROR_CODES, ...MATCH_EDITOR_SIDE_ERROR_CODES]).toContain(body.code)
        expect(PICK_BAN_VETO_FIXTURES[name].status).toBe(409)
    })

    it.each(STATE_NAMES)('%s parses into the veto contract types', (name) => {
        expectState(pickBanVetoFixture(name))
    })

    it('announces the veto in the lobby, with no plan until it resolves', () => {
        const lobby = pickBanVetoFixture('pickBanLobbyVeto')

        expect([lobby.status, lobby.veto?.active, lobby.veto?.eligible]).toEqual(['lobby', true, ['team_b']])
        expect([lobby.plan, lobby.side.cards]).toEqual([[], []])
        expect(hardCards(lobby).every((card) => card.pending_choice)).toBe(true)
        expect([lobby.side.chooser, lobby.side.chooser_reason, lobby.side.chooser_basis]).toEqual([
            'team_b',
            'lower_group_placing',
            { chooser: 4, other: 3 },
        ])
    })

    it('lets the eligible captain who has not chosen veto now', () => {
        const choosing = pickBanVetoFixture('pickBanVetoChoice')

        expect([choosing.phase, choosing.capabilities.can_veto, choosing.viewer.side]).toEqual(['veto_choice', true, 'team_b'])
        expect(choosing.veto?.choices).toEqual({ team_a: 'play', team_b: null })
        expect(choosing.side.chooser_basis).toEqual({ chooser: 16, other: 12 })
    })

    it('stamps the vetoed Hard maps and plans 9 maps, then 13 when they stay in', () => {
        const vetoed = pickBanVetoFixture('pickBanVetoSpotlightVetoed')
        const played = pickBanVetoFixture('pickBanVetoSpotlightPlayed')

        expect([vetoed.phase, vetoed.veto?.outcome, vetoed.veto?.vetoed_by]).toEqual(['veto_spotlight', 'vetoed', 'team_b'])
        expect([vetoed.viewer.side, vetoed.capabilities.acting_side]).toEqual(['team_b', 'team_b'])
        expect(hardCards(vetoed).map((card) => [card.excluded, card.exclusion?.mode, card.exclusion?.vetoed_by])).toEqual(
            HARD_MAPS.map(() => [true, 'choice', 'team_b']),
        )
        expect([vetoed.plan.length, banDownActors(vetoed)]).toEqual([9, []])
        expect([played.phase, played.veto?.outcome, played.veto?.vetoed_by]).toEqual(['veto_spotlight', 'played', null])
        expect([played.plan.length, banDownActors(played)]).toEqual([13, BAN_DOWN_ORDER])
        expect(hardCards(played).every((card) => !card.excluded && !card.pending_choice)).toBe(true)
    })

    it('builds the side cards from the plan the veto left', () => {
        const choice = pickBanVetoFixture('pickBanSideChoiceAfterVeto')

        expect([choice.phase, choice.capabilities.can_choose_side]).toEqual(['side_choice', true])
        expect(choice.side.cards.flatMap((card) => card.steps).length).toBe(8)
    })

    it('resolves a veto nobody may take to played, and has no veto block without a choice rule', () => {
        const none = pickBanVetoFixture('pickBanNoVeto')
        const direct = pickBanVetoFixture('pickBanDirectQualifier')

        expect([none.veto?.active, none.veto?.eligible, none.veto?.choices, none.veto?.outcome]).toEqual([false, [], {}, 'played'])
        expect([none.side.chooser_reason, none.side.chooser_basis]).toEqual([
            'lower_playoff_record',
            { chooser: { wins: 2, losses: 1 }, other: { wins: 2, losses: 0 } },
        ])
        expect([direct.veto, direct.side.chooser_reason, direct.side.chooser_basis]).toEqual([null, 'direct_qualifier', null])
    })

    it('reads the config with a choice rule and ban-down order on the playoffs, and the groups block as stored', () => {
        const [groups, playoffs] = pickBanVetoFixture('pickBanConfig').stages

        for (const stage of [groups, playoffs]) {
            expect(keysOf(stage)).toEqual(sortedKeys(STAGE_KEYS))
            expect(keysOf(stage.pick_ban ?? {})).toEqual(sortedKeys(BLOCK_KEYS))
            expect(keysOf(stage.pick_ban?.pacing ?? {})).toEqual(sortedKeys(PACING_KEYS))
        }
        expect(keysOf(playoffs.pick_ban?.sequence ?? {})).toEqual(sortedKeys(SEQUENCE_KEYS))
        expect(keysOf(playoffs.pick_ban?.exclusions[0] ?? {})).toEqual(sortedKeys(RULE_KEYS))
        expect(playoffs.pick_ban?.sequence.ban_down_order).toEqual(BAN_DOWN_ORDER)
        expect(playoffs.pick_ban?.exclusions).toEqual([{ tag: 'Hard', min_pre_cup_seed: 11, mode: 'choice' }])
        expect(playoffs.pick_ban?.pacing.veto_spotlight).toBe(7)
        expect([playoffs.pool_status?.normal.size, playoffs.pool_status?.exempt?.size]).toEqual([13, 9])
        expect(groups.pick_ban?.preset_id).toBe('bo4_ban_pick')
        expect(groups.pick_ban?.sequence).not.toHaveProperty('ban_down_order')
        expect(groups.pick_ban?.exclusions).toEqual([{ tag: 'Hard', min_pre_cup_seed: 11 }])
    })

    it('hands out copies, so a test cannot change the fixture for the next one', () => {
        const lobby = pickBanVetoFixture('pickBanLobbyVeto')
        if (lobby.veto) lobby.veto.choices.team_b = 'veto'

        expect(pickBanVetoFixture('pickBanLobbyVeto').veto?.choices.team_b).toBeNull()
    })

    it.each(ALL_NAMES)('builds a %s mock response with its status and body', async (name) => {
        const response = pickBanVetoFixtureResponse(name)

        expect(response.status).toBe(PICK_BAN_VETO_FIXTURES[name].status)
        expect(response.headers.get('Content-Type')).toBe('application/json')
        expect(await response.json()).toEqual(JSON.parse(fileText(name)))
    })
})
