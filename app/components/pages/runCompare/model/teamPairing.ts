import type { TeamComparisonCandidate } from '@/app/utils/api'
import { comparisonKey, type LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { comparisonKnots, type PositionLink } from '../playback/syncTargets'
import type { CompareNotice, ComparePair, CompareSync, CompareUrlState } from '../url/compareUrl'
import type { LanesModel } from './laneModel'
import { RACE_CLOCK, type SyncModel } from './positionModel'
import type { TeamModel, TeamRow } from './teamModel'
import type { TeamPair, TeamRead } from './teamVersus'

export const ALIGNED_COVERAGE = 0.5

export interface PairOption {
    capId: string
    run: SoloRun
    match: string | null
    current: boolean
}

export interface PairGroup {
    row: TeamRow
    options: PairOption[]
}

export interface PairMenu {
    capId: string
    groups: PairGroup[]
}

export interface TeamPairing {
    teamCapId: string
    runners: string[]
    references: string[]
    server: ComparePair[]
    current: ComparePair[]
}

export interface DriveChoice {
    driver: string | null
    choices: string[]
}

export interface PairingModel {
    menus: ReadonlyMap<string, PairMenu>
    teams: ReadonlyMap<string, TeamPairing>
    drives: ReadonlyMap<string, DriveChoice>
}

export const NO_PAIRING: PairingModel = { menus: new Map(), teams: new Map(), drives: new Map() }

export function sameSide(a: SoloRun, b: SoloRun): boolean {
    return a.side !== null && a.side === b.side
}

function referenceOf(teams: Pick<TeamModel, 'rows'>): TeamRow | undefined {
    return teams.rows.find(row => row.reference)
}

export interface NormalisedOverrides {
    state: CompareUrlState
    drops: CompareNotice[]
}

export function normaliseOverrides(state: CompareUrlState, teams: Pick<TeamModel, 'rows'>): NormalisedOverrides {
    const reference = referenceOf(teams)
    const references = new Map(reference?.team.members.map(member => [member.capId, member]) ?? [])
    const runners = new Map(teams.rows.filter(row => !row.reference).flatMap(row => row.team.members.map(member => [member.capId, { member, team: row.teamCapId }] as const)))
    const orient = ({ runner, reference: partner }: ComparePair): ComparePair | null => {
        if (runners.has(runner) && references.has(partner)) return { runner, reference: partner }
        if (runners.has(partner) && references.has(runner)) return { runner: partner, reference: runner }
        return null
    }
    const drops: CompareNotice[] = []
    const pairs: ComparePair[] = []
    for (const entry of state.pairs) {
        const value = `${entry.runner}:${entry.reference}`
        const pair = orient(entry)
        if (!pair || !sameSide(runners.get(pair.runner)!.member, references.get(pair.reference)!)) {
            drops.push({ param: 'pair', reason: 'outside-set', value })
            continue
        }
        const team = runners.get(pair.runner)!.team
        if (pairs.some(seen => seen.runner === pair.runner || (seen.reference === pair.reference && runners.get(seen.runner)!.team === team))) {
            drops.push({ param: 'pair', reason: 'duplicate', value })
            continue
        }
        pairs.push(pair)
    }
    const drive = state.drive !== null && runners.has(state.drive) ? state.drive : null
    if (state.drive !== null && drive === null) drops.push({ param: 'drive', reason: 'outside-set', value: state.drive })
    return { state: { ...state, pairs, drive }, drops }
}

function candidateOf(candidates: readonly TeamComparisonCandidate[], runner: SoloRun, reference: SoloRun): TeamComparisonCandidate | undefined {
    return candidates.find(candidate => candidate.runner_cap_id === runner.capId && candidate.reference_cap_id === reference.capId)
}

export function overridePair(runner: SoloRun, reference: SoloRun, candidates: readonly TeamComparisonCandidate[]): TeamPair {
    const key = comparisonKey({ runner: runner.capId, reference: reference.capId })
    const candidate = candidateOf(candidates, runner, reference)
    if (candidate?.basis === 'ghost') {
        return { key, state: candidate.score >= ALIGNED_COVERAGE ? 'aligned' : 'routes_differ', score: candidate.score, runner, reference }
    }
    if (runner.hasGhost && reference.hasGhost) return { key, state: 'aligned', score: 0, runner, reference }
    return { key, state: 'zones', score: candidate?.score ?? 0, runner, reference }
}

export function matchLabel(candidate: TeamComparisonCandidate | undefined): string | null {
    if (!candidate) return null
    const percent = `${Math.round(candidate.score * 100)} %`
    return candidate.basis === 'ghost' ? `route match ${percent}` : `zone match ${percent}`
}

function asPairs(pairs: readonly TeamPair[]): ComparePair[] {
    return pairs.map(pair => ({ runner: pair.runner.capId, reference: pair.reference.capId }))
}

function menuGroup(row: TeamRow, member: SoloRun, partners: readonly SoloRun[], read: TeamRead, asRunner: boolean): PairGroup {
    const candidates = read.comparison?.candidates ?? []
    return {
        row,
        options: partners.filter(partner => sameSide(member, partner)).map(partner => {
            const [runner, reference] = asRunner ? [member, partner] : [partner, member]
            return {
                capId: partner.capId,
                run: partner,
                match: matchLabel(candidateOf(candidates, runner, reference)),
                current: read.pairs.some(pair => pair.runner.capId === runner.capId && pair.reference.capId === reference.capId),
            }
        }),
    }
}

function pairMenus(reference: TeamRow, reads: readonly TeamRead[]): Map<string, PairMenu> {
    const answered = reads.filter(read => read.comparison)
    const menus = new Map<string, PairMenu>()
    answered.forEach(read => read.row.team.members.forEach(member => {
        menus.set(member.capId, { capId: member.capId, groups: [menuGroup(reference, member, reference.team.members, read, true)] })
    }))
    reference.team.members.forEach(member => {
        const groups = answered.map(read => menuGroup(read.row, member, read.row.team.members, read, false))
        if (groups.length > 0) menus.set(member.capId, { capId: member.capId, groups })
    })
    for (const [capId, menu] of menus) {
        if (menu.groups.every(group => group.options.length === 0)) menus.delete(capId)
    }
    return menus
}

export function composePairing(teams: Pick<TeamModel, 'rows'>, reads: readonly TeamRead[], drives: ReadonlyMap<string, DriveChoice>): PairingModel {
    const reference = referenceOf(teams)
    if (!reference) return NO_PAIRING
    const references = reference.team.members.map(member => member.capId)
    return {
        menus: pairMenus(reference, reads),
        teams: new Map(reads.filter(read => read.comparison).map(read => [read.row.teamCapId, {
            teamCapId: read.row.teamCapId,
            runners: read.row.team.members.map(member => member.capId),
            references,
            server: asPairs(read.server),
            current: asPairs(read.pairs),
        }])),
        drives,
    }
}

function samePairs(a: readonly ComparePair[], b: readonly ComparePair[]): boolean {
    return a.length === b.length && a.every(pair => b.some(other => other.runner === pair.runner && other.reference === pair.reference))
}

export function chosenPairs(current: readonly ComparePair[], runner: string, reference: string, sides: ReadonlyMap<string, SoloRun>): ComparePair[] {
    if (current.some(pair => pair.runner === runner && pair.reference === reference)) return [...current]
    const runnerWas = current.find(pair => pair.runner === runner)?.reference
    const referenceHad = current.find(pair => pair.reference === reference)?.runner
    const kept = current.filter(pair => pair.runner !== runner && pair.reference !== reference)
    const next = [...kept, { runner, reference }]
    const displacedRunner = referenceHad === undefined ? undefined : sides.get(referenceHad)
    const displacedReference = runnerWas === undefined ? undefined : sides.get(runnerWas)
    if (displacedRunner && displacedReference && sameSide(displacedRunner, displacedReference)) {
        next.push({ runner: displacedRunner.capId, reference: displacedReference.capId })
    }
    return next
}

export function overrideEdit(pairs: readonly ComparePair[], pairings: ReadonlyMap<string, TeamPairing>, runs: readonly SoloRun[], capId: string, partner: string): ComparePair[] | null {
    const byId = new Map(runs.map(run => [run.capId, run]))
    for (const pairing of pairings.values()) {
        const [runner, reference] = pairing.runners.includes(capId) ? [capId, partner] : [partner, capId]
        if (!pairing.runners.includes(runner) || !pairing.references.includes(reference)) continue
        const runnerRun = byId.get(runner)
        const referenceRun = byId.get(reference)
        if (!runnerRun || !referenceRun || !sameSide(runnerRun, referenceRun)) return null
        const next = chosenPairs(pairing.current, runner, reference, byId)
        const order = new Map(pairing.references.map((id, i) => [id, i]))
        const entries = samePairs(next, pairing.server) ? [] : next.sort((a, b) => order.get(a.reference)! - order.get(b.reference)!)
        return [...pairs.filter(pair => !pairing.runners.includes(pair.runner)), ...entries]
    }
    return null
}

export interface TeamSync {
    sync: SyncModel
    drives: Map<string, DriveChoice>
    raceClockRows: string[]
}

export function composeTeamSync(teams: Pick<TeamModel, 'rows'>, reads: readonly TeamRead[], lanes: LanesModel, comparisons: LoadedComparisons, mode: CompareSync, drive: string | null): TeamSync {
    const reference = referenceOf(teams)
    const strips = new Set(lanes.lanes.filter(lane => lane.trace.kind === 'strip').map(lane => lane.capId))
    const drives = new Map<string, DriveChoice>()
    const links: PositionLink[] = []
    const stranded: TeamRead[] = []
    reads.forEach(read => {
        const drivable = read.pairs.filter(pair => pair.state === 'aligned' && strips.has(pair.runner.capId))
        const best = drivable.reduce<TeamPair | null>((top, pair) => (!top || pair.score > top.score ? pair : top), null)
        const chosen = drivable.find(pair => pair.runner.capId === drive) ?? best
        drives.set(read.row.teamCapId, { driver: chosen?.runner.capId ?? null, choices: drivable.map(pair => pair.runner.capId) })
        const comparison = chosen ? comparisons.get(chosen.key) : null
        if (reference && chosen && comparison) {
            links.push({ capId: read.row.teamCapId, reference: reference.teamCapId, knots: comparisonKnots(comparison) })
            return
        }
        const settled = read.comparison !== undefined && read.pairs.every(pair => pair.state !== 'aligned' || comparisons.has(pair.key))
        if (settled) stranded.push(read)
    })
    const raceClockRows = mode === 'position' ? stranded.map(read => read.row.teamCapId) : []
    const raceClock = mode === 'position' ? stranded.flatMap(read => read.row.team.members.map(member => member.capId)) : []
    return { sync: { mode, links, raceClock }, drives, raceClockRows }
}

export function withRowRaceClock(teams: TeamModel, rows: readonly string[]): TeamModel {
    if (rows.length === 0) return teams
    const marked = new Set(rows)
    return {
        ...teams,
        rows: teams.rows.map(row => (marked.has(row.teamCapId)
            ? { ...row, badges: [...row.badges, RACE_CLOCK], lane: row.lane && { ...row.lane, badges: [...row.lane.badges, RACE_CLOCK] } }
            : row)),
    }
}
