import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { teamRunFromDetail, type TeamRun } from '../loading/teamRuns'
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
