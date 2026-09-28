import { describe, expect, it } from 'vitest'
import type { EventBracket, EventBracketStage, EventMatch } from '@/app/utils/api'
import { formatZoned } from '@/app/utils/timezone'
import {
    byDay, nextUp, partition, rows, unscheduledCount, type PublicScheduleDay, type PublicScheduleRow,
} from './publicSchedule'

const TEAM_A = { id: 'team-a', name: 'Alpha', seed: 1, status: 'registered' as const }
const TEAM_B = { id: 'team-b', name: 'Bravo', seed: 2, status: 'registered' as const }

function match(patch: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'match-1', stage_id: 'stage-1', group_id: null, round_no: 1, round_label: null, ordinal: 0,
        team_a: TEAM_A, team_b: TEAM_B, slot_a_label: null, slot_b_label: null,
        best_of: 3, caps_to_win: 4, mode: 'first_to', status: 'scheduled',
        winner_team_id: null, is_draw: false, score_a: null, score_b: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        scheduled_at: '2026-10-03 18:00:00', resolved_window: { opens_at: null, closes_at: null },
        stream_url: null, notes: null, published: true,
        winner_to_match_id: null, winner_to_slot: null, loser_to_match_id: null, loser_to_slot: null,
        pick_ban_status: 'none',
        ...patch,
    }
}

function stage(patch: Partial<EventBracketStage> = {}): EventBracketStage {
    return {
        id: 'stage-1', key: 'groups', name: 'Group Stage', kind: 'groups', ordinal: 0,
        status: 'active', published: true, expected_match_duration_minutes: null, config: null,
        groups: [], entrants: [], matches: [],
        ...patch,
    }
}

function bracket(...stages: EventBracketStage[]): EventBracket {
    return { published: true, format: { template: null, spec: null }, stages }
}

function ids(entries: Array<{ match: { id: string } }>): string[] {
    return entries.map(entry => entry.match.id)
}

function upcoming(...matches: EventMatch[]): PublicScheduleRow[] {
    return partition(rows(bracket(stage({ matches })))).upcoming
}

function days(groups: PublicScheduleDay[]): Array<{ key: string; label: string; ids: string[] }> {
    return groups.map(day => ({ key: day.key, label: day.label, ids: ids(day.rows) }))
}

const NOW = Date.parse('2026-10-03T12:00:00Z')

describe('rows', () => {
    it('turns a published, booked match into a row with its stage, group and start time', () => {
        const booked = match({ id: 'm1', group_id: 'ga' })
        const groups = stage({
            name: 'Group Stage', ordinal: 0, kind: 'groups',
            groups: [{ id: 'ga', name: 'Group A', ordinal: 0, standings: [] }],
            matches: [booked],
        })

        expect(rows(bracket(groups))).toEqual([{
            match: booked,
            stage: { name: 'Group Stage', ordinal: 0, kind: 'groups' },
            group: { name: 'Group A', ordinal: 0 },
            startsAt: Date.parse('2026-10-03T18:00:00Z'),
        }])
    })

    it.each<[string, EventBracketStage]>([
        ['in an unpublished stage', stage({ published: false, matches: [match()] })],
        ['that is explicitly unpublished', stage({ matches: [match({ published: false })] })],
        ['with no time booked', stage({ matches: [match({ status: 'pending', scheduled_at: null })] })],
        ['that was cancelled', stage({ matches: [match({ status: 'cancelled' })] })],
        ['that is a bye', stage({ matches: [match({ status: 'bye' })] })],
    ])('leaves out a match %s', (_, hidden) => {
        expect(rows(bracket(hidden))).toEqual([])
    })

    it('shows a manager nothing while the whole bracket is unpublished, as the public sees it', () => {
        expect(rows({ ...bracket(stage({ matches: [match()] })), published: false })).toEqual([])
    })

    it('treats a bracket that has not loaded as empty', () => {
        expect(rows(null)).toEqual([])
    })

    it('flattens every stage, keeping each match with its own stage', () => {
        const schedule = rows(bracket(
            stage({ name: 'Group Stage', ordinal: 0, kind: 'groups', matches: [match({ id: 'g1' }), match({ id: 'g2' })] }),
            stage({ name: 'Playoffs', ordinal: 1, kind: 'single_elim', matches: [match({ id: 'p1' })] }),
        ))

        expect(schedule.map(row => [row.match.id, row.stage.name, row.stage.kind]))
            .toEqual([['g1', 'Group Stage', 'groups'], ['g2', 'Group Stage', 'groups'], ['p1', 'Playoffs', 'single_elim']])
    })

    it('has no group for a match outside any group, or in a group the stage does not list', () => {
        const schedule = rows(bracket(stage({
            groups: [{ id: 'ga', name: 'Group A', ordinal: 0, standings: [] }],
            matches: [match({ id: 'loose', group_id: null }), match({ id: 'stray', group_id: 'gz' })],
        })))

        expect(schedule.map(row => row.group)).toEqual([null, null])
    })

    it('reads a zone-less timestamp as UTC, the same instant as an offset one', () => {
        const schedule = rows(bracket(stage({
            matches: [
                match({ id: 'bare', scheduled_at: '2026-10-03 23:30:00' }),
                match({ id: 'offset', scheduled_at: '2026-10-04T01:30:00+02:00' }),
            ],
        })))

        expect(schedule.map(row => row.startsAt))
            .toEqual([Date.parse('2026-10-03T23:30:00Z'), Date.parse('2026-10-03T23:30:00Z')])
    })

    it('leaves out a match whose time cannot be read', () => {
        expect(rows(bracket(stage({ matches: [match({ scheduled_at: 'not a date' })] })))).toEqual([])
    })
})

