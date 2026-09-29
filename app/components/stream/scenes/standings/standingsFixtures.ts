import type {
    EventAdvancementRule, EventBracketEntrant, EventBracketStage, EventBracketTeamRef, EventFormatSpec, EventGroupsConfig, EventMatch,
    EventStageConfig, EventStageSpec, EventStandingRow, EventSwissConfig,
} from '@/app/utils/api'
import type { StreamHotState } from '../../data/streamHotState'
import { STREAM_MATCH_ID, STREAM_T0, streamHotState, streamIso, streamMatch, streamTeam } from '../../data/streamFixtures'
import type { StandingsRead } from './standingsRead'

const MINUTE = 60_000

export const TEAM_A = streamTeam('a')
export const TEAM_B = streamTeam('b')

export function zoneless(ms: number): string {
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

export function teamRef(name: string, seed: number | null = null): EventBracketTeamRef {
    if (name === TEAM_A.name) return { id: TEAM_A.id, name, seed, status: 'registered' }
    if (name === TEAM_B.name) return { id: TEAM_B.id, name, seed, status: 'registered' }
    return { id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`, name, seed, status: 'registered' }
}

export function stageMatch(overrides: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'stage-match',
        stage_id: 'stage',
        group_id: null,
        round_no: 1,
        round_label: null,
        ordinal: 0,
        team_a: null,
        team_b: null,
        slot_a_label: null,
        slot_b_label: null,
        best_of: 4,
        caps_to_win: 2,
        mode: 'first_to',
        status: 'pending',
        winner_team_id: null,
        is_draw: false,
        score_a: null,
        score_b: null,
        caps_a: null,
        caps_b: null,
        deaths_a: null,
        deaths_b: null,
        scheduled_at: null,
        resolved_window: { opens_at: null, closes_at: null },
        stream_url: null,
        notes: null,
        published: true,
        winner_to_match_id: null,
        winner_to_slot: null,
        loser_to_match_id: null,
        loser_to_slot: null,
        pick_ban_status: 'none',
        ...overrides,
    }
}

export function played(a: string, b: string, score: [number, number], overrides: Partial<EventMatch> = {}): EventMatch {
    const teamA = teamRef(a)
    const teamB = teamRef(b)
    const winner = score[0] === score[1] ? null : score[0] > score[1] ? teamA.id : teamB.id
    return stageMatch({
        team_a: teamA,
        team_b: teamB,
        status: 'complete',
        score_a: score[0],
        score_b: score[1],
        winner_team_id: winner,
        is_draw: winner === null,
        ...overrides,
    })
}

export function upcoming(a: string | null, b: string | null, at: number | null, overrides: Partial<EventMatch> = {}): EventMatch {
    return stageMatch({
        team_a: a ? teamRef(a) : null,
        team_b: b ? teamRef(b) : null,
        status: at === null ? 'pending' : 'scheduled',
        scheduled_at: at === null ? null : zoneless(at),
        ...overrides,
    })
}

export function stage(overrides: Partial<EventBracketStage> = {}): EventBracketStage {
    return {
        id: 'stage',
        key: 'stage',
        name: 'Stage',
        kind: 'groups',
        ordinal: 0,
        status: 'active',
        published: true,
        expected_match_duration_minutes: 60,
        config: null,
        groups: [],
        entrants: [],
        matches: [],
        ...overrides,
    }
}

export function standingsRead(stagePayload: EventBracketStage, overrides: Partial<StandingsRead> = {}): StandingsRead {
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        group_id: null,
        team_ids: { a: TEAM_A.id, b: TEAM_B.id },
        stage: stagePayload,
        ...overrides,
    }
}

function standingRow(rank: number, name: string, seed: number, record: [number, number, number], maps: [number, number], capsDiff: number): EventStandingRow {
    const [wins, draws, losses] = record
    const team = teamRef(name, seed)
    return {
        team_id: team.id,
        team,
        rank,
        seed,
        played: wins + draws + losses,
        wins,
        draws,
        losses,
        points: wins * 3 + draws,
        maps_won: maps[0],
        maps_lost: maps[1],
        map_diff: maps[0] - maps[1],
        caps_for: 20 + capsDiff,
        caps_against: 20,
        caps_diff: capsDiff,
        deaths: null,
    }
}

export const GROUPS_CONFIG: EventGroupsConfig = {
    group_count: 2,
    group_size: 6,
    seeding: 'snake',
    double_round_robin: false,
    points: [
        { maps_won: 3, maps_lost: 0, points: 3 },
        { maps_won: 3, maps_lost: 1, points: 3 },
        { maps_won: 2, maps_lost: 2, points: 1 },
        { maps_won: 1, maps_lost: 3, points: 0 },
    ],
    tiebreakers: ['points', 'map_diff'],
}

export function groupStage(): EventBracketStage {
    const inGroup = (overrides: Partial<EventMatch>): Partial<EventMatch> => ({ stage_id: 'stage-groups', group_id: 'group-b', ...overrides })
    return stage({
        id: 'stage-groups',
        key: 'groups',
        name: 'Group Stage',
        kind: 'groups',
        config: GROUPS_CONFIG,
        groups: [
            {
                id: 'group-a',
                name: 'Group A',
                ordinal: 0,
                standings: [standingRow(1, 'Kinetic Kin', 5, [3, 0, 1], [10, 5], 6)],
            },
            {
                id: 'group-b',
                name: 'Group B',
                ordinal: 1,
                standings: [
                    standingRow(1, 'Warp Rabbits', 1, [4, 0, 0], [12, 3], 14),
                    standingRow(2, TEAM_A.name, 2, [2, 1, 0], [8, 3], 9),
                    standingRow(3, TEAM_B.name, 3, [2, 0, 1], [7, 4], 5),
                    standingRow(4, 'Ledge Lords', 4, [1, 1, 2], [7, 9], -3),
                    standingRow(5, 'Burrow Gang', 5, [1, 0, 2], [4, 7], -6),
                    standingRow(6, 'Flagrunners', 6, [0, 0, 3], [2, 9], -19),
                ],
            },
        ],
        matches: [
            played('Warp Rabbits', 'Flagrunners', [3, 0], inGroup({ id: 'g-1', round_no: 3, ordinal: 0, scheduled_at: zoneless(STREAM_T0 - 26 * 60 * MINUTE) })),
            played('Warp Rabbits', 'Ledge Lords', [3, 1], inGroup({ id: 'g-2', round_no: 4, ordinal: 0, scheduled_at: zoneless(STREAM_T0 - 160 * MINUTE) })),
            upcoming(TEAM_A.name, TEAM_B.name, STREAM_T0 + 80 * MINUTE, inGroup({ id: STREAM_MATCH_ID, round_no: 4, ordinal: 1 })),
            upcoming('Burrow Gang', 'Flagrunners', STREAM_T0 + 200 * MINUTE, inGroup({ id: 'g-4', round_no: 4, ordinal: 2 })),
            upcoming('Warp Rabbits', 'Burrow Gang', STREAM_T0 + 26 * 60 * MINUTE, inGroup({ id: 'g-5', round_no: 5, ordinal: 0 })),
            played('Kinetic Kin', 'Double Dash', [3, 1], { id: 'a-1', stage_id: 'stage-groups', group_id: 'group-a', round_no: 4, scheduled_at: zoneless(STREAM_T0 - 60 * MINUTE) }),
        ],
    })
}

export function groupHotState(): StreamHotState {
    return streamHotState()
}

export const SWISS_CONFIG: EventSwissConfig = {
    wins_to_qualify: 2,
    losses_to_eliminate: 2,
    entry_records: [],
    pairing: { method: 'fold', avoid_rematch: true, avoid_same_history: false, avoid_same_group: false },
}

function entrant(name: string, wins: number, losses: number, status: EventBracketEntrant['status'] = 'active'): EventBracketEntrant {
    const team = teamRef(name)
    return {
        team_id: team.id,
        team,
        group_id: null,
        seed: null,
        pot: null,
        source_rank: null,
        wins,
        losses,
        status,
        final_rank: null,
        rank_override: null,
        qualified_round: status === 'qualified' ? 2 : null,
    }
}

export function swissStage(): EventBracketStage {
    const at = (round: number, overrides: Partial<EventMatch> = {}): Partial<EventMatch> => ({
        stage_id: 'stage-swiss',
        round_no: round,
        round_label: `Round ${round}`,
        ...overrides,
    })
    return stage({
        id: 'stage-swiss',
        key: 'playoff',
        name: 'Playoff Stage',
        kind: 'swiss',
        config: SWISS_CONFIG,
        entrants: [
            entrant('Moonhoppers', 2, 0, 'qualified'),
            entrant('Strafe Society', 2, 0, 'qualified'),
            entrant(TEAM_A.name, 1, 1),
            entrant(TEAM_B.name, 1, 1),
            entrant('Ledge Lords', 1, 1),
            entrant('Quad Damage', 1, 1),
            entrant('Burrow Gang', 0, 2, 'eliminated'),
            entrant('Flagrunners', 0, 2, 'eliminated'),
        ],
        matches: [
            played(TEAM_A.name, 'Burrow Gang', [3, 1], at(1, { id: 's-1', ordinal: 0 })),
            played('Strafe Society', TEAM_B.name, [3, 2], at(1, { id: 's-2', ordinal: 1 })),
            played('Moonhoppers', 'Flagrunners', [3, 0], at(1, { id: 's-3', ordinal: 2 })),
            played('Ledge Lords', 'Quad Damage', [3, 1], at(1, { id: 's-4', ordinal: 3 })),
            played('Moonhoppers', TEAM_A.name, [3, 1], at(2, { id: 's-5', ordinal: 0 })),
            played('Strafe Society', 'Ledge Lords', [3, 0], at(2, { id: 's-6', ordinal: 1 })),
            played(TEAM_B.name, 'Burrow Gang', [3, 0], at(2, { id: 's-7', ordinal: 2 })),
            played('Quad Damage', 'Flagrunners', [3, 2], at(2, { id: 's-8', ordinal: 3 })),
            upcoming(TEAM_A.name, TEAM_B.name, STREAM_T0 + 80 * MINUTE, at(3, { id: STREAM_MATCH_ID, ordinal: 0 })),
            upcoming('Ledge Lords', 'Quad Damage', STREAM_T0 + 200 * MINUTE, at(3, { id: 's-10', ordinal: 1 })),
        ],
    })
}

export function swissHotState(): StreamHotState {
    return streamHotState({
        match: streamMatch({
            stage: { key: 'playoff', name: 'Playoff Stage' },
            group: null,
            round: { no: 3, label: 'Round 3' },
            best_of: 5,
            caps_to_win: 3,
        }),
    })
}

interface Wiring {
    id: string
    round: number
    ordinal: number
    to: string | null
    slot: 'a' | 'b' | null
}

function wired({ id, round, ordinal, to, slot }: Wiring, labels: Record<number, string>, body: Partial<EventMatch>): EventMatch {
    return stageMatch({
        ...body,
        stage_id: 'stage-final',
        id,
        round_no: round,
        round_label: labels[round],
        ordinal,
        winner_to_match_id: to,
        winner_to_slot: slot,
        best_of: 5,
        caps_to_win: 3,
    })
}

const BRACKET_LABELS: Record<number, string> = { 1: 'Opening round', 2: 'Quarter-finals', 3: 'Semi-finals', 4: 'Final' }

export function bracketStage(): EventBracketStage {
    const w = (id: string, round: number, ordinal: number, to: string | null, slot: 'a' | 'b' | null, body: Partial<EventMatch>) =>
        wired({ id, round, ordinal, to, slot }, BRACKET_LABELS, body)
    const bye = (name: string): Partial<EventMatch> => ({ team_a: teamRef(name), status: 'bye', winner_team_id: teamRef(name).id })
    const result = (a: string, b: string, score: [number, number]) => played(a, b, score)
    return stage({
        id: 'stage-final',
        key: 'final',
        name: 'Final Stage',
        kind: 'single_elim',
        config: null,
        matches: [
            w('r1-b1', 1, 0, 'qf-1', 'a', bye('Warp Rabbits')),
            w('r1-1', 1, 1, 'qf-1', 'b', result('Ledge Lords', 'Quad Damage', [3, 1])),
            w('r1-b2', 1, 2, STREAM_MATCH_ID, 'a', bye(TEAM_A.name)),
            w('r1-2', 1, 3, STREAM_MATCH_ID, 'b', result(TEAM_B.name, 'Kinetic Kin', [3, 2])),
            w('r1-b3', 1, 4, 'qf-3', 'a', bye('Moonhoppers')),
            w('r1-3', 1, 5, 'qf-3', 'b', result('Double Dash', 'Burrow Gang', [3, 0])),
            w('r1-b4', 1, 6, 'qf-4', 'a', bye('Velvet Carrots')),
            w('r1-4', 1, 7, 'qf-4', 'b', result('Strafe Society', 'Flagrunners', [3, 1])),
            w('qf-1', 2, 0, 'sf-1', 'a', result('Warp Rabbits', 'Ledge Lords', [3, 0])),
            w(STREAM_MATCH_ID, 2, 1, 'sf-1', 'b', { ...upcoming(TEAM_A.name, TEAM_B.name, STREAM_T0 + 80 * MINUTE), status: 'live' }),
            w('qf-3', 2, 2, 'sf-2', 'a', upcoming('Moonhoppers', 'Double Dash', STREAM_T0 + 170 * MINUTE)),
            w('qf-4', 2, 3, 'sf-2', 'b', upcoming('Velvet Carrots', 'Strafe Society', STREAM_T0 + 260 * MINUTE)),
            w('sf-1', 3, 0, 'final', 'a', { team_a: teamRef('Warp Rabbits'), slot_b_label: 'Winner QF2' }),
            w('sf-2', 3, 1, 'final', 'b', { slot_a_label: 'Winner QF3', slot_b_label: 'Winner QF4' }),
            w('final', 4, 0, null, null, { slot_a_label: 'Winner SF1', slot_b_label: 'Winner SF2' }),
        ],
    })
}

export function bracketHotState(): StreamHotState {
    return streamHotState({
        reason: 'live',
        match: streamMatch({
            reason: 'live',
            status: 'live',
            stage: { key: 'final', name: 'Final Stage' },
            group: null,
            round: { no: 2, label: 'Quarter-final' },
            best_of: 5,
            caps_to_win: 3,
        }),
    })
}

const LARGE_TEAMS = [
    'Warp Rabbits', 'Ledge Lords', 'Quad Damage', 'Kinetic Kin', 'Moonhoppers', 'Double Dash', 'Burrow Gang', 'Velvet Carrots',
    'Strafe Society', 'Flagrunners', 'Triple Jump', 'Hare Force', TEAM_A.name, 'Lucky Leapers', TEAM_B.name, 'Bounce House',
]

const LARGE_LABELS: Record<number, string> = { 1: 'Round of 16', 2: 'Quarter-finals', 3: 'Semi-finals', 4: 'Final' }

export function largeBracketStage(): EventBracketStage {
    const matches: EventMatch[] = []
    const ids: Record<number, string[]> = {}
    const sizes = [8, 4, 2, 1]
    sizes.forEach((count, index) => {
        const round = index + 1
        ids[round] = Array.from({ length: count }, (_, ordinal) => (round === 2 && ordinal === 3 ? STREAM_MATCH_ID : `r${round}-${ordinal + 1}`))
    })
    sizes.forEach((count, index) => {
        const round = index + 1
        for (let ordinal = 0; ordinal < count; ordinal += 1) {
            const id = ids[round][ordinal]
            const to = ids[round + 1]?.[Math.floor(ordinal / 2)] ?? null
            const slot = to === null ? null : ordinal % 2 === 0 ? 'a' : 'b'
            const body: Partial<EventMatch> = round === 1
                ? played(LARGE_TEAMS[ordinal * 2], LARGE_TEAMS[ordinal * 2 + 1], [3, ordinal % 3])
                : id === STREAM_MATCH_ID
                    ? upcoming(TEAM_A.name, TEAM_B.name, STREAM_T0 + 80 * MINUTE)
                    : round === 2
                        ? upcoming(LARGE_TEAMS[ordinal * 4], LARGE_TEAMS[ordinal * 4 + 2], STREAM_T0 + (100 + ordinal * 60) * MINUTE)
                        : upcoming(null, null, null, { slot_a_label: 'TBD', slot_b_label: 'TBD' })
            matches.push(wired({ id, round, ordinal, to, slot }, LARGE_LABELS, body))
        }
    })
    return stage({ id: 'stage-final', key: 'final', name: 'Final Stage', kind: 'single_elim', matches })
}

function specStage(key: string, name: string, kind: EventStageSpec['kind'], config: EventStageConfig, advancement: EventAdvancementRule[] = []): EventStageSpec {
    return { key, name, kind, config, advancement, match_defaults: null }
}

const ELIM_CONFIG: EventStageConfig = {
    size: 8,
    third_place_match: false,
    avoid_rematch: false,
    seeding: 'by_seed',
    pots: [],
    draw: { byes: [], matchups: [], remainder: 'fold_pairs' },
}

export function standingsFormat(): EventFormatSpec {
    return {
        version: 1,
        match_defaults: { best_of: 4, caps_to_win_map: 2, mode: 'first_to', decider: null },
        stages: [
            specStage('groups', 'Group Stage', 'groups', GROUPS_CONFIG, [
                { to_stage: 'final', label: null, from_rank: 1, to_rank: 2 },
                { to_stage: 'playoff', label: null, from_rank: 3, to_rank: 6 },
            ]),
            specStage('playoff', 'Playoff Stage', 'swiss', SWISS_CONFIG, [{ to_stage: 'final', label: null, outcome: 'qualified' }]),
            specStage('final', 'Final Stage', 'single_elim', ELIM_CONFIG),
        ],
    }
}
