import { describe, expect, it } from 'vitest'
import { streamMapScore, streamMaps, streamScore } from '../../data/streamFixtures'
import { ALL_DECIDED, INTERMISSION_MAPS, INTERMISSION_PICKS, MID_SERIES, intermissionMatch } from './intermissionFixtures'
import { advanceMapReveal, initialMapReveal, intermissionView } from './intermissionView'

describe('intermissionView series', () => {
    it('shows caps per map with where each count comes from', () => {
        const match = intermissionMatch([], {
            score: streamScore([
                streamMapScore(0, [2, 1], 'a'),
                streamMapScore(1, [2, 3], 'b', { source: 'manual', pins: { a: null, b: 3 } }),
                streamMapScore(2, [1, 0], null),
                streamMapScore(3, [0, 0], null),
            ]),
        })

        const view = intermissionView(match)

        expect(view.maps.map(map => [map.number, map.caps, map.winner, map.sourceLabel])).toEqual([
            [1, { a: 2, b: 1 }, 'a', 'Official'],
            [2, { a: 2, b: 3 }, 'b', 'Corrected'],
            [3, { a: 1, b: 0 }, null, 'Live'],
            [4, null, null, null],
        ])
        expect(view.series).toEqual({ a: 1, b: 1 })
    })

    it('marks a live decided map, a map in play and an untouched map', () => {
        const match = intermissionMatch([], {
            score: streamScore([streamMapScore(0, [2, 0], 'a', { source: 'live' }), streamMapScore(1, [0, 1]), streamMapScore(2), streamMapScore(3)]),
        })

        const view = intermissionView(match)

        expect(view.maps.map(map => map.status)).toEqual(['decided', 'next', 'open', 'open'])
        expect(view.maps.map(map => map.sourceLabel)).toEqual(['Live', 'Live', null, null])
    })

    it('names each map and its picker from the match maps, and flags the latest decided map', () => {
        const view = intermissionView(intermissionMatch(MID_SERIES))

        expect(view.maps.map(map => [map.map, map.pickedBy, map.latest])).toEqual([
            ['CTF-BT-II-Synchronize-vF2', 'a', false],
            ['CTF-BT-II-MountainBase', 'b', false],
            ['CTF-BT-II-FuriumMineCE2', 'b', true],
            ['CTF-BT-II-FaithCB', 'a', false],
        ])
        expect(view.latest?.number).toBe(3)
    })

    it('leaves a slot without a map row unnamed', () => {
        const match = intermissionMatch(MID_SERIES, { maps: [] })

        expect(intermissionView(match).maps.map(map => map.map)).toEqual([null, null, null, null])
    })

    it('has no latest map before any map is decided', () => {
        expect(intermissionView(intermissionMatch([])).latest).toBeNull()
    })

    it('numbers each map from its 0-based ordinal, not its place in the list', () => {
        const match = intermissionMatch([], { score: streamScore([streamMapScore(2, [2, 1], 'a'), streamMapScore(3)]) })

        const view = intermissionView(match)

        expect(view.maps.map(map => [map.ordinal, map.number])).toEqual([[2, 3], [3, 4]])
        expect(view.latest?.number).toBe(3)
        expect(view.upNext?.text).toBe('Up next: II-FaithCB · picked by Crimson Cats')
        expect(view.kicker).toBe('Series 1–0 · map 4 next')
    })

    it('reads the series in the title kicker', () => {
        expect(intermissionView(intermissionMatch(MID_SERIES)).kicker).toBe('Series 2–1 · map 4 next')
    })
})

describe('intermissionView up next', () => {
    it('names the next map and the team that picked it', () => {
        const view = intermissionView(intermissionMatch(MID_SERIES))

        expect(view.upNext).toEqual({ text: 'Up next: II-FaithCB · picked by Crimson Cats', tone: 'a' })
    })

    it('names the picking team of the other side', () => {
        const match = intermissionMatch([[2, 1, 'a'], [0, 2, 'b']])

        expect(intermissionView(match).upNext).toEqual({ text: 'Up next: II-FuriumMineCE2 · picked by Azure Owls', tone: 'b' })
    })

    it('says so for the decider instead of naming a team', () => {
        const match = intermissionMatch(MID_SERIES, { maps: streamMaps(INTERMISSION_MAPS, INTERMISSION_PICKS).map(row => (row.ordinal === 3 ? { ...row, kind: 'decider', picked_by: null } : row)) })

        expect(intermissionView(match).upNext).toEqual({ text: 'Up next: II-FaithCB · decider', tone: 'gold' })
    })

    it('says the map is to be decided while pick/ban has not placed it', () => {
        const match = intermissionMatch(MID_SERIES, { maps: streamMaps(INTERMISSION_MAPS.slice(0, 3), INTERMISSION_PICKS) })

        expect(intermissionView(match).upNext).toEqual({ text: 'Up next: map to be decided', tone: 'neutral' })
    })

    it('says the map is to be decided when the match has no map rows', () => {
        expect(intermissionView(intermissionMatch(MID_SERIES, { maps: [] })).upNext?.text).toBe('Up next: map to be decided')
    })

    it('follows the score block current map', () => {
        const match = intermissionMatch([[2, 1, 'a'], [0, 0, 'b']], {
            score: streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [0, 0], null), streamMapScore(2), streamMapScore(3)], { current_map: 2 }),
        })

        const view = intermissionView(match)

        expect(view.upNext?.text).toBe('Up next: II-FuriumMineCE2 · picked by Azure Owls')
        expect(view.maps.map(map => map.status)).toEqual(['decided', 'open', 'next', 'open'])
    })

    it('shows no up next line once the series is decided', () => {
        expect(intermissionView(intermissionMatch(ALL_DECIDED)).upNext).toBeNull()
    })
})

