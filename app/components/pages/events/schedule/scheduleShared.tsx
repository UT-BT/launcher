import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { EventMatch, MyTournamentMembership, ScheduleEntry } from '@/app/utils/api'
import { formatSlotTime, parseApiInstant } from '@/app/utils/timezone'
import { teamLabel } from '../bracket/bracketShared'
import { TeamName } from '../TeamRoster'

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
    if (!entry.proposal) return 'No proposals yet, either side can propose a time.'

    const { team_a, team_b } = entry.match

    if (myTeamId) {
        if (entry.whose_turn === myTeamId) return 'Your turn to respond'
        const opponent = team_a?.id === myTeamId ? team_b : team_a
        return `Waiting on ${opponent ? teamLabel(opponent) : 'the opponent'}`
    }

    const turnTeam = entry.whose_turn === team_a?.id ? team_a : entry.whose_turn === team_b?.id ? team_b : null

    return `Waiting on ${turnTeam ? teamLabel(turnTeam) : 'a response'}`
}

export function ScheduleSection({ title, count, blurb, children }: {
    title: string
    count?: number
    blurb?: string
    children: ReactNode
}) {
    return (
        <section aria-label={title} className="flex flex-col gap-2">
            <header className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
                {count !== undefined && <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>}
                {blurb && <span className="text-[11px] text-muted-foreground">{blurb}</span>}
            </header>
            {children}
        </section>
    )
}

export function ScheduleLoading() {
    return <div className="p-6 text-center text-sm text-muted-foreground">Loading schedule…</div>
}

export function TeamPair({ match, className }: {
    match: Pick<EventMatch, 'team_a' | 'team_b' | 'slot_a_label' | 'slot_b_label'>
    className?: string
}) {
    return (
        <div className={cn('flex items-center gap-1.5 min-w-0 text-sm font-medium text-foreground', className)}>
            <TeamName teamId={match.team_a?.id} className="truncate">
                {teamLabel(match.team_a, match.slot_a_label)}
            </TeamName>
            <span className="text-muted-foreground shrink-0">vs</span>
            <TeamName teamId={match.team_b?.id} className="truncate">
                {teamLabel(match.team_b, match.slot_b_label)}
            </TeamName>
        </div>
    )
}
