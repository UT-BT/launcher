import { describe, expect, it } from 'vitest'
import { streamMapScore, streamScore } from '../../data/streamFixtures'
import { ALL_DECIDED, MID_SERIES, intermissionMatch, intermissionRead } from './intermissionFixtures'
import { advanceMapReveal, initialMapReveal, intermissionView } from './intermissionView'

describe('intermissionView series', () => {
    it('shows caps per map with where each count comes from', () => {
        const match = intermissionMatch([], {
            score: streamScore([
                streamMapScore(1, [2, 1], 'a'),
                streamMapScore(2, [2, 3], 'b', { source: 'override' }),
                streamMapScore(3, [1, 0], null),
                streamMapScore(4, [0, 0], null),
            ]),
        })

        const view = intermissionView(match, null)

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
            score: streamScore([streamMapScore(1, [2, 0], 'a', { source: 'live' }), streamMapScore(2, [0, 1]), streamMapScore(3), streamMapScore(4)]),
        })

        const view = intermissionView(match, null)

        expect(view.maps.map(map => map.status)).toEqual(['decided', 'next', 'open', 'open'])
        expect(view.maps.map(map => map.sourceLabel)).toEqual(['Live', 'Live', null, null])
    })

    it('names each map and its picker from the match maps, and flags the latest decided map', () => {
        const view = intermissionView(intermissionMatch(MID_SERIES), null)

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

        expect(intermissionView(match, null).maps.map(map => map.map)).toEqual([null, null, null, null])
    })

    it('has no latest map before any map is decided', () => {
        expect(intermissionView(intermissionMatch([]), null).latest).toBeNull()
    })

    it('reads the series in the title kicker', () => {
        expect(intermissionView(intermissionMatch(MID_SERIES), null).kicker).toBe('Series 2–1 · map 4 next')
    })
})

describe('intermissionView next map', () => {
    it('follows the score block current map, not the first map without caps', () => {
        const match = intermissionMatch([[2, 1, 'a'], [0, 0, 'b']], {
            score: streamScore([streamMapScore(1, [2, 1], 'a'), streamMapScore(2, [0, 0], null), streamMapScore(3), streamMapScore(4)], { current_map: 3 }),
        })

        const view = intermissionView(match, null)

        expect(view.next?.ordinal).toBe(3)
        expect(view.next?.number).toBe(3)
        expect(view.maps.map(map => map.status)).toEqual(['decided', 'open', 'next', 'open'])
    })

    it('fills the card from the intermission read', () => {
        const view = intermissionView(intermissionMatch(MID_SERIES), intermissionRead())

        expect(view.next).toMatchObject({
            ordinal: 4,
            number: 4,
            map: 'CTF-BT-II-FaithCB',
            pickedBy: 'a',
            decider: false,
            mapper: 'RoelerCoaster',
            screenshotVersion: '2026-08-01T12:00:00+00:00',
            wrSeconds: 97.26,
            loaded: true,
        })
    })

    it('shows the hot-state map and picker while the read is missing, stale or for another map', () => {
        const match = intermissionMatch(MID_SERIES)
        const stale = [null, intermissionRead({ ordinal: 3 }), intermissionRead({ match_id: 'match-9' })]

        for (const read of stale) {
            expect(intermissionView(match, read).next).toMatchObject({
                ordinal: 4,
                map: 'CTF-BT-II-FaithCB',
                pickedBy: 'a',
                mapper: null,
                wrSeconds: null,
                loaded: false,
            })
        }
    })

    it('marks a decider and a slot the read has no map for yet', () => {
        const view = intermissionView(intermissionMatch(MID_SERIES), intermissionRead({ kind: 'decider', picked_by: null, map: null, team_wr: null }))

        expect(view.next).toMatchObject({ decider: true, pickedBy: null, map: 'CTF-BT-II-FaithCB', mapper: null, wrSeconds: null })
    })
})

describe('intermissionView lineup PBs', () => {
    it('lists the lineup A then B with each PB, and no PB for a player without a run', () => {
        const players = intermissionView(intermissionMatch(MID_SERIES), intermissionRead()).next?.players

        expect(players?.map(player => [player.slot, player.side, player.name, player.pb])).toEqual([
            ['a1', 'a', 'Ada', { seconds: 101.87, verified: true }],
            ['a2', 'a', 'Ben', { seconds: 104.02, verified: true }],
            ['b1', 'b', 'Cleo', { seconds: 99.55, verified: false }],
            ['b2', 'b', 'Dex', null],
        ])
    })

    it('carries each player title from the team roster', () => {
        const players = intermissionView(intermissionMatch(MID_SERIES), intermissionRead()).next?.players

        expect(players?.map(player => player.title?.name ?? null)).toEqual(['Cap Machine', null, null, 'Speedrunner'])
    })

    it('skips an empty lineup slot', () => {
        const read = intermissionRead()
        const players = intermissionView(intermissionMatch(MID_SERIES), { ...read, lineup: { ...read.lineup, a2: null } }).next?.players

        expect(players?.map(player => player.slot)).toEqual(['a1', 'b1', 'b2'])
    })

    it('shows the hot-state lineup with no PBs until the read lands', () => {
        const players = intermissionView(intermissionMatch(MID_SERIES), null).next?.players

        expect(players?.map(player => [player.slot, player.name, player.pb])).toEqual([
            ['a1', 'Ada', null],
            ['a2', 'Ben', null],
            ['b1', 'Cleo', null],
            ['b2', 'Dex', null],
        ])
    })
})