describe('intermissionView when every map is decided', () => {
    it('shows the final series instead of a next map', () => {
        const match = intermissionMatch(ALL_DECIDED)
        const score = { ...match.score, winner: 'a' as const, live_decided: true }

        const view = intermissionView({ ...match, status: 'complete', score })

        expect(view.upNext).toBeNull()
        expect(view.final).toEqual({ winner: 'a', series: { a: 3, b: 1 }, official: true })
        expect(view.kicker).toBe('Series 3–1 · final')
        expect(view.latest?.number).toBe(4)
    })

    it('calls the final series unofficial while any map comes from the live count', () => {
        const match = intermissionMatch([], {
            score: streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [2, 1], 'a', { source: 'live' }), streamMapScore(2), streamMapScore(3)], {
                current_map: null,
                winner: 'a',
                live_decided: true,
            }),
        })

        const view = intermissionView(match)

        expect(view.final).toEqual({ winner: 'a', series: { a: 2, b: 0 }, official: false })
        expect(view.maps.map(map => map.status)).toEqual(['decided', 'decided', 'open', 'open'])
    })

    it('shows a drawn series with no winner', () => {
        const match = intermissionMatch([[2, 0, 'a'], [0, 2, 'b'], [2, 1, 'a'], [1, 2, 'b']], { status: 'complete' })

        expect(intermissionView(match).final).toEqual({ winner: null, series: { a: 2, b: 2 }, official: true })
    })

    it('stays unofficial while every map is official but the match result is not in', () => {
        const match = intermissionMatch(ALL_DECIDED)

        expect(intermissionView(match).final?.official).toBe(false)
    })

    it.each(['forfeit', 'bye'])('calls a %s result official', status => {
        const match = intermissionMatch(ALL_DECIDED, { status })

        expect(intermissionView(match).final?.official).toBe(true)
    })

    it('is still mid-series while a map is current', () => {
        expect(intermissionView(intermissionMatch(MID_SERIES)).final).toBeNull()
    })
})

describe('map reveal', () => {
    it('never reveals the maps already decided when the scene opens', () => {
        const state = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)

        expect(state.reveal).toBeNull()
        expect(state.decided).toEqual([0, 1, 2])
    })

    it('reveals a map that becomes decided while the scene runs, once', () => {
        const opened = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)
        const decided = intermissionMatch(ALL_DECIDED).score

        const revealed = advanceMapReveal(opened, 'match-1', decided)
        const polledAgain = advanceMapReveal(revealed, 'match-1', decided)

        expect(revealed.reveal).toEqual({ ordinals: [3], seq: 1 })
        expect(polledAgain).toBe(revealed)
    })

    it('keeps the state while nothing is newly decided, even when caps change', () => {
        const opened = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)
        const inPlay = intermissionMatch([...MID_SERIES, [1, 0, null]]).score

        expect(advanceMapReveal(opened, 'match-1', inPlay)).toBe(opened)
    })

    it('reveals each map decided in the same poll', () => {
        const opened = initialMapReveal('match-1', intermissionMatch([[2, 1, 'a']]).score)

        const next = advanceMapReveal(opened, 'match-1', intermissionMatch(MID_SERIES).score)

        expect(next.reveal).toEqual({ ordinals: [1, 2], seq: 1 })
    })

    it('counts reveals up so each one plays', () => {
        const opened = initialMapReveal('match-1', intermissionMatch([[2, 1, 'a']]).score)

        const second = advanceMapReveal(opened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b']]).score)
        const third = advanceMapReveal(second, 'match-1', intermissionMatch(MID_SERIES).score)

        expect(third.reveal).toEqual({ ordinals: [2], seq: 2 })
    })

    it('reveals a reopened map again when it is decided again', () => {
        const opened = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)

        const reopened = advanceMapReveal(opened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b'], [1, 1, null]]).score)
        const redecided = advanceMapReveal(reopened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b'], [1, 2, 'b']]).score)

        expect(reopened.reveal).toBeNull()
        expect(redecided.reveal).toEqual({ ordinals: [2], seq: 1 })
    })

    it('starts over without a reveal when the scene moves to another match', () => {
        const opened = initialMapReveal('match-1', intermissionMatch([[2, 1, 'a']]).score)

        const switched = advanceMapReveal(opened, 'match-2', intermissionMatch(MID_SERIES).score)

        expect(switched).toEqual({ matchId: 'match-2', decided: [0, 1, 2], reveal: null })
    })
})
