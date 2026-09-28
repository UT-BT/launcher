import { describe, expect, it } from 'vitest'
import type { EventMatch, EventSummary, EventTeam, MyTournamentMembership, ScheduleEntry, ScheduleProposal } from './api'
import {
    combinedEventAttention, computeEventAttention, eventAttentionCount, eventAttentionTooltip, totalEventAttentionCount,
} from './eventAttention'

const TEAM_A = { id: 'team-a', name: 'Alpha', seed: 1, status: 'registered' as const }
const TEAM_B = { id: 'team-b', name: 'Bravo', seed: 2, status: 'registered' as const }

function match(patch: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'match-1', stage_id: 'stage-1', group_id: null, round_no: 1, round_label: null, ordinal: 0,
        team_a: TEAM_A, team_b: TEAM_B, slot_a_label: null, slot_b_label: null,
        best_of: 3, caps_to_win: 4, mode: 'first_to', status: 'pending',
        winner_team_id: null, is_draw: false, score_a: null, score_b: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        scheduled_at: null, resolved_window: { opens_at: null, closes_at: null },
        stream_url: null, notes: null, published: true,
        winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
        pick_ban_status: 'none',
        ...patch,
    }
}

function proposal(patch: Partial<ScheduleProposal> = {}): ScheduleProposal {
    return {
        id: 'proposal-1', team_id: TEAM_A.id, note: null, status: 'open',
        slots: [{ starts_at: '2026-09-25T18:00:00+00:00', expired: false }],
        created_by: '1', created_at: '2026-09-22T00:00:00+00:00', updated_at: null,
        ...patch,
    }
}

function entry(patch: Partial<ScheduleEntry> = {}): ScheduleEntry {
    return {
        tournament: { id: 't1', slug: '2v2-cup', name: '2v2 Cup' },
        match: match(),
        slot_window: { opens_at: null, closes_at: null },
        schedulable: true,
        reason: null,
        whose_turn: TEAM_B.id,
        proposal: proposal(),
        ...patch,
    }
}

function tournamentSummary(patch: Partial<EventSummary> = {}): EventSummary {
    return {
        id: 't1', slug: '2v2-cup', name: '2v2 Cup', summary: null, team_size: 2, bracket_type: null,
        status: 'active', signups_open: false, signup_opens_at: null, signup_closes_at: null,
        starts_at: null, ends_at: null, max_teams: null, team_count: 0, registered_team_count: 0,
        created_at: null,
        ...patch,
    }
}

function myTeam(patch: Partial<EventTeam> = {}): EventTeam {
    return {
        id: TEAM_A.id, tournament_id: 't1', name: TEAM_A.name, captain: '1', status: 'registered',
        division: null, seed: 1, member_count: 2, members: [], created_at: null,
        ...patch,
    }
}

function membership(patch: Partial<MyTournamentMembership> = {}): MyTournamentMembership {
    return {
        tournament: tournamentSummary(),
        team: myTeam(),
        membership_status: 'active',
        ...patch,
    }
}

describe('computeEventAttention', () => {
    it('groups awaiting-schedule counts by the entry event slug', () => {
        const map = computeEventAttention(
            [
                entry({ whose_turn: TEAM_A.id }),
                entry({ tournament: { id: 't2', slug: 'other-cup', name: 'Other Cup' }, whose_turn: TEAM_A.id }),
            ],
            [
                membership(),
                membership({ tournament: tournamentSummary({ id: 't2', slug: 'other-cup', name: 'Other Cup' }) }),
            ],
            new Set(),
        )
        expect(map['2v2-cup'].awaitingSchedule).toBe(1)
        expect(map['other-cup'].awaitingSchedule).toBe(1)
    })

    it('counts awaiting only for an active membership with a proposal where it is my team turn', () => {
        const count = (schedule: ScheduleEntry[], memberships: MyTournamentMembership[]) =>
            computeEventAttention(schedule, memberships, new Set())['2v2-cup']?.awaitingSchedule ?? 0

        expect(count([entry({ whose_turn: TEAM_A.id })], [membership()])).toBe(1)
        expect(count([entry({ whose_turn: TEAM_B.id })], [membership()])).toBe(0)
        expect(count([entry({ whose_turn: TEAM_A.id, proposal: null })], [membership()])).toBe(0)
        expect(count([entry({ whose_turn: TEAM_A.id })], [])).toBe(0)
        expect(count([entry({ whose_turn: TEAM_A.id })], [membership({ membership_status: 'invited' })])).toBe(0)
    })

    it('counts invited membership rows per slug and does not count active rows as invitations', () => {
        const map = computeEventAttention(
            [],
            [
                membership({ membership_status: 'invited' }),
                membership({ membership_status: 'invited', tournament: tournamentSummary({ id: 't2', slug: 'other-cup', name: 'Other Cup' }) }),
                membership({ membership_status: 'active', tournament: tournamentSummary({ id: 't3', slug: 'third-cup', name: 'Third Cup' }) }),
            ],
            new Set(),
        )
        expect(map['2v2-cup'].invitations).toBe(1)
        expect(map['other-cup'].invitations).toBe(1)
        expect(map['third-cup']?.invitations ?? 0).toBe(0)
    })

    it('marks pickBanOpen for slugs in the open-session set only', () => {
        const map = computeEventAttention([], [], new Set(['2v2-cup']))
        expect(map['2v2-cup'].pickBanOpen).toBe(1)
    })
})

describe('eventAttentionCount', () => {
    it('sums an event attention record', () => {
        expect(eventAttentionCount({ awaitingSchedule: 2, invitations: 1, pickBanOpen: 1 })).toBe(4)
    })
})

describe('totalEventAttentionCount', () => {
    it('sums across events', () => {
        const map = computeEventAttention(
            [entry({ whose_turn: TEAM_A.id })],
            [
                membership(),
                membership({ membership_status: 'invited', tournament: tournamentSummary({ id: 't2', slug: 'other-cup', name: 'Other Cup' }) }),
            ],
            new Set(['other-cup']),
        )
        expect(totalEventAttentionCount(map)).toBe(3)
    })

    it('is zero for an empty map', () => {
        expect(totalEventAttentionCount({})).toBe(0)
    })
})

describe('combinedEventAttention', () => {
    it('adds parts across events into a single record', () => {
        const map = computeEventAttention(
            [entry({ whose_turn: TEAM_A.id })],
            [
                membership(),
                membership({ membership_status: 'invited', tournament: tournamentSummary({ id: 't2', slug: 'other-cup', name: 'Other Cup' }) }),
            ],
            new Set(['other-cup']),
        )
        expect(combinedEventAttention(map)).toEqual({ awaitingSchedule: 1, invitations: 1, pickBanOpen: 1 })
    })
})

describe('eventAttentionTooltip', () => {
    it('is empty when nothing is pending', () => {
        expect(eventAttentionTooltip({ awaitingSchedule: 0, invitations: 0, pickBanOpen: 0 })).toBe('')
    })

    it('joins non-zero parts with pluralisation', () => {
        expect(eventAttentionTooltip({ awaitingSchedule: 1, invitations: 1, pickBanOpen: 1 }))
            .toBe('1 match waiting on your team to pick a time · 1 team invitation · Picks & Bans lobby open')
        expect(eventAttentionTooltip({ awaitingSchedule: 2, invitations: 3, pickBanOpen: 0 }))
            .toBe('2 matches waiting on your team to pick a time · 3 team invitations')
    })
})
