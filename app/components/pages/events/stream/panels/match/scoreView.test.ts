import { describe, expect, it } from 'vitest'
import { ApiError } from '@/app/utils/api'
import type { StreamMapScore, StreamMatch } from '../../streamDesk'
import { buildScoreView, parseScoreInput, scoreWriteMessage, shouldSendTypedScore, stateWithPin, stateWithWinner, type ScoreSideCell } from './scoreView'

const NOW = Date.parse('2026-09-26T20:10:00Z')

function team(name: string, side: 'a' | 'b') {
    return { id: `${side}-id`, name, match_side: side, stage_seed: null, pre_cup_seed: null, members: [] }
}

function mapScore(ordinal: number, overrides: Partial<StreamMapScore> = {}): StreamMapScore {
    return {
        ordinal,
        caps: { a: 0, b: 0 },
        decided: false,
        winner: null,
        source: 'live',
        closed_by: null,
        pins: { a: null, b: null },
        winner_override: 'auto',
        ...overrides,
    }
}

function official(ordinal: number, caps: { a: number; b: number }, winner: 'a' | 'b'): StreamMapScore {
    return mapScore(ordinal, { caps, decided: true, winner, source: 'official', closed_by: 'official' })
}

type Score = StreamMatch['score']

function score(maps: StreamMapScore[], overrides: Partial<Score> = {}): Score {
    const current = maps.find(entry => !entry.decided)
    return {
        maps,
        current_map: current ? current.ordinal : null,
        series: { a: maps.filter(entry => entry.winner === 'a').length, b: maps.filter(entry => entry.winner === 'b').length },
        winner: null,
        live_decided: false,
        live_counting: true,
        ...overrides,
    }
}

function match(overrides: Partial<StreamMatch> = {}, maps: StreamMapScore[] = [mapScore(0), mapScore(1), mapScore(2)]): StreamMatch {
    return {
        id: 'm1',
        reason: 'live',
        stage: { key: 'groups', name: 'Groups' },
        group: null,
        round: { no: 1, label: null },
        best_of: 3,
        mode: 'first_to',
        caps_to_win: 2,
        scheduled_at: '2026-09-26T20:00:00+00:00',
        countdown_at: '2026-09-26T20:00:00+00:00',
        live_at: null,
        live_since: null,
        live_source: null,
        status: 'live',
        stream_url: null,
        pick_ban_status: 'none',
        sides: { a: 'a', b: 'b' },
        teams: { a: team('Alpha', 'a'), b: team('Bravo', 'b') },
        lineup: { a1: null, a2: null, b1: null, b2: null },
        maps: [
            { ordinal: 0, map: 'BT-First', kind: 'normal', picked_by: 'a' },
            { ordinal: 1, map: 'BT-Second', kind: 'normal', picked_by: 'b' },
            { ordinal: 2, map: null, kind: 'decider', picked_by: null },
        ],
        score: score(maps),
        casters: [],
        ...overrides,
    }
}

function rowsOf(value: StreamMatch) {
    return buildScoreView(value, NOW)!.rows
}

