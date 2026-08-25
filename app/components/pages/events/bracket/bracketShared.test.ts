import { describe, expect, it } from 'vitest'
import type { EventMatchMap } from '@/app/utils/api'
import { mapWinnerOf, seriesProgress } from './bracketShared'

function mapRow(patch: Partial<EventMatchMap> = {}): EventMatchMap {
    return {
        id: 'row', ordinal: 0, map: null, kind: 'normal', picked_by: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        winner_side: null, started_at: null, ended_at: null, notes: null,
        ...patch,
    }
}

const bo4 = { best_of: 4, caps_to_win: 4, mode: 'all_maps' as const }
const bo3 = { best_of: 3, caps_to_win: 4, mode: 'first_to' as const }

describe('mapWinnerOf', () => {
    it('gives the map to whoever reached the cap target', () => {
        expect(mapWinnerOf(mapRow({ caps_a: 4, caps_b: 2 }), 4)).toBe('a')
        expect(mapWinnerOf(mapRow({ caps_a: 1, caps_b: 4 }), 4)).toBe('b')
    })

    it('leaves a map short of the target undecided', () => {
        expect(mapWinnerOf(mapRow({ caps_a: 3, caps_b: 1 }), 4)).toBeNull()
    })

    it('honours a hand-set winner over the caps', () => {
        expect(mapWinnerOf(mapRow({ caps_a: 3, caps_b: 1, winner_side: 'a' }), 4)).toBe('a')
        expect(mapWinnerOf(mapRow({ caps_a: 4, caps_b: 0, winner_side: 'b' }), 4)).toBe('b')
    })

    it('has no winner for an untouched map', () => {
        expect(mapWinnerOf(mapRow(), 4)).toBeNull()
    })
})

describe('seriesProgress', () => {
    it('counts a time-limit win as a full map', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2, caps_a: 4, caps_b: 0 }),
            mapRow({ ordinal: 3, caps_a: 3, caps_b: 1, winner_side: 'a' }),
        ]

        expect(seriesProgress(bo4, maps)).toMatchObject({
            decided: 4, scoreA: 4, scoreB: 0, complete: true, isDraw: false, remaining: 0,
        })
    })

    it('reports what is still missing on a part-scored four-map series', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2 }),
            mapRow({ ordinal: 3 }),
        ]

        expect(seriesProgress(bo4, maps)).toMatchObject({ decided: 2, complete: false, remaining: 2 })
    })

    it('sees a level four-map series as a draw', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2, caps_a: 0, caps_b: 4 }),
            mapRow({ ordinal: 3, caps_a: 1, caps_b: 4 }),
        ]

        expect(seriesProgress(bo4, maps)).toMatchObject({ complete: true, isDraw: true, scoreA: 2, scoreB: 2 })
    })

    it('a map nobody won blocks a four-map series from finishing', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2, caps_a: 4, caps_b: 0 }),
            mapRow({ ordinal: 3, caps_a: 3, caps_b: 1 }),
        ]

        expect(seriesProgress(bo4, maps)).toMatchObject({ decided: 3, complete: false, remaining: 1 })
    })

    it('a race to a majority ends as soon as it is won', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2 }),
        ]

        expect(seriesProgress(bo3, maps)).toMatchObject({ complete: true, scoreA: 2, remaining: 0, isDraw: false })
    })

    it('counts down the map wins a race still needs', () => {
        const maps = [mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }), mapRow({ ordinal: 1 }), mapRow({ ordinal: 2 })]

        expect(seriesProgress(bo3, maps)).toMatchObject({ complete: false, remaining: 1 })
    })
})
