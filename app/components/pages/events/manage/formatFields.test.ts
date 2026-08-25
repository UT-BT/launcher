import { describe, expect, it } from 'vitest'
import type { EventFormatSpec, EventGroupsConfig, EventMatchDefaults } from '@/app/utils/api'
import {
    allowsDraws, defaultPointsTable, effectiveDefaults, emptySpec, newStage, scorelinesFor,
    syncPointsTable, withSyncedPoints,
} from './formatFields'

function defaults(patch: Partial<EventMatchDefaults> = {}): EventMatchDefaults {
    return { best_of: 3, caps_to_win_map: 4, mode: 'first_to', decider: null, ...patch }
}

function asPairs(rows: ReturnType<typeof defaultPointsTable>) {
    return rows.map(row => [row.maps_won, row.maps_lost, row.points])
}

describe('scorelinesFor', () => {
    it('lists every result a best-of-three can produce', () => {
        expect(scorelinesFor(defaults({ best_of: 3 }))).toEqual([[2, 0], [2, 1], [1, 2], [0, 2]])
    })

    it('lists every result of a four-map series, draw included', () => {
        expect(scorelinesFor(defaults({ best_of: 4, mode: 'all_maps' })))
            .toEqual([[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]])
    })

    it('has no draw when every map is played but the count is odd', () => {
        expect(scorelinesFor(defaults({ best_of: 3, mode: 'all_maps' })))
            .toEqual([[3, 0], [2, 1], [1, 2], [0, 3]])
    })
})

describe('allowsDraws', () => {
    it('is true only when every map is played and the count is even', () => {
        expect(allowsDraws(defaults({ best_of: 4, mode: 'all_maps' }))).toBe(true)
        expect(allowsDraws(defaults({ best_of: 3, mode: 'all_maps' }))).toBe(false)
        expect(allowsDraws(defaults({ best_of: 4, mode: 'first_to' }))).toBe(false)
    })
})

describe('defaultPointsTable', () => {
    it('pays one point per step down the ladder', () => {
        expect(asPairs(defaultPointsTable(defaults({ best_of: 4, mode: 'all_maps' })))).toEqual([
            [4, 0, 4], [3, 1, 3], [2, 2, 2], [1, 3, 1], [0, 4, 0],
        ])
    })

    it('reproduces the classic best-of-three table', () => {
        expect(asPairs(defaultPointsTable(defaults({ best_of: 3 })))).toEqual([
            [2, 0, 3], [2, 1, 2], [1, 2, 1], [0, 2, 0],
        ])
    })
})

describe('syncPointsTable', () => {
    it('keeps points the admin already set for a scoreline that still exists', () => {
        const table = [
            { maps_won: 4, maps_lost: 0, points: 10 },
            { maps_won: 2, maps_lost: 2, points: 5 },
        ]
        const synced = syncPointsTable(table, defaults({ best_of: 4, mode: 'all_maps' }))

        expect(asPairs(synced)).toEqual([[4, 0, 10], [3, 1, 3], [2, 2, 5], [1, 3, 1], [0, 4, 0]])
    })

    it('drops scorelines the new series length cannot produce', () => {
        const table = defaultPointsTable(defaults({ best_of: 4, mode: 'all_maps' }))
        const synced = syncPointsTable(table, defaults({ best_of: 3 }))

        expect(asPairs(synced)).toEqual([[2, 0, 3], [2, 1, 2], [1, 2, 1], [0, 2, 0]])
        expect(synced.some(row => row.maps_won === row.maps_lost)).toBe(false)
    })
})

describe('withSyncedPoints', () => {
    function specWithGroups(stageDefaults: EventMatchDefaults | null): EventFormatSpec {
        const stage = newStage('groups', 'Group Stage', 'groups')
        return {
            ...emptySpec(),
            match_defaults: defaults(),
            stages: [{ ...stage, match_defaults: stageDefaults }],
        }
    }

    it('rebuilds a group table when the stage switches to playing every map', () => {
        const spec = specWithGroups(defaults({ best_of: 4, mode: 'all_maps' }))
        const synced = withSyncedPoints(spec)
        const config = synced.stages[0].config as EventGroupsConfig

        expect(asPairs(config.points)).toEqual([[4, 0, 4], [3, 1, 3], [2, 2, 2], [1, 3, 1], [0, 4, 0]])
    })

    it('falls back to the format-wide match format when a stage sets none', () => {
        const spec = specWithGroups(null)
        const config = (withSyncedPoints(spec).stages[0].config as EventGroupsConfig)

        expect(asPairs(config.points)).toEqual([[2, 0, 3], [2, 1, 2], [1, 2, 1], [0, 2, 0]])
        expect(effectiveDefaults(spec, spec.stages[0]).best_of).toBe(3)
    })

    it('leaves stages that do not score on points alone', () => {
        const spec: EventFormatSpec = {
            ...emptySpec(),
            stages: [newStage('bracket', 'Bracket', 'single_elim')],
        }

        expect(withSyncedPoints(spec).stages[0]).toEqual(spec.stages[0])
    })
})
