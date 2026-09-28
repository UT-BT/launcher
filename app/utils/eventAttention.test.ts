import { describe, expect, it } from 'vitest'
import type { EventMatch, EventSummary, EventTeam, MyPickBanSession, MyTournamentMembership, ScheduleEntry, ScheduleProposal } from './api'
import {
    combinedEventAttention, computeEventAttention, eventAttentionCount, eventAttentionLines, eventTodos,
    myTeamIdsByTournament, openLobbySlugs, scheduleTodoSummary, todoCountsByKind,
    type EventAttention, type EventTodo,
} from './eventAttention'

const TEAM_A = { id: 'team-a', name: 'Alpha', seed: 1, status: 'registered' as const }
const TEAM_B = { id: 'team-b', name: 'Bravo', seed: 2, status: 'registered' as const }
const TEAM_C = { id: 'team-c', name: 'Charlie', seed: 3, status: 'registered' as const }
const OTHER_CUP = { id: 't2', slug: 'other-cup', name: 'Other Cup' }
const OPEN_LOBBY: MyPickBanSession = { match_id: 'match-1', status: 'lobby' }

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
        pick_ban_session: null,
        ...patch,
    }
}

function attention(patch: Partial<EventAttention> = {}): EventAttention {
    return { offersToAnswer: 0, matchesToSchedule: 0, invitations: 0, pickBanOpen: false, ...patch }
}

describe('eventTodos', () => {
    it('asks my team to respond when the open offer is waiting on us', () => {
        const todos = eventTodos([entry({ whose_turn: TEAM_A.id })], TEAM_A.id, [])
        expect(todos.map(todo => todo.kind)).toEqual(['answer-times'])
    })

    it('asks my team to propose when a schedulable match of ours has no offer yet', () => {
        const todos = eventTodos([entry({ proposal: null, whose_turn: null })], TEAM_A.id, [])
        expect(todos.map(todo => todo.kind)).toEqual(['propose-time'])
    })

    it('stays quiet while the opponent owes a response', () => {
        expect(eventTodos([entry({ whose_turn: TEAM_B.id })], TEAM_A.id, [])).toEqual([])
    })

    it('stays quiet for a match that cannot be scheduled yet', () => {
        expect(eventTodos([entry({ proposal: null, whose_turn: null, schedulable: false })], TEAM_A.id, [])).toEqual([])
    })

    it('stays quiet for a match my team does not play in', () => {
        const theirs = entry({ proposal: null, whose_turn: null, match: match({ team_a: TEAM_B, team_b: TEAM_C }) })
        expect(eventTodos([theirs], TEAM_A.id, [])).toEqual([])
    })

    it('lists invitations only while I have no team in the event', () => {
        const invitation = myTeam({ id: 'team-x', name: 'Xray' })
        expect(eventTodos([], null, [invitation]).map(todo => todo.kind)).toEqual(['invitation'])
        expect(eventTodos([], TEAM_A.id, [invitation])).toEqual([])
    })

    it('ignores schedule entries while I have no team in the event', () => {
        expect(eventTodos([entry({ whose_turn: TEAM_A.id })], null, [])).toEqual([])
    })
})

describe('computeEventAttention', () => {
    it('groups schedule to-dos by the entry event slug', () => {
        const map = computeEventAttention(
            [
                entry({ whose_turn: TEAM_A.id }),
                entry({ tournament: OTHER_CUP, proposal: null, whose_turn: null }),
            ],
            [
                membership(),
                membership({ tournament: tournamentSummary(OTHER_CUP) }),
            ],
        )
        expect(map['2v2-cup']).toEqual(attention({ offersToAnswer: 1 }))
        expect(map['other-cup']).toEqual(attention({ matchesToSchedule: 1 }))
    })

    it('needs an active membership for schedule to-dos', () => {
        const map = computeEventAttention(
            [entry({ whose_turn: TEAM_A.id }), entry({ proposal: null, whose_turn: null })],
            [membership({ membership_status: 'invited' })],
        )
        expect(map['2v2-cup']).toEqual(attention({ invitations: 1 }))
    })

    it('counts invited membership rows per slug and does not count active rows as invitations', () => {
        const map = computeEventAttention(
            [],
            [
                membership({ membership_status: 'invited' }),
                membership({ membership_status: 'invited', tournament: tournamentSummary(OTHER_CUP) }),
                membership({ membership_status: 'active', tournament: tournamentSummary({ id: 't3', slug: 'third-cup', name: 'Third Cup' }) }),
            ],
        )
        expect(map['2v2-cup'].invitations).toBe(1)
        expect(map['other-cup'].invitations).toBe(1)
        expect(map['third-cup']).toBeUndefined()
    })

    it('marks an open lobby without counting it', () => {
        const map = computeEventAttention([], [membership({ pick_ban_session: OPEN_LOBBY })])
        expect(map['2v2-cup']).toEqual(attention({ pickBanOpen: true }))
        expect(eventAttentionCount(map['2v2-cup'])).toBe(0)
    })

    it('leaves events with nothing to do out of the map', () => {
        expect(computeEventAttention([entry({ whose_turn: TEAM_B.id })], [membership()])).toEqual({})
    })
})

