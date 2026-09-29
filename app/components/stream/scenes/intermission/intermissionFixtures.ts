import type { StreamHotState, StreamMatch, StreamSide } from '../../data/streamHotState'
import { STREAM_MATCH_ID, STREAM_T0, streamHotState, streamIso, streamMapScore, streamMaps, streamMatch, streamScore } from '../../data/streamFixtures'
import type { IntermissionPlayer, IntermissionRead } from './intermissionRead'

export const INTERMISSION_MAPS = ['CTF-BT-II-Synchronize-vF2', 'CTF-BT-II-MountainBase', 'CTF-BT-II-FuriumMineCE2', 'CTF-BT-II-FaithCB']
export const INTERMISSION_PICKS: (StreamSide | null)[] = ['a', 'b', 'b', 'a']

type MapResult = [number, number, StreamSide | null] | null

export function intermissionMatch(results: MapResult[], overrides: Partial<StreamMatch> = {}): StreamMatch {
    const maps = INTERMISSION_MAPS.map((_, index) => {
        const result = results[index] ?? null
        return result ? streamMapScore(index + 1, [result[0], result[1]], result[2]) : streamMapScore(index + 1)
    })
    return streamMatch({
        reason: 'current',
        status: 'in_progress',
        live_at: streamIso(STREAM_T0 - 45 * 60_000),
        pick_ban_status: 'complete',
        maps: streamMaps(INTERMISSION_MAPS, INTERMISSION_PICKS),
        score: streamScore(maps),
        ...overrides,
    })
}

export const MID_SERIES: MapResult[] = [[2, 1, 'a'], [0, 2, 'b'], [2, 1, 'a']]

export const ALL_DECIDED: MapResult[] = [[2, 1, 'a'], [0, 2, 'b'], [2, 1, 'a'], [2, 0, 'a']]

export function intermissionHotState(results: MapResult[], overrides: Partial<StreamMatch> = {}): StreamHotState {
    const match = intermissionMatch(results, overrides)
    return streamHotState({ reason: match.reason, match })
}

function player(id: string, name: string, pb: number | null, verified = true): IntermissionPlayer {
    return {
        id,
        display_name: name,
        avatar: `https://example.test/users/${id}/avatar`,
        pb: pb === null ? null : { time_seconds: pb, verified },
    }
}

export function intermissionRead(overrides: Partial<IntermissionRead> = {}): IntermissionRead {
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        ordinal: 4,
        kind: 'normal',
        picked_by: 'a',
        map: {
            name: 'CTF-BT-II-FaithCB',
            mapper: 'RoelerCoaster',
            screenshot_version: '2026-08-01T12:00:00+00:00',
            screenshot_url: null,
        },
        team_wr: {
            time_seconds: 97.26,
            holders: [[{ id: '3000', display_name: 'Mirelle', avatar: null }, { id: '3001', display_name: 'Vexa', avatar: null }]],
        },
        lineup: {
            a1: player('1000', 'Ada', 101.87),
            a2: player('1001', 'Ben', 104.02),
            b1: player('2000', 'Cleo', 99.55, false),
            b2: player('2001', 'Dex', null),
        },
        ...overrides,
    }
}
