import type { StreamHotState, StreamMatch, StreamSide } from '../../data/streamHotState'
import { STREAM_MATCH_ID, STREAM_T0, streamHotState, streamIso, streamMapScore, streamMaps, streamMatch, streamScore } from '../../data/streamFixtures'
import type { NextMapDetails, NextMapPlayer, NextMapRead } from './nextMapRead'

export const NEXT_MAP_NAMES = ['CTF-BT-II-Synchronize-vF2', 'CTF-BT-II-MountainBase', 'CTF-BT-II-FuriumMineCE2', 'CTF-BT-II-FaithCB']
export const NEXT_MAP_PICKS: (StreamSide | null)[] = ['a', 'b', 'a', null]
export const NEXT_MAP_VIDEO_VERSION = '2026-09-20T09:30:00+00:00'

type MapResult = [number, number, StreamSide | null] | null

export function nextMapMatch(results: MapResult[], mapCount = NEXT_MAP_NAMES.length, overrides: Partial<StreamMatch> = {}): StreamMatch {
    const scores = NEXT_MAP_NAMES.map((_, index) => {
        const result = results[index] ?? null
        return result ? streamMapScore(index, [result[0], result[1]], result[2]) : streamMapScore(index)
    })
    const maps = streamMaps(NEXT_MAP_NAMES, NEXT_MAP_PICKS).slice(0, mapCount)
    return streamMatch({
        reason: 'current',
        status: 'in_progress',
        live_at: streamIso(STREAM_T0 - 45 * 60_000),
        pick_ban_status: mapCount === NEXT_MAP_NAMES.length ? 'complete' : 'running',
        maps: maps.map(map => (map.ordinal === 3 ? { ...map, kind: 'decider' } : map)),
        score: streamScore(scores),
        ...overrides,
    })
}

export function nextMapHotState(results: MapResult[], mapCount = NEXT_MAP_NAMES.length, overrides: Partial<StreamMatch> = {}): StreamHotState {
    const match = nextMapMatch(results, mapCount, overrides)
    return streamHotState({ reason: match.reason, match })
}

export const ONE_PLAYED: MapResult[] = [[2, 1, 'a']]

function player(id: string, name: string, pb: number | null, verified = true): NextMapPlayer {
    return {
        id,
        display_name: name,
        avatar: `https://example.test/users/${id}/avatar`,
        pb: pb === null ? null : { time_seconds: pb, verified },
    }
}

export function nextMapDetails(overrides: Partial<NextMapDetails> = {}): NextMapDetails {
    return {
        name: 'CTF-BT-II-MountainBase',
        mapper: 'RoelerCoaster',
        kind: 'normal',
        picked_by: 'b',
        screenshot_version: '2026-08-01T12:00:00+00:00',
        screenshot_url: null,
        video: { available: true, version: NEXT_MAP_VIDEO_VERSION, url: null },
        ...overrides,
    }
}

export function nextMapRead(overrides: Partial<NextMapRead> = {}): NextMapRead {
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        ordinal: 1,
        map: nextMapDetails(),
        team_wr: {
            time_seconds: 97.26,
            holders: [[{ id: '3000', display_name: 'Mirelle', avatar: null }, { id: '3001', display_name: 'Vexa', avatar: null }]],
        },
        lineup: {
            a1: player('1000', 'Ada', 101.87),
            a2: player('1001', 'Ben', 97.26),
            b1: player('2000', 'Cleo', 99.55, false),
            b2: player('2001', 'Dex', null),
        },
        cup_history: {
            times_played: 2,
            fastest_run: {
                time_seconds: 98.4,
                verified: true,
                team: { id: 'team-jade', name: 'Jade Foxes' },
                players: [{ id: '4000', display_name: 'Juno', avatar: null }, { id: '4001', display_name: 'Kai', avatar: null }],
            },
        },
        ...overrides,
    }
}

export function undecidedNextMapRead(ordinal = 1): NextMapRead {
    return nextMapRead({ ordinal, map: null, team_wr: null, cup_history: null })
}