describe('partition', () => {
    it('splits live, upcoming and played matches by status', () => {
        const buckets = partition(rows(bracket(stage({
            matches: [
                match({ id: 'live', status: 'live', scheduled_at: '2026-10-03 11:00:00' }),
                match({ id: 'booked', status: 'scheduled', scheduled_at: '2026-10-03 18:00:00' }),
                match({ id: 'pending', status: 'pending', scheduled_at: '2026-10-03 20:00:00' }),
                match({ id: 'won', status: 'complete', scheduled_at: '2026-10-02 18:00:00' }),
                match({ id: 'forfeited', status: 'forfeit', scheduled_at: '2026-10-01 18:00:00' }),
            ],
        }))))

        expect(ids(buckets.live)).toEqual(['live'])
        expect(ids(buckets.upcoming)).toEqual(['booked', 'pending'])
        expect(ids(buckets.played)).toEqual(['won', 'forfeited'])
    })

    it('lists live matches in start order', () => {
        const buckets = partition(rows(bracket(stage({
            matches: [
                match({ id: 'second', status: 'live', scheduled_at: '2026-10-03 11:30:00' }),
                match({ id: 'first', status: 'live', scheduled_at: '2026-10-03 11:00:00' }),
            ],
        }))))

        expect(ids(buckets.live)).toEqual(['first', 'second'])
    })

    it('keeps a booked match whose start has passed in upcoming, ahead of the later ones', () => {
        const buckets = partition(rows(bracket(stage({
            matches: [
                match({ id: 'later', scheduled_at: '2026-10-04 18:00:00' }),
                match({ id: 'overdue', scheduled_at: '2026-10-02 18:00:00' }),
                match({ id: 'soon', scheduled_at: '2026-10-03 18:00:00' }),
            ],
        }))))

        expect(ids(buckets.upcoming)).toEqual(['overdue', 'soon', 'later'])
        expect(buckets.live).toEqual([])
        expect(buckets.played).toEqual([])
    })

    it('lists played matches most recent first', () => {
        const buckets = partition(rows(bracket(stage({
            matches: [
                match({ id: 'oldest', status: 'complete', scheduled_at: '2026-09-30 18:00:00' }),
                match({ id: 'newest', status: 'complete', scheduled_at: '2026-10-02 18:00:00' }),
                match({ id: 'middle', status: 'forfeit', scheduled_at: '2026-10-01 18:00:00' }),
            ],
        }))))

        expect(ids(buckets.played)).toEqual(['newest', 'middle', 'oldest'])
    })

    it('breaks a tie in start time by stage ordinal, then round, then match ordinal', () => {
        const at = '2026-10-03 18:00:00'
        const buckets = partition(rows(bracket(
            stage({ ordinal: 1, matches: [match({ id: 'playoffs', round_no: 1, ordinal: 0, scheduled_at: at })] }),
            stage({
                ordinal: 0,
                matches: [
                    match({ id: 'round-2', round_no: 2, ordinal: 0, scheduled_at: at }),
                    match({ id: 'round-1-second', round_no: 1, ordinal: 1, scheduled_at: at }),
                    match({ id: 'round-1-first', round_no: 1, ordinal: 0, scheduled_at: at }),
                ],
            }),
        )))

        expect(ids(buckets.upcoming)).toEqual(['round-1-first', 'round-1-second', 'round-2', 'playoffs'])
    })

    it('keeps a group together between same-time matches of one round, as the bracket does', () => {
        const at = '2026-10-03 18:00:00'
        const buckets = partition(rows(bracket(stage({
            groups: [
                { id: 'ga', name: 'Group A', ordinal: 0, standings: [] },
                { id: 'gb', name: 'Group B', ordinal: 1, standings: [] },
            ],
            matches: [
                match({ id: 'b0', group_id: 'gb', ordinal: 0, scheduled_at: at }),
                match({ id: 'a1', group_id: 'ga', ordinal: 1, scheduled_at: at }),
                match({ id: 'a0', group_id: 'ga', ordinal: 0, scheduled_at: at }),
                match({ id: 'b1', group_id: 'gb', ordinal: 1, scheduled_at: at }),
            ],
        }))))

        expect(ids(buckets.upcoming)).toEqual(['a0', 'a1', 'b0', 'b1'])
    })

    it('keeps bracket order among played matches that started at the same time', () => {
        const at = '2026-10-02 18:00:00'
        const buckets = partition(rows(bracket(stage({
            matches: [
                match({ id: 'round-2', status: 'complete', round_no: 2, scheduled_at: at }),
                match({ id: 'earlier', status: 'complete', round_no: 1, scheduled_at: '2026-10-01 18:00:00' }),
                match({ id: 'round-1', status: 'forfeit', round_no: 1, scheduled_at: at }),
            ],
        }))))

        expect(ids(buckets.played)).toEqual(['round-1', 'round-2', 'earlier'])
    })

    it('lands on the same order whichever order the bracket sent', () => {
        const at = '2026-10-03 18:00:00'
        const twins = [match({ id: 'zz', scheduled_at: at }), match({ id: 'aa', scheduled_at: at })]

        const forwards = ids(partition(rows(bracket(stage({ matches: twins })))).upcoming)
        const backwards = ids(partition(rows(bracket(stage({ matches: [...twins].reverse() })))).upcoming)

        expect(forwards).toEqual(['aa', 'zz'])
        expect(backwards).toEqual(forwards)
    })
})

