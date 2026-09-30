import { describe, expect, it } from 'vitest'
import type { StreamAssignedMatch, StreamDesk, StreamMatch } from '../../streamDesk'
import { REASON_TEXT, buildCurrentMatchView, formatMatchTime } from './currentMatchView'

const NOW = Date.parse('2026-09-26T18:40:00Z')

function assigned(id: string, overrides: Partial<StreamAssignedMatch> = {}): StreamAssignedMatch {
    return {
        id,
        stage: { key: 'groups', name: 'Groups' },
        group: { id: 'g1', name: 'Group A' },
        round: { no: 2, label: null },
        best_of: 3,
        scheduled_at: '2026-09-26T20:00:00+00:00',
        status: 'scheduled',
        stream_url: null,
        public: true,
        finished: false,
        teams: { a: { id: 't1', name: 'Alpha' }, b: { id: 't2', name: 'Bravo' } },
        ...overrides,
    }
}

function onScreen(id: string): StreamMatch {
    return { id } as StreamMatch
}

function desk(overrides: Partial<StreamDesk> = {}): StreamDesk {
    return {
        server_now: '2026-09-26T18:40:00+00:00',
        event: { name: 'Stream Cup', slug: 'cup' },
        streamer: { id: '111', display_name: 'Alice', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: 'none',
        match: null,
        assigned_matches: [],
        next_match: null,
        ...overrides,
    }
}

describe('formatMatchTime', () => {
    it('gives the UTC time and how far away it is', () => {
        expect(formatMatchTime('2026-09-26T20:00:00+00:00', NOW)).toBe('20:00 UTC · in 1h 20m')
        expect(formatMatchTime('2026-09-26T18:55:00+00:00', NOW)).toBe('18:55 UTC · in 15m')
    })

    it('says how long ago a past time was', () => {
        expect(formatMatchTime('2026-09-26T16:10:00+00:00', NOW)).toBe('16:10 UTC · 2h 30m ago')
        expect(formatMatchTime('2026-09-26T18:39:30+00:00', NOW)).toBe('18:39 UTC · now')
    })

    it('adds the UTC day when it is not today', () => {
        expect(formatMatchTime('2026-09-28T09:05:00+00:00', NOW)).toBe('Mon 28 Sep · 09:05 UTC · in 1d 14h')
        expect(formatMatchTime('2026-09-25T21:00:00+00:00', NOW)).toBe('Fri 25 Sep · 21:00 UTC · 21h 40m ago')
    })

    it('marks an unscheduled match', () => {
        expect(formatMatchTime(null, NOW)).toBe('Not scheduled')
    })
})

describe('buildCurrentMatchView', () => {
    it('lists every assigned match with its teams, round, time and status', () => {
        const view = buildCurrentMatchView(desk({ assigned_matches: [
            assigned('m1', { stream_url: 'https://twitch.tv/alice' }),
            assigned('m2', { teams: { a: null, b: { id: 't3', name: 'Charlie' } }, group: null, round: { no: 1, label: 'Final' }, scheduled_at: null, status: 'pending' }),
        ] }), NOW)

        expect(view.rows).toEqual([
            {
                id: 'm1', title: 'Alpha vs Bravo', detail: 'Groups · Group A · Round 2 · Bo3', timeText: '20:00 UTC · in 1h 20m',
                status: 'scheduled', streamUrl: 'https://twitch.tv/alice', onScreen: false, chosen: false, notPublic: false, finished: false,
            },
            {
                id: 'm2', title: 'TBD vs Charlie', detail: 'Groups · Final · Bo3', timeText: 'Not scheduled',
                status: 'pending', streamUrl: null, onScreen: false, chosen: false, notPublic: false, finished: false,
            },
        ])
    })

    it('marks the match on screen, the chosen one and the ones the public cannot see yet', () => {
        const view = buildCurrentMatchView(desk({
            reason: 'current',
            match: onScreen('m2'),
            desk: { brb_message: null, webcam_enabled: false, current_match_id: 'm2' },
            assigned_matches: [assigned('m1', { public: false }), assigned('m2')],
        }), NOW)

        expect(view.rows.map(row => [row.id, row.onScreen, row.chosen, row.notPublic])).toEqual([
            ['m1', false, false, true],
            ['m2', true, true, false],
        ])
        expect(view.onScreen?.id).toBe('m2')
        expect(view.chosenId).toBe('m2')
        expect(view.chosenNote).toBeNull()
    })

    it('explains every reason', () => {
        for (const reason of ['current', 'live', 'holding-finished', 'next', 'none'] as const) {
            expect(buildCurrentMatchView(desk({ reason }), NOW).reasonText).toBe(REASON_TEXT[reason])
        }
        expect(REASON_TEXT['holding-finished']).toMatch(/until you move on/)
    })

    it('offers the suggested next match', () => {
        const view = buildCurrentMatchView(desk({
            reason: 'holding-finished',
            match: onScreen('m1'),
            assigned_matches: [assigned('m1', { status: 'complete', finished: true }), assigned('m2')],
            next_match: assigned('m2', { scheduled_at: '2026-09-26T19:00:00+00:00' }),
        }), NOW)

        expect(view.next).toMatchObject({ id: 'm2', title: 'Alpha vs Bravo', timeText: '19:00 UTC · in 20m' })
        expect(view.onScreen).toMatchObject({ id: 'm1', finished: true })
    })

    it('has nothing on screen and no suggestion when nothing is assigned', () => {
        const view = buildCurrentMatchView(desk(), NOW)

        expect(view).toMatchObject({ rows: [], onScreen: null, next: null, chosenId: null, chosenNote: null })
    })

    it('explains a chosen match that is not public yet', () => {
        const view = buildCurrentMatchView(desk({
            reason: 'next',
            match: onScreen('m1'),
            desk: { brb_message: null, webcam_enabled: false, current_match_id: 'm2' },
            assigned_matches: [assigned('m1'), assigned('m2', { public: false })],
        }), NOW)

        expect(view.chosenNote).toBe("Alpha vs Bravo is chosen but not public yet, so your scenes can't show it until it is.")
    })

    it('explains a finished chosen match that a live one took over from', () => {
        const view = buildCurrentMatchView(desk({
            reason: 'live',
            match: onScreen('m2'),
            desk: { brb_message: null, webcam_enabled: false, current_match_id: 'm1' },
            assigned_matches: [assigned('m1', { status: 'complete', finished: true }), assigned('m2', { status: 'live' })],
        }), NOW)

        expect(view.chosenNote).toBe('Alpha vs Bravo is chosen but has finished, and another of your matches is live.')
    })
})
