import { describe, expect, it } from 'vitest'
import type {
    EventBracketGroup, EventBracketStage, EventFormatSpec, EventMatch, EventMatchMap,
} from '@/app/utils/api'
import { mapWinnerOf, matchOrder, seriesProgress, unfinishedFeeders } from './bracketShared'

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

        expect(seriesProgress(bo4, maps, true)).toMatchObject({ complete: true, isDraw: true, scoreA: 2, scoreB: 2 })
    })

    it('a map nobody won still counts towards the length', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 4, caps_b: 2 }),
            mapRow({ ordinal: 2, caps_a: 4, caps_b: 0 }),
            mapRow({ ordinal: 3, caps_a: 3, caps_b: 1 }),
        ]

        expect(seriesProgress(bo4, maps, true))
            .toMatchObject({ decided: 3, played: 4, complete: true, isDraw: false, remaining: 0 })
    })

    it('a level series that cannot be drawn stays open', () => {
        const maps = [
            mapRow({ ordinal: 0, caps_a: 4, caps_b: 1 }),
            mapRow({ ordinal: 1, caps_a: 1, caps_b: 4 }),
            mapRow({ ordinal: 2, caps_a: 3, caps_b: 1 }),
        ]

        expect(seriesProgress(bo3, maps, false)).toMatchObject({ scoreA: 1, scoreB: 1, complete: false })
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

function match(patch: Partial<EventMatch> = {}): EventMatch {
    return {
        id: 'm', stage_id: 's', group_id: null, round_no: 1, round_label: null, ordinal: 0,
        team_a: null, team_b: null, slot_a_label: null, slot_b_label: null,
        best_of: 3, caps_to_win: 4, mode: 'first_to', status: 'pending',
        winner_team_id: null, is_draw: false, score_a: null, score_b: null,
        caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
        scheduled_at: null, started_at: null, ended_at: null, stream_url: null,
        notes: null, published: true, maps: [],
        winner_to_match_id: null, winner_to_slot: null,
        loser_to_match_id: null, loser_to_slot: null,
        ...patch,
    } as EventMatch
}

const groups: EventBracketGroup[] = [
    { id: 'ga', name: 'Group A', ordinal: 0, standings: [] },
    { id: 'gb', name: 'Group B', ordinal: 1, standings: [] },
    { id: 'gc', name: 'Group C', ordinal: 2, standings: [] },
]

describe('matchOrder', () => {
    it('puts earlier rounds first', () => {
        const order = [match({ id: 'x', round_no: 2 }), match({ id: 'y', round_no: 1 })]
            .sort(matchOrder(groups))
        expect(order.map(row => row.id)).toEqual(['y', 'x'])
    })

    it('keeps a group together instead of interleaving on ordinal', () => {
        const order = [
            match({ id: 'c0', group_id: 'gc', ordinal: 0 }),
            match({ id: 'a1', group_id: 'ga', ordinal: 1 }),
            match({ id: 'b0', group_id: 'gb', ordinal: 0 }),
            match({ id: 'a0', group_id: 'ga', ordinal: 0 }),
        ].sort(matchOrder(groups))

        expect(order.map(row => row.id)).toEqual(['a0', 'a1', 'b0', 'c0'])
    })

    it('is total, so the same set always lands in the same order', () => {
        const rows = [
            match({ id: 'zz', group_id: 'ga', ordinal: 0 }),
            match({ id: 'aa', group_id: 'ga', ordinal: 0 }),
        ]
        const forwards = [...rows].sort(matchOrder(groups)).map(row => row.id)
        const backwards = [...rows].reverse().sort(matchOrder(groups)).map(row => row.id)

        expect(forwards).toEqual(['aa', 'zz'])
        expect(backwards).toEqual(forwards)
    })

    it('falls back to ordinal when a stage has no groups', () => {
        const order = [match({ id: 'second', ordinal: 1 }), match({ id: 'first', ordinal: 0 })]
            .sort(matchOrder([]))
        expect(order.map(row => row.id)).toEqual(['first', 'second'])
    })
})

function stageRow(key: string, status: EventBracketStage['status']): EventBracketStage {
    return {
        id: key, key, name: key.toUpperCase(), kind: 'groups', ordinal: 0,
        status, published: true, config: null, groups: [], entrants: [], matches: [],
    }
}

function specWith(advancement: Array<{ from: string; to: string }>): EventFormatSpec {
    const keys = [...new Set(advancement.flatMap(rule => [rule.from, rule.to]))]

    return {
        version: 1,
        match_defaults: { best_of: 3, caps_to_win_map: 4, mode: 'first_to', decider: null },
        stages: keys.map(key => ({
            key, name: key, kind: 'groups' as const, config: null as never,
            match_defaults: null,
            advancement: advancement
                .filter(rule => rule.from === key)
                .map(rule => ({ to_stage: rule.to, label: null, from_rank: 1, to_rank: 2 })),
        })),
    } as EventFormatSpec
}

describe('unfinishedFeeders', () => {
    const spec = specWith([{ from: 'groups', to: 'playoffs' }, { from: 'playoffs', to: 'final' }])

    it('names a feeder that is still being played', () => {
        const stages = [stageRow('groups', 'active'), stageRow('playoffs', 'pending')]

        expect(unfinishedFeeders(spec, stages, 'playoffs').map(s => s.key)).toEqual(['groups'])
    })

    it('says nothing once the feeder is complete', () => {
        const stages = [stageRow('groups', 'complete'), stageRow('playoffs', 'pending')]

        expect(unfinishedFeeders(spec, stages, 'playoffs')).toEqual([])
    })

    it('only looks at the stages that actually feed this one', () => {
        const stages = [stageRow('groups', 'active'), stageRow('playoffs', 'active')]

        expect(unfinishedFeeders(spec, stages, 'final').map(s => s.key)).toEqual(['playoffs'])
    })

    it('reports every unfinished feeder when a stage has more than one', () => {
        const twoWay = specWith([{ from: 'groups', to: 'final' }, { from: 'playoffs', to: 'final' }])
        const stages = [stageRow('groups', 'active'), stageRow('playoffs', 'active')]

        expect(unfinishedFeeders(twoWay, stages, 'final').map(s => s.key)).toEqual(['groups', 'playoffs'])
    })

    it('has nothing to say about a stage nothing feeds', () => {
        const stages = [stageRow('groups', 'active')]

        expect(unfinishedFeeders(spec, stages, 'groups')).toEqual([])
    })

    it('copes with no format attached', () => {
        expect(unfinishedFeeders(null, [stageRow('groups', 'active')], 'playoffs')).toEqual([])
    })
})
