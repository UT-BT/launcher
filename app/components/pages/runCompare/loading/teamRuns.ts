import { fetchTeamCapDetail, type CapCheckpoint, type TeamCapDetail, type TeamCapDetailMember } from '@/app/utils/api'
import { useRunReads, type SoloRun } from './soloRuns'

export interface TeamRun {
    teamCapId: string
    map: string
    timeSeconds: number
    disallowed: boolean
    members: SoloRun[]
}

export type LoadedTeamRuns = ReadonlyMap<string, TeamRun | null>

const ZONE_ENTRY = /^(.+)-(\d+(?:\.\d+)?)$/

export function parseZoneCheckpoints(raw: string | null | undefined): CapCheckpoint[] {
    const checkpoints: CapCheckpoint[] = []
    for (const token of (raw ?? '').split(';')) {
        const match = ZONE_ENTRY.exec(token.trim())
        if (!match) continue
        const zone = match[1].trim()
        if (!zone || checkpoints.some(checkpoint => checkpoint.zone === zone)) continue
        const cumulative = Number(match[2])
        const previous = checkpoints[checkpoints.length - 1]?.cumulative ?? 0
        checkpoints.push({ zone, cumulative, segment: cumulative - previous })
    }
    return checkpoints
}

function memberRun(member: TeamCapDetailMember, map: string, timeSeconds: number): SoloRun {
    const cap = member.cap
    const side = cap?.team === 0 || cap?.team === 1 ? cap.team : null
    return {
        capId: member.cap_id,
        user: String(member.user),
        alias: member.alias ?? null,
        title: member.active_title ?? null,
        timeSeconds,
        map,
        side,
        hasGhost: cap?.has_ghost === true,
        zoneCheckpoints: cap?.zone_checkpoints ?? null,
        checkpoints: parseZoneCheckpoints(cap?.zone_checkpoints),
        disallowed: member.disallowed === true,
    }
}

function byFinish(a: SoloRun, b: SoloRun): number {
    return a.timeSeconds - b.timeSeconds || a.user.length - b.user.length || a.user.localeCompare(b.user)
}

export function teamRunFromDetail(detail: TeamCapDetail): TeamRun | null {
    if (detail.team_time_seconds === null || detail.team_time_seconds === undefined) return null
    const members = detail.members.flatMap(member => (
        member.cap_time_seconds === null || member.cap_time_seconds === undefined ? [] : [memberRun(member, detail.map, member.cap_time_seconds)]
    ))
    if (members.length === 0) return null
    return {
        teamCapId: detail.team_cap_id ?? detail.id,
        map: detail.map,
        timeSeconds: detail.team_time_seconds,
        disallowed: detail.disallowed === true,
        members: members.sort(byFinish),
    }
}

export async function loadTeamRun(accessToken: string, teamCapId: string, signal?: AbortSignal): Promise<TeamRun | null> {
    const detail = await fetchTeamCapDetail(accessToken, teamCapId, signal)
    const team = detail ? teamRunFromDetail(detail) : null
    return team && team.teamCapId === teamCapId ? team : null
}

export function useTeamRuns(teamCapIds: readonly string[], accessToken: string): LoadedTeamRuns {
    return useRunReads(teamCapIds, accessToken, loadTeamRun)
}
