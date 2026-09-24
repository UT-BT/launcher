import type {
    PickBanActor,
    PickBanMember,
    PickBanPlanStep,
    PickBanPoolCard,
    PickBanSegment,
    PickBanSide,
    PickBanState,
    PickBanStepAction,
    PickBanTeam,
} from '@/app/utils/api'

export const T0 = Date.parse('2026-09-26T20:00:00Z')
export const LEAD_MS = 1_500
export const INTRO_MS = 5_000
export const SPOTLIGHT_MS = 10_000
export const BAN_DOWN_SPOTLIGHT_MS = 4_000
export const DECIDER_SPOTLIGHT_MS = 10_000

export const ELIGIBLE_MAPS = [
    'CTF-BT-Alpha',
    'CTF-BT-Bravo',
    'CTF-BT-Charlie',
    'CTF-BT-Delta',
    'CTF-BT-Echo',
    'CTF-BT-Foxtrot',
    'CTF-BT-Golf',
]
export const HARD_MAP = 'CTF-BT-Hard'

export function iso(ms: number): string {
    return new Date(ms).toISOString().replace('Z', '+00:00')
}

function ms(value: string | null): number | null {
    return value === null ? null : Date.parse(value)
}

function member(id: string, displayName: string, captain: boolean): PickBanMember {
    return {
        id,
        display_name: displayName,
        avatar: `https://example.test/users/${id}/avatar`,
        captain,
        acting_captain: false,
        online: true,
    }
}

const TEAM_A: PickBanTeam = {
    id: 'team-crimson',
    side: 'team_a',
    name: 'Crimson Cats',
    stage_seed: 1,
    pre_cup_seed: 3,
    ab: 'A',
    members: [member('1000', 'Ada', true), member('1001', 'Ben', false)],
}

const TEAM_B: PickBanTeam = {
    id: 'team-azure',
    side: 'team_b',
    name: 'Azure Owls',
    stage_seed: 4,
    pre_cup_seed: 12,
    ab: 'B',
    members: [member('2000', 'Cleo', true), member('2001', 'Dex', false)],
}

function card(map: string): PickBanPoolCard {
    return { map, tags: [], screenshot_version: null, excluded: false, exclusion: null }
}

const HARD_CARD: PickBanPoolCard = {
    map: HARD_MAP,
    tags: ['Hard'],
    screenshot_version: '2026-09-20T18:04:11+00:00',
    excluded: true,
    exclusion: {
        tag: 'Hard',
        min_pre_cup_seed: 10,
        triggered_by: [{ side: 'team_b', team_id: 'team-azure', pre_cup_seed: 12 }],
    },
}

export type PlanRow = [PickBanActor | null, PickBanStepAction, PickBanSegment, number | null]

const BO3_AGAINST_SEVEN: PlanRow[] = [
    ['A', 'ban', 'lettered', null],
    ['B', 'ban', 'lettered', null],
    ['B', 'pick', 'lettered', 1],
    ['A', 'pick', 'lettered', 2],
    ['B', 'ban', 'ban_down', null],
    ['A', 'ban', 'ban_down', null],
    [null, 'decider', 'decider', 3],
]

function sideOf(actor: PickBanActor | null): PickBanSide | null {
    if (actor === null) return null
    return actor === 'A' ? 'team_a' : 'team_b'
}

export function planOf(rows: PlanRow[]): PickBanPlanStep[] {
    return rows.map(([actor, action, segment, mapNumber], index) => ({
        index,
        segment,
        actor,
        action,
        map_number: mapNumber,
        side: sideOf(actor),
        map: null,
        acted_by: null,
        acted_by_admin: false,
        at: null,
        reveal_at: null,
    }))
}

