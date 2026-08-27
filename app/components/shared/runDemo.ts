export interface RunDemoMember {
    cap_id: string
    user?: string | number | null
    cap_time_seconds?: number | null
    disallowed?: boolean
    has_demo?: boolean
}

export interface RunDemoSource {
    demoCapId?: string | null
    members?: readonly RunDemoMember[] | null
    ownCapId?: string | null
    teamCapId?: string | null
}

export interface TeamRunRow {
    cap_id?: string | null
    team_cap_id?: string | null
    members?: readonly unknown[] | null
}

export interface CapRow {
    id: string
    isTeam?: boolean
    teamCapId?: string | null
    demoCapId?: string | null
}

export interface RecordFeedRow {
    id: string
    demoCapId?: string | null
    members?: readonly unknown[] | null
}

function hasUsableTime(member: RunDemoMember): boolean {
    return typeof member.cap_time_seconds === 'number' && Number.isFinite(member.cap_time_seconds)
}

function isEligible(member: RunDemoMember): boolean {
    return !!member.cap_id && member.disallowed !== true && hasUsableTime(member)
}

function slowestFirst(a: RunDemoMember, b: RunDemoMember): number {
    const timeGap = (b.cap_time_seconds as number) - (a.cap_time_seconds as number)
    if (timeGap !== 0) return timeGap
    const aUser = String(a.user ?? '')
    const bUser = String(b.user ?? '')
    if (aUser !== bUser) return aUser < bUser ? -1 : 1
    if (a.cap_id !== b.cap_id) return a.cap_id < b.cap_id ? -1 : 1
    return 0
}

export function membersWithCapIds(members?: readonly unknown[] | null): RunDemoMember[] {
    const roster: RunDemoMember[] = []
    for (const raw of members ?? []) {
        if (!raw || typeof raw !== 'object') continue
        const member = raw as RunDemoMember
        if (typeof member.cap_id === 'string' && member.cap_id) roster.push(member)
    }
    return roster
}

export function slowestMemberDemoCapId(members?: readonly RunDemoMember[] | null): string | null {
    const ranked = (members ?? []).filter(isEligible).slice().sort(slowestFirst)
    if (ranked.length === 0) return null
    const exposesAvailability = ranked.some(member => typeof member.has_demo === 'boolean')
    if (!exposesAvailability) return ranked[0].cap_id
    return ranked.find(member => member.has_demo === true)?.cap_id ?? null
}

export function runDemoCapId({ demoCapId, members, ownCapId, teamCapId }: RunDemoSource): string | null {
    if (demoCapId) return demoCapId
    const fromRoster = slowestMemberDemoCapId(members)
    if (fromRoster) return fromRoster
    if (!ownCapId) return null
    if (teamCapId && String(ownCapId) === String(teamCapId)) return null
    return ownCapId
}

export function isTeamRunRow(row: TeamRunRow): boolean {
    return !!row.team_cap_id || (row.members?.length ?? 0) > 0
}

export function teamRunCapId(row: TeamRunRow): string | null {
    if (!isTeamRunRow(row)) return null
    return row.team_cap_id ?? row.cap_id ?? null
}

export function capRowDemoCapId(row: CapRow): string | null {
    return runDemoCapId({
        demoCapId: row.demoCapId,
        ownCapId: row.id,
        teamCapId: row.isTeam ? row.teamCapId ?? null : null,
    })
}

export function recordFeedDemoCapId(row: RecordFeedRow): string | null {
    const isTeam = (row.members?.length ?? 0) > 0
    return runDemoCapId({
        demoCapId: row.demoCapId,
        members: membersWithCapIds(row.members),
        ownCapId: row.id,
        teamCapId: isTeam ? row.id : null,
    })
}
