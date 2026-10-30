import capDetailCandidates from './runCompare/cap_detail_candidates.json'
import capDetailGhostOnly from './runCompare/cap_detail_ghost_only.json'
import chartRules from './runCompare/chart_rules.json'
import compareAligned from './runCompare/compare_aligned.json'
import compareErrors from './runCompare/compare_errors.json'
import compareLong from './runCompare/compare_long.json'
import compareNeverRejoins from './runCompare/compare_never_rejoins.json'
import compareRoutesDiffer from './runCompare/compare_routes_differ.json'
import compareSeparated from './runCompare/compare_separated.json'
import compareShort from './runCompare/compare_short.json'
import teamCapDetailMembers from './runCompare/team_cap_detail_members.json'
import type { CapComparison, CapComparisonErrorCode, CapDetail, TeamCapDetail } from '@/app/utils/api'

export interface RunCompareSuccessFixtures {
    aligned: CapComparison
    separated: CapComparison
    neverRejoins: CapComparison
    long: CapComparison
    short: CapComparison
    routesDiffer: CapComparison
    capDetailCandidates: CapDetail
    capDetailGhostOnly: CapDetail
    teamCapDetailMembers: TeamCapDetail
}

export type RunCompareFixtureName = keyof RunCompareSuccessFixtures

export type RunCompareComparisonName = {
    [K in RunCompareFixtureName]: RunCompareSuccessFixtures[K] extends CapComparison ? K : never
}[RunCompareFixtureName]

export interface RunCompareErrorBody {
    success: false
    error: string
    code: CapComparisonErrorCode
}

export interface RunCompareErrorEntry {
    status: number
    body: RunCompareErrorBody
}

export interface ChartRuleXTick {
    t_ms: number
    label: string
}

export interface ChartRuleXVector {
    name: string
    source?: string
    duration_ms: number
    step_ms: number
    end_tick: boolean
    ticks: ChartRuleXTick[]
}

export interface ChartRuleYTick {
    value_ms: number
    label: string
}

export interface ChartRuleYVector {
    name: string
    source?: string
    min_delta_ms: number
    max_delta_ms: number
    step_ms: number
    domain_ms: [number, number]
    ticks: ChartRuleYTick[]
}

export interface ChartRuleVectors {
    x: ChartRuleXVector[]
    y: ChartRuleYVector[]
}

interface FixtureEntry {
    file: string
    route: string
    body: unknown
}

const COMPARE_ROUTE = 'GET /ghosts/compare?runner=:capId&reference=:capId'
const CAP_DETAIL_ROUTE = 'GET /caps/:capId/detail'

export const RUN_COMPARE_FIXTURES: Record<RunCompareFixtureName, FixtureEntry> = {
    aligned: { file: 'compare_aligned.json', route: COMPARE_ROUTE, body: compareAligned },
    separated: { file: 'compare_separated.json', route: COMPARE_ROUTE, body: compareSeparated },
    neverRejoins: { file: 'compare_never_rejoins.json', route: COMPARE_ROUTE, body: compareNeverRejoins },
    long: { file: 'compare_long.json', route: COMPARE_ROUTE, body: compareLong },
    short: { file: 'compare_short.json', route: COMPARE_ROUTE, body: compareShort },
    routesDiffer: { file: 'compare_routes_differ.json', route: COMPARE_ROUTE, body: compareRoutesDiffer },
    capDetailCandidates: { file: 'cap_detail_candidates.json', route: CAP_DETAIL_ROUTE, body: capDetailCandidates },
    capDetailGhostOnly: { file: 'cap_detail_ghost_only.json', route: CAP_DETAIL_ROUTE, body: capDetailGhostOnly },
    teamCapDetailMembers: {
        file: 'team_cap_detail_members.json',
        route: 'GET /caps/team_caps/:teamCapId/detail',
        body: teamCapDetailMembers,
    },
}

export const RUN_COMPARE_ERRORS_FILE = 'compare_errors.json'
export const CHART_RULES_FILE = 'chart_rules.json'

export function runCompareFixture<K extends RunCompareFixtureName>(name: K): RunCompareSuccessFixtures[K] {
    const body = RUN_COMPARE_FIXTURES[name].body as { data: RunCompareSuccessFixtures[K] }
    return structuredClone(body.data)
}

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

export function runCompareFixtureResponse(name: RunCompareFixtureName): Response {
    return jsonResponse(RUN_COMPARE_FIXTURES[name].body, 200)
}

export function runCompareErrors(): RunCompareErrorEntry[] {
    return structuredClone(compareErrors as RunCompareErrorEntry[])
}

export function runCompareErrorResponse(code: CapComparisonErrorCode): Response {
    const entry = runCompareErrors().find((candidate) => candidate.body.code === code)
    if (!entry) throw new Error(`no comparison error fixture for ${code}`)
    return jsonResponse(entry.body, entry.status)
}

export function chartRuleVectors(): ChartRuleVectors {
    return structuredClone(chartRules as ChartRuleVectors)
}