export function pickBanState(overrides: Partial<PickBanState> = {}): PickBanState {
    return {
        id: 'session-1',
        status: 'lobby',
        phase: 'lobby',
        phase_ends_at: null,
        intro_ends_at: null,
        spotlight_ends_at: null,
        version: 1,
        server_now: iso(T0 - 60_000),
        match: {
            id: 'match-1',
            stage_key: 'bracket',
            stage_name: 'Bracket',
            round_no: 1,
            round_label: 'Semi-Finals',
            best_of: 3,
            status: 'scheduled',
            scheduled_at: '2026-09-26T20:30:00+00:00',
        },
        sequence: {
            preset_id: 'bo3_ban_pick',
            from_stage_key: 'bracket',
            ban_down: true,
            steps: [
                { actor: 'A', action: 'ban' },
                { actor: 'B', action: 'ban' },
                { actor: 'B', action: 'pick' },
                { actor: 'A', action: 'pick' },
            ],
        },
        plan: planOf(BO3_AGAINST_SEVEN),
        current_plan_index: null,
        dropped_bans: 0,
        skipped_bans: [],
        pool: [...ELIGIBLE_MAPS.map(card), HARD_CARD],
        teams: { team_a: TEAM_A, team_b: TEAM_B },
        a_side: 'team_a',
        a_confirmed: false,
        ready: { team_a: null, team_b: null },
        selection_preview: null,
        pacing: {
            intro: INTRO_MS / 1000,
            spotlight: SPOTLIGHT_MS / 1000,
            ban_down_spotlight: BAN_DOWN_SPOTLIGHT_MS / 1000,
            decider_spotlight: DECIDER_SPOTLIGHT_MS / 1000,
        },
        paused: false,
        paused_at: null,
        paused_seconds: 0,
        opened_at: iso(T0 - 600_000),
        started_at: null,
        completed_at: null,
        ended_at: null,
        edited: false,
        end_reason: null,
        warnings: [],
        blocking_reasons: [],
        blocking_reason: null,
        viewer: { side: null, roster_captain: false },
        capabilities: { can_manage: false, acting_side: null, can_ready: false, can_lock_now: false },
        ...overrides,
    }
}

function spotlightMsOf(segment: PickBanSegment): number {
    if (segment === 'ban_down') return BAN_DOWN_SPOTLIGHT_MS
    if (segment === 'decider') return DECIDER_SPOTLIGHT_MS
    return SPOTLIGHT_MS
}

function captainOf(state: PickBanState, side: PickBanSide) {
    const captain = state.teams[side]?.members.find((m) => m.captain)
    return captain ? { id: captain.id, display_name: captain.display_name } : null
}

export function started(state: PickBanState = pickBanState(), at = T0): PickBanState {
    const introEnd = at + LEAD_MS + INTRO_MS
    return {
        ...state,
        status: 'running',
        phase: 'intro',
        started_at: iso(at),
        intro_ends_at: iso(introEnd),
        phase_ends_at: iso(introEnd),
        current_plan_index: 0,
        version: state.version + 1,
        server_now: iso(at),
    }
}

export function unlockAt(state: PickBanState): number {
    return ms(state.spotlight_ends_at) ?? ms(state.intro_ends_at) ?? T0
}

export function locked(state: PickBanState, map: string, at: number, options: { byAdmin?: boolean } = {}): PickBanState {
    const index = state.current_plan_index
    if (index === null) throw new Error('nothing to lock')
    const step = state.plan[index]
    if (step.side === null) throw new Error('the decider is automatic')
    const plan = state.plan.slice()
    plan[index] = {
        ...step,
        map,
        acted_by: captainOf(state, step.side),
        acted_by_admin: options.byAdmin ?? false,
        at: iso(at),
        reveal_at: iso(at + LEAD_MS),
    }
    let next = index + 1
    const used = new Set(plan.map((s) => s.map).filter((m): m is string => m !== null))
    const remaining = state.pool.filter((c) => !c.excluded && !used.has(c.map)).map((c) => c.map)
    if (plan[next]?.action === 'decider' && remaining.length === 1) {
        plan[next] = {
            ...plan[next],
            map: remaining[0],
            at: iso(at),
            reveal_at: iso(at + LEAD_MS + spotlightMsOf(step.segment)),
        }
        next += 1
    }
    const lastStep = plan[next - 1]
    const spotlightEnd = (ms(lastStep.reveal_at) ?? at) + spotlightMsOf(lastStep.segment)
    const complete = next >= plan.length
    return {
        ...state,
        plan,
        status: complete ? 'complete' : 'running',
        phase: 'spotlight',
        current_plan_index: complete ? null : next,
        spotlight_ends_at: iso(spotlightEnd),
        phase_ends_at: iso(spotlightEnd),
        completed_at: complete ? iso(at) : null,
        selection_preview: null,
        version: state.version + 1,
        server_now: iso(at),
    }
}

export function lockedInTurn(state: PickBanState, maps: string[], gapMs = 2_000): PickBanState {
    return maps.reduce((current, map) => locked(current, map, unlockAt(current) + gapMs), state)
}

export function paused(state: PickBanState, at: number): PickBanState {
    return {
        ...state,
        status: 'paused',
        phase: 'paused',
        paused: true,
        paused_at: iso(at),
        selection_preview: null,
        version: state.version + 1,
        server_now: iso(at),
    }
}