describe('openLobbySlugs', () => {
    it('includes an active membership with an open session', () => {
        expect([...openLobbySlugs([membership({ pick_ban_session: OPEN_LOBBY })])]).toEqual(['2v2-cup'])
    })

    it('excludes an active membership without a session', () => {
        expect([...openLobbySlugs([membership()])]).toEqual([])
    })

    it('excludes invited rows', () => {
        expect([...openLobbySlugs([membership({ membership_status: 'invited', pick_ban_session: OPEN_LOBBY })])]).toEqual([])
    })

    it('collapses duplicate slugs', () => {
        const slugs = openLobbySlugs([
            membership({ pick_ban_session: OPEN_LOBBY }),
            membership({ team: myTeam({ id: 'team-x' }), pick_ban_session: { match_id: 'match-2', status: 'running' } }),
        ])
        expect([...slugs]).toEqual(['2v2-cup'])
    })
})

describe('combinedEventAttention', () => {
    it('adds counts across events and keeps any open lobby', () => {
        const map = computeEventAttention(
            [entry({ whose_turn: TEAM_A.id })],
            [
                membership(),
                membership({ membership_status: 'invited', tournament: tournamentSummary(OTHER_CUP) }),
                membership({ tournament: tournamentSummary({ id: 't3', slug: 'third-cup', name: 'Third Cup' }), pick_ban_session: OPEN_LOBBY }),
            ],
        )
        const combined = combinedEventAttention(map)
        expect(combined).toEqual(attention({ offersToAnswer: 1, invitations: 1, pickBanOpen: true }))
        expect(eventAttentionCount(combined)).toBe(2)
    })

    it('is empty for an empty map', () => {
        expect(combinedEventAttention({})).toEqual(attention())
    })
})

describe('eventAttentionLines', () => {
    it('is empty when nothing is pending', () => {
        expect(eventAttentionLines(attention())).toEqual([])
    })

    it('spells out each part with pluralisation', () => {
        expect(eventAttentionLines(attention({ offersToAnswer: 1, matchesToSchedule: 1, invitations: 1, pickBanOpen: true }))).toEqual([
            'Respond to a time offer for 1 match',
            'Propose a time for 1 match',
            'Answer 1 team invitation',
            'Join your open Picks & Bans lobby',
        ])
        expect(eventAttentionLines(attention({ offersToAnswer: 2, matchesToSchedule: 3, invitations: 2 }))).toEqual([
            'Respond to time offers for 2 matches',
            'Propose a time for 3 matches',
            'Answer 2 team invitations',
        ])
    })
})

describe('todoCountsByKind', () => {
    it('counts each to-do kind', () => {
        const todos: EventTodo[] = [
            { kind: 'answer-times', entry: entry() },
            { kind: 'answer-times', entry: entry({ match: match({ id: 'match-2' }) }) },
            { kind: 'propose-time', entry: entry({ match: match({ id: 'match-3' }) }) },
            { kind: 'invitation', team: myTeam({ id: 'team-x', name: 'Xray' }) },
        ]
        expect(todoCountsByKind(todos)).toEqual({ offersToAnswer: 2, matchesToSchedule: 1, invitations: 1 })
    })

    it('is all zeros for no to-dos', () => {
        expect(todoCountsByKind([])).toEqual({ offersToAnswer: 0, matchesToSchedule: 0, invitations: 0 })
    })
})

describe('scheduleTodoSummary', () => {
    it('counts answer and propose to-dos and ignores invitations', () => {
        expect(scheduleTodoSummary({ offersToAnswer: 2, matchesToSchedule: 1, invitations: 4 })).toEqual({
            count: 3,
            lines: ['Respond to time offers for 2 matches', 'Propose a time for 1 match'],
        })
    })

    it('spells out the Schedule-tab tooltip lines in the singular', () => {
        expect(scheduleTodoSummary({ offersToAnswer: 1, matchesToSchedule: 0, invitations: 0 }).lines)
            .toEqual(['Respond to a time offer for 1 match'])
        expect(scheduleTodoSummary({ offersToAnswer: 0, matchesToSchedule: 1, invitations: 0 }).lines)
            .toEqual(['Propose a time for 1 match'])
    })

    it('returns an empty result for no to-dos', () => {
        expect(scheduleTodoSummary({ offersToAnswer: 0, matchesToSchedule: 0, invitations: 0 })).toEqual({ count: 0, lines: [] })
    })
})

describe('myTeamIdsByTournament', () => {
    it('maps a tournament slug to the active team id', () => {
        const map = myTeamIdsByTournament([membership()])
        expect(map.get('2v2-cup')).toBe(TEAM_A.id)
    })

    it('ignores a membership that is only invited, not active', () => {
        const map = myTeamIdsByTournament([membership({ membership_status: 'invited' })])
        expect(map.has('2v2-cup')).toBe(false)
    })
})
