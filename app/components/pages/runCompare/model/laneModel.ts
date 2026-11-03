import { buildSyncAnchors } from '@/app/components/pages/capDetail/capStats'
import { deltaAxis } from '@/app/components/pages/capDetail/runDelta/chartRules'
import {
    curveRange,
    deltaCurves,
    isDrawableComparison,
    sectorLabel,
    signedGap,
    type DeltaBand,
    type DeltaCurve,
    type SignedGap,
} from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { buildVideoStrip, equalSectorEndsMs, runnerReadout, type VideoStrip } from '@/app/components/pages/capDetail/runDelta/videoStrip'
import type { CapComparison, CapComparisonPoint } from '@/app/utils/api'
import { comparisonKey, type ComparisonRequest, type LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import type { RaceModel, RaceRun } from './raceModel'
import { isSideReference, leadSide, type References } from './referenceModel'

export const REPLAY = 'Replay'
export const ZONES = 'Zones'
export const TIME_ONLY = 'Time only'
export const SET_ON = ['Set on Red', 'Set on Blue'] as const

export type Rung = 'replay' | 'zones' | 'time'

const RUNG_BADGES: Record<Rung, string> = { replay: REPLAY, zones: ZONES, time: TIME_ONLY }

export interface LaneSplit {
    index: number
    label: string
    endMs: number
    splitMs: number
    deltaSplitMs: number
    deltaTotalMs: number
}

export interface SectorTick {
    index: number
    label: string
    startMs: number
    endMs: number
}

export interface LaneMark {
    kind: 'zone' | 'cap'
    label: string
    atMs: number
}

type LaneTrace =
    | { kind: 'none' }
    | { kind: 'flat' }
    | { kind: 'strip'; strip: VideoStrip }
    | { kind: 'steps'; steps: CapComparisonPoint[] }
    | { kind: 'cap' }

export interface Lane {
    capId: string
    run: SoloRun
    reference: boolean
    rung: Rung | null
    sideLabel: string | null
    badges: string[]
    capMs: number
    finalGap: SignedGap
    domainMs: [number, number]
    curves: DeltaCurve[]
    bands: DeltaBand[]
    splits: LaneSplit[]
    trace: LaneTrace
    marks?: LaneMark[]
}

export interface LiveDelta {
    gap: SignedGap
    differentLine: boolean
    atCap: boolean
}

export interface LanesModel {
    lanes: Lane[]
    requests: ComparisonRequest[]
    sectors: SectorTick[]
}

export const EMPTY_LANES: LanesModel = { lanes: [], requests: [], sectors: [] }

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

function onOtherSide(run: SoloRun, reference: SoloRun): boolean {
    return run.side !== null && reference.side !== null && run.side !== reference.side
}

function wantsPairwise(run: SoloRun, reference: SoloRun): boolean {
    return run.capId !== reference.capId && !onOtherSide(run, reference) && run.hasGhost && reference.hasGhost
}

function partnerOf(runs: ReadonlyMap<string, SoloRun>, references: References, run: SoloRun): SoloRun {
    return runs.get(references.partners.get(run.capId) ?? '') ?? run
}

export function comparisonRequests(runs: readonly SoloRun[], references: References): ComparisonRequest[] {
    const byId = new Map(runs.map(run => [run.capId, run]))
    return runs.flatMap(run => {
        const partner = partnerOf(byId, references, run)
        return !isSideReference(references, run.capId) && wantsPairwise(run, partner) ? [{ runner: run.capId, reference: partner.capId }] : []
    })
}

export function sectorTicks(reference: SoloRun | null): SectorTick[] {
    if (!reference) return []
    const ends = equalSectorEndsMs(msOf(reference.timeSeconds))
    return ends.map((endMs, i) => ({ index: i + 1, label: sectorLabel(i + 1), startMs: i === 0 ? 0 : ends[i - 1], endMs }))
}

function referenceSplits(capMs: number): LaneSplit[] {
    const ends = equalSectorEndsMs(capMs)
    return ends.map((endMs, i) => ({
        index: i + 1,
        label: sectorLabel(i + 1),
        endMs,
        splitMs: endMs - (i === 0 ? 0 : ends[i - 1]),
        deltaSplitMs: 0,
        deltaTotalMs: 0,
    }))
}

function stripSplits(strip: VideoStrip, comparison: CapComparison): LaneSplit[] {
    return comparison.sectors.map((sector, i) => ({
        index: sector.index,
        label: sectorLabel(sector.index),
        endMs: strip.runnerSectorEndsMs[i],
        splitMs: sector.split_ms,
        deltaSplitMs: sector.delta_split_ms,
        deltaTotalMs: sector.delta_total_ms,
    }))
}

interface ZoneSteps {
    steps: CapComparisonPoint[]
    splits: LaneSplit[]
}

function zoneSteps(run: SoloRun, reference: SoloRun): ZoneSteps | null {
    const anchors = buildSyncAnchors(run.checkpoints, reference.checkpoints, run.timeSeconds, reference.timeSeconds)
    if (anchors.length <= 2) return null
    const crossings: CapComparisonPoint[] = anchors.map(anchor => [msOf(anchor.aTime), msOf(anchor.aTime) - msOf(anchor.bTime)])
    return {
        steps: crossings,
        splits: crossings.slice(1).map(([endMs, deltaMs], i) => ({
            index: i + 1,
            label: anchors[i + 1].label,
            endMs,
            splitMs: endMs - crossings[i][0],
            deltaSplitMs: deltaMs - crossings[i][1],
            deltaTotalMs: deltaMs,
        })),
    }
}

function stepPoints(steps: CapComparisonPoint[]): CapComparisonPoint[] {
    const points: CapComparisonPoint[] = [steps[0]]
    for (let i = 1; i < steps.length; i++) {
        points.push([steps[i][0], steps[i - 1][1]], steps[i])
    }
    return points
}

function domainOf(segments: CapComparisonPoint[][], finalMs: number): [number, number] {
    const [lo, hi] = curveRange(segments)
    return deltaAxis(Math.min(lo, finalMs), Math.max(hi, finalMs)).domainMs
}

interface LaneData {
    rung: Rung | null
    curves: DeltaCurve[]
    bands: DeltaBand[]
    splits: LaneSplit[]
    trace: LaneTrace
    segments: CapComparisonPoint[][]
}

const TIME_ONLY_DATA: LaneData = { rung: 'time', curves: [], bands: [], splits: [], trace: { kind: 'cap' }, segments: [] }

function zoneData(run: SoloRun, reference: SoloRun): LaneData | null {
    const zones = zoneSteps(run, reference)
    if (!zones) return null
    const points = stepPoints(zones.steps)
    return { rung: 'zones', curves: deltaCurves([points]), bands: [], splits: zones.splits, trace: { kind: 'steps', steps: zones.steps }, segments: [points] }
}

function referenceData(run: SoloRun): LaneData {
    const rung: Rung = run.hasGhost ? 'replay' : run.checkpoints.length > 0 ? 'zones' : 'time'
    return { rung, curves: [], bands: [], splits: referenceSplits(msOf(run.timeSeconds)), trace: { kind: 'flat' }, segments: [] }
}

function compareData(run: SoloRun, reference: SoloRun, comparisons: LoadedComparisons): LaneData {
    if (onOtherSide(run, reference)) return TIME_ONLY_DATA
    if (wantsPairwise(run, reference)) {
        const key = comparisonKey({ runner: run.capId, reference: reference.capId })
        if (!comparisons.has(key)) return { ...TIME_ONLY_DATA, rung: null }
        const comparison = comparisons.get(key) ?? null
        const strip = buildVideoStrip(comparison)
        if (strip && comparison) {
            return {
                rung: 'replay',
                curves: strip.curves,
                bands: strip.bands,
                splits: stripSplits(strip, comparison),
                trace: { kind: 'strip', strip },
                segments: [...strip.curves.map(curve => curve.points), ...strip.bands.map(band => band.connector)],
            }
        }
        if (isDrawableComparison(comparison) && comparison.state === 'routes_differ') {
            return zoneData(run, reference) ?? { ...TIME_ONLY_DATA, rung: 'zones' }
        }
    }
    return zoneData(run, reference) ?? TIME_ONLY_DATA
}

interface LaneContext {
    partner: SoloRun
    isReference: boolean
    lead: number | null
    comparisons: LoadedComparisons
}

function laneFor(raceRun: RaceRun, { partner, isReference, lead, comparisons }: LaneContext): Lane {
    const { run } = raceRun
    const data = run.capId === partner.capId ? referenceData(run) : isReference ? TIME_ONLY_DATA : compareData(run, partner, comparisons)
    const sideLabel = run.side !== null && lead !== null && run.side !== lead ? SET_ON[run.side] : null
    const capMs = msOf(run.timeSeconds)
    const finalMs = capMs - msOf(partner.timeSeconds)
    return {
        capId: run.capId,
        run,
        reference: isReference,
        rung: data.rung,
        sideLabel,
        badges: [
            ...(data.rung ? [RUNG_BADGES[data.rung]] : []),
            ...(sideLabel ? [sideLabel] : []),
            ...(raceRun.tile ? [] : raceRun.badges),
        ],
        capMs,
        finalGap: signedGap(finalMs),
        domainMs: domainOf(data.segments, finalMs),
        curves: data.curves,
        bands: data.bands,
        splits: data.splits,
        trace: data.trace,
    }
}

export function composeLanes(race: RaceModel, comparisons: LoadedComparisons): LanesModel {
    const reference = race.runs.find(raceRun => raceRun.run.capId === race.reference)?.run ?? null
    if (!reference) return EMPTY_LANES
    const runs = race.runs.map(raceRun => raceRun.run)
    const byId = new Map(runs.map(run => [run.capId, run]))
    const lead = leadSide(runs)
    return {
        lanes: race.runs.map(raceRun => laneFor(raceRun, {
            partner: partnerOf(byId, race.references, raceRun.run),
            isReference: isSideReference(race.references, raceRun.run.capId),
            lead,
            comparisons,
        })),
        requests: comparisonRequests(runs, race.references),
        sectors: sectorTicks(reference),
    }
}

export function withLaneBadges(race: RaceModel, lanes: LanesModel): RaceModel {
    const badges = new Map(lanes.lanes.map(lane => [lane.capId, lane.badges]))
    const runs = race.runs.map(raceRun => ({ ...raceRun, badges: badges.get(raceRun.run.capId) ?? raceRun.badges }))
    const tiles = race.tiles.map(tile => ({ ...tile, badges: badges.get(tile.id) ?? tile.badges }))
    const byId = new Map(tiles.map(tile => [tile.id, tile]))
    return {
        ...race,
        runs,
        tiles,
        dataOnly: runs.filter(raceRun => !raceRun.tile),
        layout: { ...race.layout, placed: race.layout.placed.map(placed => ({ ...placed, slot: byId.get(placed.slot.id) ?? placed.slot })) },
    }
}

function stepAt(steps: CapComparisonPoint[], timeMs: number): number {
    let deltaMs = 0
    for (const [crossingMs, stepMs] of steps) {
        if (crossingMs > timeMs) break
        deltaMs = stepMs
    }
    return deltaMs
}

export function liveDelta(lane: Lane, seconds: number): LiveDelta | null {
    if (lane.trace.kind === 'none') return null
    const timeMs = seconds * 1000
    if (timeMs >= lane.capMs) return { gap: lane.finalGap, differentLine: false, atCap: true }
    switch (lane.trace.kind) {
        case 'flat':
            return { gap: signedGap(0), differentLine: false, atCap: false }
        case 'strip': {
            const readout = runnerReadout(lane.trace.strip, timeMs)
            return { gap: readout.gap, differentLine: readout.differentLine, atCap: false }
        }
        case 'steps':
            return { gap: signedGap(stepAt(lane.trace.steps, timeMs)), differentLine: false, atCap: false }
        case 'cap':
            return null
    }
}