export function resumed(state: PickBanState, at: number): PickBanState {
    const pausedAt = ms(state.paused_at) ?? at
    const length = at - pausedAt
    const shift = (value: string | null) => {
        const instant = ms(value)
        return instant !== null && instant > pausedAt ? iso(instant + length) : value
    }
    return {
        ...state,
        status: 'running',
        phase: 'awaiting',
        paused: false,
        paused_at: null,
        paused_seconds: state.paused_seconds + length / 1000,
        intro_ends_at: shift(state.intro_ends_at),
        spotlight_ends_at: shift(state.spotlight_ends_at),
        phase_ends_at: shift(state.phase_ends_at),
        plan: state.plan.map((step) => (step.reveal_at === null ? step : { ...step, reveal_at: shift(step.reveal_at) })),
        version: state.version + 1,
        server_now: iso(at),
    }
}

export function undone(state: PickBanState, at: number): PickBanState {
    const lastActed = state.plan.filter((step) => step.map !== null && step.actor !== null).pop()
    if (!lastActed) throw new Error('nothing to undo')
    const cleared = (step: PickBanPlanStep): PickBanPlanStep => ({
        ...step, map: null, acted_by: null, acted_by_admin: false, at: null, reveal_at: null,
    })
    return {
        ...state,
        plan: state.plan.map((step) => (step.index >= lastActed.index ? cleared(step) : step)),
        status: 'running',
        phase: 'awaiting',
        current_plan_index: lastActed.index,
        spotlight_ends_at: null,
        phase_ends_at: null,
        completed_at: null,
        selection_preview: null,
        version: state.version + 1,
        server_now: iso(at),
    }
}

export function readAt(state: PickBanState, at: number): PickBanState {
    let phase = state.phase
    if (state.status === 'running' || state.status === 'complete') {
        const introEnd = ms(state.intro_ends_at) ?? -Infinity
        const spotlightEnd = ms(state.spotlight_ends_at) ?? -Infinity
        if (at < introEnd) phase = 'intro'
        else if (at < spotlightEnd) phase = 'spotlight'
        else phase = state.status === 'complete' ? 'complete' : 'awaiting'
    }
    return withCapabilities({ ...state, phase, server_now: iso(at) })
}

function withCapabilities(state: PickBanState): PickBanState {
    const acting = state.capabilities.acting_side
    const current = state.current_plan_index === null ? null : state.plan[state.current_plan_index]
    return {
        ...state,
        capabilities: {
            ...state.capabilities,
            can_ready: acting !== null && state.status === 'lobby',
            can_lock_now: acting !== null && state.status === 'running' && state.phase === 'awaiting' && current?.side === acting,
        },
    }
}

export function asSpectator(state: PickBanState): PickBanState {
    return withCapabilities({
        ...state,
        viewer: { side: null, roster_captain: false },
        capabilities: { can_manage: false, acting_side: null, can_ready: false, can_lock_now: false },
    })
}

export function asManager(state: PickBanState): PickBanState {
    return withCapabilities({
        ...state,
        viewer: { side: null, roster_captain: false },
        capabilities: { can_manage: true, acting_side: null, can_ready: false, can_lock_now: false },
    })
}

export function asCaptain(state: PickBanState, side: PickBanSide): PickBanState {
    return withCapabilities({
        ...state,
        viewer: { side, roster_captain: true },
        capabilities: { can_manage: false, acting_side: side, can_ready: false, can_lock_now: false },
    })
}

export function asTeammate(state: PickBanState, side: PickBanSide): PickBanState {
    return withCapabilities({
        ...state,
        viewer: { side, roster_captain: false },
        capabilities: { can_manage: false, acting_side: null, can_ready: false, can_lock_now: false },
    })
}

export function asActingCaptain(state: PickBanState, side: PickBanSide): PickBanState {
    const team = state.teams[side]
    const handedOver = team && {
        ...team,
        members: team.members.map((m) => ({ ...m, acting_captain: !m.captain })),
    }
    return withCapabilities({
        ...state,
        teams: { ...state.teams, [side]: handedOver },
        viewer: { side, roster_captain: false },
        capabilities: { can_manage: false, acting_side: side, can_ready: false, can_lock_now: false },
    })
}

export function asReplacedCaptain(state: PickBanState, side: PickBanSide): PickBanState {
    return withCapabilities({
        ...asActingCaptain(state, side),
        viewer: { side, roster_captain: true },
        capabilities: { can_manage: false, acting_side: null, can_ready: false, can_lock_now: false },
    })
}
