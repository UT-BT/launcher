import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from '@/app/utils/api'
import { streamMapScore, streamScore } from '../../data/streamFixtures'
import { NEXT_MAP_VIDEO_VERSION, ONE_PLAYED, nextMapDetails, nextMapMatch, nextMapRead, undecidedNextMapRead } from './nextMapFixtures'
import { nextMapGap, nextMapMedia, nextMapReadOrdinal, nextMapView, type NextMapInput, type NextMapShown, type NextMapView } from './nextMapView'

const VIDEO_URL = `${API_BASE_URL}/videos/CTF-BT-II-MountainBase.webm?v=${encodeURIComponent(NEXT_MAP_VIDEO_VERSION)}`

function input(overrides: Partial<NextMapInput> = {}): NextMapInput {
    return { match: nextMapMatch(ONE_PLAYED), read: nextMapRead(), readFailed: false, failedVideo: null, animate: true, ...overrides }
}

function shown(view: NextMapView): NextMapShown {
    if (view.state !== 'map') throw new Error(`expected a map, got ${view.state}`)
    return view.next
}

describe('nextMapView: which map', () => {
    it('shows the first undecided map, numbered from 1', () => {
        const view = nextMapView(input())
        expect(view.state).toBe('map')
        expect(shown(view)).toMatchObject({ ordinal: 1, number: 2, map: 'CTF-BT-II-MountainBase', title: 'II-MountainBase' })
        expect(view.kicker).toBe('Map 2 of 4')
    })

    it('follows the score block to a later map', () => {
        const match = nextMapMatch([[2, 1, 'a'], [0, 2, 'b'], [2, 0, 'a']])
        const view = nextMapView(input({ match, read: nextMapRead({ ordinal: 3, map: nextMapDetails({ name: 'CTF-BT-II-FaithCB', kind: 'decider', picked_by: null }) }) }))
        expect(shown(view)).toMatchObject({ ordinal: 3, number: 4, map: 'CTF-BT-II-FaithCB', decider: true, pick: 'Decider', tone: 'gold' })
    })

    it('names the team that picked it, in its side colour', () => {
        expect(shown(nextMapView(input()))).toMatchObject({ pick: 'Picked by Azure Owls', tone: 'b' })
        const first = nextMapView(input({ match: nextMapMatch([]), read: nextMapRead({ ordinal: 0, map: nextMapDetails({ name: 'CTF-BT-II-Synchronize-vF2', picked_by: 'a' }) }) }))
        expect(shown(first)).toMatchObject({ number: 1, pick: 'Picked by Crimson Cats', tone: 'a' })
    })

    it('says maps to be decided while pick and ban has not placed the map', () => {
        const view = nextMapView(input({ match: nextMapMatch(ONE_PLAYED, 1), read: undecidedNextMapRead() }))
        expect(view).toEqual({ state: 'tbd', number: 2, kicker: 'Map 2 of 4' })
    })

    it('says maps to be decided before any map is placed, whatever the read says', () => {
        expect(nextMapView(input({ match: nextMapMatch([], 0), read: null }))).toEqual({ state: 'tbd', number: 1, kicker: 'Map 1 of 4' })
        expect(nextMapView(input({ match: nextMapMatch([], 0), read: nextMapRead({ ordinal: 0 }) })).state).toBe('tbd')
    })

    it('has no next map once the series is decided', () => {
        const match = nextMapMatch([[2, 1, 'a'], [2, 0, 'a']])
        const decided = { ...match, score: streamScore(match.score.maps, { current_map: null, winner: 'a', live_decided: true }) }
        expect(nextMapView(input({ match: decided }))).toEqual({ state: 'over', kicker: 'Series 2–0 · final' })
    })
})

