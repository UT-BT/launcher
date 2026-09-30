import type { StreamHotState, StreamMatch, StreamSide } from '../../data/streamHotState'
import { STREAM_T0, streamHotState, streamIso, streamMapScore, streamMaps, streamMatch, streamScore } from '../../data/streamFixtures'

export const INTERMISSION_MAPS = ['CTF-BT-II-Synchronize-vF2', 'CTF-BT-II-MountainBase', 'CTF-BT-II-FuriumMineCE2', 'CTF-BT-II-FaithCB']
export const INTERMISSION_PICKS: (StreamSide | null)[] = ['a', 'b', 'b', 'a']

type MapResult = [number, number, StreamSide | null] | null

export function intermissionMatch(results: MapResult[], overrides: Partial<StreamMatch> = {}): StreamMatch {
    const maps = INTERMISSION_MAPS.map((_, index) => {
        const result = results[index] ?? null
        return result ? streamMapScore(index, [result[0], result[1]], result[2]) : streamMapScore(index)
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
