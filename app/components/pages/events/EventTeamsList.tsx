import { Users2 } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { EventTeam } from '@/app/utils/api'

interface EventTeamsListProps {
    teams: EventTeam[]
    teamSize: number
    loading: boolean
}

export function EventTeamsList({ teams, teamSize, loading }: EventTeamsListProps) {
    if (loading && teams.length === 0) {
        return <div className="py-10 text-center text-sm text-muted-foreground">Loading teams…</div>
    }

    if (teams.length === 0) {
        return (
            <div className="py-10 text-center text-sm text-muted-foreground">
                <Users2 className="size-8 mx-auto mb-2 opacity-40" />
                No teams signed up yet. Be the first!
            </div>
        )
    }

    const registered = teams.filter(team => team.status === 'registered')
    const pending = teams.filter(team => team.status !== 'registered')

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                {registered.length} registered{pending.length > 0 ? ` · ${pending.length} awaiting a full roster` : ''}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
                {[...registered, ...pending].map(team => (
                    <div key={team.id} className="p-3 rounded-xl bg-card/30 border border-hairline/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground truncate">{team.name}</h3>
                            {team.status !== 'registered' && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30">
                                    {team.member_count}/{teamSize}
                                </span>
                            )}
                            {team.division && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-accent-500/15 text-accent-300 border-accent-500/30">
                                    {team.division}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            {team.members.filter(member => member.status === 'active').map(member => (
                                <PlayerInfo key={member.user} userId={member.user} alias={member.alias} size="sm" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
