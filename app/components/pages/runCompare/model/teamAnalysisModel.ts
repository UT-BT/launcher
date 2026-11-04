import { signedGap, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { TEAM_SPLIT_CAP_ZONE, type TeamSplit } from '@/app/utils/api'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { EMPTY_COMPARE_STATE } from '../url/compareUrl'
import { composeAnalysis, type AnalysisModel } from './analysisModel'
import { composeCues, type CueModel, type CuePoint } from './cueModel'
import { composeLanes } from './laneModel'
import { composeRace, formatRaceTime } from './raceModel'
import type { TeamModel, TeamRow } from './teamModel'
import { referenceRow, type TeamPair, type TeamRead } from './teamVersus'

export const CAP_ROW = 'Cap'

export interface TeamSplitCell {
    ms: number
    time: string
    delta: SignedGap | null
    member: SoloRun | null
}

export interface TeamSplitRow {
    key: string
    kind: 'zone' | 'cap'
    label: string
    atMs: number
    cue: CuePoint | null
    cells: (TeamSplitCell | null)[]
}

export interface PairSide {
    run: SoloRun
    colour: string
}

export interface PairSection {
    key: string
    runner: PairSide
    reference: PairSide
    analysis: AnalysisModel
}

export interface DifferentRouteCard {
    key: string
    runner: PairSide
    reference: PairSide
}

export interface TeamAnalysisModel {
    teams: TeamRow[]
    splits: TeamSplitRow[]
    pairs: PairSection[]
    routes: DifferentRouteCard[]
    highlighted: string | null
}

export const NO_TEAM_ANALYSIS: TeamAnalysisModel = { teams: [], splits: [], pairs: [], routes: [], highlighted: null }

export interface TeamAnalysisInput {
    teams: TeamModel
    reads: readonly TeamRead[]
    cues: CueModel
    comparisons: LoadedComparisons
    speedRun: string | null
}

function msOf(seconds: number): number {
    return Math.round(seconds * 1000)
}

function slowest(row: TeamRow): SoloRun {
    return row.team.members[row.team.members.length - 1]
}

function splitCell(ms: number, deltaMs: number | null, member: SoloRun | null): TeamSplitCell {
    return { ms, time: formatRaceTime(ms / 1000), delta: deltaMs === null ? null : signedGap(deltaMs), member }
}

function composeSplits({ teams, reads, cues }: TeamAnalysisInput, reference: TeamRow): TeamSplitRow[] {
    const members = new Map(teams.rows.flatMap(row => row.team.members.map(member => [member.capId, member] as const)))
    const cueOf = new Map(cues.zones.map(point => [point.label, point]))
    const zoneRows = new Map<string, { atMs: number; first: SoloRun | null; splits: Map<string, TeamSplit> }>()
    reads.forEach(read => read.comparison?.team_splits.forEach(split => {
        if (split.zone === TEAM_SPLIT_CAP_ZONE) return
        const seen = zoneRows.get(split.zone) ?? { atMs: split.reference_ms, first: members.get(split.reference_member_cap_id) ?? null, splits: new Map() }
        seen.splits.set(read.row.teamCapId, split)
        zoneRows.set(split.zone, seen)
    }))
    const readOf = new Map(reads.map(read => [read.row.teamCapId, read]))
    const referenceCap = reads.flatMap(read => read.comparison?.team_splits.filter(split => split.zone === TEAM_SPLIT_CAP_ZONE) ?? [])[0]
    const referenceMs = msOf(reference.team.timeSeconds)
    const zones = [...zoneRows]
        .sort((a, b) => a[1].atMs - b[1].atMs || a[0].localeCompare(b[0]))
        .map(([zone, { atMs, first, splits }]): TeamSplitRow => ({
            key: `zone:${zone}`,
            kind: 'zone',
            label: zone,
            atMs,
            cue: cueOf.get(zone) ?? null,
            cells: teams.rows.map(row => {
                if (row.reference) return splitCell(atMs, null, first)
                const split = splits.get(row.teamCapId)
                return split ? splitCell(split.runner_ms, split.delta_ms, members.get(split.runner_member_cap_id) ?? null) : null
            }),
        }))
    const cap: TeamSplitRow = {
        key: 'cap',
        kind: 'cap',
        label: CAP_ROW,
        atMs: referenceMs,
        cue: null,
        cells: teams.rows.map(row => {
            if (row.reference) return splitCell(referenceMs, null, members.get(referenceCap?.reference_member_cap_id ?? '') ?? slowest(row))
            const read = readOf.get(row.teamCapId)
            if (read?.comparison === undefined) return null
            const split = read.comparison?.team_splits.find(entry => entry.zone === TEAM_SPLIT_CAP_ZONE)
            const capMs = msOf(row.team.timeSeconds)
            if (!split) return splitCell(capMs, capMs - referenceMs, slowest(row))
            return splitCell(split.runner_ms, split.delta_ms, members.get(split.runner_member_cap_id) ?? slowest(row))
        }),
    }
    return [...zones, cap]
}

function teamCue(point: CuePoint, key: string, teamOf: (capId: string) => string): CuePoint {
    return {
        ...point,
        key: `${key}:${point.key}`,
        runTimesMs: new Map([...point.runTimesMs].map(([capId, ms]) => [teamOf(capId), ms])),
    }
}

function pairAnalysis(pair: TeamPair, teamOf: (capId: string) => string, comparisons: LoadedComparisons, speedRun: string | null): AnalysisModel {
    const runs = [pair.reference, pair.runner]
    const local: LoadedComparisons = pair.state === 'aligned' ? comparisons : new Map([[pair.key, null]])
    const race = composeRace({
        runs,
        state: { ...EMPTY_COMPARE_STATE, runs: runs.map(run => run.capId), refs: [pair.reference.capId] },
        videos: new Map(),
        failedVideos: new Set(),
        stageBox: null,
    })
    const lanes = composeLanes(race, local)
    const analysis = composeAnalysis(race, lanes, composeCues(race, lanes, local), local, speedRun)
    const key = `pair:${pair.key}`
    return {
        ...analysis,
        matrix: analysis.matrix.map(row => (row.cue ? { ...row, cue: teamCue(row.cue, key, teamOf) } : row)),
    }
}

function routeCard(pair: TeamPair, read: TeamRead, reference: TeamRow): DifferentRouteCard {
    return {
        key: `route:${pair.key}`,
        runner: { run: pair.runner, colour: read.row.colour },
        reference: { run: pair.reference, colour: reference.colour },
    }
}

export function composeTeamAnalysis(input: TeamAnalysisInput): TeamAnalysisModel {
    const { teams, reads, comparisons, speedRun } = input
    const reference = referenceRow(teams)
    if (!reference || teams.rows.length < 2) return NO_TEAM_ANALYSIS
    const teamOf = (capId: string) => teams.seats.get(capId)?.teamCapId ?? capId
    const pairs = reads.flatMap(read => read.pairs
        .filter(pair => pair.state !== 'routes_differ')
        .map((pair): PairSection => ({
            key: `pair:${pair.key}`,
            runner: { run: pair.runner, colour: read.row.colour },
            reference: { run: pair.reference, colour: reference.colour },
            analysis: pairAnalysis(pair, teamOf, comparisons, speedRun),
        })))
    const routes = reads.flatMap(read => read.pairs.filter(pair => pair.state === 'routes_differ').map(pair => routeCard(pair, read, reference)))
    return {
        teams: teams.rows,
        splits: composeSplits(input, reference),
        pairs,
        routes,
        highlighted: pairs.map(pair => pair.analysis.speed.highlighted).find(capId => capId !== null) ?? null,
    }
}

export const SAME_LINE_SHARE = 0.05

export type PairRoute = 'same' | 'apart' | 'different'

export interface PairSummary {
    key: string
    runner: PairSide
    reference: PairSide
    route: PairRoute
    apartShare: number
}

function apartShareOf(pair: PairSection): number {
    const line = pair.analysis.cumulative.lines[0]
    if (!line || line.cap[0] <= 0) return 0
    const apartMs = line.bands.reduce((sum, band) => sum + Math.max(0, band.endMs - band.startMs), 0)
    return Math.min(1, apartMs / line.cap[0])
}

export function pairSummaries(analysis: Pick<TeamAnalysisModel, 'pairs' | 'routes'>): PairSummary[] {
    return [
        ...analysis.pairs.map((pair): PairSummary => {
            const apartShare = apartShareOf(pair)
            return { key: pair.key, runner: pair.runner, reference: pair.reference, route: apartShare < SAME_LINE_SHARE ? 'same' : 'apart', apartShare }
        }),
        ...analysis.routes.map((card): PairSummary => ({ key: card.key, runner: card.runner, reference: card.reference, route: 'different', apartShare: 1 })),
    ]
}

export function pairRouteNote(summary: PairSummary): string {
    if (summary.route === 'same') return 'Same line'
    if (summary.route === 'different') return 'Different routes'
    return `Took another line for ${Math.round(summary.apartShare * 100)}% of the run`
}