describe('nextMapView: details from the read', () => {
    it('shows the mapper, the team WR and its holders', () => {
        const next = shown(nextMapView(input()))
        expect(next.loaded).toBe(true)
        expect(next.mapper).toBe('RoelerCoaster')
        expect(next.wr).toEqual({ seconds: 97.26, holders: [[{ id: '3000', name: 'Mirelle' }, { id: '3001', name: 'Vexa' }]] })
    })

    it('lists each lineup player with their PB and the gap to the WR', () => {
        const players = shown(nextMapView(input())).players
        expect(players.map(player => [player.slot, player.name, player.pb, player.gap])).toEqual([
            ['a1', 'Ada', { seconds: 101.87, verified: true }, '+4.610s'],
            ['a2', 'Ben', { seconds: 97.26, verified: true }, 'WR'],
            ['b1', 'Cleo', { seconds: 99.55, verified: false }, '+2.290s'],
            ['b2', 'Dex', null, null],
        ])
        expect(players[0].title?.name).toBe('Cap Machine')
    })

    it('has no gaps when the map has no team WR', () => {
        const next = shown(nextMapView(input({ read: nextMapRead({ team_wr: null }) })))
        expect(next.wr).toBeNull()
        expect(next.players.map(player => player.gap)).toEqual([null, null, null, null])
    })

    it('shows the cup history: times played and the fastest cup team run', () => {
        expect(shown(nextMapView(input())).history).toEqual({
            timesPlayed: 2,
            played: 'Played 2 times in this cup',
            fastest: { seconds: 98.4, verified: true, team: 'Jade Foxes', players: [{ id: '4000', name: 'Juno' }, { id: '4001', name: 'Kai' }] },
        })
        const fresh = nextMapRead({ cup_history: { times_played: 0, fastest_run: null } })
        expect(shown(nextMapView(input({ read: fresh }))).history).toEqual({ timesPlayed: 0, played: 'Not played yet in this cup', fastest: null })
        const once = nextMapRead({ cup_history: { times_played: 1, fastest_run: null } })
        expect(shown(nextMapView(input({ read: once }))).history?.played).toBe('Played once in this cup')
    })

    it('keeps the hot-state lineup with no times until the read for this map lands', () => {
        for (const read of [null, nextMapRead({ ordinal: 2 }), nextMapRead({ match_id: 'other' }), nextMapRead({ map: nextMapDetails({ name: 'CTF-BT-Other' }) })]) {
            const next = shown(nextMapView(input({ read })))
            expect(next.loaded).toBe(false)
            expect(next.mapper).toBeNull()
            expect(next.wr).toBeNull()
            expect(next.history).toBeNull()
            expect(next.players.map(player => [player.name, player.pb])).toEqual([['Ada', null], ['Ben', null], ['Cleo', null], ['Dex', null]])
        }
    })

    it('leaves out an empty lineup slot', () => {
        const read = nextMapRead()
        const next = shown(nextMapView(input({ read: { ...read, lineup: { ...read.lineup, b2: null } } })))
        expect(next.players.map(player => player.slot)).toEqual(['a1', 'a2', 'b1'])
    })
})