describe('byDay', () => {
    it('labels today and tomorrow relative to now in the zone, and dates the days after', () => {
        const schedule = upcoming(
            match({ id: 'afternoon', scheduled_at: '2026-10-03 20:00:00' }),
            match({ id: 'late', scheduled_at: '2026-10-04 03:30:00' }),
            match({ id: 'sunday', scheduled_at: '2026-10-04 18:00:00' }),
            match({ id: 'tuesday-night', scheduled_at: '2026-10-07 02:00:00' }),
        )

        expect(days(byDay(schedule, 'America/New_York', NOW))).toEqual([
            { key: '2026-10-03', label: 'Today', ids: ['afternoon', 'late'] },
            { key: '2026-10-04', label: 'Tomorrow', ids: ['sunday'] },
            {
                key: '2026-10-06',
                label: formatZoned(Date.parse('2026-10-07T02:00:00Z'), 'America/New_York', { weekday: 'short', day: 'numeric', month: 'short' }),
                ids: ['tuesday-night'],
            },
        ])
    })

    it('works out today from now in the zone, not in UTC', () => {
        const eveningInNewYork = Date.parse('2026-10-04T02:00:00Z')
        const schedule = upcoming(
            match({ id: 'tonight', scheduled_at: '2026-10-04 03:00:00' }),
            match({ id: 'tomorrow', scheduled_at: '2026-10-04 18:00:00' }),
        )

        expect(days(byDay(schedule, 'America/New_York', eveningInNewYork)).map(day => day.label)).toEqual(['Today', 'Tomorrow'])
        expect(days(byDay(schedule, 'UTC', eveningInNewYork))).toEqual([
            { key: '2026-10-04', label: 'Today', ids: ['tonight', 'tomorrow'] },
        ])
    })

    it('buckets by the zone it is given, whatever zone the machine runs in', () => {
        const schedule = upcoming(
            match({ id: 'morning', scheduled_at: '2026-10-05 09:00:00' }),
            match({ id: 'night', scheduled_at: '2026-10-05 11:30:00' }),
        )

        expect(days(byDay(schedule, 'Pacific/Auckland', NOW)).map(day => [day.key, day.ids]))
            .toEqual([['2026-10-05', ['morning']], ['2026-10-06', ['night']]])
        expect(days(byDay(schedule, 'America/Los_Angeles', NOW)).map(day => [day.key, day.ids]))
            .toEqual([['2026-10-05', ['morning', 'night']]])
    })

    it('keeps a 25-hour day together when daylight saving ends', () => {
        const schedule = upcoming(
            match({ id: 'just-after-midnight', scheduled_at: '2026-11-01 04:30:00' }),
            match({ id: 'last-of-the-day', scheduled_at: '2026-11-02 04:30:00' }),
            match({ id: 'next-midnight', scheduled_at: '2026-11-02 05:00:00' }),
        )

        expect(days(byDay(schedule, 'America/New_York', NOW)).map(day => [day.key, day.ids])).toEqual([
            ['2026-11-01', ['just-after-midnight', 'last-of-the-day']],
            ['2026-11-02', ['next-midnight']],
        ])
    })

    it('calls the next calendar day Tomorrow across a daylight-saving change, not 24 hours on', () => {
        const justAfterMidnight = Date.parse('2026-11-01T04:30:00Z')
        const schedule = upcoming(
            match({ id: 'tonight', scheduled_at: '2026-11-02 04:30:00' }),
            match({ id: 'monday', scheduled_at: '2026-11-02 05:00:00' }),
        )

        expect(days(byDay(schedule, 'America/New_York', justAfterMidnight))).toEqual([
            { key: '2026-11-01', label: 'Today', ids: ['tonight'] },
            { key: '2026-11-02', label: 'Tomorrow', ids: ['monday'] },
        ])
    })

    it('places a zone-less timestamp on its UTC instant', () => {
        const schedule = upcoming(match({ id: 'bare', scheduled_at: '2026-10-03 23:30:00' }))

        expect(days(byDay(schedule, 'UTC', NOW))[0].key).toBe('2026-10-03')
        expect(days(byDay(schedule, 'Asia/Tokyo', NOW))[0].key).toBe('2026-10-04')
    })

    it('keeps the order it is given, so played matches read newest day first', () => {
        const played = partition(rows(bracket(stage({
            matches: [
                match({ id: 'first', status: 'complete', scheduled_at: '2026-10-01 18:00:00' }),
                match({ id: 'early', status: 'complete', scheduled_at: '2026-10-02 18:00:00' }),
                match({ id: 'late', status: 'forfeit', scheduled_at: '2026-10-02 20:00:00' }),
            ],
        })))).played

        expect(days(byDay(played, 'UTC', NOW)).map(day => [day.key, day.ids])).toEqual([
            ['2026-10-02', ['late', 'early']],
            ['2026-10-01', ['first']],
        ])
    })

    it('has no days when nothing is scheduled', () => {
        expect(byDay([], 'UTC', NOW)).toEqual([])
    })
})

