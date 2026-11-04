import { deltaAxis } from '@/app/components/pages/capDetail/runDelta/chartRules'
import { curveRange, deltaCurves, signedGap, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { TEAM_SPLIT_CAP_ZONE, type CapComparisonPoint, type TeamComparison, type TeamComparisonPairState, type TeamSplit } from '@/app/utils/api'
import { comparisonKey, type ComparisonRequest, type LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import type { LoadedTeamComparisons } from '../loading/teamComparisons'
import { EMPTY_CUES, type CueModel, type CuePoint } from './cueModel'
import { laneFor, liveDelta, RUNG_BADGES, stepPoints, TIME_ONLY, type Lane, type LaneMark, type LanesModel, type Rung } from './laneModel'
import type { RaceModel, RaceRun } from './raceModel'
import { leadSide } from './referenceModel'
import { firstCrossings, memberLane, type TeamGridRow, type TeamModel, type TeamRow } from './teamModel'

export const DIFFERENT_ROUTE = 'Different route'
export const SPAWN_ANCHOR = 'Spawn'
export const CAP_ANCHOR = 'Cap'

export interface TeamPair {
    key: string
    state: TeamComparisonPairState
    score: number
    runner: SoloRun
    reference: SoloRun
}

export interface TeamRead {
    row: TeamRow
    comparison: TeamComparison | null | undefined
    pairs: TeamPair[]
}

export interface RouteAnchor {
    label: string
    runnerMs: number
    referenceMs: number
}

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

export function referenceRow(teams: Pick<TeamModel, 'rows'>): TeamRow | undefined {
    return teams.rows.find(row => row.reference)
}

export function teamReads(teams: TeamModel, loaded: LoadedTeamComparisons): TeamRead[] {
    const reference = referenceRow(teams)
    if (!reference || teams.rows.length < 2) return []
    const referenceMembers = new Map(reference.team.members.map(member => [member.capId, member]))
    return teams.rows.filter(row => !row.reference).map(row => {
        const comparison = loaded.get(comparisonKey({ runner: row.teamCapId, reference: reference.teamCapId }))
        const members = new Map(row.team.members.map(member => [member.capId, member]))
        const pairs = (comparison?.pairs ?? []).flatMap((pair): TeamPair[] => {
            const runner = members.get(pair.runner_cap_id)
            const partner = referenceMembers.get(pair.reference_cap_id)
            if (!runner || !partner) return []
            return [{ key: comparisonKey({ runner: runner.capId, reference: partner.capId }), state: pair.state, score: pair.score, runner, reference: partner }]
        })
        return { row, comparison, pairs }
    })
}

export interface PairGrid {
    cells: ReadonlyMap<string, TeamGridRow>
    indices: ReadonlyMap<string, number>
}

export function pairGrid(teams: TeamModel, reads: readonly TeamRead[]): PairGrid | null {
    const reference = referenceRow(teams)
    if (!reference || reads.length === 0) return null
    const paired = new Set(reads.flatMap(read => read.pairs.map(pair => pair.reference.capId)))
    const columns = reference.team.members.map(member => member.capId).filter(capId => paired.has(capId))
    const partners = new Map(reads
        .filter(read => read.comparison)
        .map(read => [read.row.teamCapId, new Map(read.pairs.map(pair => [pair.reference.capId, pair.runner.capId]))]))
    const cells = new Map<string, TeamGridRow>()
    const indices = new Map<string, number>()
    teams.rows.forEach(row => {
        const own = row.reference ? new Map(columns.map(capId => [capId, capId])) : partners.get(row.teamCapId)
        if (!own) return
        const placed = columns.map(column => own.get(column) ?? null)
        const rest = row.team.members.map(member => member.capId).filter(capId => !placed.includes(capId))
        placed.forEach((capId, i) => {
            if (capId !== null) indices.set(capId, i + 1)
        })
        rest.forEach((capId, i) => indices.set(capId, columns.length + i + 1))
        cells.set(row.teamCapId, { columns: placed, rest })
    })
    return { cells, indices }
}

export function withPairSeats(teams: TeamModel, grid: PairGrid | null): TeamModel {
    if (!grid) return teams
    return {
        ...teams,
        seats: new Map([...teams.seats].map(([capId, seat]) => [capId, { ...seat, index: grid.indices.get(capId) ?? seat.index }])),
    }
}

export function sharedAnchors(runner: SoloRun, reference: SoloRun): RouteAnchor[] {
    const own = firstCrossings(runner)
    const runnerCap = msOf(runner.timeSeconds)
    const referenceCap = msOf(reference.timeSeconds)
    const zones = [...firstCrossings(reference)]
        .flatMap(([label, referenceMs]): RouteAnchor[] => {
            const runnerMs = own.get(label)
            if (runnerMs === undefined || runnerMs <= 0 || runnerMs >= runnerCap || referenceMs <= 0 || referenceMs >= referenceCap) return []
            return [{ label, runnerMs, referenceMs }]
        })
        .sort((a, b) => a.referenceMs - b.referenceMs || a.label.localeCompare(b.label))
    return [
        { label: SPAWN_ANCHOR, runnerMs: 0, referenceMs: 0 },
        ...zones,
        { label: CAP_ANCHOR, runnerMs: runnerCap, referenceMs: referenceCap },
    ]
}

function withBadges(lane: Lane, raceRun: RaceRun, rung: Rung | null, extra: readonly string[] = []): Lane {
    return {
        ...lane,
        rung,
        badges: [
            ...(rung ? [RUNG_BADGES[rung]] : []),
            ...extra,
            ...(lane.sideLabel ? [lane.sideLabel] : []),
            ...(raceRun.tile ? [] : raceRun.badges),
        ],
    }
}

function routeLane(raceRun: RaceRun, pair: TeamPair, lead: number | null): Lane {
    const base = laneFor(raceRun, { partner: pair.reference, isReference: false, lead, comparisons: new Map([[pair.key, null]]) })
    const anchors = sharedAnchors(pair.runner, pair.reference)
    const steps = anchors
        .map((anchor): CapComparisonPoint => [anchor.runnerMs, anchor.runnerMs - anchor.referenceMs])
        .sort((a, b) => a[0] - b[0])
    const trace: Lane['trace'] = anchors.length > 2 ? { kind: 'steps', steps } : { kind: 'cap' }
    return withBadges({ ...base, curves: [], bands: [], splits: [], trace }, raceRun, 'zones', [DIFFERENT_ROUTE])
}

function pairLane(raceRun: RaceRun, pair: TeamPair, lead: number | null, comparisons: LoadedComparisons): Lane {
    switch (pair.state) {
        case 'aligned':
            return laneFor(raceRun, { partner: pair.reference, isReference: false, lead, comparisons })
        case 'zones':
            return laneFor(raceRun, { partner: pair.reference, isReference: false, lead, comparisons: new Map([[pair.key, null]]) })
        case 'routes_differ':
            return routeLane(raceRun, pair, lead)
    }
}

export function composeVersusLanes(race: RaceModel, teams: TeamModel, reads: readonly TeamRead[], comparisons: LoadedComparisons): LanesModel {
    const reference = referenceRow(teams)
    const lead = reference ? leadSide(reference.team.members) : null
    const pairs = new Map(reads.flatMap(read => read.pairs.map(pair => [pair.runner.capId, pair] as const)))
    const readOf = new Map(reads.flatMap(read => read.row.team.members.map(member => [member.capId, read] as const)))
    const lanes = race.runs.map(raceRun => {
        const base = memberLane(raceRun, lead)
        const read = readOf.get(raceRun.run.capId)
        if (!read) return base
        const pair = pairs.get(raceRun.run.capId)
        if (pair) return pairLane(raceRun, pair, lead, comparisons)
        return withBadges(base, raceRun, read.comparison === undefined ? null : 'time')
    })
    const requests = reads.flatMap(read => read.pairs
        .filter(pair => pair.state === 'aligned')
        .map((pair): ComparisonRequest => ({ runner: pair.runner.capId, reference: pair.reference.capId })))
    return { lanes, requests, sectors: [] }
}

function zoneSplits(comparison: TeamComparison | null | undefined): TeamSplit[] {
    return comparison?.team_splits.filter(split => split.zone !== TEAM_SPLIT_CAP_ZONE) ?? []
}

function teamLane(row: TeamRow, capMs: number, finalMs: number, splits: readonly TeamSplit[]): Lane {
    const crossings = [...splits].sort((a, b) => a.runner_ms - b.runner_ms)
    const steps: CapComparisonPoint[] | null = row.reference || crossings.length === 0
        ? null
        : [[0, 0], ...crossings.map((split): CapComparisonPoint => [split.runner_ms, split.delta_ms]), [capMs, finalMs]]
    const points = steps ? stepPoints(steps) : []
    const [lo, hi] = curveRange(steps ? [points] : [])
    const marks: LaneMark[] = steps
        ? [...crossings.map((split): LaneMark => ({ kind: 'zone', label: split.zone, atMs: split.runner_ms })), { kind: 'cap', label: 'CAP', atMs: capMs }]
        : []
    return {
        capId: row.teamCapId,
        run: row.team.members[row.team.members.length - 1],
        reference: row.reference,
        rung: null,
        sideLabel: null,
        badges: row.badges,
        capMs,
        finalGap: signedGap(finalMs),
        domainMs: deltaAxis(Math.min(lo, finalMs), Math.max(hi, finalMs)).domainMs,
        curves: steps ? deltaCurves([points]) : [],
        bands: [],
        splits: [],
        trace: row.reference ? { kind: 'flat' } : steps ? { kind: 'steps', steps } : { kind: 'cap' },
        marks,
    }
}

export function withTeamLanes(teams: TeamModel, reads: readonly TeamRead[]): TeamModel {
    const reference = referenceRow(teams)
    if (!reference || reads.length === 0) return teams
    const byRow = new Map(reads.map(read => [read.row.teamCapId, read]))
    const referenceMs = msOf(reference.team.timeSeconds)
    return {
        ...teams,
        rows: teams.rows.map(row => {
            const capMs = msOf(row.team.timeSeconds)
            if (row.reference) return { ...row, lane: teamLane(row, capMs, 0, []) }
            const comparison = byRow.get(row.teamCapId)?.comparison
            const splits = zoneSplits(comparison)
            const badges = comparison !== undefined && splits.length === 0 ? [TIME_ONLY] : []
            const finalMs = comparison ? comparison.final_delta_ms : capMs - referenceMs
            const marked = { ...row, badges }
            return { ...marked, lane: teamLane(marked, capMs, finalMs, splits) }
        }),
    }
}

export function composeSplitCues(teams: TeamModel, reads: readonly TeamRead[]): CueModel {
    const reference = referenceRow(teams)
    if (!reference) return EMPTY_CUES
    const capMs = msOf(reference.team.timeSeconds)
    const zones = new Map<string, { atMs: number; runTimesMs: Map<string, number> }>()
    reads.forEach(read => zoneSplits(read.comparison).forEach(split => {
        if (split.reference_ms <= 0 || split.reference_ms >= capMs) return
        const seen = zones.get(split.zone) ?? { atMs: split.reference_ms, runTimesMs: new Map([[reference.teamCapId, split.reference_ms]]) }
        seen.runTimesMs.set(read.row.teamCapId, split.runner_ms)
        zones.set(split.zone, seen)
    }))
    const points = [...zones]
        .sort((a, b) => a[1].atMs - b[1].atMs || a[0].localeCompare(b[0]))
        .map(([zone, { atMs, runTimesMs }]): CuePoint => ({ key: `zone:${zone}`, kind: 'zone', label: zone, atMs, runTimesMs }))
    return { references: [reference.teamCapId], points, sectors: [], zones: points }
}

export interface TeamClock {
    t: number
    runTimes: Readonly<Record<string, number>>
}

export function teamDeltaAt(row: TeamRow, { t, runTimes }: TeamClock): SignedGap | null {
    if (!row.lane || row.reference) return null
    const clock = row.team.members[row.team.members.length - 1].capId
    const seconds = runTimes[clock] ?? t
    const [first] = row.lane.marks ?? []
    if (first?.kind === 'zone' && seconds * 1000 < first.atMs) return null
    return liveDelta(row.lane, seconds)?.gap ?? null
}

export function sameTeamDelta(a: SignedGap | null, b: SignedGap | null): boolean {
    return a?.label === b?.label && a?.tone === b?.tone
}
