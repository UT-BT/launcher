import type { RawActiveTitle } from '@/app/utils/api'
import type { StreamSide } from '../../data/streamHotState'
import type {
    PreviewCupRunEntry,
    PreviewEliminationView,
    PreviewGroupRow,
    PreviewGroupsView,
    PreviewMatchSummary,
    PreviewMember,
    PreviewOdds,
    PreviewSlot,
    PreviewStageMatch,
    PreviewSwissRow,
    PreviewSwissView,
    PreviewTeam,
    PreviewTeamRef,
    StreamPreview,
} from './previewRead'

const T0_ISO = '2026-09-29T18:40:00+00:00'
const STARTS_AT = '2026-09-29T20:00:00+00:00'

function title(name: string, rarity: number, color: [number, number, number]): RawActiveTitle {
    return { name, rarity, color_r: color[0], color_g: color[1], color_b: color[2] }
}

export function previewMember(id: string, displayName: string, overrides: Partial<PreviewMember> = {}): PreviewMember {
    return {
        id,
        display_name: displayName,
        avatar: `https://example.test/users/${id}/avatar`,
        title: null,
        captain: false,
        career_caps: 0,
        wr_count: 0,
        solo_wrs: 0,
        team_wrs: 0,
        cup_caps: 0,
        ...overrides,
    }
}

export function previewTeamRef(id: string, name: string, seed: number | null = null): PreviewTeamRef {
    return { id, name, seed, status: null }
}

const CRIMSON = previewTeamRef('team-crimson', 'Crimson Cats', 3)
const AZURE = previewTeamRef('team-azure', 'Azure Owls', 12)
const WARP = previewTeamRef('team-warp', 'Warp Rabbits', 1)
const LEDGE = previewTeamRef('team-ledge', 'Ledge Lords', 7)
const BURROW = previewTeamRef('team-burrow', 'Burrow Gang', 9)
const FLAG = previewTeamRef('team-flag', 'Flagrunners', 15)

export function previewCupRun(
    matchId: string,
    roundNo: number,
    opponent: PreviewTeamRef | null,
    result: PreviewCupRunEntry['result'],
    score: [number, number],
    overrides: Partial<PreviewCupRunEntry> = {},
): PreviewCupRunEntry {
    return {
        match_id: matchId,
        stage: { key: 'groups', name: 'Group Stage' },
        round: { no: roundNo, label: `Round ${roundNo}` },
        opponent,
        result,
        score: { for: score[0], against: score[1] },
        status: 'complete',
        scheduled_at: null,
        ...overrides,
    }
}

const TEAMS: Record<StreamSide, PreviewTeam> = {
    a: {
        id: CRIMSON.id,
        name: CRIMSON.name,
        match_side: 'a',
        stage_seed: 2,
        pre_cup_seed: 5,
        members: [
            previewMember('310000000000000001', 'Ada', {
                captain: true,
                title: title('Cap Machine', 3, [240, 120, 41]),
                career_caps: 1284,
                wr_count: 23,
                solo_wrs: 17,
                team_wrs: 6,
                cup_caps: 19,
            }),
            previewMember('310000000000000002', 'Ben', {
                title: title('Speedrunner', 2, [31, 166, 230]),
                career_caps: 947,
                wr_count: 8,
                solo_wrs: 5,
                team_wrs: 3,
                cup_caps: 17,
            }),
        ],
        cup_run: [
            previewCupRun('g-1', 1, FLAG, 'win', [3, 1]),
            previewCupRun('g-2', 2, LEDGE, 'draw', [2, 2]),
            previewCupRun('g-3', 3, BURROW, 'win', [3, 0]),
        ],
    },
    b: {
        id: AZURE.id,
        name: AZURE.name,
        match_side: 'b',
        stage_seed: 3,
        pre_cup_seed: 8,
        members: [
            previewMember('320000000000000001', 'Cleo', {
                captain: true,
                title: title('World Record Holder', 5, [240, 180, 41]),
                career_caps: 1610,
                wr_count: 31,
                solo_wrs: 22,
                team_wrs: 9,
                cup_caps: 21,
            }),
            previewMember('320000000000000002', 'Dex', {
                title: title('Rookie', 1, [160, 160, 160]),
                career_caps: 212,
                cup_caps: 9,
            }),
        ],
        cup_run: [
            previewCupRun('g-4', 1, BURROW, 'win', [3, 1]),
            previewCupRun('g-5', 2, WARP, 'loss', [1, 3]),
            previewCupRun('g-6', 3, FLAG, 'win', [3, 0]),
        ],
    },
}

