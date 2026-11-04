import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replyFor } from '../data'
import { recordedFixtureSet } from '../recording'
import type { FixtureRoute, FixtureSet } from '../types'
import { person, syntheticId } from './people'
import type { TeamComparison, TeamComparisonTeam } from '../../../../app/utils/api'
import { teamDetail, teamEntry, TEAM_MAP, type TeamFixture } from '../../../teamRuns'

const RECORDED = recordedFixtureSet('cap-detail')
const DONOR_ID = '258021df-51b1-4ed3-99cc-62d4e75892a7'
const RECORDED_RUNS = [DONOR_ID, '418b0aec-34c5-40e7-acf4-f2bc33373063', '8d742df9-2f14-4998-835c-3c16c1d1ee92']
const PLAYABLE_VIDEO = `data:video/webm;base64,${readFileSync(resolve(__dirname, '../../../next-map-flythrough.webm')).toString('base64')}`

export const EXTRA_RUN_IDS: readonly string[] = Array.from({ length: 5 }, (_, i) => `c0ffee0${i}-0000-4000-8000-00000000000${i}`)
export const EIGHT_RUN_IDS: readonly string[] = [...RECORDED_RUNS, ...EXTRA_RUN_IDS]

const TEAMS: readonly TeamFixture[] = [1, 2].map(t => ({
    teamCapId: `c0ffee${t}0-0000-4000-8000-0000000000${t}0`,
    members: [1, 2].map(m => {
        const someone = person(50 + t * 2 + m)
        return {
            capId: `c0ffee${t}${m}-0000-4000-8000-0000000000${t}${m}`,
            user: syntheticId(50 + t * 2 + m),
            alias: someone.alias,
            seconds: 40 + t + m * 1.5,
            zones: `Gate-${8 + t + m};Crane-${20 + t + m};`,
            ghost: m === 1,
        }
    }),
}))

export const TEAM_RUN_IDS: readonly string[] = TEAMS.map(team => team.teamCapId)
const TEAM_POV_IDS = TEAMS.flatMap(team => team.members.map(member => member.capId))

function comparisonTeam(team: TeamFixture): TeamComparisonTeam {
    return {
        team_cap_id: team.teamCapId,
        team_run_id: team.teamCapId.replace(/^c0ffee/, 'deadbe'),
        team_time_ms: Math.max(...team.members.map(member => member.seconds)) * 1000,
        members: team.members.map(member => ({
            cap_id: member.capId,
            user: member.user,
            alias: member.alias,
            team: 0,
            cap_time_ms: member.seconds * 1000,
            has_ghost: member.ghost === true,
            has_zones: member.zones !== null,
        })),
    }
}

function teamComparison(runner: TeamFixture, reference: TeamFixture): TeamComparison {
    const [ahead, behind] = [comparisonTeam(reference), comparisonTeam(runner)]
    const pairs = ahead.members.map((member, i) => ({
        runner_cap_id: behind.members[i].cap_id,
        reference_cap_id: member.cap_id,
        basis: member.has_ghost ? 'ghost' as const : 'zones' as const,
        score: member.has_ghost ? 0.9 : 1,
        state: member.has_ghost ? 'aligned' as const : 'zones' as const,
    }))
    const split = (zone: string, referenceMs: number, runnerMs: number, member: number) => ({
        zone,
        reference_ms: referenceMs,
        runner_ms: runnerMs,
        delta_ms: runnerMs - referenceMs,
        reference_member_cap_id: ahead.members[member].cap_id,
        runner_member_cap_id: behind.members[member].cap_id,
    })
    return {
        runner: behind,
        reference: ahead,
        final_delta_ms: behind.team_time_ms - ahead.team_time_ms,
        pairs,
        unpaired: [],
        candidates: [...pairs].sort((a, b) => b.score - a.score).map(({ state: _state, ...candidate }) => candidate),
        team_splits: [
            split('Gate', 10_000, 11_000, 0),
            split('Crane', 22_000, 23_000, 0),
            split('CAP', ahead.team_time_ms, behind.team_time_ms, 1),
        ],
    }
}