describe('nextMapMedia', () => {
    const details = nextMapDetails()

    it('plays the versioned video, muted and looping, when the map has one', () => {
        expect(nextMapMedia({ map: details.name, details, settled: true, failedVideo: null, animate: true })).toEqual({ kind: 'video', src: VIDEO_URL, playing: true })
        expect(shown(nextMapView(input())).media).toEqual({ kind: 'video', src: VIDEO_URL, playing: true })
    })

    it('freezes the video on its first frame with motion=0', () => {
        expect(nextMapMedia({ map: details.name, details, settled: true, failedVideo: null, animate: false })).toEqual({ kind: 'video', src: VIDEO_URL, playing: false })
    })

    it('falls back to the panning screenshot when the map has no video', () => {
        const noVideo = nextMapDetails({ video: { available: false, version: null, url: null } })
        expect(nextMapMedia({ map: details.name, details: noVideo, settled: true, failedVideo: null, animate: true })).toEqual({
            kind: 'screenshot',
            map: 'CTF-BT-II-MountainBase',
            version: '2026-08-01T12:00:00+00:00',
            pan: true,
        })
    })

    it('falls back to the screenshot when the video fails to load, until the version changes', () => {
        expect(nextMapMedia({ map: details.name, details, settled: true, failedVideo: VIDEO_URL, animate: true })).toMatchObject({ kind: 'screenshot', pan: true })
        const replaced = nextMapDetails({ video: { available: true, version: '2026-09-30T08:00:00+00:00', url: null } })
        expect(nextMapMedia({ map: details.name, details: replaced, settled: true, failedVideo: VIDEO_URL, animate: true })).toMatchObject({ kind: 'video' })
    })

    it('holds the screenshot still with motion=0', () => {
        const noVideo = nextMapDetails({ video: { available: false, version: null, url: null } })
        expect(nextMapMedia({ map: details.name, details: noVideo, settled: true, failedVideo: null, animate: false })).toMatchObject({ kind: 'screenshot', pan: false })
    })

    it('waits for the read before choosing, then uses the unversioned screenshot if the read has nothing for this map', () => {
        expect(nextMapMedia({ map: details.name, details: null, settled: false, failedVideo: null, animate: true })).toEqual({ kind: 'pending' })
        expect(nextMapMedia({ map: details.name, details: null, settled: true, failedVideo: null, animate: true })).toEqual({
            kind: 'screenshot',
            map: 'CTF-BT-II-MountainBase',
            version: null,
            pan: true,
        })
    })

    it('is settled by a failed read or a read for this map that disagrees with the hot state', () => {
        expect(shown(nextMapView(input({ read: null }))).media).toEqual({ kind: 'pending' })
        expect(shown(nextMapView(input({ read: nextMapRead({ ordinal: 2 }) }))).media).toEqual({ kind: 'pending' })
        expect(shown(nextMapView(input({ read: null, readFailed: true }))).media).toMatchObject({ kind: 'screenshot', version: null })
        expect(shown(nextMapView(input({ read: undecidedNextMapRead() }))).media).toMatchObject({ kind: 'screenshot', version: null })
    })
})

describe('nextMapGap', () => {
    it('reads the gap to the WR in seconds', () => {
        expect(nextMapGap(101.87, 97.26)).toBe('+4.610s')
        expect(nextMapGap(97.26, 97.26)).toBe('WR')
        expect(nextMapGap(96.9, 97.26)).toBe('-0.360s')
        expect(nextMapGap(170.5, 97.26)).toBe('+01:13.240')
    })

    it('is empty without both times', () => {
        expect(nextMapGap(null, 97.26)).toBeNull()
        expect(nextMapGap(101.87, null)).toBeNull()
    })

    it('ignores floating point noise', () => {
        expect(nextMapGap(0.1 + 0.2, 0.3)).toBe('WR')
    })
})

describe('nextMapView: score entries without a hot-state row', () => {
    it('numbers from the ordinal, not the list position', () => {
        const match = nextMapMatch([], 0)
        const late = { ...match, score: streamScore([streamMapScore(2), streamMapScore(3)]) }
        expect(nextMapView(input({ match: late, read: null }))).toEqual({ state: 'tbd', number: 3, kicker: 'Map 3 of 4' })
    })
})

describe('nextMapReadOrdinal', () => {
    it('reads the next map only once the hot state has placed it', () => {
        expect(nextMapReadOrdinal(nextMapMatch(ONE_PLAYED))).toBe(1)
        expect(nextMapReadOrdinal(nextMapMatch(ONE_PLAYED, 1))).toBeNull()
        expect(nextMapReadOrdinal(nextMapMatch([], 0))).toBeNull()
    })

    it('reads nothing once the series is decided', () => {
        const match = nextMapMatch([[2, 1, 'a'], [2, 0, 'a']])
        expect(nextMapReadOrdinal({ ...match, score: { ...match.score, current_map: null } })).toBeNull()
    })
})
