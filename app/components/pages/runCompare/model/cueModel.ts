import type { CapCheckpoint } from '@/app/utils/api'
import { comparisonKey, type LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { comparisonKnots, positionTarget, type CueTargetPoint } from '../playback/syncTargets'
import { sectorTicks, type Lane, type LanesModel } from './laneModel'
import type { RaceModel } from './raceModel'
import { isSideReference } from './referenceModel'

export type CueKind = 'sector' | 'zone'

export interface CuePoint extends CueTargetPoint {
    key: string
    kind: CueKind
    label: string
}

export interface CueModel {
    references: string[]
    points: CuePoint[]
    sectors: CuePoint[]
    zones: CuePoint[]
}

export const EMPTY_CUES: CueModel = { references: [], points: [], sectors: [], zones: [] }

const CUE_TOLERANCE_MS = 1

interface SideCue extends CuePoint {
    runTimesMs: Map<string, number>
}

interface SideMember {
    lane: Lane
    zoneMs: (zone: string) => number | null
    runMsAt: ((referenceMs: number) => number) | null
}

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

function zoneKey(zone: string): string {
    return `zone:${zone}`
}

function firstCrossings(checkpoints: readonly CapCheckpoint[]): Map<string, number> {
    const crossings = new Map<string, number>()
    checkpoints.forEach(checkpoint => {
        if (!crossings.has(checkpoint.zone)) crossings.set(checkpoint.zone, msOf(checkpoint.cumulative))
    })
    return crossings
}

function memberOf(lane: Lane, reference: SoloRun, comparisons: LoadedComparisons): SideMember {
    const crossings = firstCrossings(lane.run.checkpoints)
    const comparison = lane.rung === 'replay' ? comparisons.get(comparisonKey({ runner: lane.capId, reference: reference.capId })) : null
    const target = comparison ? positionTarget(comparisonKnots(comparison)) : null
    return {
        lane,
        zoneMs: zone => crossings.get(zone) ?? null,
        runMsAt: target ? referenceMs => target.runTime(referenceMs / 1000) * 1000 : null,
    }
}

function sectorCues(reference: SoloRun, members: readonly SideMember[]): SideCue[] {
    return sectorTicks(reference).map(({ label, startMs }, i) => {
        const runTimesMs = new Map([[reference.capId, startMs]])
        members.forEach(({ lane }) => {
            if (lane.rung !== 'replay' || lane.trace.kind !== 'strip') return
            runTimesMs.set(lane.capId, i === 0 ? 0 : lane.trace.strip.runnerSectorEndsMs[i - 1])
        })
        return { key: label, kind: 'sector', label, atMs: startMs, runTimesMs }
    })
}

function zoneCues(reference: SoloRun, members: readonly SideMember[]): SideCue[] {
    if (!members.some(({ lane }) => lane.rung === 'zones')) return []
    const capMs = msOf(reference.timeSeconds)
    return [...firstCrossings(reference.checkpoints)]
        .filter(([, crossingMs]) => crossingMs > 0 && crossingMs < capMs)
        .map(([zone, crossingMs]) => {
            const runTimesMs = new Map([[reference.capId, crossingMs]])
            members.forEach(({ lane, zoneMs, runMsAt }) => {
                const ownMs = lane.rung === 'replay' ? runMsAt?.(crossingMs) ?? null : lane.rung === 'zones' ? zoneMs(zone) : null
                if (ownMs !== null) runTimesMs.set(lane.capId, ownMs)
            })
            return { key: zoneKey(zone), kind: 'zone', label: zone, atMs: crossingMs, runTimesMs }
        })
}

export function composeCues(race: RaceModel, lanes: LanesModel, comparisons: LoadedComparisons): CueModel {
    const runs = new Map(race.runs.map(raceRun => [raceRun.run.capId, raceRun.run]))
    const merged = new Map<string, SideCue>()
    race.references.sides.forEach(({ capId }) => {
        const reference = runs.get(capId)
        if (!reference) return
        const members = lanes.lanes
            .filter(lane => race.references.partners.get(lane.capId) === capId && !isSideReference(race.references, lane.capId))
            .map(lane => memberOf(lane, reference, comparisons))
        const side = [...sectorCues(reference, members), ...zoneCues(reference, members)]
        side.forEach(cue => {
            const seen = merged.get(cue.key)
            if (seen) cue.runTimesMs.forEach((ms, runId) => seen.runTimesMs.set(runId, ms))
            else merged.set(cue.key, cue)
        })
    })
    const points: CuePoint[] = [...merged.values()].sort((a, b) => a.atMs - b.atMs || Number(a.kind === 'zone') - Number(b.kind === 'zone'))
    return {
        references: race.references.sides.map(({ capId }) => capId),
        points,
        sectors: points.filter(point => point.kind === 'sector'),
        zones: points.filter(point => point.kind === 'zone'),
    }
}

export function adjacentCue(cues: CueModel, seconds: number, direction: 1 | -1): CuePoint | null {
    const ms = seconds * 1000
    if (direction > 0) return cues.points.find(point => point.atMs > ms + CUE_TOLERANCE_MS) ?? null
    return cues.points.findLast(point => point.atMs < ms - CUE_TOLERANCE_MS) ?? null
}
