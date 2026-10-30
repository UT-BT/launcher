import type { CapCheckpoint, CapComparison } from '@/app/utils/api'
import { buildSyncAnchors, type SyncAnchor } from '@/app/components/pages/capDetail/capStats'
import { signedGap, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import {
    buildVideoStrip,
    referenceReadout,
    runnerReadout,
    type VideoStrip,
} from '@/app/components/pages/capDetail/runDelta/videoStrip'

export interface CompareRunTiming {
    capId: string
    capTime: number
    side: number | null
    checkpoints: CapCheckpoint[]
}

export interface ComparisonRequest {
    runnerCapId: string
    referenceCapId: string
}

export type RunComparisons = ReadonlyMap<string, CapComparison | null>

export type RunTrack =
    | { role: 'reference'; capTime: number; ticks: number[]; sectors: VideoStrip | null; checkpoints: SyncAnchor[] }
    | { role: 'replay'; capTime: number; ticks: number[]; strip: VideoStrip }
    | { role: 'zones'; capTime: number; ticks: number[]; checkpoints: SyncAnchor[]; capDelta: number }
    | { role: 'unpaired'; capTime: number; ticks: []; sideKnown: boolean }

export interface CheckpointGap {
    t: number
    delta: number
}

export type CompareStrip =
    | { kind: 'replay'; runnerIndex: number; strip: VideoStrip }
    | { kind: 'zones'; timeIndex: number; points: CheckpointGap[] }

export interface CompareView {
    referenceIndex: number
    tracks: RunTrack[]
    strip: CompareStrip | null
}

export interface PaneReadout {
    label: string
    greyed: boolean
    gap: SignedGap | null
}

const CAP_EPSILON_SECONDS = 0.06

export function comparisonKey(runnerCapId: string, referenceCapId: string): string {
    return `${runnerCapId}|${referenceCapId}`
}

function compareReferenceIndex(runs: CompareRunTiming[]): number {
    return runs.reduce((slowest, r, i) => (r.capTime > runs[slowest].capTime ? i : slowest), 0)
}

function referenceSideIndices(runs: CompareRunTiming[], referenceIndex: number): number[] {
    const side = runs[referenceIndex]?.side ?? null
    if (side == null) return []
    return runs.flatMap((r, i) => (r.side === side ? [i] : []))
}

export function comparisonRequests(runs: CompareRunTiming[]): ComparisonRequest[] {
    if (runs.length === 0) return []
    const referenceIndex = compareReferenceIndex(runs)
    const referenceCapId = runs[referenceIndex].capId
    return referenceSideIndices(runs, referenceIndex)
        .filter(i => i !== referenceIndex)
        .map(i => ({ runnerCapId: runs[i].capId, referenceCapId }))
}

function seconds(ms: number[]): number[] {
    return ms.map(t => t / 1000)
}

function isCheckpoint(anchor: SyncAnchor): boolean {
    return anchor.label !== 'SPAWN' && anchor.label !== 'CAP'
}

function checkpointAnchors(run: CompareRunTiming, reference: CompareRunTiming): SyncAnchor[] {
    return buildSyncAnchors(run.checkpoints, reference.checkpoints, run.capTime, reference.capTime).filter(isCheckpoint)
}

function compareStrip(runs: CompareRunTiming[], tracks: RunTrack[], pair: number[]): CompareStrip | null {
    if (pair.length !== 2) return null
    const runnerIndex = pair.find(i => tracks[i].role !== 'reference') ?? -1
    const runnerTrack = tracks[runnerIndex]
    if (runnerTrack?.role === 'replay') return { kind: 'replay', runnerIndex, strip: runnerTrack.strip }
    const [a, b] = pair.map(i => runs[i])
    const anchors = buildSyncAnchors(a.checkpoints, b.checkpoints, a.capTime, b.capTime)
    if (!anchors.some(isCheckpoint)) return null
    return { kind: 'zones', timeIndex: pair[0], points: anchors.map(x => ({ t: x.aTime, delta: x.aTime - x.bTime })) }
}

export function buildCompareView(runs: CompareRunTiming[], comparisons: RunComparisons): CompareView {
    const referenceIndex = compareReferenceIndex(runs)
    const reference = runs[referenceIndex]
    const sameSide = referenceSideIndices(runs, referenceIndex)
    const paired = new Set(sameSide)
    const strips = runs.map((r, i) => (
        i !== referenceIndex && paired.has(i)
            ? buildVideoStrip(comparisons.get(comparisonKey(r.capId, reference.capId)) ?? null)
            : null
    ))
    const sectors = strips.find(s => s != null) ?? null
    const tracks = runs.map((r, i): RunTrack => {
        const strip = strips[i]
        if (i === referenceIndex) {
            const checkpoints = checkpointAnchors(r, r)
            const ticks = sectors ? seconds(sectors.reference.ticksMs) : checkpoints.map(a => a.aTime)
            return { role: 'reference', capTime: r.capTime, ticks, sectors, checkpoints }
        }
        if (!paired.has(i)) {
            return { role: 'unpaired', capTime: r.capTime, ticks: [], sideKnown: r.side != null && reference.side != null }
        }
        if (strip) return { role: 'replay', capTime: r.capTime, ticks: seconds(strip.runner.ticksMs), strip }
        const checkpoints = checkpointAnchors(r, reference)
        return {
            role: 'zones',
            capTime: r.capTime,
            ticks: checkpoints.map(a => a.aTime),
            checkpoints,
            capDelta: r.capTime - reference.capTime,
        }
    })
    return { referenceIndex, tracks, strip: compareStrip(runs, tracks, sameSide) }
}

function gapSeconds(delta: number): SignedGap {
    return signedGap(Math.round(delta * 1000) || 0)
}

function checkpointReadout(checkpoints: SyncAnchor[], runTime: number): PaneReadout {
    const passed = checkpoints.reduce((last, a, i) => (a.aTime <= runTime ? i : last), -1)
    if (passed < 0) return { label: 'SPAWN', greyed: false, gap: null }
    const anchor = checkpoints[passed]
    return { label: `CP${passed + 1}`, greyed: false, gap: gapSeconds(anchor.aTime - anchor.bTime) }
}

export function paneReadout(track: RunTrack, runTime: number): PaneReadout {
    const atCap = runTime >= track.capTime - CAP_EPSILON_SECONDS
    switch (track.role) {
        case 'unpaired':
            return { label: atCap ? 'CAP' : track.sideKnown ? 'Other side' : 'Side unknown', greyed: false, gap: null }
        case 'reference':
            if (atCap) return { label: 'CAP', greyed: false, gap: signedGap(0) }
            if (!track.sectors) return checkpointReadout(track.checkpoints, runTime)
            return { label: referenceReadout(track.sectors, runTime * 1000).label, greyed: false, gap: signedGap(0) }
        case 'replay': {
            if (atCap) return { label: 'CAP', greyed: false, gap: signedGap(track.strip.finalDeltaMs) }
            const readout = runnerReadout(track.strip, runTime * 1000)
            return { label: readout.label, greyed: readout.differentLine, gap: readout.gap }
        }
        case 'zones':
            if (atCap) return { label: 'CAP', greyed: false, gap: gapSeconds(track.capDelta) }
            return checkpointReadout(track.checkpoints, runTime)
    }
}