export function previewTeam(side: StreamSide, overrides: Partial<PreviewTeam> = {}): PreviewTeam {
    return { ...TEAMS[side], ...overrides }
}

function groupRow(rank: number, team: PreviewTeamRef, wdl: [number, number, number], maps: [number, number], points: number, side: StreamSide | null = null): PreviewGroupRow {
    return {
        rank,
        team_id: team.id,
        team,
        seed: team.seed,
        played: wdl[0] + wdl[1] + wdl[2],
        wins: wdl[0],
        draws: wdl[1],
        losses: wdl[2],
        points,
        maps_won: maps[0],
        maps_lost: maps[1],
        map_diff: maps[0] - maps[1],
        side,
    }
}

export function groupsStageView(overrides: Partial<PreviewGroupsView> = {}): PreviewGroupsView {
    return {
        kind: 'groups',
        stage: { key: 'groups', name: 'Group Stage' },
        group: { id: 'group-b', name: 'Group B' },
        rows: [
            groupRow(1, WARP, [4, 0, 0], [12, 3], 12),
            groupRow(2, CRIMSON, [2, 1, 0], [8, 3], 7, 'a'),
            groupRow(3, AZURE, [2, 0, 1], [7, 4], 6, 'b'),
            groupRow(4, LEDGE, [1, 1, 2], [7, 9], 4),
            groupRow(5, BURROW, [1, 0, 2], [4, 7], 3),
            groupRow(6, FLAG, [0, 0, 3], [2, 9], 0),
        ],
        ...overrides,
    }
}

export function swissRow(team: PreviewTeamRef, wins: number, losses: number, status: PreviewSwissRow['status'] = 'active', side: StreamSide | null = null): PreviewSwissRow {
    return { team_id: team.id, team, seed: team.seed, wins, losses, status, side }
}

export function swissStageView(overrides: Partial<PreviewSwissView> = {}): PreviewSwissView {
    return {
        kind: 'swiss',
        stage: { key: 'playoffs', name: 'Playoff Stage' },
        round: { no: 3, label: 'Round 3' },
        wins_to_qualify: 2,
        losses_to_eliminate: 2,
        rows: [
            swissRow(WARP, 2, 0, 'qualified'),
            swissRow(CRIMSON, 1, 1, 'active', 'a'),
            swissRow(AZURE, 1, 1, 'active', 'b'),
            swissRow(LEDGE, 1, 1),
            swissRow(BURROW, 0, 2, 'eliminated'),
            swissRow(FLAG, 1, 1),
        ],
        pairings: [],
        ...overrides,
    }
}

export function previewSlot(team: PreviewTeamRef | null, overrides: Partial<PreviewSlot> = {}): PreviewSlot {
    return { team, label: null, side: null, score: null, winner: false, ...overrides }
}

export function stageMatch(
    id: string,
    round: { no: number; label: string },
    slots: [PreviewSlot, PreviewSlot],
    overrides: Partial<PreviewStageMatch> = {},
): PreviewStageMatch {
    const decided = slots.some(slot => slot.winner)
    return {
        id,
        round,
        ordinal: 1,
        status: decided ? 'complete' : 'scheduled',
        scheduled_at: null,
        current: false,
        is_draw: false,
        slots,
        winner_to_match_id: null,
        ...overrides,
    }
}

const OPENING = { no: 1, label: 'Opening Round' }
const QUARTERS = { no: 2, label: 'Quarter-finals' }
const SEMIS = { no: 3, label: 'Semi-finals' }
const FINAL = { no: 4, label: 'Grand Final' }

