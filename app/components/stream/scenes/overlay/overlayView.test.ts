import { describe, expect, it } from 'vitest'
import { streamMapScore, streamMaps, streamMatch, streamScore, streamTeam } from '../../data/streamFixtures'
import { overlayView } from './overlayView'

const MAPS = streamMaps(['CTF-BT-II-Diplopia-V4', 'CTF-BT-II-InventionCE2', 'CTF-BT-II-Fabricatorium', 'CTF-BT-II-FaithCB'], ['a', 'b', 'a', null])

function midSeries() {
    return streamMatch({
        reason: 'current',
        maps: MAPS,
        score: streamScore([streamMapScore(1, [2, 0], 'a'), streamMapScore(2, [1, 2], 'b'), streamMapScore(3, [1, 1])]),
    })
}

describe('overlayView', () => {
    it('shows nothing when no match is resolved', () => {
        expect(overlayView(null)).toBeNull()
    })

    it('puts a name tag on each quadrant from the lineup: A on top, B at the bottom, slot 1 left', () => {
        const view = overlayView(midSeries())

        expect(view?.tags).toEqual([
            { slot: 'a1', label: 'A1', side: 'a', corner: 'mid-left', userId: '1000', name: 'Ada' },
            { slot: 'a2', label: 'A2', side: 'a', corner: 'mid-right', userId: '1001', name: 'Ben' },
            { slot: 'b1', label: 'B1', side: 'b', corner: 'bottom-left', userId: '2000', name: 'Cleo' },
            { slot: 'b2', label: 'B2', side: 'b', corner: 'bottom-right', userId: '2001', name: 'Dex' },
        ])
    })

    it('follows a swapped lineup and leaves an empty slot without a tag', () => {
        const match = streamMatch({
            lineup: {
                a1: { id: '1001', display_name: 'Ben', avatar: null },
                a2: { id: '1000', display_name: 'Ada', avatar: null },
                b1: { id: '2000', display_name: 'Cleo', avatar: null },
                b2: null,
            },
        })

        expect(overlayView(match)?.tags.map(tag => [tag.slot, tag.name])).toEqual([
            ['a1', 'Ben'],
            ['a2', 'Ada'],
            ['b1', 'Cleo'],
        ])
    })

    it('keeps Team A on the top row and Team B on the bottom row', () => {
        const view = overlayView(midSeries())

        expect(view?.teams.map(team => [team.side, team.name])).toEqual([
            ['a', 'Crimson Cats'],
            ['b', 'Azure Owls'],
        ])
    })

    it('shows the series as map-win flags and the current map caps from the score block', () => {
        const view = overlayView(midSeries())

        expect(view?.teams.map(team => team.flags)).toEqual([
            ['won', 'open', 'open'],
            ['won', 'open', 'open'],
        ])
        expect(view?.teams.map(team => team.caps)).toEqual([1, 1])
        expect(view?.capsSource).toBe('live')
        expect(view?.mapLine).toBe('Map 3 of 4 · first to 2')
    })

    it('shows the caps a streamer override set, with its source', () => {
        const match = streamMatch({
            maps: MAPS,
            score: streamScore([streamMapScore(1, [0, 1], null, { source: 'override' })]),
        })

        const view = overlayView(match)

        expect(view?.teams.map(team => team.caps)).toEqual([0, 1])
        expect(view?.capsSource).toBe('override')
    })

    it('shows an official map result as it stands', () => {
        const match = streamMatch({
            best_of: 1,
            maps: MAPS.slice(0, 1),
            score: streamScore([streamMapScore(1, [2, 0], 'a')], { current_map: null, winner: 'a', live_decided: true }),
        })

        const view = overlayView(match)

        expect(view?.teams.map(team => team.caps)).toEqual([2, 0])
        expect(view?.teams.map(team => team.flags)).toEqual([['won'], ['open']])
        expect(view?.capsSource).toBe('official')
        expect(view?.mapLine).toBe('Map 1 of 1 · first to 2')
    })

    it('keeps the last decided map once the series is over', () => {
        const match = streamMatch({
            maps: MAPS,
            score: streamScore(
                [streamMapScore(1, [2, 0], 'a'), streamMapScore(2, [2, 1], 'a'), streamMapScore(3, [2, 0], 'a'), streamMapScore(4)],
                { current_map: null, winner: 'a', live_decided: true },
            ),
        })

        const view = overlayView(match)

        expect(view?.mapLine).toBe('Map 3 of 4 · first to 2')
        expect(view?.map?.name).toBe('II-Fabricatorium')
        expect(view?.teams.map(team => team.flags)).toEqual([
            ['won', 'won', 'won'],
            ['open', 'open', 'open'],
        ])
    })

    it('leaves caps that were never entered empty', () => {
        const match = streamMatch({
            maps: MAPS,
            score: streamScore([streamMapScore(1, [0, 0], 'b', { caps: { a: null, b: null } })], { current_map: 1 }),
        })

        expect(overlayView(match)?.teams.map(team => team.caps)).toEqual([null, null])
    })

    it('names the current map and the team that picked it', () => {
        expect(overlayView(midSeries())?.map).toEqual({ name: 'II-Fabricatorium', pickedBy: { side: 'a', team: 'Crimson Cats' } })

        const decider = streamMatch({ maps: MAPS, score: streamScore([1, 2, 3].map(ordinal => streamMapScore(ordinal, [2, 0], 'a')).concat(streamMapScore(4))) })
        expect(overlayView(decider)?.map).toEqual({ name: 'II-FaithCB', pickedBy: null })
    })

    it('has no map before pick/ban has chosen one', () => {
        const view = overlayView(streamMatch())

        expect(view?.map).toBeNull()
        expect(view?.mapLine).toBe('Map 1 of 4 · first to 2')
    })

    it('shows the stage, round and format label', () => {
        expect(overlayView(streamMatch({ best_of: 5 }))?.footer).toBe('Group Stage · Group B · Round 4 · Bo5 · first to 2 team caps')
        expect(overlayView(streamMatch({ group: null, round: { no: 1, label: 'Final' }, stage: { key: 'final', name: 'Final Stage' }, caps_to_win: 3 }))?.footer).toBe(
            'Final Stage · Final · Bo4 · first to 3 team caps',
        )
    })

    it('reads a match without a caps target', () => {
        const view = overlayView(streamMatch({ caps_to_win: null }))

        expect(view?.mapLine).toBe('Map 1 of 4')
        expect(view?.footer).toBe('Group Stage · Group B · Round 4 · Bo4')
    })

    it('counts every map in an all-maps series', () => {
        const view = overlayView(streamMatch({ best_of: 2, mode: 'all_maps', score: streamScore([streamMapScore(1, [2, 1], 'a'), streamMapScore(2)]) }))

        expect(view?.teams.map(team => team.flags)).toEqual([
            ['won', 'open'],
            ['open', 'open'],
        ])
        expect(view?.mapLine).toBe('Map 2 of 2 · first to 2')
    })

    it('reads a team that is not known yet as TBD', () => {
        const match = streamMatch({ teams: { a: streamTeam('a'), b: null } })

        expect(overlayView(match)?.teams.map(team => team.name)).toEqual(['Crimson Cats', 'TBD'])
    })
})
