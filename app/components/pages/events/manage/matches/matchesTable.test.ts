import { describe, expect, it } from 'vitest'
import type { EventBracket, EventBracketStage, EventMatch, EventMatchAdmin, EventStreamer } from '@/app/utils/api'
import {
    DEFAULT_MATCHES_FILTER, filterMatchRows, isOpenMatch, matchRows, matchesSummary, staffChoices, withMatchStaff,
    type MatchesFilter,
} from './matchesTable'

const ALPHA = { id: 'team-a', name: 'Alpha', seed: 1, status: 'registered' as const }
const BRAVO = { id: 'team-b', name: 'Bravo', seed: 2, status: 'registered' as const }
const STREAMER: EventStreamer = { id: '111', display_name: 'Caster', twitch_url: null }
const ADMIN: EventMatchAdmin = { id: '222', display_name: 'Referee', role: 3, event_manager: false }

function match(patch: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'match-1', stage_id: 'stage-1', group_id: null, round_no: 1, round_label: null, ordinal: 0,
        team_a: ALPHA, team_b: BRAVO, slot_a_label: null, slot_b_label: null,
        best_of: 4, caps_to_win: 2, mode: 'first_to', status: 'pending',
        winner_team_id: null, is_draw: false, score_a: null, score_b: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        scheduled_at: null, resolved_window: { opens_at: null, closes_at: null },
        stream_url: null, notes: null, published: true,
        winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
        pick_ban_status: 'none', streamer: null, match_admin: null,
        ...patch,
    }
}

function stage(key: string, ordinal: number, matches: EventMatch[], kind: EventBracketStage['kind'] = 'groups'): EventBracketStage {
    return {
        id: `stage-${key}`, key, name: key === 'groups' ? 'Group Stage' : 'Playoffs', kind, ordinal, status: 'active',
        published: true, expected_match_duration_minutes: null, config: null, groups: [], entrants: [], matches,
    }
}

function bracket(stages: EventBracketStage[]): EventBracket {
    return { published: true, format: { template: null, spec: null }, stages }
}

function ids(rows: Array<{ match: { id: string } }>): string[] {
    return rows.map(row => row.match.id)
}

function filtered(source: EventBracket, patch: Partial<MatchesFilter>): string[] {
    return ids(filterMatchRows(matchRows(source), { ...DEFAULT_MATCHES_FILTER, ...patch }))
}

describe('isOpenMatch', () => {
    it('treats pending, scheduled and live as open and everything else as finished', () => {
        expect(['pending', 'scheduled', 'live'].every(status => isOpenMatch(status as EventMatch['status']))).toBe(true)
        expect(['complete', 'forfeit', 'bye', 'cancelled'].some(status => isOpenMatch(status as EventMatch['status']))).toBe(false)
    })
})

describe('matchRows', () => {
    it('is empty without a bracket', () => {
        expect(matchRows(null)).toEqual([])
    })

    it('orders by scheduled time with unscheduled last, then stage, round and match order', () => {
        const rows = matchRows(bracket([
            stage('playoffs', 1, [match({ id: 'p-unscheduled', round_no: 1 })], 'single_elim'),
            stage('groups', 0, [
                match({ id: 'g-r2', round_no: 2 }),
                match({ id: 'g-late', scheduled_at: '2026-10-02 20:00:00' }),
                match({ id: 'g-r1-b', ordinal: 1 }),
                match({ id: 'g-soon', scheduled_at: '2026-10-01 18:00:00' }),
                match({ id: 'g-r1-a', ordinal: 0 }),
            ]),
        ]))

        expect(ids(rows)).toEqual(['g-soon', 'g-late', 'g-r1-a', 'g-r1-b', 'g-r2', 'p-unscheduled'])
    })

    it('carries the stage, round label, team names and assignments of each match', () => {
        const [row] = matchRows(bracket([stage('groups', 0, [
            match({ round_no: 3, team_b: null, slot_b_label: 'Winner of A1', streamer: STREAMER, match_admin: ADMIN }),
        ])]))

        expect(row.stageName).toBe('Group Stage')
        expect(row.roundLabel).toBe('Round 3')
        expect(row.teamAName).toBe('Alpha')
        expect(row.teamBName).toBe('Winner of A1')
        expect(row.streamer).toEqual(STREAMER)
        expect(row.matchAdmin).toEqual(ADMIN)
        expect(row.drawsAllowed).toBe(true)
    })

    it('falls back to TBD and to no assignment when the payload has neither', () => {
        const [row] = matchRows(bracket([stage('playoffs', 0, [
            match({ team_a: null, streamer: undefined, match_admin: undefined }),
        ], 'single_elim')]))

        expect(row.teamAName).toBe('TBD')
        expect(row.streamer).toBeNull()
        expect(row.matchAdmin).toBeNull()
        expect(row.drawsAllowed).toBe(false)
    })

    it('shows the series score once a match is live or finished, never for an unplayed one', () => {
        const rows = matchRows(bracket([stage('groups', 0, [
            match({ id: 'final', status: 'complete', score_a: 3, score_b: 1 }),
            match({ id: 'live', status: 'live', score_a: 1, score_b: 0, ordinal: 1 }),
            match({ id: 'pending', status: 'pending', score_a: 0, score_b: 0, ordinal: 2 }),
            match({ id: 'unscored', status: 'complete', ordinal: 3 }),
        ])]))
        const score = (id: string) => rows.find(row => row.match.id === id)?.score

        expect(score('final')).toBe('3–1')
        expect(score('live')).toBe('1–0')
        expect(score('pending')).toBeNull()
        expect(score('unscored')).toBeNull()
    })
})

