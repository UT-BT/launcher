import { describe, expect, it } from 'vitest'
import type { EventMatch, MatchPickBanStatus, MyMatchEntry, ScheduleEntry } from '@/app/utils/api'
import { formatSlotTime } from '@/app/utils/timezone'
import { matchRoundLabel, matchTimeLabel, pickBanCallToAction, scheduleSections, type ScheduleViewer } from './scheduleSections'

const TEAM_A = { id: 'team-a', name: 'Alpha', seed: 1, status: 'registered' as const }
const TEAM_B = { id: 'team-b', name: 'Bravo', seed: 2, status: 'registered' as const }

const PLAYER: ScheduleViewer = { hasTeam: true, canManageBracket: false, isStreamer: false }
const STREAMER: ScheduleViewer = { hasTeam: false, canManageBracket: false, isStreamer: true }

function match(patch: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'match-1', stage_id: 'stage-1', group_id: null, round_no: 1, round_label: null, ordinal: 0,
        team_a: TEAM_A, team_b: TEAM_B, slot_a_label: null, slot_b_label: null,
        best_of: 3, caps_to_win: 4, mode: 'first_to', status: 'scheduled',
        winner_team_id: null, is_draw: false, score_a: null, score_b: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        scheduled_at: '2026-09-26 20:00:00', resolved_window: { opens_at: null, closes_at: null },
        stream_url: null, notes: null, published: true,
        winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
        pick_ban_status: 'none',
        ...patch,
    }
}

function mine(patch: Partial<EventMatch>, roles: MyMatchEntry['roles'] = ['player']): MyMatchEntry {
    return {
        match: match(patch),
        stage: { key: 'groups', name: 'Group Stage' },
        roles,
        streamer: null,
    }
}

function pending(patch: Partial<EventMatch>): ScheduleEntry {
    return {
        tournament: { id: 't1', slug: '2v2-cup', name: '2v2 Cup' },
        match: match({ status: 'pending', scheduled_at: null, ...patch }),
        slot_window: { opens_at: null, closes_at: null },
        schedulable: true,
        reason: null,
        whose_turn: null,
        proposal: null,
    }
}

function ids(entries: Array<{ match: { id: string } }>): string[] {
    return entries.map(entry => entry.match.id)
}

