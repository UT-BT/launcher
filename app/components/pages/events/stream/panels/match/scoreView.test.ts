import { describe, expect, it } from 'vitest'
import type { StreamMapScore, StreamMatch } from '../../streamDesk'
import { buildScoreView } from './scoreView'

const NOW = Date.parse('2026-09-26T20:10:00Z')

function team(name: string, side: 'a' | 'b') {
    return { id: `${side}-id`, name, match_side: side, stage_seed: null, pre_cup_seed: null, members: [] }
}

function mapScore(ordinal: number, overrides: Partial<StreamMapScore> = {}): StreamMapScore {
    return { ordinal, caps: { a: 0, b: 0 }, decided: false, winner: null, source: 'live', ...overrides }
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
        score: { maps, current_map: 0, series: { a: 0, b: 0 }, winner: null, live_decided: false },
        casters: [],
        ...overrides,
    }
}

describe('buildScoreView', () => {
    it('has nothing to show without a match or a score block', () => {
        expect(buildScoreView(null, NOW)).toBeNull()
        expect(buildScoreView({ id: 'm1' } as StreamMatch, NOW)).toBeNull()
    })

    it('says when the match was marked live', () => {
        const view = buildScoreView(match({ live_at: '2026-09-26T20:03:00+00:00' }), NOW)
        expect(view?.liveSet).toBe(true)
        expect(view?.liveText).toBe('Live since 20:03 UTC · 7m ago')
    })

    it('explains where counting starts when the match is not marked live', () => {
        expect(buildScoreView(match(), NOW)?.liveText).toMatch(/starts counting once you mark the match live/)
        expect(buildScoreView(match({ pick_ban_status: 'complete' }), NOW)?.liveText).toMatch(/counts from the end of pick & ban/)
    })

    it('lists every map with its name, both teams, caps and source', () => {
        const view = buildScoreView(match({}, [
            mapScore(0, { caps: { a: 1, b: 2 }, decided: true, winner: 'b', source: 'override' }),
            mapScore(1, { caps: { a: 1, b: 0 } }),
            mapScore(2),
        ]), NOW)!

        expect(view.rows.map(row => [row.label, row.mapName, row.sourceLabel])).toEqual([
            ['Map 1', 'BT-First', 'Override'],
            ['Map 2', 'BT-Second', 'Live'],
            ['Map 3', null, 'Live'],
        ])
        expect(view.rows[0].sides.map(cell => [cell.team, cell.caps])).toEqual([['Alpha', 1], ['Bravo', 2]])
        expect(view.rows[0].winnerText).toBe('Bravo won')
        expect(view.rows[0].current).toBe(true)
    })

    it('shows the series in stream order', () => {
        const view = buildScoreView(match({ score: { maps: [], current_map: null, series: { a: 1, b: 0 }, winner: null, live_decided: false } }), NOW)
        expect(view?.seriesText).toBe('Alpha 1 – 0 Bravo')
    })

    it('never offers a minus at zero', () => {
        const row = buildScoreView(match({}, [mapScore(0, { caps: { a: 1, b: 0 } })]), NOW)!.rows[0]
        expect(row.sides.map(cell => cell.canRemove)).toEqual([true, false])
        expect(row.sides.map(cell => cell.canAdd)).toEqual([true, true])
    })

    it('does not offer a plus to the side that already won the map', () => {
        const row = buildScoreView(match({}, [mapScore(0, { caps: { a: 2, b: 1 }, decided: true, winner: 'a' })]), NOW)!.rows[0]
        expect(row.sides.map(cell => cell.canAdd)).toEqual([false, true])
        expect(row.sides.map(cell => cell.canRemove)).toEqual([true, true])
    })

    it('locks official maps and maps with no map picked', () => {
        const rows = buildScoreView(match({}, [
            mapScore(0, { caps: { a: 2, b: 0 }, decided: true, winner: 'a', source: 'official' }),
            mapScore(1),
            mapScore(2),
        ]), NOW)!.rows
        expect(rows[0].lockedNote).toMatch(/official result/)
        expect(rows[1].lockedNote).toBeNull()
        expect(rows[2].lockedNote).toBe('No map picked yet.')
        expect(rows[0].sides.every(cell => !cell.canAdd && !cell.canRemove)).toBe(true)
    })

    it('locks the maps left over once the series is decided', () => {
        const decided = mapScore(0, { caps: { a: 2, b: 0 }, decided: true, winner: 'a' })
        const view = buildScoreView(match({
            maps: match().maps.map(entry => ({ ...entry, map: entry.map ?? 'BT-Third' })),
            score: {
                maps: [decided, { ...decided, ordinal: 1 }, mapScore(2)],
                current_map: null,
                series: { a: 2, b: 0 },
                winner: 'a',
                live_decided: true,
            },
        }), NOW)!
        expect(view.rows[1].lockedNote).toBeNull()
        expect(view.rows[2].lockedNote).toBe('The series is already decided.')
    })

    it('locks every map once the match is over', () => {
        const view = buildScoreView(match({ status: 'complete' }, [mapScore(0, { caps: { a: 1, b: 0 } })]), NOW)!
        expect(view.finished).toBe(true)
        expect(view.rows[0].lockedNote).toMatch(/match is over/)
        expect(view.rows[0].sides.every(cell => !cell.canAdd && !cell.canRemove)).toBe(true)
    })

    it('falls back to a side name when a team is missing', () => {
        const view = buildScoreView(match({ teams: { a: null, b: team('Bravo', 'b') } }), NOW)!
        expect(view.rows[0].sides[0].team).toBe('Team A')
    })
})
