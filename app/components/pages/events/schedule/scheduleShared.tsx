import type { MyTournamentMembership, ScheduleEntry } from '@/app/utils/api'
import { formatSlotTime, parseApiInstant } from '@/app/utils/timezone'
import { teamLabel } from '../bracket/bracketShared'

export { formatSlotTime, parseApiInstant }

const SCHEDULABILITY_REASONS: Record<string, string> = {
    bracket_not_published: "This event's bracket has not been published yet.",
    teams_not_decided: "This match's opponent is not decided yet.",
    team_not_registered: 'One of the teams in this match is not an active registered team.',
    window_not_open: "This match's scheduling window is not open yet.",
}

export function schedulabilityReason(reason: string | null): string {
    if (!reason) return ''
    return SCHEDULABILITY_REASONS[reason] ?? 'This match cannot be scheduled right now.'
}

export function myTeamIdsByTournament(memberships: MyTournamentMembership[]): Map<string, string> {
    const byTournament = new Map<string, string>()

    for (const membership of memberships) {
        if (membership.membership_status === 'active') byTournament.set(membership.tournament.slug, membership.team.id)
    }

    return byTournament
}

export function awaitingMyResponseCount(schedule: ScheduleEntry[], memberships: MyTournamentMembership[]): number {
    const myTeamIds = myTeamIdsByTournament(memberships)

    return schedule.filter(entry => {
        const myTeamId = myTeamIds.get(entry.tournament.slug)
        return !!myTeamId && !!entry.proposal && entry.whose_turn === myTeamId
    }).length
}

export function proposerName(entry: ScheduleEntry): string {
    const { team_a, team_b } = entry.match
    const proposerId = entry.proposal?.team_id
    const proposer = proposerId === team_a?.id ? team_a : proposerId === team_b?.id ? team_b : null

    return proposer ? teamLabel(proposer) : 'A team'
}

export function whoseTurnLabel(entry: ScheduleEntry, myTeamId: string | null): string {
    if (!entry.proposal) return 'No offer yet — either side can propose a time.'

    const { team_a, team_b } = entry.match

    if (myTeamId) {
        if (entry.whose_turn === myTeamId) return 'Your turn to respond'
        const opponent = team_a?.id === myTeamId ? team_b : team_a
        return `Waiting on ${opponent ? teamLabel(opponent) : 'the opponent'}`
    }

    const turnTeam = entry.whose_turn === team_a?.id ? team_a : entry.whose_turn === team_b?.id ? team_b : null

    return `Waiting on ${turnTeam ? teamLabel(turnTeam) : 'a response'}`
}