describe('unscheduledCount', () => {
    it('counts pending matches with both teams decided and no time booked', () => {
        const count = unscheduledCount(bracket(stage({
            matches: [
                match({ id: 'waiting', status: 'pending', scheduled_at: null }),
                match({ id: 'also-waiting', status: 'pending', scheduled_at: null }),
                match({ id: 'no-opponent', status: 'pending', scheduled_at: null, team_b: null }),
                match({ id: 'no-teams', status: 'pending', scheduled_at: null, team_a: null, team_b: null }),
                match({ id: 'booked', status: 'scheduled', scheduled_at: '2026-10-03 18:00:00' }),
                match({ id: 'pending-with-time', status: 'pending', scheduled_at: '2026-10-03 18:00:00' }),
                match({ id: 'cancelled', status: 'cancelled', scheduled_at: null }),
                match({ id: 'bye', status: 'bye', scheduled_at: null, team_b: null }),
                match({ id: 'played', status: 'complete', scheduled_at: null }),
            ],
        })))

        expect(count).toBe(2)
    })

    it('leaves out unpublished stages and matches, and an unpublished bracket', () => {
        const waiting = { status: 'pending' as const, scheduled_at: null }
        const hidden = bracket(
            stage({ published: false, matches: [match(waiting)] }),
            stage({ matches: [match({ ...waiting, published: false }), match(waiting)] }),
        )

        expect(unscheduledCount(hidden)).toBe(1)
        expect(unscheduledCount({ ...hidden, published: false })).toBe(0)
    })

    it('counts every published stage', () => {
        const waiting = { status: 'pending' as const, scheduled_at: null }

        expect(unscheduledCount(bracket(stage({ matches: [match(waiting)] }), stage({ ordinal: 1, matches: [match(waiting)] }))))
            .toBe(2)
    })

    it('treats a bracket that has not loaded as nothing to schedule', () => {
        expect(unscheduledCount(null)).toBe(0)
    })
})

