import { describe, expect, it } from 'vitest'
import { streamDrawnMapScore, streamMapScore, streamMaps, streamMatch, streamScore, streamTeam } from '../../data/streamFixtures'
import { MAP_NAME_MAX_PX, UPCOMING_NAME_MIN_PX } from './overlayLayout'
import { overlayView } from './overlayView'

const MAPS = streamMaps(['CTF-BT-Maverick', 'CTF-BT-Mandarin', 'CTF-BT-Letss-Go', 'CTF-BT-Skyfall'], ['a', 'b', 'b', null])
const LONG_MAPS = streamMaps(['CTF-BT-II-Diplopia-V4', 'CTF-BT-II-InventionCE2', 'CTF-BT-II-Fabricatorium', 'CTF-BT-II-FaithCB'], ['a', 'b', 'a', null])

function midSeries() {
    return streamMatch({
        reason: 'current',
        maps: MAPS,
        score: streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [1, 0]), streamMapScore(2), streamMapScore(3)]),
    })
}

describe('overlayView', () => {
    it('shows nothing when no match is resolved', () => {
        expect(overlayView(null)).toBeNull()
    })

    it('puts a name tag with only the alias and avatar on each quadrant against the seam: A above it, B below it, slot 1 left', () => {
        const view = overlayView(midSeries())

        expect(view?.tags).toEqual([
            { slot: 'a1', side: 'a', placement: 'above-seam-left', userId: '1000', name: 'Ada' },
            { slot: 'a2', side: 'a', placement: 'above-seam-right', userId: '1001', name: 'Ben' },
            { slot: 'b1', side: 'b', placement: 'below-seam-left', userId: '2000', name: 'Cleo' },
            { slot: 'b2', side: 'b', placement: 'below-seam-right', userId: '2001', name: 'Dex' },
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

    it('reads a team that is not known yet as TBD', () => {
        const match = streamMatch({ teams: { a: streamTeam('a'), b: null } })

        expect(overlayView(match)?.teams.map(team => team.name)).toEqual(['Crimson Cats', 'TBD'])
    })

    describe('pips', () => {
        it('shows the majority of a first-to series as pips', () => {
            const view = overlayView(midSeries())

            expect(view?.teams.map(team => team.pips)).toEqual([
                ['won', 'open', 'open'],
                ['open', 'open', 'open'],
            ])
            expect(overlayView(streamMatch({ best_of: 5 }))?.teams[0].pips).toHaveLength(3)
        })

        it('shows every map of an all-maps series as pips', () => {
            const view = overlayView(streamMatch({ best_of: 4, mode: 'all_maps', score: streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1)]) }))

            expect(view?.teams.map(team => team.pips)).toEqual([
                ['won', 'open', 'open', 'open'],
                ['open', 'open', 'open', 'open'],
            ])
        })

        it('drops a pip from the race for every drawn map', () => {
            const one = overlayView(streamMatch({ best_of: 4, score: streamScore([streamDrawnMapScore(0), streamMapScore(1)]) }))
            const two = overlayView(streamMatch({ best_of: 5, score: streamScore([streamDrawnMapScore(0), streamDrawnMapScore(1, [0, 0]), streamMapScore(2)]) }))

            expect(one?.teams.map(team => team.pips)).toEqual([['open', 'open'], ['open', 'open']])
            expect(two?.teams[0].pips).toHaveLength(2)
        })
    })

    describe('score box', () => {
        it('shows the current map caps from the score block', () => {
            const view = overlayView(midSeries())

            expect(view?.teams.map(team => team.caps)).toEqual([1, 0])
            expect(view?.capsSource).toBe('live')
        })

        it('shows the caps a streamer set by hand, with its source', () => {
            const match = streamMatch({ maps: MAPS, score: streamScore([streamMapScore(0, [0, 1], null, { source: 'manual', pins: { a: null, b: 1 } })]) })

            const view = overlayView(match)

            expect(view?.teams.map(team => team.caps)).toEqual([0, 1])
            expect(view?.capsSource).toBe('manual')
        })

        it('keeps the last decided map once the series is over', () => {
            const match = streamMatch({
                maps: MAPS,
                score: streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [2, 1], 'a'), streamMapScore(2, [2, 0], 'a'), streamMapScore(3)], {
                    current_map: null,
                    winner: 'a',
                    live_decided: true,
                }),
            })

            const view = overlayView(match)

            expect(view?.teams.map(team => team.caps)).toEqual([2, 0])
            expect(view?.capsSource).toBe('official')
            expect(view?.teams.map(team => team.pips)).toEqual([
                ['won', 'won', 'won'],
                ['open', 'open', 'open'],
            ])
        })

        it('leaves caps that were never entered empty', () => {
            const match = streamMatch({ maps: MAPS, score: streamScore([streamMapScore(0, [0, 0], 'b', { caps: { a: null, b: null } })], { current_map: 0 }) })

            expect(overlayView(match)?.teams.map(team => team.caps)).toEqual([null, null])
        })
    })

    describe('map strip', () => {
        it('lists every series map with its 1-based number, played, current or upcoming', () => {
            const strip = overlayView(midSeries())?.strip

            expect(strip?.maps.map(map => [map.number, map.name, map.state])).toEqual([
                [1, 'Maverick', 'played'],
                [2, 'Mandarin', 'current'],
                [3, 'Letss-Go', 'upcoming'],
                [4, 'Skyfall', 'upcoming'],
            ])
        })

        it('numbers maps from their ordinal, not their place in the list', () => {
            const match = streamMatch({ maps: streamMaps(['CTF-BT-Maverick', 'CTF-BT-Mandarin']).map(map => ({ ...map, ordinal: map.ordinal + 2 })) })

            expect(overlayView(match)?.strip.maps.map(map => map.number)).toEqual([3, 4])
        })

        it('colours each map by who picked it, and the decider gold', () => {
            expect(overlayView(midSeries())?.strip.maps.map(map => map.tone)).toEqual(['a', 'b', 'b', 'gold'])
        })

        it('gives played maps their result and the winner, and upcoming maps none', () => {
            expect(overlayView(midSeries())?.strip.maps.map(map => map.result)).toEqual([{ a: 2, b: 1, winner: 'a', drawn: false }, null, null, null])
        })

        it('shows a map decided with no winner at its level score', () => {
            const match = streamMatch({
                maps: MAPS,
                score: streamScore([streamMapScore(0, [1, 1], null, { decided: true, source: 'live' }), streamMapScore(1, [0, 2], 'b'), streamMapScore(2), streamMapScore(3)]),
            })

            const maps = overlayView(match)?.strip.maps

            expect(maps?.map(map => map.state)).toEqual(['played', 'played', 'current', 'upcoming'])
            expect(maps?.[0].result).toEqual({ a: 1, b: 1, winner: null, drawn: true })
            expect(maps?.[1].result).toEqual({ a: 0, b: 2, winner: 'b', drawn: false })
        })

        it('gives a decided map with no caps no result', () => {
            const match = streamMatch({ maps: MAPS, score: streamScore([streamMapScore(0, [0, 0], 'a', { caps: { a: null, b: null } }), streamMapScore(1)]) })

            expect(overlayView(match)?.strip.maps[0]).toMatchObject({ state: 'played', result: null })
        })

        it('has no current map once the series is decided, and dims the maps never played', () => {
            const match = streamMatch({
                maps: MAPS,
                score: streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [2, 1], 'a'), streamMapScore(2, [2, 0], 'a'), streamMapScore(3)], {
                    current_map: null,
                    winner: 'a',
                    live_decided: true,
                }),
            })

            expect(overlayView(match)?.strip.maps.map(map => map.state)).toEqual(['played', 'played', 'played', 'skipped'])
        })

        it('ends a four-map race at 2-0 after a drawn map, with the last map skipped', () => {
            const match = streamMatch({
                maps: MAPS,
                score: streamScore([streamMapScore(0, [2, 0], 'a'), streamDrawnMapScore(1), streamMapScore(2, [2, 1], 'a'), streamMapScore(3)], {
                    current_map: null,
                    winner: 'a',
                    live_decided: true,
                }),
            })

            const view = overlayView(match)

            expect(view?.strip.maps.map(map => map.state)).toEqual(['played', 'played', 'played', 'skipped'])
            expect(view?.strip.maps[1].result).toEqual({ a: 1, b: 1, winner: null, drawn: true })
            expect(view?.teams.map(team => team.pips)).toEqual([['won', 'won'], ['open', 'open']])
        })

        it('is empty before pick/ban has placed any map', () => {
            expect(overlayView(streamMatch())?.strip.maps).toEqual([])
        })
    })

    describe('caps target chip', () => {
        it('shows the caps target', () => {
            expect(overlayView(midSeries())?.strip.target).toBe('FT2')
            expect(overlayView(streamMatch({ best_of: 5, caps_to_win: 3 }))?.strip.target).toBe('FT3')
        })

        it('has no chip when the match has no caps target', () => {
            expect(overlayView(streamMatch({ caps_to_win: null }))?.strip.target).toBeNull()
        })
    })

    describe('fit rules', () => {
        it('drops a size for team names longer than 15 characters', () => {
            const match = streamMatch({ teams: { a: streamTeam('a', { name: 'Jumpstart Syndic' }), b: streamTeam('b', { name: 'Jumpstart Syndi' }) } })

            expect(overlayView(match)?.teams.map(team => [team.name.length, team.longName])).toEqual([
                [16, true],
                [15, false],
            ])
        })

        it('keeps played map names while the band fits', () => {
            const strip = overlayView(
                streamMatch({ maps: MAPS, caps_to_win: null, score: streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1), streamMapScore(2), streamMapScore(3)]) }),
            )?.strip

            expect(strip?.compact).toBe(false)
            expect(strip?.maps.every(map => map.showName)).toBe(true)
        })

        it('collapses played maps to number and score when the band would overflow', () => {
            const match = streamMatch({
                maps: LONG_MAPS,
                score: streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [1, 2], 'b'), streamMapScore(2), streamMapScore(3)]),
            })

            const strip = overlayView(match)?.strip

            expect(strip?.compact).toBe(true)
            expect(strip?.maps.map(map => [map.state, map.showName])).toEqual([
                ['played', false],
                ['played', false],
                ['current', true],
                ['upcoming', true],
            ])
            expect(strip?.maps[0].result).toEqual({ a: 2, b: 0, winner: 'a', drawn: false })
        })

        it('counts the caps target chip in the band width', () => {
            const maps = streamMaps(['CTF-BT-Maverick', 'CTF-BT-Mandarin-Groves', 'CTF-BT-Letss-Go', 'CTF-BT-Skyfall'], ['a', 'b', 'b', null])
            const score = streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1), streamMapScore(2), streamMapScore(3)])

            expect(overlayView(streamMatch({ maps, caps_to_win: null, score }))?.strip.compact).toBe(false)
            expect(overlayView(streamMatch({ maps, caps_to_win: 2, score }))?.strip.compact).toBe(true)
        })

        it('truncates upcoming map names at 140 px, and counts them at that width', () => {
            const longName = `CTF-BT-${'Lengthy'.repeat(6)}`
            const match = streamMatch({
                maps: streamMaps(['CTF-BT-Maverick', 'CTF-BT-Mandarin', longName], ['a', 'b', 'a']),
                caps_to_win: null,
                best_of: 3,
                score: streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1), streamMapScore(2)]),
            })

            const strip = overlayView(match)?.strip

            expect(MAP_NAME_MAX_PX.upcoming).toBe(140)
            expect(strip?.maps.map(map => map.nameMaxPx)).toEqual([MAP_NAME_MAX_PX.played, null, 140])
            expect(strip?.compact).toBe(false)
        })

        it('shortens upcoming map names so every map stays in the band before any is played', () => {
            const strip = overlayView(streamMatch({ maps: LONG_MAPS, score: streamScore([streamMapScore(0), streamMapScore(1), streamMapScore(2), streamMapScore(3)]) }))?.strip
            const upcoming = strip?.maps.filter(map => map.state === 'upcoming') ?? []

            expect(strip?.compact).toBe(true)
            expect(strip?.maps.map(map => map.showName)).toEqual([true, true, true, true])
            expect(upcoming).toHaveLength(3)
            for (const map of upcoming) {
                expect(map.nameMaxPx).toBeLessThan(MAP_NAME_MAX_PX.upcoming)
                expect(map.nameMaxPx).toBeGreaterThanOrEqual(UPCOMING_NAME_MIN_PX)
            }
        })

        it('drops upcoming map names to their numbers when even short names would overflow', () => {
            const maps = streamMaps(['CTF-BT-II-Synchronize-vF2', ...LONG_MAPS.map(map => map.map)], ['a', 'b', 'a', 'b', null])
            const score = streamScore([streamMapScore(0), streamMapScore(1), streamMapScore(2), streamMapScore(3), streamMapScore(4)])

            const strip = overlayView(streamMatch({ maps, best_of: 5, score }))?.strip

            expect(strip?.maps.map(map => [map.state, map.showName])).toEqual([
                ['current', true],
                ['upcoming', false],
                ['upcoming', false],
                ['upcoming', false],
                ['upcoming', false],
            ])
        })
    })
})