describe('filterMatchRows', () => {
    const source = bracket([
        stage('groups', 0, [
            match({ id: 'open-staffed', streamer: STREAMER, match_admin: ADMIN }),
            match({ id: 'open-bare', ordinal: 1 }),
            match({ id: 'done', status: 'complete', ordinal: 2 }),
        ]),
        stage('playoffs', 1, [
            match({ id: 'playoff', team_a: { ...ALPHA, name: 'Charlie' } }),
        ], 'single_elim'),
    ])

    it('shows open matches by default', () => {
        expect(filtered(source, {})).toEqual(['open-staffed', 'open-bare', 'playoff'])
    })

    it('filters by status', () => {
        expect(filtered(source, { status: 'finished' })).toEqual(['done'])
        expect(filtered(source, { status: 'all' })).toEqual(['open-staffed', 'open-bare', 'done', 'playoff'])
    })

    it('filters by stage', () => {
        expect(filtered(source, { stage: 'playoffs' })).toEqual(['playoff'])
    })

    it('filters to matches missing a match admin or a streamer', () => {
        expect(filtered(source, { staff: 'needs_admin' })).toEqual(['open-bare', 'playoff'])
        expect(filtered(source, { staff: 'needs_streamer' })).toEqual(['open-bare', 'playoff'])
    })

    it('searches team, streamer and match admin names without caring about case', () => {
        expect(filtered(source, { search: 'charlie' })).toEqual(['playoff'])
        expect(filtered(source, { search: ' REFEREE ' })).toEqual(['open-staffed'])
        expect(filtered(source, { search: 'cast' })).toEqual(['open-staffed'])
        expect(filtered(source, { search: '   ' })).toEqual(['open-staffed', 'open-bare', 'playoff'])
    })
})

describe('matchesSummary', () => {
    it('counts open matches and how many of them still lack a match admin or a streamer', () => {
        const rows = matchRows(bracket([stage('groups', 0, [
            match({ id: 'a', match_admin: ADMIN }),
            match({ id: 'b', streamer: STREAMER, ordinal: 1 }),
            match({ id: 'c', ordinal: 2 }),
            match({ id: 'd', status: 'complete', ordinal: 3 }),
        ])]))

        expect(matchesSummary(rows)).toEqual({ open: 3, withoutAdmin: 2, withoutStreamer: 2 })
    })
})

describe('withMatchStaff', () => {
    it('patches only the named match and keeps every other stage and match as it was', () => {
        const untouched = stage('playoffs', 1, [match({ id: 'other' })], 'single_elim')
        const source = bracket([stage('groups', 0, [match({ id: 'target' }), match({ id: 'sibling', ordinal: 1 })]), untouched])

        const next = withMatchStaff(source, 'target', { match_admin: ADMIN })

        expect(next.stages[0].matches[0].match_admin).toEqual(ADMIN)
        expect(next.stages[0].matches[0].streamer).toBeNull()
        expect(next.stages[0].matches[1]).toBe(source.stages[0].matches[1])
        expect(next.stages[1]).toBe(untouched)
        expect(source.stages[0].matches[0].match_admin).toBeNull()
    })
})

describe('staffChoices', () => {
    const OTHER: EventMatchAdmin = { id: '333', display_name: 'Other', role: 1, event_manager: false }

    it('keeps the list when the current pick is already in it', () => {
        expect(staffChoices([ADMIN, OTHER], ADMIN)).toEqual([ADMIN, OTHER])
        expect(staffChoices([ADMIN, OTHER], null)).toEqual([ADMIN, OTHER])
    })

    it('puts a current pick missing from the list first, so it stays selectable', () => {
        expect(staffChoices([OTHER], ADMIN)).toEqual([ADMIN, OTHER])
    })
})