describe('nextUp', () => {
    it('picks the soonest upcoming match that has not started yet', () => {
        const schedule = rows(bracket(stage({
            matches: [
                match({ id: 'later', scheduled_at: '2026-10-04 18:00:00' }),
                match({ id: 'soon', scheduled_at: '2026-10-03 18:00:00' }),
                match({ id: 'pending-soonest', status: 'pending', scheduled_at: '2026-10-03 14:00:00' }),
            ],
        })))

        expect(nextUp(schedule, NOW)?.match.id).toBe('pending-soonest')
    })

    it('never gives the countdown to a match whose start has passed or is right now', () => {
        const schedule = rows(bracket(stage({
            matches: [
                match({ id: 'overdue', scheduled_at: '2026-10-03 10:00:00' }),
                match({ id: 'starting-now', scheduled_at: '2026-10-03 12:00:00' }),
                match({ id: 'future', scheduled_at: '2026-10-03 18:00:00' }),
            ],
        })))

        expect(nextUp(schedule, NOW)?.match.id).toBe('future')
    })

    it('skips live and played matches even when their booked time is still ahead', () => {
        const schedule = rows(bracket(stage({
            matches: [
                match({ id: 'started-early', status: 'live', scheduled_at: '2026-10-03 13:00:00' }),
                match({ id: 'forfeited-early', status: 'forfeit', scheduled_at: '2026-10-03 14:00:00' }),
                match({ id: 'booked', scheduled_at: '2026-10-03 18:00:00' }),
            ],
        })))

        expect(nextUp(schedule, NOW)?.match.id).toBe('booked')
    })

    it('breaks a tie at the same start the way upcoming does', () => {
        const at = '2026-10-03 18:00:00'
        const schedule = rows(bracket(stage({
            matches: [match({ id: 'second', ordinal: 1, scheduled_at: at }), match({ id: 'first', ordinal: 0, scheduled_at: at })],
        })))

        expect(nextUp(schedule, NOW)?.match.id).toBe('first')
    })

    it('has no next match when everything left is overdue, live or played', () => {
        const schedule = rows(bracket(stage({
            matches: [
                match({ id: 'overdue', scheduled_at: '2026-10-03 10:00:00' }),
                match({ id: 'live', status: 'live', scheduled_at: '2026-10-03 18:00:00' }),
                match({ id: 'played', status: 'complete', scheduled_at: '2026-10-02 18:00:00' }),
            ],
        })))

        expect(nextUp(schedule, NOW)).toBeNull()
        expect(nextUp([], NOW)).toBeNull()
    })
})