describe('buildScoreView', () => {
    it('has nothing to show without a match or a score block', () => {
        expect(buildScoreView(null, NOW)).toBeNull()
        expect(buildScoreView({ id: 'm1' } as StreamMatch, NOW)).toBeNull()
    })

    it('says when the match was marked live', () => {
        const at = '2026-09-26T20:03:00+00:00'
        const view = buildScoreView(match({ live_at: at, live_since: at, live_source: 'manual' }), NOW)
        expect(view?.liveSet).toBe(true)
        expect(view?.canClearLive).toBe(true)
        expect(view?.liveText).toBe('Live since 20:03 UTC · 7m ago')
    })

    it('shows the match live from the end of pick & ban without Match live', () => {
        const view = buildScoreView(match({ pick_ban_status: 'complete', live_since: '2026-09-26T19:58:00+00:00', live_source: 'pick_ban' }), NOW)
        expect(view?.liveSet).toBe(true)
        expect(view?.canClearLive).toBe(false)
        expect(view?.liveText).toBe('Live since 19:58 UTC · 12m ago, when pick & ban ended.')
    })

    it('explains how the match goes live when it is not live yet', () => {
        const view = buildScoreView(match(), NOW)
        expect(view?.liveSet).toBe(false)
        expect(view?.liveText).toMatch(/goes live when pick & ban ends/)
    })

    it('says the match is over once it is finished', () => {
        const view = buildScoreView(match({ status: 'complete', live_since: '2026-09-26T19:58:00+00:00', live_source: 'pick_ban' }), NOW)
        expect(view?.liveText).toBe('The match is over.')
    })

    it('lists one row per map in pick order with its number, name, picker and source', () => {
        const rows = rowsOf(match({}, [
            mapScore(2),
            official(0, { a: 2, b: 1 }, 'a'),
            mapScore(1, { caps: { a: 1, b: 3 }, source: 'manual', pins: { a: null, b: 3 } }),
        ]))

        expect(rows.map(row => [row.label, row.mapName, row.pickedText, row.sourceLabel])).toEqual([
            ['Map 1', 'BT-First', 'Picked by Alpha', 'Official'],
            ['Map 2', 'BT-Second', 'Picked by Bravo', 'Manual'],
            ['Map 3', null, 'Decider', 'Live'],
        ])
        expect(rows[1].sides.map(cell => [cell.team, cell.caps, cell.pinned])).toEqual([['Alpha', 1, false], ['Bravo', 3, true]])
    })

    it('says who won each decided map, and when a map closed with no winner', () => {
        const rows = rowsOf(match({}, [
            official(0, { a: 2, b: 1 }, 'a'),
            mapScore(1, { caps: { a: 1, b: 1 }, decided: true, source: 'manual', closed_by: 'override', winner_override: 'none' }),
            mapScore(2),
        ]))

        expect(rows.map(row => row.resultText)).toEqual(['Alpha won', 'Draw', null])
    })

    it('offers Auto, both team names and Draw, with the stored override selected', () => {
        const row = rowsOf(match({}, [mapScore(0, { winner_override: 'b', decided: true, winner: 'b', source: 'manual' }), mapScore(1)]))[0]

        expect(row.winnerOptions).toEqual([
            { value: 'auto', label: 'Auto' },
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Bravo' },
            { value: 'none', label: 'Draw' },
        ])
        expect(row.winner).toBe('b')
    })

    it('names the teams in stream order and falls back to a side name when a team is missing', () => {
        const view = buildScoreView(match({ teams: { a: null, b: team('Bravo', 'b') } }), NOW)!
        expect(view.rows[0].sides[0].team).toBe('Team A')
        expect(view.rows[0].winnerOptions.map(option => option.label)).toEqual(['Auto', 'Team A', 'Bravo', 'Draw'])
    })

    it('shows the no-winner hint on the current map only', () => {
        const rows = rowsOf(match({}, [official(0, { a: 2, b: 0 }, 'a'), mapScore(1, { caps: { a: 1, b: 1 } }), mapScore(2)]))

        expect(rows.map(row => row.current)).toEqual([false, true, false])
        expect(rows.map(row => row.hint)).toEqual([null, 'Map ended level? Close it here as a draw.', null])
    })

    it('shows no hint when there is no current map', () => {
        const rows = rowsOf(match({}, [official(0, { a: 2, b: 0 }, 'a'), official(1, { a: 2, b: 1 }, 'a')]))
        expect(rows.every(row => row.hint === null)).toBe(true)
    })

    it('lets every side of an open live map be stepped and typed, but never below 0 or above 20', () => {
        const [low, high] = rowsOf(match({}, [mapScore(0, { caps: { a: 0, b: 3 } }), mapScore(1, { caps: { a: 20, b: 19 } })]))

        expect(low.locked).toBe(false)
        expect(low.sides.map(cell => [cell.canLower, cell.canRaise])).toEqual([[false, true], [true, true]])
        expect(high.sides.map(cell => [cell.canLower, cell.canRaise])).toEqual([[true, false], [true, true]])
    })

    it('locks maps with an official result', () => {
        const row = rowsOf(match({}, [official(0, { a: 2, b: 0 }, 'a'), mapScore(1)]))[0]

        expect(row.locked).toBe(true)
        expect(row.lockedNote).toBe('Official result. It can’t be edited here.')
        expect(row.sides.every(cell => !cell.canLower && !cell.canRaise)).toBe(true)
        expect(row.canReset).toBe(false)
        expect(row.hint).toBeNull()
    })

    it('locks the maps left over once the series is decided', () => {
        const won = mapScore(0, { caps: { a: 2, b: 0 }, decided: true, winner: 'a', closed_by: 'target' })
        const rows = rowsOf(match({}, [won, { ...won, ordinal: 1 }, mapScore(2)]))
        const decided = rowsOf(match({ score: score([won, { ...won, ordinal: 1 }, mapScore(2)], { current_map: null, live_decided: true, winner: 'a' }) }))

        expect(rows[2].locked).toBe(false)
        expect(decided[1].locked).toBe(false)
        expect(decided[2].locked).toBe(true)
        expect(decided[2].lockedNote).toBe('The series is already decided.')
    })

    it('locks every map once the match is over', () => {
        const view = buildScoreView(match({ status: 'complete' }, [mapScore(0, { caps: { a: 1, b: 0 }, pins: { a: 1, b: null }, source: 'manual' })]), NOW)!

        expect(view.finished).toBe(true)
        expect(view.rows[0].locked).toBe(true)
        expect(view.rows[0].lockedNote).toMatch(/match is over/)
        expect(view.rows[0].canReset).toBe(false)
        expect(view.canResetAll).toBe(false)
    })

    it('offers Reset only on maps with a typed score or a winner override', () => {
        const rows = rowsOf(match({}, [
            mapScore(0, { caps: { a: 1, b: 0 }, pins: { a: 1, b: null }, source: 'manual' }),
            mapScore(1, { winner_override: 'none', decided: true, source: 'manual' }),
            mapScore(2),
        ]))

        expect(rows.map(row => row.canReset)).toEqual([true, true, false])
    })

    it('offers Reset all while any map has stored state', () => {
        expect(buildScoreView(match(), NOW)!.canResetAll).toBe(false)
        expect(buildScoreView(match({}, [mapScore(0, { pins: { a: null, b: 2 }, source: 'manual' })]), NOW)!.canResetAll).toBe(true)
        expect(buildScoreView(match({}, [{ ...official(0, { a: 2, b: 0 }, 'a'), pins: { a: 1, b: null } }]), NOW)!.canResetAll).toBe(true)
    })

    it('reports the live counting switch', () => {
        const on = buildScoreView(match(), NOW)!
        const off = buildScoreView(match({ score: score([mapScore(0)], { live_counting: false }) }), NOW)!

        expect([on.liveCounting, on.liveCountingText]).toEqual([true, 'Runs from the servers count toward the score.'])
        expect([off.liveCounting, off.liveCountingText]).toEqual([false, 'Off: only official results and the scores you set count.'])
    })

    it('derives the series from the map winners, in stream order', () => {
        const view = buildScoreView(match({}, [
            official(0, { a: 2, b: 1 }, 'a'),
            mapScore(1, { caps: { a: 2, b: 2 }, decided: true, source: 'manual', closed_by: 'override', winner_override: 'none' }),
            mapScore(2, { caps: { a: 0, b: 2 }, decided: true, winner: 'b', closed_by: 'target' }),
        ]), NOW)!

        expect(view.seriesText).toBe('Series: Alpha 1 – 1 Bravo')
    })
})