const TEAM_COMPARISON = teamComparison(TEAMS[1], TEAMS[0])

const teamComparisonRoute: FixtureRoute = {
    host: 'api',
    path: '/ghosts/compare/team',
    reply: url => (url.searchParams.get('runner') === TEAMS[1].teamCapId && url.searchParams.get('reference') === TEAMS[0].teamCapId
        ? { json: { success: true, data: TEAM_COMPARISON } }
        : { status: 404, json: { success: false, error: 'Team cap not found', code: 'team_cap_not_found' } }),
}

function teamDetailRoute(team: TeamFixture): FixtureRoute {
    return { host: 'api', path: `/caps/team_caps/${team.teamCapId}/detail`, reply: { json: { success: true, data: teamDetail(team) } } }
}

type Detail = { cap: Record<string, unknown>; checkpoints: { cumulative: number; segment: number }[] } & Record<string, unknown>

function donorDetail(): Detail {
    const reply = replyFor(RECORDED, new URL(`https://api.utbt.net/caps/${DONOR_ID}/detail`))
    return (reply?.json as { data: Detail }).data
}

function extraDetail(capId: string, i: number): FixtureRoute {
    const donor = donorDetail()
    const seconds = Number(donor.cap.cap_time_seconds) + 2 * (i + 1)
    const scale = seconds / Number(donor.cap.cap_time_seconds)
    const someone = person(40 + i)
    return {
        host: 'api',
        path: `/caps/${capId}/detail`,
        reply: {
            json: {
                success: true,
                data: {
                    ...donor,
                    cap: { ...donor.cap, id: capId, user: syntheticId(40 + i), alias: someone.alias, cap_time_seconds: seconds, active_title: null },
                    checkpoints: donor.checkpoints.map(checkpoint => ({ ...checkpoint, cumulative: checkpoint.cumulative * scale, segment: checkpoint.segment * scale })),
                    compare_candidates: [],
                    neighbors: { above: [], below: [] },
                },
            },
        },
    }
}

export const START_MAP = 'CTF-BT-HumanResources'

function latestRecord(index: number, map: string, seconds: number, team: TeamFixture | null = null) {
    const someone = person(70 + index)
    return {
        cap_id: `c0ffee9${index}-0000-4000-8000-00000000009${index}`,
        user_id: syntheticId(70 + index),
        map,
        added: `2026-10-2${index}T12:00:00Z`,
        cap_time_seconds: seconds,
        alias: someone.alias,
        active_title: null,
        members: team && team.members.map(member => ({
            user: member.user,
            alias: member.alias,
            cap_id: member.capId,
            cap_time_seconds: member.seconds,
            verified: true,
            active_title: null,
        })),
    }
}

const latestRecordsRoute: FixtureRoute = {
    host: 'api',
    path: '/v2/world_records',
    reply: { json: { success: true, data: [latestRecord(1, START_MAP, 61.25), latestRecord(2, TEAM_MAP, 44.5, TEAMS[0]), latestRecord(3, START_MAP, 62.5)] } },
}

function playableReplay(capId: string): FixtureRoute {
    return {
        host: 'gateway',
        path: `/replays/${capId}`,
        reply: { json: { source: 'utrecorder', mp4_url: PLAYABLE_VIDEO, view_url: null, fps: 60 } },
    }
}

export const RUN_COMPARE_SET: FixtureSet = {
    name: 'run-compare',
    routes: [
        ...EIGHT_RUN_IDS.map(playableReplay),
        ...EXTRA_RUN_IDS.map(extraDetail),
        ...TEAM_POV_IDS.map(playableReplay),
        ...TEAMS.map(teamDetailRoute),
        { host: 'api', path: `/caps/leaderboard/team/map/${TEAM_MAP}`, reply: { json: { success: true, data: TEAMS.map(teamEntry) } } },
        teamComparisonRoute,
        latestRecordsRoute,
        ...RECORDED.routes,
    ],
}