describe('intermissionView when every map is decided', () => {
    it('shows the final series instead of a next map', () => {
        const match = intermissionMatch(ALL_DECIDED)
        const score = { ...match.score, winner: 'a' as const, live_decided: true }

        const view = intermissionView({ ...match, status: 'complete', score }, null)

        expect(view.next).toBeNull()
        expect(view.final).toEqual({ winner: 'a', series: { a: 3, b: 1 }, official: true })
        expect(view.kicker).toBe('Series 3–1 · final')
        expect(view.latest?.number).toBe(4)
    })

    it('calls the final series unofficial while any map comes from the live count', () => {
        const match = intermissionMatch([], {
            score: streamScore([streamMapScore(1, [2, 0], 'a'), streamMapScore(2, [2, 1], 'a', { source: 'live' }), streamMapScore(3), streamMapScore(4)], {
                current_map: null,
                winner: 'a',
                live_decided: true,
            }),
        })

        const view = intermissionView(match, null)

        expect(view.final).toEqual({ winner: 'a', series: { a: 2, b: 0 }, official: false })
        expect(view.maps.map(map => map.status)).toEqual(['decided', 'decided', 'open', 'open'])
    })

    it('shows a drawn series with no winner', () => {
        const match = intermissionMatch([[2, 0, 'a'], [0, 2, 'b'], [2, 1, 'a'], [1, 2, 'b']], { status: 'complete' })

        expect(intermissionView(match, null).final).toEqual({ winner: null, series: { a: 2, b: 2 }, official: true })
    })

    it('stays unofficial while every map is official but the match result is not in', () => {
        const match = intermissionMatch(ALL_DECIDED)

        expect(intermissionView(match, null).final?.official).toBe(false)
    })

    it.each(['forfeit', 'bye'])('calls a %s result official', status => {
        const match = intermissionMatch(ALL_DECIDED, { status })

        expect(intermissionView(match, null).final?.official).toBe(true)
    })

    it('is still mid-series while a map is current', () => {
        expect(intermissionView(intermissionMatch(MID_SERIES), null).final).toBeNull()
    })
})

describe('map reveal', () => {
    it('never reveals the maps already decided when the scene opens', () => {
        const state = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)

        expect(state.reveal).toBeNull()
        expect(state.decided).toEqual([1, 2, 3])
    })

    it('reveals a map that becomes decided while the scene runs, once', () => {
        const opened = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)
        const decided = intermissionMatch(ALL_DECIDED).score

        const revealed = advanceMapReveal(opened, 'match-1', decided)
        const polledAgain = advanceMapReveal(revealed, 'match-1', decided)

        expect(revealed.reveal).toEqual({ ordinals: [4], seq: 1 })
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

        expect(next.reveal).toEqual({ ordinals: [2, 3], seq: 1 })
    })

    it('counts reveals up so each one plays', () => {
        const opened = initialMapReveal('match-1', intermissionMatch([[2, 1, 'a']]).score)

        const second = advanceMapReveal(opened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b']]).score)
        const third = advanceMapReveal(second, 'match-1', intermissionMatch(MID_SERIES).score)

        expect(third.reveal).toEqual({ ordinals: [3], seq: 2 })
    })

    it('reveals a reopened map again when it is decided again', () => {
        const opened = initialMapReveal('match-1', intermissionMatch(MID_SERIES).score)

        const reopened = advanceMapReveal(opened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b'], [1, 1, null]]).score)
        const redecided = advanceMapReveal(reopened, 'match-1', intermissionMatch([[2, 1, 'a'], [0, 2, 'b'], [1, 2, 'b']]).score)

        expect(reopened.reveal).toBeNull()
        expect(redecided.reveal).toEqual({ ordinals: [3], seq: 1 })
    })

    it('starts over without a reveal when the scene moves to another match', () => {
        const opened = initialMapReveal('match-1', intermissionMatch([[2, 1, 'a']]).score)

        const switched = advanceMapReveal(opened, 'match-2', intermissionMatch(MID_SERIES).score)

        expect(switched).toEqual({ matchId: 'match-2', decided: [1, 2, 3], reveal: null })
    })
})
