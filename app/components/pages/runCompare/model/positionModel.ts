import { comparisonKey, type LoadedComparisons } from '../loading/comparisons'
import { comparisonKnots, type PositionLink } from '../playback/syncTargets'
import type { CompareSync } from '../url/compareUrl'
import type { LanesModel } from './laneModel'
import type { RaceModel } from './raceModel'

export const RACE_CLOCK = 'Race clock'

export interface SyncModel {
    mode: CompareSync
    links: PositionLink[]
    raceClock: string[]
}

export const EMPTY_SYNC: SyncModel = { mode: 'race', links: [], raceClock: [] }

export function composeSync(race: RaceModel, lanes: LanesModel, comparisons: LoadedComparisons, mode: CompareSync): SyncModel {
    const links = lanes.lanes.flatMap((lane): PositionLink[] => {
        const reference = race.references.partners.get(lane.capId)
        if (lane.reference || lane.trace.kind !== 'strip' || !reference) return []
        const comparison = comparisons.get(comparisonKey({ runner: lane.capId, reference }))
        return comparison ? [{ capId: lane.capId, reference, knots: comparisonKnots(comparison) }] : []
    })
    const linked = new Set(links.map(link => link.capId))
    const raceClock = mode === 'position'
        ? lanes.lanes.filter(lane => !lane.reference && lane.rung !== null && !linked.has(lane.capId)).map(lane => lane.capId)
        : []
    return { mode, links, raceClock }
}

export function withRaceClock(lanes: LanesModel, sync: SyncModel): LanesModel {
    if (sync.raceClock.length === 0) return lanes
    const marked = new Set(sync.raceClock)
    return {
        ...lanes,
        lanes: lanes.lanes.map(lane => (marked.has(lane.capId) ? { ...lane, badges: [...lane.badges, RACE_CLOCK] } : lane)),
    }
}