export function eliminationStageView(overrides: Partial<PreviewEliminationView> = {}): PreviewEliminationView {
    return {
        kind: 'single_elim',
        stage: { key: 'final', name: 'Final Stage' },
        rounds: [
            {
                ...OPENING,
                matches: [
                    stageMatch('or-1', OPENING, [previewSlot(LEDGE, { score: 3, winner: true }), previewSlot(BURROW, { score: 1 })], { winner_to_match_id: 'qf-1' }),
                    stageMatch('or-2', OPENING, [previewSlot(AZURE, { score: 3, winner: true, side: 'b' }), previewSlot(FLAG, { score: 2 })], { ordinal: 2, winner_to_match_id: 'qf-2' }),
                ],
            },
            {
                ...QUARTERS,
                matches: [
                    stageMatch('qf-1', QUARTERS, [previewSlot(WARP, { score: 3, winner: true }), previewSlot(LEDGE, { score: 0 })], { winner_to_match_id: 'sf-1' }),
                    stageMatch('qf-2', QUARTERS, [previewSlot(CRIMSON, { side: 'a' }), previewSlot(AZURE, { side: 'b' })], { ordinal: 2, current: true, winner_to_match_id: 'sf-1' }),
                ],
            },
            {
                ...SEMIS,
                matches: [
                    stageMatch('sf-1', SEMIS, [previewSlot(WARP), previewSlot(null, { label: 'Winner QF2' })], { winner_to_match_id: 'final' }),
                ],
            },
            {
                ...FINAL,
                matches: [stageMatch('final', FINAL, [previewSlot(null, { label: 'Winner SF1' }), previewSlot(null, { label: 'Winner SF2' })])],
            },
        ],
        path: { a: ['qf-2'], b: ['or-2', 'qf-2'] },
        winner_path: ['sf-1', 'final'],
        ...overrides,
    }
}

export function previewSummary(opponent: string, outcome: PreviewMatchSummary['outcome'], score: [number, number], overrides: Partial<PreviewMatchSummary> = {}): PreviewMatchSummary {
    return {
        match_id: `summary-${opponent}-${score.join('-')}`,
        stage: 'Group Stage',
        round_label: 'Round 1',
        opponent,
        outcome,
        score: score[0],
        opponent_score: score[1],
        scheduled_at: null,
        ...overrides,
    }
}

export function previewOdds(overrides: Partial<PreviewOdds> = {}): PreviewOdds {
    return {
        status: 'open',
        draws_allowed: false,
        price: { a: 0.58, b: 0.42, draw: null },
        pool_stake: 12450,
        position_count: 164,
        closes_at: null,
        ...overrides,
    }
}

export function streamPreview(overrides: Partial<StreamPreview> = {}): StreamPreview {
    const a = previewTeam('a')
    const b = previewTeam('b')
    return {
        server_now: T0_ISO,
        match: {
            id: 'match-1',
            stage: { key: 'groups', name: 'Group Stage', kind: 'groups' },
            group: { id: 'group-b', name: 'Group B' },
            round: { no: 4, label: 'Round 4' },
            best_of: 4,
            mode: 'first_to',
            caps_to_win: 2,
            status: 'scheduled',
            scheduled_at: STARTS_AT,
        },
        sides: { a: 'a', b: 'b' },
        teams: { a, b },
        lineup: { a1: a.members[0].id, a2: a.members[1].id, b1: b.members[0].id, b2: b.members[1].id },
        stage_view: groupsStageView(),
        insights: {
            available: true,
            teams: {
                a: {
                    team_id: a.id,
                    name: a.name,
                    record: { win: 2, loss: 0, draw: 1 },
                    form: [previewSummary('Burrow Gang', 'win', [3, 0]), previewSummary('Ledge Lords', 'draw', [2, 2]), previewSummary('Flagrunners', 'win', [3, 1])],
                },
                b: {
                    team_id: b.id,
                    name: b.name,
                    record: { win: 2, loss: 1, draw: 0 },
                    form: [previewSummary('Flagrunners', 'win', [3, 0]), previewSummary('Warp Rabbits', 'loss', [1, 3]), previewSummary('Burrow Gang', 'win', [3, 1])],
                },
            },
            head_to_head: {
                played: 3,
                record: { win: 1, loss: 2, draw: 0 },
                matches: [
                    previewSummary('Azure Owls', 'loss', [1, 3], { scheduled_at: '2026-08-14T19:00:00+00:00' }),
                    previewSummary('Azure Owls', 'win', [3, 2], { scheduled_at: '2026-07-02T19:00:00+00:00' }),
                    previewSummary('Azure Owls', 'loss', [0, 3], { scheduled_at: '2026-06-11T19:00:00+00:00' }),
                ],
            },
        },
        predictions_enabled: true,
        odds: previewOdds(),
        ...overrides,
    }
}
