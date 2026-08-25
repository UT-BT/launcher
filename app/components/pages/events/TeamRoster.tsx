import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { EventTeam, EventTeamMember } from '@/app/utils/api'

const RosterContext = createContext<Map<string, EventTeamMember[]>>(new Map())

/**
 * Rosters keyed by team id, so a team name anywhere under here can show who plays
 * for it without every bracket view threading the team list down to it. Nesting a
 * second provider replaces the outer one — the manage side has a fuller list.
 */
export function EventRosterProvider({ teams, children }: { teams: EventTeam[]; children: ReactNode }) {
    const roster = useMemo(
        () => new Map(teams.map(team => [team.id, team.members ?? []])),
        [teams],
    )

    return <RosterContext.Provider value={roster}>{children}</RosterContext.Provider>
}

export function useTeamRoster(teamId: string | null | undefined): EventTeamMember[] {
    const roster = useContext(RosterContext)

    if (!teamId) return []

    return (roster.get(teamId) ?? []).filter(member => member.status === 'active')
}

/** Wraps a rendered team name so hovering it lists the players on that team. */
export function TeamName({ teamId, className, children }: {
    teamId?: string | null
    className?: string
    children: ReactNode
}) {
    const members = useTeamRoster(teamId)

    if (members.length === 0) return <span className={className}>{children}</span>

    return (
        <Tooltip
            className="min-w-0 max-w-full"
            content={
                <div className="flex flex-col gap-1.5 font-normal tracking-normal py-0.5">
                    {members.map(member => (
                        <PlayerInfo
                            key={member.user}
                            userId={member.user}
                            alias={member.alias}
                            size="sm"
                            interactive={false}
                        />
                    ))}
                </div>
            }
        >
            <span className={cn('min-w-0 cursor-help', className)}>{children}</span>
        </Tooltip>
    )
}