describe('score editor writes', () => {
    const row = rowsOf(match({}, [mapScore(0, { caps: { a: 1, b: 2 }, pins: { a: null, b: 2 }, winner_override: 'auto', source: 'manual' })]))[0]

    it('pins one side and keeps the other side and the winner as stored', () => {
        expect(stateWithPin(row, 'a', 3)).toEqual({ a: 3, b: 2, winner: 'auto' })
        expect(stateWithPin(row, 'b', 0)).toEqual({ a: null, b: 0, winner: 'auto' })
    })

    it('sets the winner and keeps the stored pins', () => {
        expect(stateWithWinner(row, 'none')).toEqual({ a: null, b: 2, winner: 'none' })
    })

    it.each([
        ['0', 0],
        ['20', 20],
        [' 7 ', 7],
        ['21', null],
        ['-1', null],
        ['1.5', null],
        ['', null],
        ['two', null],
    ])('reads the typed score %j as %j', (text, value) => {
        expect(parseScoreInput(text)).toBe(value)
    })
})

describe('shouldSendTypedScore', () => {
    const cell = (pinned: boolean): ScoreSideCell => ({ side: 'a', team: 'Crimson Tide', caps: 2, pinned, canLower: true, canRaise: true })

    it('sends a typed value that differs from the shown score', () => {
        expect(shouldSendTypedScore(cell(false), 3, true)).toBe(true)
        expect(shouldSendTypedScore(cell(true), 3, true)).toBe(true)
    })

    it('sends a typed value equal to the live count, so it freezes that side', () => {
        expect(shouldSendTypedScore(cell(false), 2, true)).toBe(true)
    })

    it('sends nothing when the input was left untouched or the side is already pinned at that value', () => {
        expect(shouldSendTypedScore(cell(false), 2, false)).toBe(false)
        expect(shouldSendTypedScore(cell(true), 2, true)).toBe(false)
    })
})

describe('scoreWriteMessage', () => {
    it.each([
        ['official_map', 'That map has an official result, so it can’t be edited.'],
        ['invalid_request', 'Scores go from 0 to 20.'],
        ['unknown_map', 'That map is no longer part of this match.'],
    ])('turns the %s reject into a readable message', (reason, message) => {
        expect(scoreWriteMessage(new ApiError(422, 'server text', 'Request failed (422)', reason), 'map')).toBe(message)
    })

    it.each([
        ['map', 'Nothing changed: the map already shows that.'],
        ['reset', 'Nothing to reset: that map already counts live.'],
        ['resetAll', 'Nothing to reset: every map already counts live.'],
        ['liveCounting', 'Nothing changed: live counting is already set that way.'],
    ] as const)('words the no_effect reject for a %s write', (kind, message) => {
        expect(scoreWriteMessage(new ApiError(422, 'server text', 'Request failed (422)', 'no_effect'), kind)).toBe(message)
    })

    it('keeps the server message for other errors', () => {
        expect(scoreWriteMessage(new ApiError(403, 'You are not the streamer for this match.', 'Request failed (403)', 'not_authorized'), 'map'))
            .toBe('You are not the streamer for this match.')
        expect(scoreWriteMessage(new Error(''), 'map')).toBe('Something went wrong.')
    })
})
