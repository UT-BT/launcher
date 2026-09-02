import { describe, expect, it } from 'vitest'
import type { EventFormatSpec, EventGroupsConfig, EventMatchDefaults } from '@/app/utils/api'
import {
    allowsDraws, defaultPointsTable, effectiveDefaults, emptySpec, newStage, parseSpecErrors, scorelinesFor,
    syncPointsTable, withSyncedPoints,
} from './formatFields'

function defaults(patch: Partial<EventMatchDefaults> = {}): EventMatchDefaults {
    return { best_of: 3, caps_to_win_map: 4, mode: 'first_to', decider: null, ...patch }
}

describe('scorelinesFor', () => {
    it('lists every result a race to two can produce', () => {
        expect(scorelinesFor(defaults({ best_of: 3 })))
            .toEqual([[2, 0], [2, 1], [1, 0], [1, 1], [0, 0], [1, 2], [0, 1], [0, 2]])
    })

    it('stops a race at the map that wins it', () => {
        const lines = scorelinesFor(defaults({ best_of: 4, mode: 'first_to' }))

        expect(lines).toContainEqual([3, 0])
        expect(lines).toContainEqual([3, 1])
        expect(lines).toContainEqual([2, 2])
        expect(lines).not.toContainEqual([4, 0])
        expect(lines).toHaveLength(13)
    })

    it('lets every map be played out when the format says so', () => {
        const lines = scorelinesFor(defaults({ best_of: 4, mode: 'all_maps' }))

        expect(lines).toContainEqual([4, 0])
        expect(lines).toContainEqual([2, 2])
        expect(lines).toHaveLength(15)
    })

    it('still has a draw when every map is played and the count is odd', () => {
        const lines = scorelinesFor(defaults({ best_of: 3, mode: 'all_maps' }))

        expect(lines).toContainEqual([3, 0])
        expect(lines).toContainEqual([0, 0])
    })
})

describe('allowsDraws', () => {
    it('is true whenever the maps can be split evenly, whichever way it runs', () => {
        expect(allowsDraws(defaults({ best_of: 4, mode: 'all_maps' }))).toBe(true)
        expect(allowsDraws(defaults({ best_of: 4, mode: 'first_to' }))).toBe(true)
        expect(allowsDraws(defaults({ best_of: 3, mode: 'all_maps' }))).toBe(false)
        expect(allowsDraws(defaults({ best_of: 3, mode: 'first_to' }))).toBe(false)
    })
})

describe('defaultPointsTable', () => {
    it('pays three for a win, one for a draw and nothing for a defeat', () => {
        const table = new Map(
            defaultPointsTable(defaults({ best_of: 4, mode: 'all_maps' }))
                .map(row => [`${row.maps_won}-${row.maps_lost}`, row.points]),
        )

        expect(table.get('4-0')).toBe(3)
        expect(table.get('2-1')).toBe(3)
        expect(table.get('2-2')).toBe(1)
        expect(table.get('0-0')).toBe(1)
        expect(table.get('1-3')).toBe(0)
    })

    it('covers every scoreline a race to two can reach', () => {
        const table = defaultPointsTable(defaults({ best_of: 3 }))

        expect(table).toHaveLength(8)
        expect(table.every(row => row.points === (
            row.maps_won > row.maps_lost ? 3 : row.maps_won === row.maps_lost ? 1 : 0
        ))).toBe(true)
    })
})

describe('syncPointsTable', () => {
    it('keeps points the admin already set for a scoreline that still exists', () => {
        const table = [
            { maps_won: 4, maps_lost: 0, points: 10 },
            { maps_won: 2, maps_lost: 2, points: 5 },
        ]
        const synced = new Map(
            syncPointsTable(table, defaults({ best_of: 4, mode: 'all_maps' }))
                .map(row => [`${row.maps_won}-${row.maps_lost}`, row.points]),
        )

        expect(synced.get('4-0')).toBe(10)
        expect(synced.get('2-2')).toBe(5)
        expect(synced.get('3-1')).toBe(3)
    })

    it('drops scorelines the new series length cannot produce', () => {
        const table = defaultPointsTable(defaults({ best_of: 4, mode: 'all_maps' }))
        const synced = syncPointsTable(table, defaults({ best_of: 3 }))

        expect(synced.some(row => row.maps_won > 2 || row.maps_lost > 2)).toBe(false)
        expect(synced.some(row => row.maps_won === 0 && row.maps_lost === 0)).toBe(true)
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
        const config = withSyncedPoints(spec).stages[0].config as EventGroupsConfig

        expect(config.points).toHaveLength(15)
        expect(config.points.some(row => row.maps_won === 4 && row.points === 3)).toBe(true)
    })

    it('falls back to the format-wide match format when a stage sets none', () => {
        const spec = specWithGroups(null)
        const config = withSyncedPoints(spec).stages[0].config as EventGroupsConfig

        expect(config.points).toHaveLength(8)
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

describe('parseSpecErrors', () => {
    it('splits the field errors the server reports apart', () => {
        expect(parseSpecErrors('stages[0].key: already used; match_defaults.best_of: must be odd')).toEqual({
            'stages[0].key': 'already used',
            'match_defaults.best_of': 'must be odd',
        })
    })

    it('leaves a plain message alone so the caller can show it', () => {
        expect(parseSpecErrors('Cannot change kind: stage already has matches')).toEqual({})
    })

    it('keeps the field errors out of a message that also carries prose', () => {
        expect(parseSpecErrors('stages[1].config.group_count: must be at least 1; Not allowed: stage is drawn'))
            .toEqual({ 'stages[1].config.group_count': 'must be at least 1' })
    })
})
