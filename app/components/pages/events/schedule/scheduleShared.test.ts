import { describe, expect, it } from 'vitest'
import type { EventMatch, EventSummary, EventTeam, MyTournamentMembership, ScheduleEntry, ScheduleProposal } from '@/app/utils/api'
import {
    awaitingMyResponseCount, formatSlotTime, myTeamIdsByTournament, proposerName, schedulabilityReason, whoseTurnLabel,
} from './scheduleShared'

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
        schedulable: true,
        reason: null,
        whose_turn: TEAM_B.id,
        proposal: proposal(),
        ...patch,
    }
}

describe('schedulabilityReason', () => {
    it('translates a known reason code', () => {
        expect(schedulabilityReason('window_not_open')).toBe("This match's scheduling window is not open yet.")
    })

    it('falls back to a generic message for an unknown code', () => {
        expect(schedulabilityReason('something_new')).toBe('This match cannot be scheduled right now.')
    })

    it('is blank when there is no reason', () => {
        expect(schedulabilityReason(null)).toBe('')
    })
})

describe('formatSlotTime', () => {
    it('renders in the given IANA zone, never a typed abbreviation', () => {
        const rendered = formatSlotTime('2026-09-25T18:00:00+00:00', 'America/New_York')
        expect(rendered).not.toMatch(/UTC|GMT/)
        expect(rendered.length).toBeGreaterThan(0)
    })

    it('falls back gracefully on an unparseable timestamp', () => {
        expect(formatSlotTime('not a date', 'UTC')).toBe('Unknown time')
    })
})

describe('proposerName', () => {
    it('names the proposing team', () => {
        expect(proposerName(entry())).toBe('Alpha')
    })

    it('falls back when the proposal names no known side', () => {
        expect(proposerName(entry({ proposal: proposal({ team_id: 'someone-else' }) }))).toBe('A team')
    })
})

describe('whoseTurnLabel', () => {
    it('says no offer yet when there is no open proposal', () => {
        expect(whoseTurnLabel(entry({ proposal: null, whose_turn: null }), TEAM_A.id))
            .toBe('No offer yet — either side can propose a time.')
    })

    it('tells the viewer it is their turn', () => {
        expect(whoseTurnLabel(entry({ whose_turn: TEAM_B.id }), TEAM_B.id)).toBe('Your turn to respond')
    })

    it('names the opponent the viewer is waiting on', () => {
        expect(whoseTurnLabel(entry({ whose_turn: TEAM_B.id }), TEAM_A.id)).toBe('Waiting on Bravo')
    })

    it('names the team by side for a manager with no team in the event', () => {
        expect(whoseTurnLabel(entry({ whose_turn: TEAM_B.id }), null)).toBe('Waiting on Bravo')
    })
})

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

describe('awaitingMyResponseCount', () => {
    it('counts a match where my own team is the one the proposal is waiting on', () => {
        const count = awaitingMyResponseCount([entry({ whose_turn: TEAM_A.id })], [membership()])
        expect(count).toBe(1)
    })

    it('does not count a match waiting on the opponent', () => {
        const count = awaitingMyResponseCount([entry({ whose_turn: TEAM_B.id })], [membership()])
        expect(count).toBe(0)
    })

    it('does not count a match with no open proposal', () => {
        const count = awaitingMyResponseCount([entry({ whose_turn: TEAM_A.id, proposal: null })], [membership()])
        expect(count).toBe(0)
    })

    it('does not count an event I have no active membership in', () => {
        const count = awaitingMyResponseCount([entry({ whose_turn: TEAM_A.id })], [])
        expect(count).toBe(0)
    })
})
