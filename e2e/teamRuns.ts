import type { Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import type { TeamCapDetail, TeamLeaderboardEntry } from '../app/utils/api'
import { replayVideoUrl } from './replayVideos'

const BASE = runCompareFixture('teamCapDetailMembers')
export const TEAM_MAP = BASE.map

export interface TeamMember {
    capId: string
    user: string
    alias: string
    seconds: number
    zones: string | null
    ghost?: boolean
    side?: number
}

export interface TeamFixture {
    teamCapId: string
    members: TeamMember[]
}

function teamTime(team: TeamFixture): number {
    return Math.max(...team.members.map(member => member.seconds))
}

export function teamDetail(team: TeamFixture): TeamCapDetail {
    const [donor] = BASE.members
    return {
        ...BASE,
        id: team.teamCapId,
        team_cap_id: team.teamCapId,
        team_size: team.members.length,
        member_key: null,
        team_time_seconds: teamTime(team),
        members: team.members.map(member => ({
            ...donor,
            user: member.user,
            alias: member.alias,
            active_title: null,
            cap_id: member.capId,
            cap_time_seconds: member.seconds,
            cap: {
                ...donor.cap!,
                id: member.capId,
                user: member.user,
                alias: member.alias,
                active_title: null,
                cap_time_seconds: member.seconds,
                team: member.side ?? 0,
                has_ghost: member.ghost ?? false,
                zone_checkpoints: member.zones,
            },
        })),
    }
}

export function teamEntry(team: TeamFixture): TeamLeaderboardEntry {
    return {
        id: team.teamCapId,
        map: TEAM_MAP,
        added: BASE.added ?? '',
        cap_time_seconds: teamTime(team),
        verified: true,
        complete: true,
        disallowed: false,
        state: 'verified',
        team_size: team.members.length,
        user: team.members[0].user,
        medal: 0,
        members: team.members.map(member => ({
            user: member.user,
            alias: member.alias,
            cap_id: member.capId,
            cap_time_seconds: member.seconds,
            verified: true,
            disallowed: false,
            active_title: null,
            team: member.side ?? 0,
            has_ghost: member.ghost ?? false,
            has_zones: !!member.zones,
        })),
    }
}

export async function mockTeamRuns(page: Page, teams: readonly TeamFixture[], { videos = [] as readonly string[] } = {}) {
    const details = new Map(teams.map(team => [team.teamCapId, teamDetail(team)]))
    await page.route(/https:\/\/api\.utbt\.net\/caps\/team_caps\/[^/]+\/detail$/, route => {
        const teamCapId = /\/team_caps\/([^/]+)\/detail$/.exec(new URL(route.request().url()).pathname)![1]
        const detail = details.get(teamCapId)
        if (!detail) return route.fulfill({ status: 404, json: { success: false, error: 'Team cap not found' } })
        return route.fulfill({ json: { success: true, data: detail } })
    })
    await page.route(/https:\/\/api\.utbt\.net\/caps\/leaderboard\/team\/map\/.*/, route => route.fulfill({ json: { success: true, data: teams.map(teamEntry) } }))
    await page.route(/https:\/\/gateway\.utbt\.net\/replays\/[^/]+$/, route => {
        const capId = new URL(route.request().url()).pathname.split('/').pop()!
        if (!videos.includes(capId)) return route.fallback()
        return route.fulfill({ json: { source: 'utrecorder', mp4_url: replayVideoUrl(capId), view_url: null, fps: 60 } })
    })
}

export const ALPHA: TeamFixture = {
    teamCapId: 'abab0001-0000-4000-8000-0000000000a1',
    members: [
        { capId: 'abab0011-0000-4000-8000-0000000000b1', user: '700000000000000041', alias: 'Alpha One', seconds: 12, zones: 'Gate-3.000;Crane-7.500;Gate-9.000;' },
        { capId: 'abab0012-0000-4000-8000-0000000000b2', user: '700000000000000042', alias: 'Alpha Two', seconds: 13.5, zones: 'Gate-3.400;', ghost: true },
    ],
}

export const BRAVO: TeamFixture = {
    teamCapId: 'abab0002-0000-4000-8000-0000000000a2',
    members: [
        { capId: 'abab0021-0000-4000-8000-0000000000c1', user: '700000000000000043', alias: 'Bravo One', seconds: 12.5, zones: 'Gate-3.200;' },
        { capId: 'abab0022-0000-4000-8000-0000000000c2', user: '700000000000000044', alias: 'Bravo Two', seconds: 14, zones: null },
    ],
}

export const TEAM_POVS = [ALPHA, BRAVO].flatMap(team => team.members.map(member => member.capId))