describe('scheduleSections', () => {
    it('splits booked player matches from the ones that still need a time', () => {
        const sections = scheduleSections([pending({ id: 'p1' })], [mine({ id: 'b1' })], PLAYER)

        expect(ids(sections.upcoming)).toEqual(['b1'])
        expect(ids(sections.needsTime)).toEqual(['p1'])
        expect(sections.streaming).toEqual([])
        expect(sections.showPlayer).toBe(true)
        expect(sections.showStreaming).toBe(false)
    })

    it('puts a live match first, then the soonest booked time, with no time last', () => {
        const sections = scheduleSections([], [
            mine({ id: 'late', scheduled_at: '2026-09-27 20:00:00' }),
            mine({ id: 'none', scheduled_at: null }),
            mine({ id: 'soon', scheduled_at: '2026-09-26 18:00:00' }),
            mine({ id: 'live', status: 'live', scheduled_at: '2026-09-28 18:00:00' }),
        ], PLAYER)

        expect(ids(sections.upcoming)).toEqual(['live', 'soon', 'late', 'none'])
    })

    it('keeps the server order between matches booked for the same time', () => {
        const at = '2026-09-26 18:00:00'
        const sections = scheduleSections([], [
            mine({ id: 'first', scheduled_at: at }),
            mine({ id: 'second', scheduled_at: at }),
            mine({ id: 'third', scheduled_at: at }),
        ], PLAYER)

        expect(ids(sections.upcoming)).toEqual(['first', 'second', 'third'])
    })

    it('leaves a pending match to the needs-a-time list even if it shows up as a player match', () => {
        const sections = scheduleSections([pending({ id: 'm1' })], [mine({ id: 'm1', status: 'pending' })], PLAYER)

        expect(sections.upcoming).toEqual([])
        expect(ids(sections.needsTime)).toEqual(['m1'])
    })

    it('never lists a booked match twice when both reads caught it mid-change', () => {
        const sections = scheduleSections([pending({ id: 'm1' })], [mine({ id: 'm1', status: 'scheduled' })], PLAYER)

        expect(ids(sections.upcoming)).toEqual(['m1'])
        expect(sections.needsTime).toEqual([])
    })

    it('lists a streamer their assigned matches whatever their status, live first', () => {
        const sections = scheduleSections([], [
            mine({ id: 'unbooked', status: 'pending', scheduled_at: null }, ['streamer']),
            mine({ id: 'booked', scheduled_at: '2026-09-26 18:00:00' }, ['streamer']),
            mine({ id: 'live', status: 'live' }, ['streamer']),
        ], STREAMER)

        expect(ids(sections.streaming)).toEqual(['live', 'booked', 'unbooked'])
        expect(sections.upcoming).toEqual([])
        expect(sections.showStreaming).toBe(true)
        expect(sections.showPlayer).toBe(false)
    })

    it('shows a streamer the streaming section even with nothing assigned yet', () => {
        const sections = scheduleSections([], [], STREAMER)

        expect(sections.showStreaming).toBe(true)
        expect(sections.streaming).toEqual([])
    })

    it('shows both sections to a player who also streams, and a match with both roles in both', () => {
        const sections = scheduleSections([], [mine({ id: 'both' }, ['player', 'streamer'])], { ...PLAYER, isStreamer: true })

        expect(ids(sections.upcoming)).toEqual(['both'])
        expect(ids(sections.streaming)).toEqual(['both'])
        expect(sections.showPlayer).toBe(true)
        expect(sections.showStreaming).toBe(true)
    })

    it('keeps the player sections for a bracket manager with no team', () => {
        const sections = scheduleSections([], [], { hasTeam: false, canManageBracket: true, isStreamer: false })

        expect(sections.showPlayer).toBe(true)
        expect(sections.showStreaming).toBe(false)
    })

    it('treats a read that has not loaded as empty', () => {
        const sections = scheduleSections(null, null, PLAYER)

        expect(sections.upcoming).toEqual([])
        expect(sections.needsTime).toEqual([])
        expect(sections.streaming).toEqual([])
    })

    it('still shows a streaming section when a match is assigned but the viewer is not flagged a streamer', () => {
        const sections = scheduleSections([], [mine({ id: 's1' }, ['streamer'])], { hasTeam: false, canManageBracket: false, isStreamer: false })

        expect(sections.showStreaming).toBe(true)
    })
})

describe('pickBanCallToAction', () => {
    it.each<MatchPickBanStatus>(['lobby', 'running', 'paused'])('offers Join while the pick/ban is %s', (status) => {
        expect(pickBanCallToAction(match({ pick_ban_status: status }), null)).toBe('join')
    })

    it('offers View once the pick/ban is complete', () => {
        expect(pickBanCallToAction(match({ pick_ban_status: 'complete' }), null)).toBe('view')
    })

    it('offers the quiet page link before any lobby opens', () => {
        expect(pickBanCallToAction(match({ pick_ban_status: 'none' }), null)).toBe('page')
    })

    it('trusts the fresher open session over a stale match status', () => {
        expect(pickBanCallToAction(match({ id: 'm1', pick_ban_status: 'none' }), { match_id: 'm1', status: 'lobby' })).toBe('join')
    })

    it('ignores an open session that belongs to another match', () => {
        expect(pickBanCallToAction(match({ id: 'm1', pick_ban_status: 'none' }), { match_id: 'm2', status: 'running' })).toBe('page')
    })
})

describe('matchTimeLabel', () => {
    it('says Live now for a live match whatever its booked time', () => {
        expect(matchTimeLabel(match({ status: 'live' }), 'UTC')).toBe('Live now')
    })

    it('renders a booked time in the display zone', () => {
        expect(matchTimeLabel(match({ scheduled_at: '2026-09-26 20:00:00' }), 'Europe/Berlin'))
            .toBe(formatSlotTime('2026-09-26 20:00:00', 'Europe/Berlin'))
    })

    it('says no time is booked for an unbooked match', () => {
        expect(matchTimeLabel(match({ status: 'pending', scheduled_at: null }), 'UTC')).toBe('No time booked yet')
    })
})

describe('matchRoundLabel', () => {
    it('prefers the round label and falls back to the round number', () => {
        expect(matchRoundLabel(match({ round_label: 'Semi-Finals' }))).toBe('Semi-Finals')
        expect(matchRoundLabel(match({ round_label: null, round_no: 3 }))).toBe('Round 3')
    })
})
