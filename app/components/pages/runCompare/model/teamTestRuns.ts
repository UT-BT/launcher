import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapComparison, ReplayVideo, TeamComparison, TeamComparisonTeam } from '@/app/utils/api'
import { comparisonKey } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { parseZoneCheckpoints, teamRunFromDetail, type TeamRun } from '../loading/teamRuns'
import { composeCompareModel, type CompareModelInput } from './compareModel'

export const INDUSTRY = teamRunFromDetail(runCompareFixture('teamCapDetailMembers'))!
export const WIDE = { width: 1920, height: 1080 }
export const VIDEO: ReplayVideo = { source: 'utrecorder', mp4_url: 'https://media.test/v.mp4', view_url: null, fps: 60 }

export function testId(n: number, kind: string): string {
    return `${kind}${String(n).padStart(2, '0')}0000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
}

export function testMember(team: number, seat: number, seconds: number, overrides: Partial<SoloRun> = {}): SoloRun {
    return {
        capId: testId(team * 10 + seat, 'cc'),
        user: `80000000000000${team}${seat}`,
        alias: `T${team}M${seat}`,
        title: null,
        timeSeconds: seconds,
        map: INDUSTRY.map,
        side: 0,
        hasGhost: true,
        zoneCheckpoints: null,
        checkpoints: [{ zone: 'Gate', cumulative: seconds / 6, segment: seconds / 6 }],
        disallowed: false,
        ...overrides,
    }
}

export function testTeam(n: number, seconds: number, overrides: Partial<TeamRun> = {}): TeamRun {
    return {
        teamCapId: testId(n, 'ee'),
        map: INDUSTRY.map,
        timeSeconds: seconds,
        disallowed: false,
        members: [testMember(n, 1, seconds - 1), testMember(n, 2, seconds)],
        ...overrides,
    }
}

export function testSolo(capId: string): SoloRun {
    return testMember(9, 9, 70, { capId })
}

export function composeTeams(query: string, teams: readonly TeamRun[], overrides: Partial<CompareModelInput> = {}) {
    const ids = new URLSearchParams(query).get('runs')?.split(',') ?? []
    const byId = new Map(teams.map(entry => [entry.teamCapId, entry]))
    const videos = new Map(teams.flatMap(entry => entry.members.map(run => [run.capId, VIDEO] as const)))
    return composeCompareModel({
        query,
        runs: new Map(ids.map(capId => [capId, null])),
        teams: new Map(ids.map(capId => [capId, byId.get(capId) ?? null])),
        videos,
        stageBox: WIDE,
        ...overrides,
    })
}

const MEMBER_ZONES: Readonly<Record<string, string>> = {
    '826017aa-4c06-4ec3-bc88-cd21f39ec922': 'Bridge-12.204;Lift-30.551;Flag-78.433;',
    'bfdc9f6f-3c01-47a0-bbae-1c618a6c7231': 'Ramp-14.880;Pit-41.206;Flag-79.112;',
    '45174a12-7a87-4ace-a867-c569c61c051e': 'Ramp-15.102;Pit-40.877;Flag-78.950;',
    '00173dd9-2526-4372-baca-6f561812ac44': 'Bridge-12.517;Lift-30.990;Flag-79.604;',
    '24793498-f193-498c-adce-c637758a659d': 'Gate-9.512;Crane-26.940;Gate-31.207;Furnace-43.655;Flag-64.870;',
    '67c166fe-0aa1-4f79-9482-22ee4095d153': 'Gate-9.700;Crane-26.810;Vent-41.020;Flag-65.990;',
    '41c75422-5c62-4e78-91b5-e19a1378a597': 'Docks-11.020;Silo-29.874;Kiln-47.310;',
    'e3a90c47-6b1d-4f2e-9a85-0c7d2b4f6e18': 'Docks-11.388;Silo-30.502;Kiln-48.117;',
}

export function teamFromComparison(team: TeamComparisonTeam): TeamRun {
    if (team.team_cap_id === INDUSTRY.teamCapId) return INDUSTRY
    return {
        teamCapId: team.team_cap_id,
        map: INDUSTRY.map,
        timeSeconds: team.team_time_ms / 1000,
        disallowed: false,
        members: team.members.map((member): SoloRun => ({
            capId: member.cap_id,
            user: member.user,
            alias: member.alias,
            title: null,
            timeSeconds: member.cap_time_ms / 1000,
            map: INDUSTRY.map,
            side: member.team,
            hasGhost: member.has_ghost,
            zoneCheckpoints: MEMBER_ZONES[member.cap_id] ?? null,
            checkpoints: parseZoneCheckpoints(MEMBER_ZONES[member.cap_id]),
            disallowed: false,
        })),
    }
}

export type TeamFixtureName = 'teamAligned' | 'teamMixed' | 'teamOppositeSides'

export interface Versus {
    comparison: TeamComparison
    runner: TeamRun
    reference: TeamRun
    query: string
    key: string
}

export function versusOf(name: TeamFixtureName): Versus {
    const comparison = runCompareFixture(name)
    const runner = teamFromComparison(comparison.runner)
    const reference = teamFromComparison(comparison.reference)
    return {
        comparison,
        runner,
        reference,
        query: `runs=${runner.teamCapId},${reference.teamCapId}&ref=${reference.teamCapId}`,
        key: comparisonKey({ runner: runner.teamCapId, reference: reference.teamCapId }),
    }
}

export function alignedComparisons(versus: Versus, comparison: CapComparison | null = runCompareFixture('aligned')): Map<string, CapComparison | null> {
    return new Map(versus.comparison.pairs
        .filter(pair => pair.state === 'aligned')
        .map(pair => [comparisonKey({ runner: pair.runner_cap_id, reference: pair.reference_cap_id }), comparison]))
}

export function composeVersus(versus: Versus, overrides: Partial<CompareModelInput> = {}, query = versus.query) {
    return composeTeams(query, [versus.runner, versus.reference], {
        teamComparisons: new Map([[versus.key, versus.comparison]]),
        comparisons: alignedComparisons(versus),
        ...overrides,
    })
}
